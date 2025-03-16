"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

// Download queue item type
interface QueueItem {
  id: string;
  url: string;
  destination: string;
  formats?: Record<string, boolean>;
  status: "queued" | "downloading" | "completed" | "failed";
  progress: number;
  estimatedTime?: string;
  error?: string;
}

// Props for the component
interface DownloadQueueProps {
  initialItems?: QueueItem[];
}

/**
 * Component for displaying the download queue
 */
export default function DownloadQueue({ initialItems = [] }: DownloadQueueProps) {
  const [queue, setQueue] = useState<QueueItem[]>(initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Fetch queue data on mount and periodically
  const fetchQueue = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/download");
      
      if (!response.ok) {
        throw new Error("Failed to fetch queue");
      }
      
      const data = await response.json();
      setQueue(data.queue || []);
    } catch (error) {
      console.error("Error fetching queue:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    
    // Poll for updates every 3 seconds
    const interval = setInterval(fetchQueue, 3000);
    
    return () => clearInterval(interval);
  }, []);

  // Add a new download to the queue
  const addDownload = (download: QueueItem) => {
    setQueue(prev => [download, ...prev]);
  };

  // Remove an item from the queue
  const removeItem = async (id: string) => {
    try {
      const response = await fetch(`/api/download/${id}`, {
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
      const response = await fetch(`/api/download/${id}/stop`, {
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

  // Clear the entire queue
  const clearQueue = async () => {
    try {
      setIsClearing(true);
      const response = await fetch("/api/download/clear", {
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

  // Get status color for display
  const getStatusColor = (status: QueueItem["status"]) => {
    switch (status) {
      case "queued":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      case "downloading":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  // Get progress bar color
  const getProgressColor = (status: QueueItem["status"]) => {
    switch (status) {
      case "downloading":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-300 dark:bg-gray-600";
    }
  };

  // Format the URL for display
  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      if (pathParts[0] === 'details' && pathParts[1]) {
        return pathParts[1];
      }
      
      return url;
    } catch {
      return url;
    }
  };

  // Format formats for display
  const formatFormats = (formats?: Record<string, boolean>) => {
    if (!formats) return "Default formats";
    
    const enabledFormats = Object.entries(formats)
      .filter(([_, enabled]) => enabled)
      .map(([format]) => format.toUpperCase());
    
    return enabledFormats.length > 0 
      ? enabledFormats.join(', ')
      : "No formats selected";
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Download Queue</h2>
        
        {queue.length > 0 && (
          <button
            onClick={clearQueue}
            disabled={isClearing}
            className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 
                     rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 
                     focus:ring-red-500 focus:ring-offset-2 dark:bg-red-900/30 dark:text-red-300 
                     dark:hover:bg-red-900/50 disabled:opacity-50"
          >
            {isClearing ? "Clearing..." : "Clear Queue"}
          </button>
        )}
      </div>
      
      <div className="p-6">
        {isLoading && queue.length === 0 ? (
          <div className="flex justify-center items-center py-8">
            <svg className="animate-spin h-8 w-8 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : queue.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No downloads in queue</p>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((item) => (
              <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="p-4">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{formatUrl(item.url)}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.destination}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Formats: {formatFormats(item.formats)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                      
                      {/* Action buttons */}
                      <div className="flex space-x-1">
                        {item.status === "downloading" && (
                          <button
                            onClick={() => stopDownload(item.id)}
                            className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 
                                     dark:hover:text-red-400 focus:outline-none"
                            title="Stop download"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                        
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 
                                   dark:hover:text-red-400 focus:outline-none"
                          title="Remove from queue"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {item.error && (
                    <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                      Error: {item.error}
                    </div>
                  )}
                  
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${getProgressColor(item.status)}`} 
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{item.progress}%</span>
                      {item.estimatedTime && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Est. time: {item.estimatedTime}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 