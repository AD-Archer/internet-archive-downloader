import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

// Convert exec to Promise-based
const execAsync = promisify(exec);

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
  status: "queued" | "downloading" | "completed" | "failed" | "canceled";
  timestamp: string;
  completedAt: string;
  fileCount: number;
  downloadPath: string;
};

// Path to queue data file
const queueFilePath = path.join(process.cwd(), "data", "queue.json");
const historyFilePath = path.join(process.cwd(), "data", "history.json");

/**
 * Attempts to fix corrupted JSON data
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

// Read queue data from file
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

// Write queue data to file with backup
const writeQueue = async (data: { queue: QueueItem[] }): Promise<boolean> => {
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(queueFilePath);
    if (!fs.existsSync(dataDir)) {
      await fs.promises.mkdir(dataDir, { recursive: true });
    }
    
    // Create a backup of the current file if it exists
    if (fs.existsSync(queueFilePath)) {
      const backupPath = `${queueFilePath}.backup`;
      await fs.promises.copyFile(queueFilePath, backupPath);
    }
    
    // Write the new data atomically by writing to a temp file first
    const tempFilePath = `${queueFilePath}.temp`;
    await fs.promises.writeFile(tempFilePath, JSON.stringify(data, null, 2));
    
    // Rename the temp file to the actual file (atomic operation)
    await fs.promises.rename(tempFilePath, queueFilePath);
    
    return true;
  } catch (error) {
    console.error("Error writing queue data:", error);
    return false;
  }
};

// Add to history
const addToHistory = async (item: QueueItem): Promise<boolean> => {
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(historyFilePath);
    if (!fs.existsSync(dataDir)) {
      await fs.promises.mkdir(dataDir, { recursive: true });
    }
    
    // Read existing history
    let historyData: { history: HistoryItem[] } = { history: [] };
    if (fs.existsSync(historyFilePath)) {
      const data = await fs.promises.readFile(historyFilePath, "utf-8");
      historyData = fixCorruptedJson(data, { history: [] });
    }
    
    // Add item to history
    historyData.history.unshift({
      id: item.id,
      url: item.url,
      status: item.status,
      timestamp: item.timestamp,
      completedAt: new Date().toISOString(),
      fileCount: item.totalFiles,
      downloadPath: item.downloadPath,
    });
    
    // Limit history size
    if (historyData.history.length > 100) {
      historyData.history = historyData.history.slice(0, 100);
    }
    
    // Write history
    await fs.promises.writeFile(historyFilePath, JSON.stringify(historyData, null, 2));
    
    return true;
  } catch (error) {
    console.error("Error adding to history:", error);
    return false;
  }
};

// Update queue item
const updateQueueItem = async (id: string, updates: Partial<QueueItem>): Promise<boolean> => {
  try {
    const queueData = await readQueue();
    const queue = queueData.queue || [];
    
    const itemIndex = queue.findIndex(item => item.id === id);
    if (itemIndex === -1) {
      return false;
    }
    
    // Update the item
    queue[itemIndex] = { ...queue[itemIndex], ...updates };
    
    // Write updated queue
    return await writeQueue({ queue });
  } catch (error) {
    console.error("Error updating queue item:", error);
    return false;
  }
};

// Process a download
const processDownload = async (item: QueueItem): Promise<void> => {
  try {
    // Update status to downloading
    await updateQueueItem(item.id, { 
      status: "downloading", 
      message: "Starting download..." 
    });
    
    // Create download directory
    const itemDownloadPath: string = item.downloadPath || path.join(process.cwd(), "downloads");
    if (!fs.existsSync(itemDownloadPath)) {
      await fs.promises.mkdir(itemDownloadPath, { recursive: true });
    }
    
    // Build file type filter
    const fileTypeFilter = item.fileTypes.length > 0 
      ? item.fileTypes.map(type => `--format *${type}`).join(" ") 
      : "--format best";
    
    // Build playlist flag
    const playlistFlag = item.isPlaylist ? "--yes-playlist" : "--no-playlist";
    
    // Determine which download tool to use
    let downloadTool = "youtube-dl";
    try {
      await execAsync("which yt-dlp");
      downloadTool = "yt-dlp";
    } catch {
      // Fallback to youtube-dl
      try {
        await execAsync("which youtube-dl");
      } catch {
        throw new Error("Neither yt-dlp nor youtube-dl is installed");
      }
    }
    
    // Build command
    const downloadCommand = `cd "${itemDownloadPath}" && ${downloadTool} ${playlistFlag} ${fileTypeFilter} --write-info-json "${item.url}"`;
    console.log(`Executing command: ${downloadCommand}`);
    
    // Execute command
    const childProcess = exec(downloadCommand);
    const processId = childProcess.pid;
    
    // Update with process ID
    await updateQueueItem(item.id, { 
      processId, 
      message: "Download in progress..." 
    });
    
    // Handle output
    let progress = 0;
    let filesCompleted = 0;
    let totalFiles = item.isPlaylist ? 0 : 1;
    
    childProcess.stdout?.on("data", async (data: Buffer) => {
      const output = data.toString();
      console.log(`Download output: ${output}`);
      
      // Parse progress
      const progressMatch = output.match(/(\d+(\.\d+)?)%/);
      if (progressMatch) {
        progress = parseFloat(progressMatch[1]);
        await updateQueueItem(item.id, { 
          progress, 
          message: `Downloading: ${progress.toFixed(1)}%` 
        });
      }
      
      // Parse playlist info
      const playlistMatch = output.match(/Downloading (\d+) of (\d+)/);
      if (playlistMatch) {
        filesCompleted = parseInt(playlistMatch[1], 10) - 1;
        totalFiles = parseInt(playlistMatch[2], 10);
        await updateQueueItem(item.id, { 
          filesCompleted, 
          totalFiles,
          message: `Downloading file ${filesCompleted + 1} of ${totalFiles}` 
        });
      }
    });
    
    // Handle errors
    childProcess.stderr?.on("data", async (data: Buffer) => {
      const error = data.toString();
      console.error(`Download error: ${error}`);
      
      // Only update if it's a real error (some tools use stderr for info)
      if (error.includes("ERROR") || error.includes("Error")) {
        await updateQueueItem(item.id, { 
          message: `Error: ${error.substring(0, 100)}${error.length > 100 ? '...' : ''}` 
        });
      }
    });
    
    // Handle completion
    childProcess.on("exit", async (code: number) => {
      console.log(`Download process exited with code ${code}`);
      
      if (code === 0) {
        // Success
        await updateQueueItem(item.id, { 
          status: "completed", 
          progress: 100,
          filesCompleted: totalFiles,
          message: "Download completed successfully" 
        });
        
        // Add to history
        await addToHistory({
          ...item,
          status: "completed",
          progress: 100,
          filesCompleted: totalFiles,
          totalFiles
        });
      } else {
        // Failure
        await updateQueueItem(item.id, { 
          status: "failed", 
          message: `Download failed with exit code ${code}` 
        });
        
        // Add to history
        await addToHistory({
          ...item,
          status: "failed",
          progress: progress,
          filesCompleted: filesCompleted,
          totalFiles
        });
      }
      
      // Process next item
      processNextQueueItem();
    });
  } catch (error) {
    console.error(`Error processing download: ${error}`);
    
    // Update item status
    await updateQueueItem(item.id, { 
      status: "failed", 
      message: `Error: ${error instanceof Error ? error.message : String(error)}` 
    });
    
    // Process next item
    processNextQueueItem();
  }
};

// Process next queue item
const processNextQueueItem = async (): Promise<void> => {
  try {
    // Read queue
    const queueData = await readQueue();
    const queue = queueData.queue || [];
    
    // Check if there are any active downloads
    const activeDownloads = queue.filter(item => item.status === "downloading");
    if (activeDownloads.length > 0) {
      console.log(`${activeDownloads.length} active downloads, waiting...`);
      return;
    }
    
    // Find next queued item
    const nextItem = queue.find(item => item.status === "queued");
    if (!nextItem) {
      console.log("No items in queue");
      return;
    }
    
    // Process the item
    console.log(`Processing queue item: ${nextItem.id}`);
    await processDownload(nextItem);
  } catch (error) {
    console.error(`Error processing queue: ${error}`);
  }
};

// GET handler to start processing the queue
export async function GET() {
  try {
    // Start processing in the background
    processNextQueueItem();
    
    return NextResponse.json({ 
      success: true, 
      message: "Queue processing started" 
    });
  } catch (error) {
    console.error("Error starting queue processing:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to start queue processing" 
    }, { status: 500 });
  }
} 