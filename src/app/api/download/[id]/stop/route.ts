import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import path from "path";
import os from "os";
import { promises as fs } from "fs";
import { spawn } from "child_process";

/**
 * POST handler to stop a download
 */
export async function POST(
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
      await axios.post(`http://localhost:3001/api/queue/${id}/stop`);
      return NextResponse.json({ success: true, message: "Download stopped" });
    } catch (serverError) {
      console.error("Error connecting to downloader server:", serverError);
      
      // If server is not running, try to update the queue file directly
      try {
        // Try the default queue location
        const queuePath = path.join(os.homedir(), '.internet-archive-downloader', 'queue.json');
        let queue = [];
        let queueFilePath = queuePath;
        
        try {
          const data = await fs.readFile(queuePath, 'utf8');
          queue = JSON.parse(data);
        } catch (readError) {
          // Try the temp location if default fails
          const tempQueuePath = path.join(os.tmpdir(), 'archive-download-queue.json');
          const data = await fs.readFile(tempQueuePath, 'utf8');
          queue = JSON.parse(data);
          queueFilePath = tempQueuePath;
        }
        
        // Find the item with the given ID
        const itemIndex = queue.findIndex((item: any) => item.id === id);
        
        if (itemIndex === -1) {
          return NextResponse.json(
            { error: "Item not found in queue" },
            { status: 404 }
          );
        }
        
        // Update the item status
        queue[itemIndex] = {
          ...queue[itemIndex],
          status: "failed",
          error: "Download stopped by user",
        };
        
        // Write back to the queue file
        await fs.writeFile(queueFilePath, JSON.stringify(queue, null, 2), 'utf8');
        
        // Try to kill any wget processes for this download
        // This is a best-effort approach and may not work in all cases
        try {
          // On macOS/Linux, use ps and grep to find wget processes
          const ps = spawn('ps', ['aux']);
          let psOutput = '';
          
          ps.stdout.on('data', (data) => {
            psOutput += data.toString();
          });
          
          ps.on('close', () => {
            // Look for wget processes with the item's URL
            const item = queue[itemIndex];
            const lines = psOutput.split('\n').filter(line => 
              line.includes('wget') && line.includes(item.url)
            );
            
            // Extract PIDs and kill them
            lines.forEach(line => {
              const parts = line.trim().split(/\s+/);
              if (parts.length > 1) {
                const pid = parts[1];
                try {
                  spawn('kill', [pid]);
                  console.log(`Killed process ${pid} for download ${id}`);
                } catch (killError) {
                  console.error(`Failed to kill process ${pid}:`, killError);
                }
              }
            });
          });
        } catch (processError) {
          console.error("Error trying to kill wget processes:", processError);
        }
        
        return NextResponse.json({ success: true, message: "Download marked as stopped" });
      } catch (fileError) {
        console.error("Error updating queue file:", fileError);
        throw new Error("Failed to stop download");
      }
    }
  } catch (error) {
    console.error("Error stopping download:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 