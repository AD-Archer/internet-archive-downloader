import { NextResponse } from "next/server";
import axios from "axios";
import path from "path";
import os from "os";
import { promises as fs } from "fs";

/**
 * POST handler to clear the entire download queue
 */
export async function POST() {
  try {
    // Try to connect to the downloader server
    try {
      await axios.post('http://localhost:3001/api/queue/clear');
      return NextResponse.json({ success: true, message: "Queue cleared" });
    } catch (serverError) {
      console.error("Error connecting to downloader server:", serverError);
      
      // If server is not running, try to clear the queue file directly
      try {
        // Try the default queue location
        const queuePath = path.join(os.homedir(), '.internet-archive-downloader', 'queue.json');
        await fs.writeFile(queuePath, JSON.stringify([]), 'utf8');
        
        // Also try the temp location
        const tempQueuePath = path.join(os.tmpdir(), 'archive-download-queue.json');
        if (await fs.stat(tempQueuePath).catch(() => null)) {
          await fs.writeFile(tempQueuePath, JSON.stringify([]), 'utf8');
        }
        
        return NextResponse.json({ success: true, message: "Queue cleared" });
      } catch (fileError) {
        console.error("Error clearing queue file:", fileError);
        throw new Error("Failed to clear queue");
      }
    }
  } catch (error) {
    console.error("Error clearing queue:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 