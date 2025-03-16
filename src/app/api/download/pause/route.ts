import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

// Server configuration
const SERVER_URL = process.env.DOWNLOADER_SERVER_URL || 'http://localhost:9124';

/**
 * POST handler to pause or resume the download queue
 */
export async function POST(request: NextRequest) {
  try {
    // Get pause state from request body
    const body = await request.json();
    const { paused } = body;
    
    if (typeof paused !== 'boolean') {
      return NextResponse.json(
        { error: "Paused state must be a boolean" },
        { status: 400 }
      );
    }
    
    // Connect to the downloader server
    await axios.post(`${SERVER_URL}/api/queue/pause`, { paused });
    
    return NextResponse.json({ 
      success: true, 
      message: paused ? "Queue paused" : "Queue resumed" 
    });
  } catch (error) {
    console.error("Error pausing/resuming queue:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET handler to check if queue is paused
 */
export async function GET() {
  try {
    // Connect to the downloader server
    const response = await axios.get(`${SERVER_URL}/api/queue/status`);
    
    return NextResponse.json(response.data);
  } catch (error) {
    console.error("Error checking queue status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 