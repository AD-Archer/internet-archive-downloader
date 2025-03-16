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

// Path to data files
const queueFilePath = path.join(process.cwd(), "data", "queue.json");
const statusFilePath = path.join(process.cwd(), "data", "status.json");

/**
 * Fix corrupted JSON data
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
 * Read queue data to calculate stats
 */
const readQueue = async () => {
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
 * Read status data
 */
const readStatus = async () => {
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
 * Write status data
 */
const writeStatus = async (data: { isPaused: boolean }): Promise<boolean> => {
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(statusFilePath);
    if (!fs.existsSync(dataDir)) {
      await fs.promises.mkdir(dataDir, { recursive: true });
    }
    
    // Create a backup of the current file if it exists
    if (fs.existsSync(statusFilePath)) {
      const backupPath = `${statusFilePath}.backup`;
      await fs.promises.copyFile(statusFilePath, backupPath);
    }
    
    // Write the new data atomically by writing to a temp file first
    const tempFilePath = `${statusFilePath}.temp`;
    await fs.promises.writeFile(tempFilePath, JSON.stringify(data, null, 2));
    
    // Rename the temp file to the actual file (atomic operation)
    await fs.promises.rename(tempFilePath, statusFilePath);
    
    return true;
  } catch (error) {
    console.error("Error writing status data:", error);
    return false;
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
 * GET handler for retrieving status
 */
export async function GET(request: NextRequest) {
  try {
    // Read queue and status data
    const [queueData, statusData] = await Promise.all([
      readQueue(),
      readStatus()
    ]);
    
    // Calculate stats
    const stats = calculateStats(queueData.queue || []);
    
    return NextResponse.json({
      stats,
      isPaused: statusData.isPaused || false
    });
  } catch (error) {
    console.error("Error retrieving status:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server error" 
    }, { status: 500 });
  }
}

/**
 * POST handler for updating status
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (typeof data.isPaused !== 'boolean') {
      return NextResponse.json({ 
        success: false, 
        message: "Missing or invalid isPaused field" 
      }, { status: 400 });
    }
    
    // Read current status
    const currentStatus = await readStatus();
    
    // Update status
    const newStatus = {
      ...currentStatus,
      isPaused: data.isPaused
    };
    
    // Write updated status
    const success = await writeStatus(newStatus);
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: data.isPaused ? "Queue paused" : "Queue resumed",
        isPaused: data.isPaused
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: "Failed to update status" 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error updating status:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server error" 
    }, { status: 500 });
  }
} 