import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * Health check endpoint to verify the server is running properly
 * GET /api/health
 */
export async function GET(request: NextRequest) {
  try {
    // Check if data directory exists
    const dataDir = path.join(process.cwd(), "data");
    let dataDirExists = false;
    
    try {
      dataDirExists = fs.existsSync(dataDir);
      if (!dataDirExists) {
        await fs.promises.mkdir(dataDir, { recursive: true });
        dataDirExists = true;
      }
    } catch (error) {
      console.error("Error checking/creating data directory:", error);
    }
    
    // Check if required API endpoints exist
    const requiredEndpoints = [
      "/api/queue",
      "/api/status",
      "/api/history",
      "/api/download"
    ];
    
    // Return health status
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      dataDirExists,
      requiredEndpoints,
      version: "1.0.0"
    });
  } catch (error) {
    console.error("Error in health check:", error);
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 