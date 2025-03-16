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

// GET handler for retrieving queue
export async function GET(request: NextRequest) {
  try {
    const queueData = await readQueue();
    
    return NextResponse.json(queueData);
  } catch (error) {
    console.error("Error retrieving queue:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server error" 
    }, { status: 500 });
  }
}

// POST handler for adding to queue
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (!data.url || !data.downloadPath || !data.fileTypes) {
      return NextResponse.json({ 
        success: false, 
        message: "Missing required fields" 
      }, { status: 400 });
    }
    
    const queueData = await readQueue();
    const queue = queueData.queue || [];
    
    // Add new download to queue
    const newQueueItem: QueueItem = {
      id: Date.now().toString(),
      url: data.url,
      downloadPath: data.downloadPath,
      fileTypes: data.fileTypes,
      isPlaylist: data.isPlaylist || false,
      status: "queued",
      progress: 0,
      filesCompleted: 0,
      totalFiles: data.isPlaylist ? 0 : 1, // Will be updated when download starts
      timestamp: new Date().toISOString(),
      message: "Queued for download",
    };
    
    queue.push(newQueueItem);
    
    // Save updated queue
    const success = await writeQueue({ queue });
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: "Download added to queue",
        id: newQueueItem.id
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: "Failed to save queue" 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error adding to queue:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server error" 
    }, { status: 500 });
  }
}

// DELETE handler for clearing queue
export async function DELETE(request: NextRequest) {
  try {
    // Get current queue to check for active downloads
    const queueData = await readQueue();
    const queue = queueData.queue || [];
    
    // Filter out active downloads (can't delete those)
    const newQueue = queue.filter(item => item.status === "downloading");
    
    // Save updated queue
    const success = await writeQueue({ queue: newQueue });
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: "Queue cleared (active downloads preserved)" 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: "Failed to clear queue" 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error clearing queue:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server error" 
    }, { status: 500 });
  }
} 