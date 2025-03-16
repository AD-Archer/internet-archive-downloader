import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import axios from "axios";

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

// Path to queue data file
const queueFilePath = path.join(process.cwd(), "data", "queue.json");

// Read queue data from file
const readQueue = async (): Promise<{ queue: QueueItem[] }> => {
  try {
    if (!fs.existsSync(queueFilePath)) {
      return { queue: [] };
    }
    
    const data = await fs.promises.readFile(queueFilePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading queue data:", error);
    return { queue: [] };
  }
};

// Write queue data to file
const writeQueue = async (data: { queue: QueueItem[] }): Promise<boolean> => {
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(queueFilePath);
    if (!fs.existsSync(dataDir)) {
      await fs.promises.mkdir(dataDir, { recursive: true });
    }
    
    await fs.promises.writeFile(queueFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Error writing queue data:", error);
    return false;
  }
};

// Validate URL is from Internet Archive
const isValidArchiveUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === "archive.org" || urlObj.hostname.endsWith(".archive.org");
  } catch (e) {
    return false;
  }
};

// Sanitize file path to prevent command injection
const sanitizePath = (filePath: string): string => {
  // Remove any characters that could be used for command injection
  const sanitized = filePath.replace(/[;&|`$(){}[\]<>]/g, "");
  
  // Get default download path from environment variable or use a fallback
  const defaultPath = process.env.DEFAULT_DOWNLOAD_PATH || path.join(process.cwd(), "downloads");
  
  // If path is root or empty, use the default path
  if (sanitized === "/" || !sanitized) {
    return defaultPath;
  }
  
  // Ensure path is absolute
  return path.isAbsolute(sanitized) ? sanitized : path.join(defaultPath, sanitized);
};

// Sanitize file types
const sanitizeFileTypes = (fileTypes: string[]): string[] => {
  const allowedTypes = ["mp4", "mkv", "avi", "mov", "webm", "mp3", "flac", "pdf"];
  return fileTypes.filter(type => allowedTypes.includes(type));
};

// Update queue item with progress
const updateQueueItemProgress = async (id: string, progress: number, filesCompleted: number, totalFiles: number, message?: string) => {
  const queueData = await readQueue();
  const queue = queueData.queue || [];
  
  const itemIndex = queue.findIndex(item => item.id === id);
  
  if (itemIndex !== -1) {
    queue[itemIndex].progress = progress;
    queue[itemIndex].filesCompleted = filesCompleted;
    queue[itemIndex].totalFiles = totalFiles;
    
    if (message) {
      queue[itemIndex].message = message;
    }
    
    await writeQueue({ queue });
  }
};

// Process the next item in the queue
const processNextQueueItem = async () => {
  const queueData = await readQueue();
  const queue = queueData.queue || [];
  
  // Find the next queued item
  const nextItem = queue.find(item => item.status === "queued");
  
  if (!nextItem) {
    return; // No items to process
  }
  
  // Update status to downloading
  const itemIndex = queue.findIndex(item => item.id === nextItem.id);
  queue[itemIndex].status = "downloading";
  queue[itemIndex].message = "Download started";
  await writeQueue({ queue });
  
  // Start the download
  try {
    // Create download directory if it doesn't exist
    const sanitizedPath = sanitizePath(nextItem.downloadPath);
    await fs.promises.mkdir(sanitizedPath, { recursive: true });
    
    // Build the download command
    const fileTypeFilter = sanitizeFileTypes(nextItem.fileTypes).map(type => `*.${type}`).join(" -o ");
    const playlistFlag = nextItem.isPlaylist ? "--yes-playlist" : "--no-playlist";
    
    // Check if yt-dlp is available, otherwise use youtube-dl
    let downloadTool = "youtube-dl";
    try {
      await execAsync("which yt-dlp");
      downloadTool = "yt-dlp";
    } catch (error) {
      // Fallback to youtube-dl
    }
    
    // Add progress tracking
    const command = `cd ${sanitizedPath} && ${downloadTool} ${playlistFlag} -o "%(title)s.%(ext)s" -f "bestvideo[ext=${nextItem.fileTypes.join('|ext=')}]+bestaudio/best[ext=${nextItem.fileTypes.join('|ext=')}]" --newline --progress ${nextItem.url}`;
    
    // Execute the command
    const childProcess = exec(command);
    const processId = childProcess.pid;
    
    // Store process ID for potential cancellation
    queue[itemIndex].processId = processId;
    await writeQueue({ queue });
    
    let filesCompleted = 0;
    let totalFiles = nextItem.isPlaylist ? 0 : 1;
    let currentProgress = 0;
    
    // Parse output to track progress
    childProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      
      // Check if this is a playlist and we're getting the total count
      if (output.includes('Downloading video') && output.includes('of')) {
        const match = output.match(/Downloading video (\d+) of (\d+)/);
        if (match && match[2]) {
          totalFiles = parseInt(match[2], 10);
          filesCompleted = parseInt(match[1], 10) - 1; // -1 because this one is in progress
          updateQueueItemProgress(nextItem.id, currentProgress, filesCompleted, totalFiles);
        }
      }
      
      // Check for download progress percentage
      if (output.includes('%')) {
        const progressMatch = output.match(/(\d+\.\d+)%/);
        if (progressMatch && progressMatch[1]) {
          currentProgress = parseFloat(progressMatch[1]);
          updateQueueItemProgress(nextItem.id, currentProgress, filesCompleted, totalFiles);
        }
      }
      
      // Check for completed file
      if (output.includes('has already been downloaded') || output.includes('Destination:')) {
        filesCompleted++;
        updateQueueItemProgress(nextItem.id, currentProgress, filesCompleted, totalFiles);
      }
    });
    
    // Handle errors
    childProcess.stderr?.on('data', (data) => {
      const errorMsg = data.toString();
      console.error(`Download stderr: ${errorMsg}`);
      updateQueueItemProgress(nextItem.id, currentProgress, filesCompleted, totalFiles, errorMsg);
    });
    
    // Handle completion
    childProcess.on('close', async (code) => {
      const queueData = await readQueue();
      const queue = queueData.queue || [];
      const itemIndex = queue.findIndex(item => item.id === nextItem.id);
      
      if (itemIndex !== -1) {
        // Check if the process was canceled
        if (queue[itemIndex].status === "canceled") {
          // Already handled by cancel endpoint
        } else if (code === 0) {
          // Success
          queue[itemIndex].status = "completed";
          queue[itemIndex].progress = 100;
          queue[itemIndex].filesCompleted = totalFiles;
          queue[itemIndex].message = "Download completed successfully";
        } else {
          // Error
          queue[itemIndex].status = "failed";
          queue[itemIndex].message = `Download failed with exit code ${code}`;
        }
        
        // Remove process ID
        delete queue[itemIndex].processId;
        
        await writeQueue({ queue });
        
        // Add to history directly instead of using axios
        try {
          // Create history data structure
          const historyFilePath = path.join(process.cwd(), "data", "history.json");
          let historyData: { history: any[] } = { history: [] };
          
          // Read existing history if available
          if (fs.existsSync(historyFilePath)) {
            const data = await fs.promises.readFile(historyFilePath, "utf-8");
            historyData = JSON.parse(data);
          }
          
          // Add new history item
          const historyItem = {
            id: Date.now().toString(),
            url: queue[itemIndex].url,
            downloadPath: queue[itemIndex].downloadPath,
            fileTypes: queue[itemIndex].fileTypes,
            isPlaylist: queue[itemIndex].isPlaylist,
            status: queue[itemIndex].status,
            timestamp: new Date().toISOString(),
            message: queue[itemIndex].message,
          };
          
          historyData.history.unshift(historyItem);
          
          // Keep only the last 100 downloads
          if (historyData.history.length > 100) {
            historyData.history.length = 100;
          }
          
          // Save updated history
          await fs.promises.writeFile(historyFilePath, JSON.stringify(historyData, null, 2));
        } catch (error) {
          console.error("Error adding to history:", error);
        }
        
        // Process next item in queue
        processNextQueueItem();
      }
    });
  } catch (error) {
    console.error("Error executing download command:", error);
    
    // Update queue item status
    const queueData = await readQueue();
    const queue = queueData.queue || [];
    const itemIndex = queue.findIndex(item => item.id === nextItem.id);
    
    if (itemIndex !== -1) {
      queue[itemIndex].status = "failed";
      queue[itemIndex].message = `Failed to start download: ${error}`;
      await writeQueue({ queue });
    }
    
    // Process next item in queue
    processNextQueueItem();
  }
};

// Add item to queue directly
const addToQueue = async (
  url: string, 
  downloadPath: string, 
  fileTypes: string[], 
  isPlaylist: boolean
): Promise<{ success: boolean; id?: string; message: string }> => {
  try {
    const queueData = await readQueue();
    const queue = queueData.queue || [];
    
    // Add new download to queue
    const newQueueItem: QueueItem = {
      id: Date.now().toString(),
      url,
      downloadPath,
      fileTypes,
      isPlaylist: isPlaylist || false,
      status: "queued",
      progress: 0,
      filesCompleted: 0,
      totalFiles: isPlaylist ? 0 : 1, // Will be updated when download starts
      timestamp: new Date().toISOString(),
      message: "Queued for download",
    };
    
    queue.push(newQueueItem);
    
    // Save updated queue
    const success = await writeQueue({ queue });
    
    if (success) {
      return { 
        success: true, 
        message: "Download added to queue",
        id: newQueueItem.id
      };
    } else {
      return { 
        success: false, 
        message: "Failed to save queue" 
      };
    }
  } catch (error) {
    console.error("Error adding to queue:", error);
    return { 
      success: false, 
      message: "Server error" 
    };
  }
};

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { url, downloadPath, fileTypes, isPlaylist } = data;
    
    // Validate inputs
    if (!url || !downloadPath || !fileTypes || !Array.isArray(fileTypes) || fileTypes.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: "Missing required fields" 
      }, { status: 400 });
    }
    
    // Validate URL
    if (!isValidArchiveUrl(url)) {
      return NextResponse.json({ 
        success: false, 
        message: "Invalid Internet Archive URL" 
      }, { status: 400 });
    }
    
    // Sanitize inputs
    const sanitizedPath = sanitizePath(downloadPath);
    const sanitizedFileTypes = sanitizeFileTypes(fileTypes);
    
    if (sanitizedFileTypes.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: "No valid file types selected" 
      }, { status: 400 });
    }
    
    // Add to queue directly instead of using axios
    const queueResult = await addToQueue(
      url,
      sanitizedPath,
      sanitizedFileTypes,
      isPlaylist || false
    );
    
    if (!queueResult.success) {
      return NextResponse.json({ 
        success: false, 
        message: queueResult.message 
      }, { status: 500 });
    }
    
    // Check if there are any active downloads
    const queueData = await readQueue();
    const queue = queueData.queue || [];
    const activeDownloads = queue.filter(item => item.status === "downloading");
    
    // If no active downloads, start processing the queue
    if (activeDownloads.length === 0) {
      // Start processing in the background
      setTimeout(processNextQueueItem, 100);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Download added to queue. ${activeDownloads.length > 0 ? 'Will start after current downloads complete.' : 'Starting download...'}`,
      queueId: queueResult.id
    });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server error" 
    }, { status: 500 });
  }
} 