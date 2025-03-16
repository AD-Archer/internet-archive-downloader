"use client";

import { useState, useEffect } from "react";
import axios from "axios";

// Type for download history item
type DownloadItem = {
  id: string;
  url: string;
  downloadPath: string;
  fileTypes: string[];
  isPlaylist: boolean;
  status: "pending" | "completed" | "failed";
  timestamp: string;
  message?: string;
};

export default function DownloadHistory() {
  const [history, setHistory] = useState<DownloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch download history
  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.get("/api/history");
      setHistory(response.data.history || []);
    } catch (err) {
      console.error("Error fetching download history:", err);
      setError("Failed to load download history");
    } finally {
      setIsLoading(false);
    }
  };

  // Load history on component mount
  useEffect(() => {
    fetchHistory();
    
    // Refresh history every 30 seconds
    const intervalId = setInterval(fetchHistory, 30000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Format timestamp
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch(status) {
      case 'completed':
        return 'status-badge status-completed';
      case 'failed':
        return 'status-badge status-failed';
      default:
        return 'status-badge status-pending';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-[var(--primary)] opacity-75 mb-4"></div>
          <p className="text-[var(--text-muted)]">Loading download history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--danger)] bg-opacity-10 p-6 rounded-lg text-[var(--danger)]">
        <p className="font-medium">{error}</p>
        <button 
          onClick={fetchHistory}
          className="mt-3 px-4 py-2 bg-[var(--danger)] bg-opacity-20 rounded-md hover:bg-opacity-30 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <p className="text-lg mb-2">No download history available</p>
        <p className="text-sm">Your download history will appear here</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold">Download History</h3>
        <button 
          onClick={fetchHistory}
          className="px-4 py-2 bg-[var(--input-bg)] rounded-md hover:bg-opacity-80 transition-colors text-sm font-medium"
        >
          Refresh
        </button>
      </div>
      
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full">
          <thead className="bg-[var(--input-bg)]">
            <tr>
              <th className="px-6 py-4">URL</th>
              <th className="px-6 py-4">File Types</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id} className="border-t border-[var(--border)] hover:bg-[var(--input-bg)] hover:bg-opacity-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="truncate max-w-xs">{item.url}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {item.fileTypes.map(type => (
                      <span key={type} className="inline-block px-2 py-1 bg-[var(--input-bg)] rounded text-xs">
                        {type}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={getStatusBadgeClass(item.status)}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {formatDate(item.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 