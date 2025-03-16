import React from 'react';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import Home from '@/app/page';

// Mock the components used in the page
jest.mock('@/components/DownloadForm', () => {
  return function MockDownloadForm({ onDownloadAdded }: { onDownloadAdded: any }) {
    return (
      <div data-testid="mock-download-form">
        <button onClick={() => onDownloadAdded({
          id: 'test-id',
          url: 'https://archive.org/details/test',
          destination: '/test/path',
          status: 'queued'
        })}>
          Add Download
        </button>
      </div>
    );
  };
});

jest.mock('@/components/DownloadQueue', () => {
  return function MockDownloadQueue({ initialItems }: { initialItems: any[] }) {
    return (
      <div data-testid="mock-download-queue">
        {initialItems.map((item) => (
          <div key={item.id} data-testid={`queue-item-${item.id}`}>
            {item.url}
          </div>
        ))}
      </div>
    );
  };
});

describe('Home Page', () => {
  it('renders the page title', () => {
    render(<Home />);
    expect(screen.getByText('Internet Archive Downloader')).toBeInTheDocument();
  });

  it('renders the DownloadForm component', () => {
    render(<Home />);
    expect(screen.getByTestId('mock-download-form')).toBeInTheDocument();
  });

  it('renders the DownloadQueue component', () => {
    render(<Home />);
    expect(screen.getByTestId('mock-download-queue')).toBeInTheDocument();
  });

  it('adds a download to the queue when onDownloadAdded is called', async () => {
    render(<Home />);
    
    // Initially, there should be no queue items
    expect(screen.queryByTestId('queue-item-test-id')).not.toBeInTheDocument();
    
    // Click the button to add a download
    await act(async () => {
      const addButton = screen.getByText('Add Download');
      addButton.click();
    });
    
    // Now there should be a queue item
    expect(screen.getByTestId('queue-item-test-id')).toBeInTheDocument();
    expect(screen.getByText('https://archive.org/details/test')).toBeInTheDocument();
  });
}); 