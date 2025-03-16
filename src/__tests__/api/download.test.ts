// Mock next/server
jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    url: string;
    method: string;
    private bodyContent: any;

    constructor(url: string, options: { method: string; body: string }) {
      this.url = url;
      this.method = options.method;
      this.bodyContent = JSON.parse(options.body);
    }

    async json() {
      return this.bodyContent;
    }
  },
  NextResponse: {
    json: (data: any, options: any = {}) => {
      return {
        status: options.status || 200,
        json: async () => data,
      };
    },
  },
}));

import { POST, GET } from '@/app/api/download/route';

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn(),
}));

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Download API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST endpoint', () => {
    it('validates request body', async () => {
      // Create request with invalid body
      const { NextRequest } = require('next/server');
      const request = new NextRequest('http://localhost:3000/api/download', {
        method: 'POST',
        body: JSON.stringify({ invalid: 'data' }),
      });

      // Call the POST handler
      const response = await POST(request);
      const data = await response.json();

      // Check response
      expect(response.status).toBe(400);
      expect(data.error).toBeTruthy();
    });

    it('handles valid download request', async () => {
      // Create request with valid body
      const { NextRequest } = require('next/server');
      const request = new NextRequest('http://localhost:3000/api/download', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://archive.org/details/example',
          destination: '/mnt/jellyfin/downloads',
        }),
      });

      // Call the POST handler
      const response = await POST(request);
      const data = await response.json();

      // Check response
      expect(response.status).toBe(200);
      expect(data.message).toBe('Download added to queue');
      expect(data.job).toBeDefined();
      expect(data.job.id).toBeDefined();
      expect(data.job.url).toBe('https://archive.org/details/example');
      expect(data.job.destination).toBe('/mnt/jellyfin/downloads');
      expect(data.job.status).toBe('queued');
    });
  });

  describe('GET endpoint', () => {
    it('returns the download queue', async () => {
      // Call the GET handler
      const response = await GET();
      const data = await response.json();

      // Check response
      expect(response.status).toBe(200);
      expect(data.queue).toBeDefined();
      expect(Array.isArray(data.queue)).toBe(true);
    });
  });
}); 