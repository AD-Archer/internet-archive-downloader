import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import path from "path";
import os from "os";
import { promises as fs } from "fs";

/**
 * DELETE handler to remove an item from the queue
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }
    
    // Try to connect to the downloader server
    try {
      await axios.delete(`http://localhost:3001/api/queue/${id}`);
      return NextResponse.json({ success: true, message: "Item removed from queue" });
    } catch (serverError) {
      console.error("Error connecting to downloader server:", serverError);
      
      // If server is not running, try to remove from the queue file directly
      try {
        // Try the default queue location
        const queuePath = path.join(os.homedir(), '.internet-archive-downloader', 'queue.json');
        let queue = [];
        
        try {
          const data = await fs.readFile(queuePath, 'utf8');
          queue = JSON.parse(data);
        } catch (readError) {
          // Try the temp location if default fails
          const tempQueuePath = path.join(os.tmpdir(), 'archive-download-queue.json');
          const data = await fs.readFile(tempQueuePath, 'utf8');
          queue = JSON.parse(data);
        }
        
        // Filter out the item with the given ID
        const filteredQueue = queue.filter((item: any) => item.id !== id);
        
        // Write back to both possible locations
        try {
          await fs.writeFile(queuePath, JSON.stringify(filteredQueue, null, 2), 'utf8');
        } catch (writeError) {
          console.error("Error writing to default queue location:", writeError);
        }
        
        try {
          const tempQueuePath = path.join(os.tmpdir(), 'archive-download-queue.json');
          await fs.writeFile(tempQueuePath, JSON.stringify(filteredQueue, null, 2), 'utf8');
        } catch (writeError) {
          console.error("Error writing to temp queue location:", writeError);
        }
        
        return NextResponse.json({ success: true, message: "Item removed from queue" });
      } catch (fileError) {
        console.error("Error removing item from queue file:", fileError);
        throw new Error("Failed to remove item from queue");
      }
    }
  } catch (error) {
    console.error("Error removing item from queue:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 