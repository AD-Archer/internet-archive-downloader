"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import toast from 'react-hot-toast';

// Download queue item type
export interface QueueItem {
  id: string;
  url: string;
  destination: string;
  formats?: Record<string, boolean>;
  status: "queued" | "downloading" | "completed" | "failed" | "fetching_metadata";
  progress: number;
  fileProgress?: number;
  currentFile?: string;
  fileIndex?: number;
  totalFiles?: number;
  totalSize?: number;
  totalSizeFormatted?: string;
  estimatedTime?: string;
  downloadSpeed?: string;
  error?: string;
  priority?: "high" | "normal" | "low";
  title?: string;
  message?: string;
}

// Queue stats type
export interface QueueStats {
  total: number;
  queued: number;
  downloading: number;
  completed: number;
  failed: number;
  totalSize: number;
  totalSizeFormatted: string;
}

// Form data type
export interface DownloadFormData {
  url: string;
  destination: string;
  formats: Record<string, boolean>;
  priority: "high" | "normal" | "low";
  searchQuery?: string;
  isBatchDownload: boolean;
}

// Context interface
interface DownloadContextType {
  queue: QueueItem[];
  stats: QueueStats | null;
  isLoading: boolean;
  isClearing: boolean;
  isPaused: boolean;
  isTogglingPause: boolean;
  addDownload: (download: QueueItem) => void;
  removeItem: (id: string) => Promise<void>;
  stopDownload: (id: string) => Promise<void>;
  retryDownload: (id: string) => Promise<void>;
  prioritizeDownload: (id: string) => Promise<void>;
  toggleQueuePause: () => Promise<void>;
  clearQueue: () => Promise<void>;
  submitDownload: (data: DownloadFormData) => Promise<void>;
  submitBatchDownload: (selectedItems: string[], formData: DownloadFormData) => Promise<void>;
}

// Create context with default values
const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

/**
 * Helper function to fetch with retry logic
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param retries - Number of retries
 * @param backoff - Backoff time in ms
 */
const fetchWithRetry = async (
  url: string, 
  options: RequestInit = {}, 
  retries = 3, 
  backoff = 300
): Promise<Response> => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response;
  } catch (error) {
    if (retries <= 1) throw error;
    
    // Wait for backoff time
    await new Promise(resolve => setTimeout(resolve, backoff));
    
    // Retry with exponential backoff
    return fetchWithRetry(url, options, retries - 1, backoff * 2);
  }
};

/**
 * Provider component for download state management
 */
