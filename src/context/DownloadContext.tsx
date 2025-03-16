"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
  
  // API base URL
  const apiBaseUrl = '/api';

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
    const totalSizeFormatted = '0 MB'; // Placeholder
    
    return {
      total,
      queued,
      downloading,
      completed,
      failed,
      totalSizeFormatted
    };
  };

  // Fetch queue data
  const fetchQueue = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${apiBaseUrl}/queue`);
      
      if (response.data && Array.isArray(response.data.queue)) {
        // Transform API data to match our QueueItem interface if needed
        const transformedQueue = response.data.queue.map((item: any) => ({
          id: item.id,
          url: item.url,
          title: item.title || undefined,
          status: item.status,
          progress: item.progress || 0,
          fileProgress: item.fileProgress,
          downloadSpeed: item.downloadSpeed,
          estimatedTime: item.estimatedTime,
          totalSizeFormatted: item.totalSizeFormatted,
          currentFile: item.currentFile,
          fileIndex: item.fileIndex,
          totalFiles: item.totalFiles,
          error: item.error,
          message: item.message,
          priority: item.priority,
          formats: item.formats
        }));
        
        setQueue(transformedQueue);
        setStats(calculateStats(transformedQueue));
      } else {
        // If API returns unexpected format, use empty queue
        setQueue([]);
        setStats({
          total: 0,
          queued: 0,
          downloading: 0,
          completed: 0,
          failed: 0,
          totalSizeFormatted: '0 MB'
        });
      }
    } catch (error) {
      console.error('Error fetching queue:', error);
      toast.error('Failed to load download queue');
      
      // Set empty queue on error
      setQueue([]);
      setStats({
        total: 0,
        queued: 0,
        downloading: 0,
        completed: 0,
        failed: 0,
        totalSizeFormatted: '0 MB'
      });
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  // Initialize on mount and set up polling
  useEffect(() => {
    // Initial fetch
    fetchQueue();
    
    // Set up polling to keep queue updated
    const intervalId = setInterval(() => {
      fetchQueue();
    }, 3000); // Poll every 3 seconds
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [fetchQueue]);

  // Add to queue
  const addToQueue = async (url: string, formats?: Record<string, boolean>, isPlaylist?: boolean) => {
    try {
      // Convert formats to fileTypes array for API
      const fileTypes = formats ? 
        Object.entries(formats)
          .filter(([_, enabled]) => enabled)
          .map(([format]) => format) : 
        [];
      
      // Call API to add to queue
      const response = await axios.post(`${apiBaseUrl}/queue`, {
        url,
        downloadPath: '/downloads', // Default download path
        fileTypes,
        isPlaylist: isPlaylist || false // Use provided value or default to false
      });
      
      if (response.data && response.data.success) {
        toast.success('Added to download queue');
        
        // Refresh queue to get updated data
        fetchQueue();
      } else {
        toast.error(response.data?.message || 'Failed to add to queue');
      }
    } catch (error) {
      handleApiError(error, 'Error adding to queue');
    }
  };

  // Remove item
  const removeItem = async (id: string) => {
    try {
      // Call API to remove item
      const response = await axios.delete(`${apiBaseUrl}/queue/${id}`);
      
      if (response.data && response.data.success) {
        // Update local state immediately for better UX
        setQueue(prev => prev.filter(item => item.id !== id));
        setStats(prev => prev ? calculateStats(queue.filter(item => item.id !== id)) : null);
        
        toast.success('Item removed from queue');
      } else {
        toast.error(response.data?.message || 'Failed to remove item');
      }
    } catch (error) {
      // Check if error is because item is downloading
      if (axios.isAxiosError(error) && error.response?.status === 400 && error.response?.data?.message?.includes('Cannot remove an active download')) {
        toast.error('Cannot remove an active download. Stop it first.');
      } else {
        handleApiError(error, 'Error removing item');
      }
    }
  };

  // Stop download
  const stopDownload = async (id: string) => {
    try {
      // Call API to cancel download
      const response = await axios.post(`${apiBaseUrl}/queue/cancel`, { id });
      
      if (response.data && response.data.success) {
        // Update local state immediately for better UX
        setQueue(prev => 
          prev.map(item => 
            item.id === id 
              ? { ...item, status: 'canceled', error: 'Download stopped by user' } 
              : item
          )
        );
        
        toast.success('Download stopped');
        
        // Refresh queue to get updated data
        fetchQueue();
      } else {
        toast.error(response.data?.message || 'Failed to stop download');
      }
    } catch (error) {
      handleApiError(error, 'Error stopping download');
    }
  };

  // Retry download
  const retryDownload = async (id: string) => {
    try {
      // Call API to update item status
      const response = await axios.patch(`${apiBaseUrl}/queue/${id}`, {
        status: 'queued',
        progress: 0,
        error: undefined,
        message: 'Queued for retry'
      });
      
      if (response.data && response.data.success) {
        // Update local state immediately for better UX
        setQueue(prev => 
          prev.map(item => 
            item.id === id 
              ? { ...item, status: 'queued', progress: 0, error: undefined, message: 'Queued for retry' } 
              : item
          )
        );
        
        toast.success('Download queued for retry');
        
        // Refresh queue to get updated data
        fetchQueue();
      } else {
        toast.error(response.data?.message || 'Failed to retry download');
      }
    } catch (error) {
      handleApiError(error, 'Error retrying download');
    }
  };

  // Prioritize download
  const prioritizeDownload = async (id: string) => {
    try {
      // Call API to update item priority
      const response = await axios.patch(`${apiBaseUrl}/queue/${id}`, {
        priority: 'high'
      });
      
      if (response.data && response.data.success) {
        // Update local state immediately for better UX
        setQueue(prev => {
          const item = prev.find(i => i.id === id);
          if (!item) return prev;
          
          const newQueue = prev.filter(i => i.id !== id);
          return [{ ...item, priority: 'high' }, ...newQueue];
        });
        
        toast.success('Download prioritized');
        
        // Refresh queue to get updated data
        fetchQueue();
      } else {
        toast.error(response.data?.message || 'Failed to prioritize download');
      }
    } catch (error) {
      handleApiError(error, 'Error prioritizing download');
    }
  };

  // Toggle queue pause
  const toggleQueuePause = async () => {
    try {
      setIsTogglingPause(true);
      
      // This would be replaced with actual API call
      // For now, just simulate the toggle
      setTimeout(() => {
        setIsPaused(prev => !prev);
        setIsTogglingPause(false);
        toast.success(isPaused ? 'Queue resumed' : 'Queue paused');
      }, 500);
    } catch (error) {
      handleApiError(error, 'Error toggling queue pause');
      setIsTogglingPause(false);
    }
  };

  // Clear queue
  const clearQueue = async () => {
    try {
      setIsClearing(true);
      
      // Call API to clear queue
      const response = await axios.delete(`${apiBaseUrl}/queue`);
      
      if (response.data && response.data.success) {
        // Refresh queue to get updated data
        await fetchQueue();
        toast.success('Queue cleared');
      } else {
        toast.error(response.data?.message || 'Failed to clear queue');
      }
    } catch (error) {
      handleApiError(error, 'Error clearing queue');
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