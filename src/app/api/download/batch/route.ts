import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import axios from "axios";

// Server configuration
const SERVER_URL = process.env.DOWNLOADER_SERVER_URL || 'http://localhost:9124';

// Schema for batch download request validation
const batchDownloadSchema = z.object({
  items: z.array(
    z.object({
      url: z.string().url(),
      identifier: z.string().optional(),
    })
  ).min(1, "At least one item is required"),
  destination: z.string().optional(),
  formats: z.record(z.boolean()).optional(),
  priority: z.enum(["high", "normal", "low"]).optional().default("normal"),
});

/**
 * POST handler for batch download requests
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate request
    const result = batchDownloadSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request", details: result.error.format() },
        { status: 400 }
      );
    }
    
    // Get data from validated request
    const { items, destination, formats, priority } = result.data;
    
    // Add to queue
    const response = await axios.post(`${SERVER_URL}/api/queue/batch`, {
      items,
      destination,
      formats,
      priority
    });
    
    return NextResponse.json({ 
      success: true, 
      message: `Added ${response.data.jobs.length} downloads to queue`,
      jobs: response.data.jobs 
    });
  } catch (error) {
    console.error("Error processing batch download request:", error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 