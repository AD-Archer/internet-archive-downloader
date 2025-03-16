"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';

// Define the QueueItem type
export interface QueueItem {
  id: string;
  url: string;
  title?: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'fetching_metadata' | 'canceled';
  progress: number;
  fileProgress?: number;
  downloadSpeed?: string;
  estimatedTime?: string;
  totalSizeFormatted?: string;
  currentFile?: string;
  fileIndex?: number;
  totalFiles?: number;
  error?: string;
  message?: string;
  priority?: string;
  formats?: Record<string, boolean>;
  timestamp?: string;
}

// Define the stats type
interface QueueStats {
  total: number;
  queued: number;
  downloading: number;
  completed: number;
  failed: number;
  totalSizeFormatted: string;
}

// Define the context type
interface DownloadContextType {
  queue: QueueItem[];
  stats: QueueStats | null;
  isLoading: boolean;
  isClearing: boolean;
  isPaused: boolean;
  isTogglingPause: boolean;
  completedDownloads: QueueItem[];
  addToQueue: (url: string, formats?: Record<string, boolean>, isPlaylist?: boolean) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  stopDownload: (id: string) => Promise<void>;
  retryDownload: (id: string) => Promise<void>;
  prioritizeDownload: (id: string) => Promise<void>;
  toggleQueuePause: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

// Create the context with default values
const DownloadContext = createContext<DownloadContextType>({
  queue: [],
  stats: null,
  isLoading: false,
  isClearing: false,
  isPaused: false,
  isTogglingPause: false,
  completedDownloads: [],
  addToQueue: async () => {},
  removeItem: async () => {},
  stopDownload: async () => {},
  retryDownload: async () => {},
  prioritizeDownload: async () => {},
  toggleQueuePause: async () => {},
  clearQueue: async () => {},
});

// Provider props type
interface DownloadProviderProps {
  children: ReactNode;
}

// Create the provider component
export function DownloadProvider({ children }: DownloadProviderProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const [completedDownloads, setCompletedDownloads] = useState<QueueItem[]>([]);
  const [isUpdating, setIsUpdating] = useState(false); // Add state to track updates
  
  // API base URL
  const apiBaseUrl = '/api';
  
  // Request throttling
  const pendingRequestRef = useRef<boolean>(false);
  const requestQueueRef = useRef<(() => Promise<void>)[]>([]);
  
  // Process the request queue
  const processRequestQueue = useCallback(async () => {
    if (pendingRequestRef.current || requestQueueRef.current.length === 0) {
      return;
    }
    
    pendingRequestRef.current = true;
    
    try {
      // Get the next request from the queue
      const nextRequest = requestQueueRef.current.shift();
      if (nextRequest) {
        await nextRequest();
      }
    } finally {
      pendingRequestRef.current = false;
      
      // Process the next request after a small delay
      if (requestQueueRef.current.length > 0) {
        setTimeout(() => {
          processRequestQueue();
        }, 100);
      }
    }
  }, []);
  
  // Add a request to the queue
  const queueRequest = useCallback((request: () => Promise<void>) => {
    requestQueueRef.current.push(request);
    processRequestQueue();
  }, [processRequestQueue]);

  // Helper function to handle API errors
  const handleApiError = (error: unknown, message: string) => {
    console.error(`${message}:`, error);
    
    // Extract error message from response if available
    let errorMessage = 'An error occurred';
    
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    toast.error(errorMessage);
    
    return null;
  };

  // Calculate queue stats
  const calculateStats = (queueItems: QueueItem[]): QueueStats => {
    const total = queueItems.length;
    const queued = queueItems.filter(item => item.status === 'queued' || item.status === 'fetching_metadata').length;
    const downloading = queueItems.filter(item => item.status === 'downloading').length;
    const completed = queueItems.filter(item => item.status === 'completed').length;
    const failed = queueItems.filter(item => item.status === 'failed' || item.status === 'canceled').length;
    
    // Calculate total size (this would be more accurate with actual API data)
    let totalSize = 0;
    queueItems.forEach(item => {
      if (item.totalSizeFormatted) {
        const match = item.totalSizeFormatted.match(/(\d+(\.\d+)?)\s*(MB|GB)/i);
        if (match) {
          const size = parseFloat(match[1]);
          const unit = match[3].toUpperCase();
          totalSize += unit === 'GB' ? size * 1024 : size;
        }
      }
    });
    
    const totalSizeFormatted = totalSize > 1024 
      ? `${(totalSize / 1024).toFixed(2)} GB` 
      : `${totalSize.toFixed(2)} MB`;
    
    return {
      total,
      queued,
      downloading,
      completed,
      failed,
      totalSizeFormatted
    };
  };

  // Track consecutive failures
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [pollingInterval, setPollingInterval] = useState(10000); // Start with 10 seconds instead of 5
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [hasActiveDownloads, setHasActiveDownloads] = useState(false);
  const [lastPollTime, setLastPollTime] = useState(0);
  const [isPollingPaused, setIsPollingPaused] = useState(false);

  // Function to check if there are active downloads
  const checkForActiveDownloads = useCallback((queueItems: QueueItem[]) => {
    const active = queueItems.some(item => 
      item.status === 'downloading' || 
      item.status === 'queued' || 
      item.status === 'fetching_metadata'
    );
    setHasActiveDownloads(active);
    return active;
  }, []);

  // Batch API requests to reduce calls
  const fetchAllData = useCallback(async () => {
    try {
      // Make a single API call that returns all needed data
      // Add cache-control headers to leverage browser caching
      const response = await axios.get('/api/combined-data', {
        headers: {
          'Cache-Control': 'max-age=2',
          'Pragma': 'no-cache'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching combined data:', error);
      // Fallback to individual calls if combined endpoint doesn't exist
      return null;
    }
  }, []);

  // Fetch queue data with debounce protection
  const fetchQueueData = useCallback(async () => {
    if (isUpdating) return; // Prevent concurrent updates
    
    // Implement minimum time between polls (debounce)
    const now = Date.now();
    const timeSinceLastPoll = now - lastPollTime;
    
    // Enforce a minimum of 3 seconds between polls regardless of other settings
    if (timeSinceLastPoll < 3000) {
      return;
    }
    
    // Update last poll time
    setLastPollTime(now);
    
    // Queue the actual fetch operation
    queueRequest(async () => {
      try {
        setIsUpdating(true);
        
        // Try to use the combined endpoint first
        const combinedData = await fetchAllData();
        
        if (combinedData) {
          // Use the combined data
          setQueue(combinedData.queue || []);
          setStats(combinedData.stats || null);
          setIsPaused(combinedData.isPaused || false);
          setCompletedDownloads(combinedData.history || []);
          checkForActiveDownloads(combinedData.queue || []);
          setIsLoading(false);
          return;
        }
        
        // Fallback to individual API calls if combined endpoint failed
        // Use individual try/catch blocks for each API call to handle failures gracefully
        let queueData: QueueItem[] = [];
        let statusData: any = null;
        let historyData: any = null;
        
        try {
          const queueResponse = await axios.get('/api/queue');
          queueData = queueResponse.data?.queue || [];
        } catch (queueError) {
          console.error('Error fetching queue data:', queueError);
          // Don't show toast for queue errors to avoid spam
        }
        
        try {
          const statusResponse = await axios.get('/api/status');
          statusData = statusResponse.data;
        } catch (statusError) {
          console.error('Error fetching status data:', statusError);
          // Don't show toast for status errors to avoid spam
        }
        
        try {
          const historyResponse = await axios.get('/api/history');
          historyData = historyResponse.data;
        } catch (historyError) {
          console.error('Error fetching history data:', historyError);
          // Don't show toast for history errors to avoid spam
        }
        
        // Ensure all items have required properties
        const sanitizedQueue = queueData.map((item: QueueItem) => ({
          ...item,
          progress: typeof item.progress === 'number' ? item.progress : 0,
          status: item.status || 'queued',
          id: item.id || `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        }));
        
        setQueue(sanitizedQueue);
        checkForActiveDownloads(sanitizedQueue);
        
        if (statusData) {
          setStats(statusData.stats || calculateStats(sanitizedQueue));
          setIsPaused(statusData.isPaused || false);
        } else {
          setStats(calculateStats(sanitizedQueue));
        }
        
        if (historyData) {
          setCompletedDownloads(historyData.history || []);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error in fetchQueueData:', error);
        // Don't show toast here to avoid spam
        setIsLoading(false);
      } finally {
        setIsUpdating(false);
      }
    });
  }, [isUpdating, checkForActiveDownloads, fetchAllData, lastPollTime, queueRequest]);

  // Initialize on mount and set up polling with adaptive intervals
  useEffect(() => {
    // Function to fetch data and handle failures
    const fetchWithBackoff = async () => {
      // Skip if polling is paused
      if (isPollingPaused) return;
      
      try {
        await fetchQueueData();
        // Reset on success
        if (consecutiveFailures > 0) {
          setConsecutiveFailures(0);
          // Don't reset polling interval here, let the adaptive logic handle it
        }
      } catch (error) {
        // Increment failure count and increase backoff
        const newFailureCount = consecutiveFailures + 1;
        setConsecutiveFailures(newFailureCount);
        
        // Exponential backoff: 10s, 20s, 40s, 80s, max 120s
        const newInterval = Math.min(10000 * Math.pow(2, newFailureCount), 120000);
        setPollingInterval(newInterval);
        
        console.log(`Backing off polling to ${newInterval}ms after ${newFailureCount} failures`);
      }
    };
    
    // Initial fetch
    fetchWithBackoff();
    
    // Set up polling with current interval
    const intervalId = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;
      
      // Adjust polling interval based on activity and download status
      if (hasActiveDownloads) {
        // If there are active downloads, poll every 10 seconds
        if (pollingInterval !== 10000) {
          setPollingInterval(10000);
        }
      } else if (timeSinceLastActivity < 2 * 60 * 1000) {
        // If user was active in the last 2 minutes, poll every 20 seconds
        if (pollingInterval !== 20000) {
          setPollingInterval(20000);
        }
      } else if (timeSinceLastActivity < 10 * 60 * 1000) {
        // If user was active in the last 10 minutes, poll every 60 seconds
        if (pollingInterval !== 60000) {
          setPollingInterval(60000);
        }
      } else {
        // If user has been inactive for over 10 minutes, poll every 2 minutes
        if (pollingInterval !== 120000) {
          setPollingInterval(120000);
        }
      }
      
      fetchWithBackoff();
    }, pollingInterval);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [fetchQueueData, consecutiveFailures, pollingInterval, lastActivity, hasActiveDownloads, isPollingPaused]);

  // Track user activity with debounce
  useEffect(() => {
    let activityTimeout: NodeJS.Timeout;
    
    const updateLastActivity = () => {
      // Clear any existing timeout
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      
      // Set a timeout to update lastActivity after 500ms of inactivity
      activityTimeout = setTimeout(() => {
        setLastActivity(Date.now());
        
        // Trigger an immediate poll when user becomes active
        fetchQueueData();
        
        // Resume polling if it was paused
        if (isPollingPaused) {
          setIsPollingPaused(false);
        }
      }, 500);
    };
    
    // Add event listeners for user activity
    window.addEventListener('mousemove', updateLastActivity);
    window.addEventListener('keydown', updateLastActivity);
    window.addEventListener('click', updateLastActivity);
    window.addEventListener('scroll', updateLastActivity);
    window.addEventListener('touchstart', updateLastActivity);
    
    // Pause polling when tab is not visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPollingPaused(true);
      } else {
        setIsPollingPaused(false);
        setLastActivity(Date.now());
        fetchQueueData(); // Fetch immediately when tab becomes visible again
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      // Remove event listeners on cleanup
      window.removeEventListener('mousemove', updateLastActivity);
      window.removeEventListener('keydown', updateLastActivity);
      window.removeEventListener('click', updateLastActivity);
      window.removeEventListener('scroll', updateLastActivity);
      window.removeEventListener('touchstart', updateLastActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Clear any pending timeout
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
    };
  }, [fetchQueueData, isPollingPaused]);

  // Add to queue
  const addToQueue = async (url: string, formats?: Record<string, boolean>, isPlaylist?: boolean) => {
    try {
      // Convert formats to fileTypes array for API
      const fileTypes = formats ? 
        Object.entries(formats)
          .filter(([_, enabled]) => enabled)
          .map(([format]) => format) : 
        [];
      
      // Optimistic update - add a temporary item to the queue
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const tempItem: QueueItem = {
        id: tempId,
        url,
        status: 'queued',
        progress: 0,
        formats: formats || {},
        message: 'Adding to queue...',
        title: url.split('/').pop() || url
      };
      
      // Update queue with temporary item
      setQueue(prev => [...prev, tempItem]);
      
      // Call API to add to queue
      const response = await axios.post(`${apiBaseUrl}/queue`, {
        url,
        downloadPath: '/downloads', // Default download path
        fileTypes,
        isPlaylist: isPlaylist || false // Use provided value or default to false
      });
      
      if (response.data && response.data.success) {
        toast.success('Added to download queue');
        
        // Update lastActivity to trigger more frequent polling
        setLastActivity(Date.now());
        
        // No need to immediately fetch queue data - the polling will handle it
        // and we've already added an optimistic item
      } else {
        // Remove temporary item if failed
        setQueue(prev => prev.filter(item => item.id !== tempId));
        toast.error(response.data?.message || 'Failed to add to queue');
      }
    } catch (error) {
      handleApiError(error, 'Error adding to queue');
    }
  };

  // Remove item with error handling
  const removeItem = async (id: string) => {
    try {
      // Optimistic update
      const removedItem = queue.find(item => item.id === id);
      setQueue(prev => prev.filter(item => item.id !== id));
      
      // Call API to remove item
      const response = await axios.delete(`${apiBaseUrl}/queue/${id}`);
      
      if (response.data && response.data.success) {
        toast.success('Item removed from queue');
        
        // Update lastActivity
        setLastActivity(Date.now());
      } else {
        // Revert on failure
        if (removedItem) {
          setQueue(prev => [...prev, removedItem]);
        }
        toast.error(response.data?.message || 'Failed to remove item');
      }
    } catch (error) {
      // Check if error is because item is downloading
      if (axios.isAxiosError(error) && error.response?.status === 400 && error.response?.data?.message?.includes('Cannot remove an active download')) {
        toast.error('Cannot remove an active download. Stop it first.');
        
        // Revert optimistic update
        fetchQueueData();
      } else {
        handleApiError(error, 'Error removing item');
      }
    }
  };

  // Stop download
  const stopDownload = async (id: string) => {
    try {
      // Update local state immediately for better UX
      setQueue(prev => 
        prev.map(item => 
          item.id === id 
            ? { ...item, status: 'canceled', error: 'Download stopped by user' } 
            : item
        )
      );
      
      // Call API to cancel download
      const response = await axios.post(`${apiBaseUrl}/queue/cancel`, { id });
      
      if (response.data && response.data.success) {
        toast.success('Download stopped');
        
        // Update lastActivity
        setLastActivity(Date.now());
      } else {
        // Revert on failure
        fetchQueueData();
        toast.error(response.data?.message || 'Failed to stop download');
      }
    } catch (error) {
      handleApiError(error, 'Error stopping download');
      // Revert optimistic update
      fetchQueueData();
    }
  };

  // Retry download
  const retryDownload = async (id: string) => {
    try {
      // Update local state immediately for better UX
      setQueue(prev => 
        prev.map(item => 
          item.id === id 
            ? { ...item, status: 'queued', progress: 0, error: undefined, message: 'Queued for retry' } 
            : item
        )
      );
      
      // Call API to update item status
      const response = await axios.patch(`${apiBaseUrl}/queue/${id}`, {
        status: 'queued',
        progress: 0,
        error: undefined,
        message: 'Queued for retry'
      });
      
      if (response.data && response.data.success) {
        toast.success('Download queued for retry');
        
        // Update lastActivity and active downloads
        setLastActivity(Date.now());
        setHasActiveDownloads(true);
      } else {
        // Revert on failure
        fetchQueueData();
        toast.error(response.data?.message || 'Failed to retry download');
      }
    } catch (error) {
      handleApiError(error, 'Error retrying download');
      // Revert optimistic update
      fetchQueueData();
    }
  };

  // Prioritize download
  const prioritizeDownload = async (id: string) => {
    try {
      // Find the item to prioritize
      const item = queue.find(i => i.id === id);
      if (!item) {
        toast.error('Item not found');
        return;
      }
      
      // Update local state immediately for better UX
      setQueue(prev => {
        const newQueue = prev.filter(i => i.id !== id);
        return [{ ...item, priority: 'high' }, ...newQueue];
      });
      
      // Call API to update item priority
      const response = await axios.patch(`${apiBaseUrl}/queue/${id}`, {
        priority: 'high'
      });
      
      if (response.data && response.data.success) {
        toast.success('Download prioritized');
        
        // Update lastActivity
        setLastActivity(Date.now());
      } else {
        // Revert on failure
        fetchQueueData();
        toast.error(response.data?.message || 'Failed to prioritize download');
      }
    } catch (error) {
      handleApiError(error, 'Error prioritizing download');
      // Revert optimistic update
      fetchQueueData();
    }
  };

  // Toggle queue pause
  const toggleQueuePause = async () => {
    try {
      setIsTogglingPause(true);
      
      // Optimistic update
      setIsPaused(prev => !prev);
      
      // Call API to toggle pause state
      const response = await axios.post(`${apiBaseUrl}/status`, {
        isPaused: !isPaused
      });
      
      if (response.data && response.data.success) {
        toast.success(isPaused ? 'Queue resumed' : 'Queue paused');
        
        // Update lastActivity
        setLastActivity(Date.now());
      } else {
        // Revert on failure
        setIsPaused(prev => !prev);
        toast.error(response.data?.message || 'Failed to toggle queue state');
      }
    } catch (error) {
      // Revert optimistic update
      setIsPaused(prev => !prev);
      handleApiError(error, 'Error toggling queue pause');
    } finally {
      setIsTogglingPause(false);
    }
  };

  // Clear queue
  const clearQueue = async () => {
    try {
      setIsClearing(true);
      
      // Optimistic update - keep only downloading items
      const downloadingItems = queue.filter(item => item.status === 'downloading');
      setQueue(downloadingItems);
      
      // Call API to clear queue
      const response = await axios.delete(`${apiBaseUrl}/queue`);
      
      if (response.data && response.data.success) {
        toast.success('Queue cleared');
        
        // Update lastActivity
        setLastActivity(Date.now());
      } else {
        // Revert on failure
        fetchQueueData();
        toast.error(response.data?.message || 'Failed to clear queue');
      }
    } catch (error) {
      handleApiError(error, 'Error clearing queue');
      // Revert optimistic update
      fetchQueueData();
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <DownloadContext.Provider
      value={{
        queue,
        stats,
        isLoading,
        isClearing,
        isPaused,
        isTogglingPause,
        completedDownloads,
        addToQueue,
        removeItem,
        stopDownload,
        retryDownload,
        prioritizeDownload,
        toggleQueuePause,
        clearQueue
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
}

// Custom hook to use the download context
export function useDownload() {
  return useContext(DownloadContext);
} 