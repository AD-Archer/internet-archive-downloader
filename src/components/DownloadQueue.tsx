"use client";

import { useEffect, useState } from "react";

// Download queue item type
interface QueueItem {
  id: string;
  url: string;
  destination: string;
  status: "queued" | "downloading" | "completed" | "failed";
  progress: number;
  estimatedTime?: string;
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

  // Fetch queue data on mount
  useEffect(() => {
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

    fetchQueue();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchQueue, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Get status badge color
  const getStatusColor = (status: QueueItem["status"]) => {
    switch (status) {
      case "queued":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
      case "downloading":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
      case "completed":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      case "failed":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";
    }
  };

  // Get progress bar color
  const getProgressColor = (status: QueueItem["status"]) => {
    switch (status) {
      case "downloading":
        return "bg-blue-600 dark:bg-blue-500";
      case "completed":
        return "bg-green-600 dark:bg-green-500";
      case "failed":
        return "bg-red-600 dark:bg-red-500";
      default:
        return "bg-gray-600 dark:bg-gray-500";
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Download Queue</h2>
      </div>
      
      <div className="p-6">
        {isLoading && queue.length === 0 ? (
          <div className="flex justify-center items-center py-8">
            <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : queue.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="mt-2 text-sm">No downloads in queue</p>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((item) => (
              <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h3 className="font-medium truncate max-w-[70%] text-gray-900 dark:text-white">{item.url}</h3>
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${getStatusColor(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                
                <div className="p-4">
                  <div className="mb-2">
                    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(item.status)} rounded-full transition-all duration-300 ease-in-out`}
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {item.progress}% complete
                      </span>
                      {item.estimatedTime && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ETA: {item.estimatedTime}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-2 truncate">
                    Destination: {item.destination}
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