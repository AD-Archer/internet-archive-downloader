import { NextResponse } from "next/server";
import axios from "axios";
import path from "path";
import os from "os";
import { promises as fs } from "fs";

// Server configuration
const SERVER_URL = process.env.DOWNLOADER_SERVER_URL || 'http://localhost:9124';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

/**
 * POST handler to clear the entire download queue
 */
export async function POST() {
  try {
    // Connect to the downloader server
    await axios.post(`${SERVER_URL}/api/queue/clear`);
    return NextResponse.json({ success: true, message: "Queue cleared" });
  } catch (error) {
    console.error("Error clearing queue:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 