export function DownloadProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);

  // API base URL from environment variable or fallback to relative path
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';

  // Fetch queue data on mount and periodically
  const fetchQueue = async () => {
    try {
      setIsLoading(true);
      // Fetch both queue and stats in parallel for efficiency
      const [queueResponse, statsResponse] = await Promise.allSettled([
        fetchWithRetry(`${apiBaseUrl}/queue`),
        fetchWithRetry(`${apiBaseUrl}/queue/stats`)
      ]);
      
      // Handle responses based on their status
      if (queueResponse.status === 'fulfilled' && statsResponse.status === 'fulfilled') {
        const queueData = await queueResponse.value.json();
        const statsData = await statsResponse.value.json();
        
        setQueue(queueData.queue || []);
        setStats(statsData.stats || null);
      } else {
        // At least one request failed
        throw new Error("Failed to fetch queue data");
      }
    } catch (error) {
      console.error("Error fetching queue:", error);
      // Don't set isLoading to false on error if we already have queue items
      // This prevents flickering when there are temporary network issues
      if (queue.length === 0) {
        setIsLoading(false);
      }
    } finally {
      // Only set loading to false on success or if queue is empty
      if (isLoading) {
        setIsLoading(false);
      }
    }
  };

  // Fetch queue pause status
  const fetchQueueStatus = async () => {
    try {
      const response = await fetchWithRetry(`${apiBaseUrl}/queue/status`);
      const data = await response.json();
      setIsPaused(data.paused || false);
    } catch (error) {
      console.error("Error fetching queue status:", error);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchQueue();
    fetchQueueStatus();
    
    // Set up more frequent polling for active downloads
    const pollInterval = setInterval(() => {
      fetchQueue();
    }, 2000); // Poll every 2 seconds for more responsive updates
    
    // Set up less frequent polling for queue status
    const statusInterval = setInterval(() => {
      fetchQueueStatus();
    }, 5000); // Poll status every 5 seconds
    
    // Clean up intervals on unmount
    return () => {
      clearInterval(pollInterval);
      clearInterval(statusInterval);
    };
  }, []);

  // Add a new download to the queue
  const addDownload = (download: QueueItem) => {
    setQueue(prev => [download, ...prev]);
  };

  // Remove an item from the queue
  const removeItem = async (id: string) => {
    try {
      const response = await fetchWithRetry(`${apiBaseUrl}/queue/${id}`, {
        method: "DELETE",
      });
      
      // Update local state
      setQueue(prev => prev.filter(item => item.id !== id));
      toast.success("Item removed from queue");
    } catch (error) {
      console.error("Error removing item:", error);
      toast.error("Failed to remove item");
    }
  };

  // Stop a download
  const stopDownload = async (id: string) => {
    try {
      await fetchWithRetry(`${apiBaseUrl}/queue/${id}/stop`, {
        method: "POST",
      });
      
      // Refresh queue
      fetchQueue();
      toast.success("Download stopped");
    } catch (error) {
      console.error("Error stopping download:", error);
      toast.error("Failed to stop download");
    }
  };

  // Retry a failed download
  const retryDownload = async (id: string) => {
    try {
      await fetchWithRetry(`${apiBaseUrl}/queue/${id}/retry`, {
        method: "POST",
      });
      
      // Refresh queue
      fetchQueue();
      toast.success("Download queued for retry");
    } catch (error) {
      console.error("Error retrying download:", error);
      toast.error("Failed to retry download");
    }
  };

  // Prioritize a download
  const prioritizeDownload = async (id: string) => {
    try {
      await fetchWithRetry(`${apiBaseUrl}/queue/${id}/prioritize`, {
        method: "POST",
      });
      
      // Refresh queue
      fetchQueue();
      toast.success("Download prioritized");
    } catch (error) {
      console.error("Error prioritizing download:", error);
      toast.error("Failed to prioritize download");
    }
  };

  // Toggle queue pause state
  const toggleQueuePause = async () => {
    try {
      setIsTogglingPause(true);
      await fetchWithRetry(`${apiBaseUrl}/queue/pause`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paused: !isPaused }),
      });
      
      setIsPaused(!isPaused);
      toast.success(isPaused ? "Queue resumed" : "Queue paused");
    } catch (error) {
      console.error("Error toggling queue pause state:", error);
      toast.error("Failed to toggle queue pause state");
    } finally {
      setIsTogglingPause(false);
    }
  };

  // Clear the entire queue
  const clearQueue = async () => {
    try {
      setIsClearing(true);
      await fetchWithRetry(`${apiBaseUrl}/queue/clear`, {
        method: "POST",
      });
      
      setQueue([]);
      toast.success("Queue cleared");
    } catch (error) {
      console.error("Error clearing queue:", error);
      toast.error("Failed to clear queue");
    } finally {
      setIsClearing(false);
    }
  };

  // Submit a single download
  const submitDownload = async (data: DownloadFormData) => {
    try {
      // Submit to API
      const response = await fetchWithRetry(`${apiBaseUrl}/queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: data.url,
          destination: data.destination,
          formats: data.formats,
          priority: data.priority,
        }),
      });
      
      const result = await response.json();
      
      // Add to queue
      addDownload(result.job);
      
      toast.success("Download added to queue");
      return result.job;
    } catch (error) {
      console.error("Error adding download:", error);
      toast.error("Failed to add download");
      throw error;
    }
  };

  // Submit batch downloads
  const submitBatchDownload = async (selectedItems: string[], formData: DownloadFormData) => {
    try {
      const response = await fetchWithRetry(`${apiBaseUrl}/queue/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: selectedItems.map(id => ({ identifier: id })),
          destination: formData.destination,
          formats: formData.formats,
          priority: formData.priority,
        }),
      });
      
      const result = await response.json();
      
      // Add each job to the queue
      if (result.jobs && Array.isArray(result.jobs)) {
        result.jobs.forEach((job: QueueItem) => {
          addDownload(job);
        });
      }
      
      toast.success(`Added ${result.jobs.length} downloads to queue`);
      return result.jobs;
    } catch (error) {
      console.error("Error adding batch downloads:", error);
      toast.error("Failed to add batch downloads");
      throw error;
    }
  };

  // Context value
  const value = {
    queue,
    stats,
    isLoading,
    isClearing,
    isPaused,
    isTogglingPause,
    addDownload,
    removeItem,
    stopDownload,
    retryDownload,
    prioritizeDownload,
    toggleQueuePause,
    clearQueue,
    submitDownload,
    submitBatchDownload
  };

  return (
    <DownloadContext.Provider value={value}>
      {children}
    </DownloadContext.Provider>
  );
}

/**
 * Custom hook to use the download context
 */
export function useDownload() {
  const context = useContext(DownloadContext);
  if (context === undefined) {
    throw new Error('useDownload must be used within a DownloadProvider');
  }
  return context;
} 