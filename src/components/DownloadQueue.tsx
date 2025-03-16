"use client";

import { useDownload, QueueItem } from "@/context/DownloadContext";
import { useState, useCallback, memo } from "react";

/**
 * Component for displaying the download queue
 */
export default function DownloadQueue() {
  // Use the download context
  const {
    queue,
    stats,
    isLoading,
    isClearing,
    isPaused,
    isTogglingPause,
    removeItem,
    stopDownload,
    retryDownload,
    prioritizeDownload,
    toggleQueuePause,
    clearQueue
  } = useDownload();

  // Local error state
  const [error, setError] = useState<string | null>(null);

  // Status color mapping
  const getStatusColor = useCallback((status: QueueItem["status"]) => {
    switch (status) {
      case "queued":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
      case "downloading":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300";
      case "fetching_metadata":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  }, []);

  // Progress color mapping
  const getProgressColor = useCallback((status: QueueItem["status"]) => {
    switch (status) {
      case "downloading":
        return "bg-green-500";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      case "fetching_metadata":
        return "bg-purple-500";
      default:
        return "bg-blue-500";
    }
  }, []);

  // Priority color mapping
  const getPriorityColor = useCallback((priority?: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300";
      case "low":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  }, []);

  // Format URL for display
  const formatUrl = useCallback((url: string, title?: string) => {
    if (title) {
      return title;
    }
    
    try {
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split('/');
      const identifier = parts[parts.length - 1] || parts[parts.length - 2];
      
      return identifier || url;
    } catch (e) {
      return url;
    }
  }, []);

  // Format formats for display
  const formatFormats = useCallback((formats?: Record<string, boolean>) => {
    if (!formats) return "All formats";
    
    const enabledFormats = Object.entries(formats)
      .filter(([_, enabled]) => enabled)
      .map(([format]) => format.toUpperCase());
    
    return enabledFormats.length > 0 
      ? enabledFormats.join(", ") 
      : "All formats";
  }, []);

  // Safe action handlers with error catching
  const handleRemoveItem = useCallback((id: string) => {
    try {
      removeItem(id);
    } catch (err) {
      console.error("Error removing item:", err);
      setError("Failed to remove item. Please try again.");
    }
  }, [removeItem]);

  const handleStopDownload = useCallback((id: string) => {
    try {
      stopDownload(id);
    } catch (err) {
      console.error("Error stopping download:", err);
      setError("Failed to stop download. Please try again.");
    }
  }, [stopDownload]);

  const handleRetryDownload = useCallback((id: string) => {
    try {
      retryDownload(id);
    } catch (err) {
      console.error("Error retrying download:", err);
      setError("Failed to retry download. Please try again.");
    }
  }, [retryDownload]);

  const handlePrioritizeDownload = useCallback((id: string) => {
    try {
      prioritizeDownload(id);
    } catch (err) {
      console.error("Error prioritizing download:", err);
      setError("Failed to prioritize download. Please try again.");
    }
  }, [prioritizeDownload]);

  const handleToggleQueuePause = useCallback(() => {
    try {
      toggleQueuePause();
    } catch (err) {
      console.error("Error toggling queue pause:", err);
      setError("Failed to pause/resume queue. Please try again.");
    }
  }, [toggleQueuePause]);

  const handleClearQueue = useCallback(() => {
    try {
      clearQueue();
    } catch (err) {
      console.error("Error clearing queue:", err);
      setError("Failed to clear queue. Please try again.");
    }
  }, [clearQueue]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Download Queue</h2>
        
        <div className="flex space-x-2">
          <button
            onClick={handleToggleQueuePause}
            disabled={isTogglingPause}
            className="px-3 py-1 text-sm font-medium rounded-md transition-colors
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     bg-blue-100 text-blue-800 hover:bg-blue-200
                     dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
          >
            {isPaused ? "Resume Queue" : "Pause Queue"}
          </button>
          
          <button
            onClick={handleClearQueue}
            disabled={isClearing || queue.length === 0}
            className="px-3 py-1 text-sm font-medium rounded-md transition-colors
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     bg-red-100 text-red-800 hover:bg-red-200
                     dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
          >
            Clear Queue
          </button>
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 border-b border-red-200 dark:border-red-800">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setError(null)}
                  className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Queue stats */}
      {stats && (
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 border-b border-gray-200 dark:border-gray-600 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total:</span>{" "}
            <span className="font-medium text-gray-900 dark:text-white">{stats.total}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Queued:</span>{" "}
            <span className="font-medium text-gray-900 dark:text-white">{stats.queued}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Downloading:</span>{" "}
            <span className="font-medium text-gray-900 dark:text-white">{stats.downloading}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Completed:</span>{" "}
            <span className="font-medium text-gray-900 dark:text-white">{stats.completed}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Size:</span>{" "}
            <span className="font-medium text-gray-900 dark:text-white">{stats.totalSizeFormatted}</span>
          </div>
        </div>
      )}
      
      {/* Queue items */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {isLoading && queue.length === 0 ? (
          <div className="p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mb-2"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading queue...</p>
          </div>
        ) : queue.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400">No downloads in queue</p>
          </div>
        ) : (
          queue.map((item: QueueItem) => (
            <QueueItemComponent 
              key={item.id} 
              item={item}
              getStatusColor={getStatusColor}
              getProgressColor={getProgressColor}
              getPriorityColor={getPriorityColor}
              formatUrl={formatUrl}
              formatFormats={formatFormats}
              onRemove={handleRemoveItem}
              onStop={handleStopDownload}
              onRetry={handleRetryDownload}
              onPrioritize={handlePrioritizeDownload}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Memoized queue item component for better performance
const QueueItemComponent = memo(({
  item,
  getStatusColor,
  getProgressColor,
  getPriorityColor,
  formatUrl,
  formatFormats,
  onRemove,
  onStop,
  onRetry,
  onPrioritize
}: {
  item: QueueItem;
  getStatusColor: (status: QueueItem["status"]) => string;
  getProgressColor: (status: QueueItem["status"]) => string;
  getPriorityColor: (priority?: string) => string;
  formatUrl: (url: string, title?: string) => string;
  formatFormats: (formats?: Record<string, boolean>) => string;
  onRemove: (id: string) => void;
  onStop: (id: string) => void;
  onRetry: (id: string) => void;
  onPrioritize: (id: string) => void;
}) => {
  // Safely handle progress value
  const progressValue = typeof item.progress === 'number' && !isNaN(item.progress) 
    ? Math.min(Math.max(item.progress, 0), 100) 
    : 0;
  
  // Safely handle file progress value
  const fileProgressValue = typeof item.fileProgress === 'number' && !isNaN(item.fileProgress)
    ? Math.min(Math.max(item.fileProgress, 0), 100)
    : undefined;
  
  return (
    <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate" title={item.url}>
            {formatUrl(item.url, item.title)}
          </h3>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
              {item.status.replace('_', ' ')}
            </span>
            
            {item.priority && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(item.priority)}`}>
                {item.priority}
              </span>
            )}
            
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
              {formatFormats(item.formats)}
            </span>
          </div>
        </div>
        
        <div className="flex mt-2 md:mt-0 space-x-2">
          {item.status === "downloading" && (
            <button
              onClick={() => onStop(item.id)}
              className="px-2 py-1 text-xs font-medium rounded
                       bg-red-100 text-red-800 hover:bg-red-200
                       dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30
                       focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
            >
              Stop
            </button>
          )}
          
          {item.status === "failed" && (
            <button
              onClick={() => onRetry(item.id)}
              className="px-2 py-1 text-xs font-medium rounded
                       bg-blue-100 text-blue-800 hover:bg-blue-200
                       dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Retry
            </button>
          )}
          
          {(item.status === "queued" || item.status === "fetching_metadata") && (
            <button
              onClick={() => onPrioritize(item.id)}
              className="px-2 py-1 text-xs font-medium rounded
                       bg-purple-100 text-purple-800 hover:bg-purple-200
                       dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/30
                       focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
            >
              Prioritize
            </button>
          )}
          
          <button
            onClick={() => onRemove(item.id)}
            className="px-2 py-1 text-xs font-medium rounded
                     bg-gray-100 text-gray-800 hover:bg-gray-200
                     dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600
                     focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mt-2">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div 
            className={`h-2.5 rounded-full ${getProgressColor(item.status)}`} 
            style={{ width: `${progressValue}%` }}
          ></div>
        </div>
        
        <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <div>
            {progressValue.toFixed(1)}%
            {item.downloadSpeed && ` • ${item.downloadSpeed}`}
          </div>
          <div>
            {item.estimatedTime && `${item.estimatedTime} remaining`}
            {item.totalSizeFormatted && ` • ${item.totalSizeFormatted}`}
          </div>
        </div>
        
        {item.currentFile && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
            {item.fileIndex !== undefined && item.totalFiles !== undefined && (
              <span className="font-medium">{`File ${item.fileIndex + 1}/${item.totalFiles}: `}</span>
            )}
            {item.currentFile}
            {fileProgressValue !== undefined && (
              <span className="ml-1 font-medium">{`(${fileProgressValue.toFixed(1)}%)`}</span>
            )}
          </div>
        )}
        
        {item.error && (
          <div className="mt-1 text-xs text-red-500 truncate" title={item.error}>
            Error: {item.error}
          </div>
        )}
        
        {item.message && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate" title={item.message}>
            {item.message}
          </div>
        )}
      </div>
    </div>
  );
}); 