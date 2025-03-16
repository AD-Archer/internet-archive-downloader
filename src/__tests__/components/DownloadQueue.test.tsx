import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import DownloadQueue from '@/components/DownloadQueue';

// Mock the fetch API
global.fetch = jest.fn();

describe('DownloadQueue Component', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders loading state initially', () => {
    // Mock empty response
    (global.fetch as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ queue: [] })
      }), 100))
    );
    
    // Render component
    render(<DownloadQueue />);
    
    // Check loading state
    expect(screen.getByText(/loading queue/i)).toBeInTheDocument();
  });

  it('renders empty queue message when no downloads', async () => {
    // Mock empty queue response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ queue: [] })
    });
    
    // Render component
    let component;
    await act(async () => {
      component = render(<DownloadQueue />);
    });
    
    // Wait for fetch to complete
    await waitFor(() => {
      expect(screen.getByText(/no downloads in queue/i)).toBeInTheDocument();
    });
  });

  it('renders queue items correctly', async () => {
    // Mock queue response
    const mockQueue = [
      {
        id: '1',
        url: 'https://archive.org/details/example1',
        destination: '/path/to/download1',
        status: 'queued',
        progress: 0
      },
      {
        id: '2',
        url: 'https://archive.org/details/example2',
        destination: '/path/to/download2',
        status: 'downloading',
        progress: 50,
        estimatedTime: '2 minutes'
      },
      {
        id: '3',
        url: 'https://archive.org/details/example3',
        destination: '/path/to/download3',
        status: 'completed',
        progress: 100
      }
    ];
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ queue: mockQueue })
    });
    
    // Render component
    await act(async () => {
      render(<DownloadQueue />);
    });
    
    // Wait for fetch to complete and check if items are rendered
    await waitFor(() => {
      expect(screen.getByText('https://archive.org/details/example1')).toBeInTheDocument();
      expect(screen.getByText('https://archive.org/details/example2')).toBeInTheDocument();
      expect(screen.getByText('https://archive.org/details/example3')).toBeInTheDocument();
      
      // Check status badges
      expect(screen.getByText('queued')).toBeInTheDocument();
      expect(screen.getByText('downloading')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
      
      // Check progress
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
      
      // Check ETA
      expect(screen.getByText('ETA: 2 minutes')).toBeInTheDocument();
    });
  });

  it('uses initialItems when provided', () => {
    // Mock initial items
    const initialItems = [
      {
        id: 'initial1',
        url: 'https://archive.org/details/initial',
        destination: '/path/to/initial',
        status: 'queued' as const,
        progress: 0
      }
    ];
    
    // Render component with initial items
    render(<DownloadQueue initialItems={initialItems} />);
    
    // Check if initial item is rendered
    expect(screen.getByText('https://archive.org/details/initial')).toBeInTheDocument();
  });

  it('polls for updates', async () => {
    // Mock initial response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ queue: [] })
    });
    
    // Mock second response (after polling)
    const updatedQueue = [
      {
        id: 'new1',
        url: 'https://archive.org/details/new',
        destination: '/path/to/new',
        status: 'downloading',
        progress: 25
      }
    ];
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ queue: updatedQueue })
    });
    
    // Render component
    await act(async () => {
      render(<DownloadQueue />);
    });
    
    // Wait for first fetch to complete
    await waitFor(() => {
      expect(screen.getByText(/no downloads in queue/i)).toBeInTheDocument();
    });
    
    // Fast-forward time to trigger polling
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    
    // Wait for second fetch to complete
    await waitFor(() => {
      expect(screen.getByText('https://archive.org/details/new')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
    });
    
    // Verify fetch was called twice
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
}); 