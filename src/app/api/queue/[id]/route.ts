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

// GET handler for retrieving a specific queue item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Ensure params is properly awaited before accessing properties
    const { id } = await Promise.resolve(params);
    const queueData = await readQueue();
    const queue = queueData.queue || [];
    
    const queueItem = queue.find(item => item.id === id);
    
    if (!queueItem) {
      return NextResponse.json({ 
        success: false, 
        message: "Queue item not found" 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      queueItem 
    });
  } catch (error) {
    console.error("Error retrieving queue item:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server error" 
    }, { status: 500 });
  }
}

// PATCH handler for updating a queue item
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Ensure params is properly awaited before accessing properties
    const { id } = await Promise.resolve(params);
    const data = await request.json();
    
    const queueData = await readQueue();
    const queue = queueData.queue || [];
    
    const itemIndex = queue.findIndex(item => item.id === id);
    
    if (itemIndex === -1) {
      return NextResponse.json({ 
        success: false, 
        message: "Queue item not found" 
      }, { status: 404 });
    }
    
    // Update the queue item with the new data
    queue[itemIndex] = {
      ...queue[itemIndex],
      ...data,
    };
    
    // Save updated queue
    const success = await writeQueue({ queue });
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: "Queue item updated" 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: "Failed to update queue item" 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error updating queue item:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server error" 
    }, { status: 500 });
  }
}

// DELETE handler for removing a queue item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Ensure params is properly awaited before accessing properties
    const { id } = await Promise.resolve(params);
    const queueData = await readQueue();
    const queue = queueData.queue || [];
    
    const itemIndex = queue.findIndex(item => item.id === id);
    
    if (itemIndex === -1) {
      return NextResponse.json({ 
        success: false, 
        message: "Queue item not found" 
      }, { status: 404 });
    }
    
    // Check if the item is currently downloading
    if (queue[itemIndex].status === "downloading") {
      return NextResponse.json({ 
        success: false, 
        message: "Cannot remove an active download. Cancel it first." 
      }, { status: 400 });
    }
    
    // Remove the item from the queue
    queue.splice(itemIndex, 1);
    
    // Save updated queue
    const success = await writeQueue({ queue });
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: "Queue item removed" 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: "Failed to remove queue item" 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error removing queue item:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server error" 
    }, { status: 500 });
  }
} 