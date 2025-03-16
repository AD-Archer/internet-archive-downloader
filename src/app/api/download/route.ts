import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import axios from "axios";
import { promises as fs } from "fs";
import path from "path";

// Download queue to track active downloads
interface DownloadJob {
  id: string;
  url: string;
  destination: string;
  status: "queued" | "downloading" | "completed" | "failed";
  progress: number;
  estimatedTime?: string;
  error?: string;
}

// In-memory queue (would be replaced with a database in production)
const downloadQueue: DownloadJob[] = [];

// Schema for download request validation
const downloadSchema = z.object({
  url: z.string().url(),
  destination: z.string(),
});

// Helper function to extract file details from Internet Archive URL
async function getArchiveDetails(url: string) {
  try {
    // This is a simplified example - in a real implementation, you would
    // need to parse the Internet Archive URL and use their API to get metadata
    const urlObj = new URL(url);
    const identifier = urlObj.pathname.split('/').filter(Boolean)[1];
    
    if (!identifier) {
      throw new Error("Invalid Internet Archive URL format");
    }
    
    // In a real implementation, you would fetch metadata from Internet Archive API
    // For example: https://archive.org/metadata/{identifier}
    
    return {
      identifier,
      fileName: `${identifier}.zip`, // Simplified - would get actual file name from metadata
      estimatedSize: "Unknown", // Would get from metadata
    };
  } catch (error) {
    console.error("Error getting archive details:", error);
    throw new Error("Failed to get archive details");
  }
}

// POST handler for new download requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const result = downloadSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: result.error.format() },
        { status: 400 }
      );
    }
    
    const { url, destination } = result.data;
    
    // Get archive details
    const details = await getArchiveDetails(url);
    
    // Create download job
    const job: DownloadJob = {
      id: Date.now().toString(),
      url,
      destination,
      status: "queued",
      progress: 0,
    };
    
    // Add to queue
    downloadQueue.push(job);
    
    // In a real implementation, you would start a background process or worker
    // to handle the download. Here we're just simulating it.
    
    // Return job details
    return NextResponse.json({
      message: "Download added to queue",
      job: {
        id: job.id,
        url: job.url,
        destination: job.destination,
        status: job.status,
        details,
      },
    });
  } catch (error) {
    console.error("Error processing download request:", error);
    return NextResponse.json(
      { error: "Failed to process download request" },
      { status: 500 }
    );
  }
}

// GET handler to retrieve queue status
export async function GET() {
  return NextResponse.json({ queue: downloadQueue });
} 