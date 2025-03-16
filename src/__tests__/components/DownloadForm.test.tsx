import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import DownloadForm from '@/components/DownloadForm';

// Mock the fetch API
global.fetch = jest.fn();

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

describe('DownloadForm Component', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  it('renders the form correctly', () => {
    // Mock callback function
    const mockOnDownloadAdded = jest.fn();
    
    // Render component
    render(<DownloadForm onDownloadAdded={mockOnDownloadAdded} />);
    
    // Check if form elements are rendered
    expect(screen.getByLabelText(/internet archive url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/destination path/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to queue/i })).toBeInTheDocument();
  });

  it('validates URL input', async () => {
    // Mock callback function
    const mockOnDownloadAdded = jest.fn();
    
    // Render component
    render(<DownloadForm onDownloadAdded={mockOnDownloadAdded} />);
    
    // Get form elements
    const urlInput = screen.getByLabelText(/internet archive url/i);
    const submitButton = screen.getByRole('button', { name: /add to queue/i });
    
    // Enter invalid URL
    await act(async () => {
      await userEvent.type(urlInput, 'invalid-url');
      fireEvent.click(submitButton);
    });
    
    // Check for validation error
    await waitFor(() => {
      expect(screen.getByText(/please enter a valid internet archive url/i)).toBeInTheDocument();
    });
    
    // Verify fetch was not called
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('submits the form with valid data', async () => {
    // Mock successful API response
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        job: {
          id: '123',
          url: 'https://archive.org/details/example',
          destination: '/mnt/jellyfin/downloads',
          status: 'queued'
        }
      })
    };
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
    
    // Mock callback function
    const mockOnDownloadAdded = jest.fn();
    
    // Render component
    render(<DownloadForm onDownloadAdded={mockOnDownloadAdded} />);
    
    // Get form elements
    const urlInput = screen.getByLabelText(/internet archive url/i);
    const submitButton = screen.getByRole('button', { name: /add to queue/i });
    
    // Fill form with valid data and submit
    await act(async () => {
      await userEvent.type(urlInput, 'https://archive.org/details/example');
      fireEvent.click(submitButton);
    });
    
    // Verify fetch was called with correct data
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://archive.org/details/example',
          destination: '/mnt/jellyfin/downloads',
        }),
      });
    });
    
    // Verify callback was called with correct data
    expect(mockOnDownloadAdded).toHaveBeenCalledWith({
      id: '123',
      url: 'https://archive.org/details/example',
      destination: '/mnt/jellyfin/downloads',
      status: 'queued'
    });
  });

  it('handles API error', async () => {
    // Mock failed API response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
    });
    
    // Mock callback function
    const mockOnDownloadAdded = jest.fn();
    
    // Render component
    render(<DownloadForm onDownloadAdded={mockOnDownloadAdded} />);
    
    // Get form elements
    const urlInput = screen.getByLabelText(/internet archive url/i);
    const submitButton = screen.getByRole('button', { name: /add to queue/i });
    
    // Fill form with valid data and submit
    await act(async () => {
      await userEvent.type(urlInput, 'https://archive.org/details/example');
      fireEvent.click(submitButton);
    });
    
    // Verify error handling
    await waitFor(() => {
      const toast = require('react-hot-toast');
      expect(toast.error).toHaveBeenCalledWith('Failed to add download');
    });
    
    // Verify callback was not called
    expect(mockOnDownloadAdded).not.toHaveBeenCalled();
  });
}); 