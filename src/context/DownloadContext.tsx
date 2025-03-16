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
 * Provider component for download state management
 */
export function DownloadProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);

  // Fetch queue data on mount and periodically
  const fetchQueue = async () => {
    try {
      setIsLoading(true);
      // Fetch both queue and stats in parallel for efficiency
      const [queueResponse, statsResponse] = await Promise.all([
        fetch("/api/queue"),
        fetch("/api/queue/stats")
      ]);
      
      if (!queueResponse.ok || !statsResponse.ok) {
        throw new Error("Failed to fetch queue data");
      }
      
      const queueData = await queueResponse.json();
      const statsData = await statsResponse.json();
      
      setQueue(queueData.queue || []);
      setStats(statsData.stats || null);
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
      const response = await fetch("/api/queue/status");
      
      if (!response.ok) {
        throw new Error("Failed to fetch queue status");
      }
      
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
    }, 1000); // Poll every second for more responsive updates
    
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
      const response = await fetch(`/api/queue/${id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Failed to remove item");
      }
      
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
      const response = await fetch(`/api/queue/${id}/stop`, {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error("Failed to stop download");
      }
      
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
      const response = await fetch(`/api/queue/${id}/retry`, {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error("Failed to retry download");
      }
      
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
      const response = await fetch(`/api/queue/${id}/prioritize`, {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error("Failed to prioritize download");
      }
      
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
      const response = await fetch("/api/queue/pause", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paused: !isPaused }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to toggle queue pause state");
      }
      
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
      const response = await fetch("/api/queue/clear", {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error("Failed to clear queue");
      }
      
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
      const response = await fetch("/api/queue", {
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
      
      if (!response.ok) {
        throw new Error("Failed to add download to queue");
      }
      
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
      const response = await fetch("/api/queue/batch", {
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
      
      if (!response.ok) {
        throw new Error("Failed to add batch downloads to queue");
      }
      
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