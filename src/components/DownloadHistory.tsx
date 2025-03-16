"use client";

import { useState, useCallback } from "react";
import { useDownload, QueueItem } from "@/context/DownloadContext";

/**
 * Component for displaying download history
 */
export default function DownloadHistory() {
  // Use the download context
  const { completedDownloads, isLoading } = useDownload();
  const [error, setError] = useState<string | null>(null);

  // Format date for display
  const formatDate = useCallback((timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      console.error("Error fetching history");
      setError("Failed to load history. Please try again.");
      return "Unknown date";
    }
  }, []);

  // Format URL for display
  const formatUrl = useCallback((url: string) => {
    try {
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split('/');
      const identifier = parts[parts.length - 1] || parts[parts.length - 2];
      return identifier || url;
    } catch (e) {
      return url;
    }
  }, []);

  // Status color mapping
  const getStatusColor = useCallback((status: QueueItem["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-primary opacity-75 mb-4"></div>
          <p className="text-muted-foreground">Loading download history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-600 dark:text-red-400">
        <p className="text-lg mb-2">Error loading download history</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!completedDownloads || completedDownloads.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg mb-2">No download history available</p>
        <p className="text-sm">Your completed downloads will appear here</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold">Download History</h3>
      </div>
      
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-4 text-left">URL</th>
              <th className="px-6 py-4 text-left">Title</th>
              <th className="px-6 py-4 text-left">Status</th>
              <th className="px-6 py-4 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {completedDownloads.map((item) => (
              <tr key={item.id} className="border-t hover:bg-muted/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="truncate max-w-xs" title={item.url}>
                    {formatUrl(item.url)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="truncate max-w-xs">{item.title || "Unknown"}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(item.status)}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {item.timestamp ? formatDate(item.timestamp) : "Unknown"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 