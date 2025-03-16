import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import path from "path";
import os from "os";
import { promises as fs } from "fs";
import { spawn } from "child_process";

// Server configuration
const SERVER_URL = process.env.DOWNLOADER_SERVER_URL || 'http://localhost:9124';

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
    
    // Connect to the downloader server
    await axios.post(`${SERVER_URL}/api/queue/${id}/stop`);
    return NextResponse.json({ success: true, message: "Download stopped" });
  } catch (error) {
    console.error("Error stopping download:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 