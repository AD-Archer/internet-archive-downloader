import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

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

// POST handler for canceling a download
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { id } = data;
    
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        message: "Missing download ID" 
      }, { status: 400 });
    }
    
    const queueData = await readQueue();
    const queue = queueData.queue || [];
    
    const itemIndex = queue.findIndex(item => item.id === id);
    
    if (itemIndex === -1) {
      return NextResponse.json({ 
        success: false, 
        message: "Download not found" 
      }, { status: 404 });
    }
    
    // Can only cancel queued or downloading items
    if (queue[itemIndex].status !== "queued" && queue[itemIndex].status !== "downloading") {
      return NextResponse.json({ 
        success: false, 
        message: "Cannot cancel a download that is not in progress or queued" 
      }, { status: 400 });
    }
    
    // If the download is in progress, we need to kill the process
    if (queue[itemIndex].status === "downloading" && queue[itemIndex].processId) {
      try {
        // Kill the download process
        exec(`kill ${queue[itemIndex].processId}`);
      } catch (error) {
        console.error("Error killing download process:", error);
      }
    }
    
    // Update the queue item status
    queue[itemIndex].status = "canceled";
    queue[itemIndex].message = "Download canceled by user";
    
    // Save updated queue
    const success = await writeQueue({ queue });
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: "Download canceled" 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: "Failed to update queue" 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error canceling download:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server error" 
    }, { status: 500 });
  }
} 