import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import path from "path";
import os from "os";
import { promises as fs } from "fs";

// Server configuration
const SERVER_URL = process.env.DOWNLOADER_SERVER_URL || 'http://localhost:9124';

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
    
    // Connect to the downloader server
    await axios.delete(`${SERVER_URL}/api/queue/${id}`);
    return NextResponse.json({ success: true, message: "Item removed from queue" });
  } catch (error) {
    console.error("Error removing item from queue:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST handler to retry a failed download
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
    
    // Get the action from the request body
    const body = await request.json();
    const { action } = body;
    
    if (action === "prioritize") {
      // Prioritize the download
      await axios.post(`${SERVER_URL}/api/queue/${id}/prioritize`);
      return NextResponse.json({ success: true, message: "Download prioritized" });
    } else if (action === "retry") {
      // Retry the download
      await axios.post(`${SERVER_URL}/api/queue/${id}/retry`);
      return NextResponse.json({ success: true, message: "Download queued for retry" });
    } else {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error processing download action:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 