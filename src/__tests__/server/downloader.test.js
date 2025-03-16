/**
 * Tests for the downloader utility
 */

// Mock dependencies
jest.mock('axios');
jest.mock('fs');
jest.mock('child_process');

// Import the module under test
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { spawn } = require('child_process');

// Mock the spawn implementation
const mockSpawn = {
  stdout: {
    on: jest.fn(),
  },
  stderr: {
    on: jest.fn(),
  },
  on: jest.fn(),
};

spawn.mockReturnValue(mockSpawn);

// We need to mock the module before importing it
jest.mock('../../server/downloader', () => {
  // Get the original module
  const originalModule = jest.requireActual('../../server/downloader');
  
  // Return a modified version for testing
  return {
    ...originalModule,
    // Export internal functions for testing
    parseArchiveUrl: originalModule.parseArchiveUrl,
    getArchiveMetadata: originalModule.getArchiveMetadata,
    downloadWithWget: originalModule.downloadWithWget,
    processDownload: originalModule.processDownload,
  };
}, { virtual: true });

// Now import the module
const { 
  parseArchiveUrl,
  getArchiveMetadata,
  downloadWithWget,
  processDownload
} = require('../../server/downloader');

describe('Downloader Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('parseArchiveUrl', () => {
    it('extracts identifier from valid URL', () => {
      const url = 'https://archive.org/details/example-identifier';
      const result = parseArchiveUrl(url);
      expect(result).toBe('example-identifier');
    });
    
    it('returns null for invalid URL', () => {
      const url = 'invalid-url';
      const result = parseArchiveUrl(url);
      expect(result).toBeNull();
    });
    
    it('returns null for URL without identifier', () => {
      const url = 'https://archive.org/details/';
      const result = parseArchiveUrl(url);
      expect(result).toBeNull();
    });
  });
  
  describe('getArchiveMetadata', () => {
    it('fetches metadata for valid identifier', async () => {
      // Mock axios response
      const mockMetadata = {
        data: {
          metadata: {
            identifier: 'example-identifier',
            title: 'Example Title',
          },
          files: [
            { name: 'file1.mp4', size: '1000000' },
            { name: 'file2.mp3', size: '500000' },
          ],
        },
      };
      
      axios.get.mockResolvedValue(mockMetadata);
      
      const result = await getArchiveMetadata('example-identifier');
      
      expect(axios.get).toHaveBeenCalledWith(
        'https://archive.org/metadata/example-identifier'
      );
      expect(result).toEqual(mockMetadata.data);
    });
    
    it('handles errors gracefully', async () => {
      // Mock axios error
      axios.get.mockRejectedValue(new Error('Network error'));
      
      await expect(getArchiveMetadata('example-identifier')).rejects.toThrow();
    });
  });
  
  describe('downloadWithWget', () => {
    it('spawns wget process with correct parameters', async () => {
      // Setup mock event handlers
      mockSpawn.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          // Simulate progress output
          callback(Buffer.from('50% [=======>      ] 500,000   1.5MB/s eta 2m'));
        }
        return mockSpawn.stdout;
      });
      
      mockSpawn.stderr.on.mockImplementation((event, callback) => {
        return mockSpawn.stderr;
      });
      
      mockSpawn.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          // Simulate successful download
          callback(0);
        }
        return mockSpawn;
      });
      
      const url = 'https://archive.org/download/example/file.mp4';
      const destination = '/path/to/download';
      
      const downloadPromise = downloadWithWget(url, destination);
      
      // Resolve the promise
      await downloadPromise;
      
      // Check if wget was called with correct parameters
      expect(spawn).toHaveBeenCalledWith('wget', [
        url,
        '-O', destination,
        '--progress=dot:mega'
      ]);
    });
  });
  
  describe('processDownload', () => {
    it('processes download for valid URL', async () => {
      // Mock dependencies
      const mockMetadata = {
        metadata: {
          identifier: 'example-identifier',
          title: 'Example Title',
        },
        files: [
          { name: 'file1.mp4', size: '1000000', source: 'original' },
          { name: 'file2.mp3', size: '500000', source: 'original' },
        ],
      };
      
      axios.get.mockResolvedValue({ data: mockMetadata });
      
      // Mock successful download
      mockSpawn.stdout.on.mockImplementation((event, callback) => {
        return mockSpawn.stdout;
      });
      
      mockSpawn.stderr.on.mockImplementation((event, callback) => {
        return mockSpawn.stderr;
      });
      
      mockSpawn.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          callback(0);
        }
        return mockSpawn;
      });
      
      const url = 'https://archive.org/details/example-identifier';
      const destination = '/path/to/download';
      
      await processDownload(url, destination);
      
      // Verify axios was called to get metadata
      expect(axios.get).toHaveBeenCalledWith(
        'https://archive.org/metadata/example-identifier'
      );
      
      // Verify wget was called for each file
      expect(spawn).toHaveBeenCalledTimes(2);
    });
  });
}); 