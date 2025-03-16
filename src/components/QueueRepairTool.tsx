"use client";

import { useState } from "react";
import axios from "axios";

/**
 * Component for repairing corrupted queue files
 */
export default function QueueRepairTool() {
  const [isRepairing, setIsRepairing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    itemCount?: number;
  } | null>(null);

  // Handle repair queue
  const handleRepairQueue = async () => {
    try {
      setIsRepairing(true);
      setResult(null);
      
      const response = await axios.get("/api/queue/repair");
      
      setResult({
        success: response.data.success,
        message: response.data.message,
        itemCount: response.data.itemCount
      });
    } catch (error) {
      console.error("Error repairing queue:", error);
      
      let errorMessage = "Failed to repair queue";
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setResult({
        success: false,
        message: errorMessage
      });
    } finally {
      setIsRepairing(false);
    }
  };

  // Handle reset queue
  const handleResetQueue = async () => {
    if (!window.confirm("Are you sure you want to reset the queue? This will remove all items.")) {
      return;
    }
    
    try {
      setIsResetting(true);
      setResult(null);
      
      const response = await axios.post("/api/queue/repair");
      
      setResult({
        success: response.data.success,
        message: response.data.message
      });
      
      // Reload the page to refresh the queue
      window.location.reload();
    } catch (error) {
      console.error("Error resetting queue:", error);
      
      let errorMessage = "Failed to reset queue";
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setResult({
        success: false,
        message: errorMessage
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Queue Repair Tools</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Use these tools if you're experiencing issues with the download queue
        </p>
      </div>
      
      <div className="p-6 space-y-4">
        {/* Result message */}
        {result && (
          <div className={`p-4 rounded-lg ${result.success ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"}`}>
            <p>{result.message}</p>
            {result.itemCount !== undefined && (
              <p className="mt-1 text-sm">Items in queue: {result.itemCount}</p>
            )}
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Repair button */}
          <button
            onClick={handleRepairQueue}
            disabled={isRepairing || isResetting}
            className="px-4 py-2 font-medium rounded-md transition-colors
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     bg-blue-100 text-blue-800 hover:bg-blue-200
                     dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
          >
            {isRepairing ? "Repairing..." : "Repair Queue File"}
          </button>
          
          {/* Reset button */}
          <button
            onClick={handleResetQueue}
            disabled={isRepairing || isResetting}
            className="px-4 py-2 font-medium rounded-md transition-colors
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     bg-red-100 text-red-800 hover:bg-red-200
                     dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
          >
            {isResetting ? "Resetting..." : "Reset Queue (Clear All)"}
          </button>
        </div>
        
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          <p><strong>Repair Queue File:</strong> Attempts to fix a corrupted queue file without losing data.</p>
          <p className="mt-1"><strong>Reset Queue:</strong> Creates a new empty queue file. Use this as a last resort.</p>
        </div>
      </div>
    </div>
  );
} 