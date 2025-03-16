import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Queue item type definition
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
  processId?: number;
};

// History item type definition
type HistoryItem = {
  id: string;
  url: string;
  title?: string;
  status: "completed" | "failed" | "canceled";
  timestamp: string;
  completedAt?: string;
  fileCount?: number;
  totalSize?: string;
  downloadPath?: string;
};

// Status type definition
type StatusData = {
  isPaused: boolean;
};

// Combined data type
type CombinedData = {
  queue: QueueItem[];
  history: HistoryItem[];
  stats: {
    total: number;
    queued: number;
    downloading: number;
    completed: number;
    failed: number;
    totalSizeFormatted: string;
  };
  isPaused: boolean;
};

// Path to data files
const queueFilePath = path.join(process.cwd(), "data", "queue.json");
const historyFilePath = path.join(process.cwd(), "data", "history.json");
const statusFilePath = path.join(process.cwd(), "data", "status.json");

// Cache implementation
let dataCache: CombinedData | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 2000; // Cache time-to-live in milliseconds (2 seconds)

// File modification timestamps
let queueLastModified = 0;
let historyLastModified = 0;
let statusLastModified = 0;

/**
 * Check if files have been modified since last cache
 */
const filesModifiedSinceCache = async (): Promise<boolean> => {
  try {
    // Check if files exist
    const queueExists = fs.existsSync(queueFilePath);
    const historyExists = fs.existsSync(historyFilePath);
    const statusExists = fs.existsSync(statusFilePath);
    
    // Get current modification times
    const queueMtime = queueExists ? (await fs.promises.stat(queueFilePath)).mtimeMs : 0;
    const historyMtime = historyExists ? (await fs.promises.stat(historyFilePath)).mtimeMs : 0;
    const statusMtime = statusExists ? (await fs.promises.stat(statusFilePath)).mtimeMs : 0;
    
    // Check if any file has been modified
    const modified = queueMtime > queueLastModified || 
                     historyMtime > historyLastModified || 
                     statusMtime > statusLastModified;
    
    // Update stored timestamps
    queueLastModified = queueMtime;
    historyLastModified = historyMtime;
    statusLastModified = statusMtime;
    
    return modified;
  } catch (error) {
    console.error("Error checking file modifications:", error);
    return true; // Assume modified on error
  }
};

/**
 * Attempts to fix corrupted JSON data
 * @param data The potentially corrupted JSON string
 * @param defaultValue Default value to return if parsing fails
 * @returns A valid JSON object or default value
 */
const fixCorruptedJson = <T>(data: string, defaultValue: T): T => {
  try {
    // First try normal parsing
    return JSON.parse(data);
  } catch (error) {
    console.error("JSON parse error, attempting to fix:", error);
    
    try {
      // Try to fix common JSON corruption issues
      
      // 1. Remove any trailing commas before closing brackets
      let fixedData = data.replace(/,\s*([\]}])/g, '$1');
      
      // 2. Add missing closing brackets if needed
      const openBraces = (data.match(/\{/g) || []).length;
      const closeBraces = (data.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        fixedData = fixedData + '}'.repeat(openBraces - closeBraces);
      }
      
      // 3. Add missing closing square brackets if needed
      const openBrackets = (data.match(/\[/g) || []).length;
      const closeBrackets = (data.match(/\]/g) || []).length;
      if (openBrackets > closeBrackets) {
        fixedData = fixedData + ']'.repeat(openBrackets - closeBrackets);
      }
      
      // Try parsing the fixed data
      return JSON.parse(fixedData);
    } catch (fixError) {
      console.error("Failed to fix JSON, returning default value:", fixError);
      
      // If all else fails, return the default value
      return defaultValue;
    }
  }
};

/**
 * Read queue data from file
 */
const readQueue = async (): Promise<{ queue: QueueItem[] }> => {
  try {
    if (!fs.existsSync(queueFilePath)) {
      return { queue: [] };
    }
    
    const data = await fs.promises.readFile(queueFilePath, "utf-8");
    return fixCorruptedJson(data, { queue: [] });
  } catch (error) {
    console.error("Error reading queue data:", error);
    return { queue: [] };
  }
};

/**
 * Read history data from file
 */
const readHistory = async (): Promise<{ history: HistoryItem[] }> => {
  try {
    if (!fs.existsSync(historyFilePath)) {
      return { history: [] };
    }
    
    const data = await fs.promises.readFile(historyFilePath, "utf-8");
    return fixCorruptedJson(data, { history: [] });
  } catch (error) {
    console.error("Error reading history data:", error);
    return { history: [] };
  }
};

/**
 * Read status data from file
 */
const readStatus = async (): Promise<StatusData> => {
  try {
    if (!fs.existsSync(statusFilePath)) {
      return { isPaused: false };
    }
    
    const data = await fs.promises.readFile(statusFilePath, "utf-8");
    return fixCorruptedJson(data, { isPaused: false });
  } catch (error) {
    console.error("Error reading status data:", error);
    return { isPaused: false };
  }
};

/**
 * Calculate stats from queue data
 */
const calculateStats = (queueItems: QueueItem[]) => {
  const total = queueItems.length;
  const queued = queueItems.filter(item => item.status === 'queued').length;
  const downloading = queueItems.filter(item => item.status === 'downloading').length;
  const completed = queueItems.filter(item => item.status === 'completed').length;
  const failed = queueItems.filter(item => item.status === 'failed' || item.status === 'canceled').length;
  
  // Calculate total size (placeholder implementation)
  const totalSizeFormatted = "0 MB";
  
  return {
    total,
    queued,
    downloading,
    completed,
    failed,
    totalSizeFormatted
  };
};

/**
 * GET handler for retrieving combined data
 * This endpoint combines queue, history, and status data to reduce API calls
 */
export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    const cacheAge = now - lastCacheTime;
    
    // Check if we can use the cache
    if (dataCache && cacheAge < CACHE_TTL) {
      // Check if any files have been modified since last cache
      const filesModified = await filesModifiedSinceCache();
      
      // If files haven't been modified and cache is still fresh, return cached data
      if (!filesModified) {
        // Add cache headers
        const headers = new Headers();
        headers.set('Cache-Control', 'private, max-age=2');
        headers.set('X-Cache', 'HIT');
        
        return NextResponse.json(dataCache, { headers });
      }
    }
    
    // Cache miss or expired, fetch fresh data
    const [queueData, historyData, statusData] = await Promise.all([
      readQueue(),
      readHistory(),
      readStatus()
    ]);
    
    // Calculate stats from queue data
    const stats = calculateStats(queueData.queue);
    
    // Create combined data
    const combinedData: CombinedData = {
      queue: queueData.queue,
      history: historyData.history,
      stats,
      isPaused: statusData.isPaused
    };
    
    // Update cache
    dataCache = combinedData;
    lastCacheTime = now;
    
    // Add cache headers
    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=2');
    headers.set('X-Cache', 'MISS');
    
    // Return combined data
    return NextResponse.json(combinedData, { headers });
  } catch (error) {
    console.error("Error retrieving combined data:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server error" 
    }, { status: 500 });
  }
} 