"use client";

import { useState, useEffect } from "react";
import axios from "axios";

// Type for queue item
type QueueItem = {
  id: string;
  url: string;
  downloadPath: string;
  fileTypes: string[];
  isPlaylist: boolean;
  status: "queued" | "downloading" | "completed" | "failed" | "canceled";
  progress: number;
  filesCompleted: number;
  totalFiles: number;
  timestamp: string;
  message?: string;
};

export default function DownloadQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch queue
  const fetchQueue = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.get("/api/queue");
      setQueue(response.data.queue || []);
    } catch (err) {
      console.error("Error fetching download queue:", err);
      setError("Failed to load download queue");
    } finally {
      setIsLoading(false);
    }
  };

  // Load queue on component mount and refresh periodically
  useEffect(() => {
    fetchQueue();
    
    // Refresh queue every 5 seconds to update progress
    const intervalId = setInterval(fetchQueue, 5000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Format timestamp
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Cancel a download
  const cancelDownload = async (id: string) => {
    try {
      await axios.post(`/api/queue/cancel`, { id });
      fetchQueue(); // Refresh queue after cancellation
    } catch (err) {
      console.error("Error canceling download:", err);
      setError("Failed to cancel download");
    }
  };

  // Remove a download from queue
  const removeFromQueue = async (id: string) => {
    try {
      await axios.delete(`/api/queue/${id}`);
      fetchQueue(); // Refresh queue after removal
    } catch (err) {
      console.error("Error removing from queue:", err);
      setError("Failed to remove from queue");
    }
  };

  // Clear entire queue
  const clearQueue = async () => {
    try {
      await axios.delete(`/api/queue`);
      fetchQueue(); // Refresh queue after clearing
    } catch (err) {
      console.error("Error clearing queue:", err);
      setError("Failed to clear queue");
    }
  };

  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch(status) {
      case 'completed':
        return 'status-badge status-completed';
      case 'failed':
        return 'status-badge status-failed';
      case 'downloading':
        return 'status-badge status-downloading';
      case 'canceled':
        return 'status-badge status-canceled';
      default:
        return 'status-badge status-queued';
    }
  };

  if (isLoading && queue.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-[var(--primary)] opacity-75 mb-4"></div>
          <p className="text-[var(--text-muted)]">Loading download queue...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--danger)] bg-opacity-10 p-6 rounded-lg text-[var(--danger)]">
        <p className="font-medium">{error}</p>
        <button 
          onClick={fetchQueue}
          className="mt-3 px-4 py-2 bg-[var(--danger)] bg-opacity-20 rounded-md hover:bg-opacity-30 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <p className="text-lg mb-2">Download queue is empty</p>
        <p className="text-sm">Add downloads to see them here</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold">Download Queue</h3>
        <div className="flex gap-3">
          <button 
            onClick={fetchQueue}
            className="px-4 py-2 bg-[var(--input-bg)] rounded-md hover:bg-opacity-80 transition-colors text-sm font-medium"
          >
            Refresh
          </button>
          <button 
            onClick={clearQueue}
            className="px-4 py-2 bg-[var(--danger)] text-white rounded-md hover:opacity-90 transition-colors text-sm font-medium"
          >
            Clear Queue
          </button>
        </div>
      </div>
      
      <div className="space-y-4">
        {queue.map((item) => (
          <div key={item.id} className="card p-4 hover:transform-none">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-medium truncate max-w-md">{item.url}</h4>
                <div className="flex gap-2 mt-1">
                  <span className={getStatusBadgeClass(item.status)}>
                    {item.status}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {formatDate(item.timestamp)}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {(item.status === 'queued' || item.status === 'downloading') && (
                  <button
                    onClick={() => cancelDownload(item.id)}
                    className="px-3 py-1 bg-[var(--warning)] text-black rounded-md text-xs font-medium"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => removeFromQueue(item.id)}
                  className="px-3 py-1 bg-[var(--danger)] text-white rounded-md text-xs font-medium"
                >
                  Remove
                </button>
              </div>
            </div>
            
            {/* File types */}
            <div className="flex flex-wrap gap-1 mb-3">
              {item.fileTypes.map(type => (
                <span key={type} className="inline-block px-2 py-1 bg-[var(--input-bg)] rounded text-xs">
                  {type}
                </span>
              ))}
            </div>
            
            {/* Progress bar */}
            <div className="mb-2">
              <div className="h-2 w-full bg-[var(--input-bg)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--primary)]" 
                  style={{ width: `${item.progress}%` }}
                ></div>
              </div>
            </div>
            
            {/* Progress details */}
            <div className="flex justify-between text-xs text-[var(--text-muted)]">
              <span>{item.progress.toFixed(1)}% complete</span>
              <span>
                {item.filesCompleted} of {item.totalFiles || '?'} files
              </span>
            </div>
            
            {/* Message */}
            {item.message && (
              <div className="mt-3 text-xs text-[var(--text-muted)] italic">
                {item.message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 