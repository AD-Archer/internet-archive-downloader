import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import axios from "axios";
import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import os from "os";

// Download queue schema
interface DownloadJob {
  id: string;
  url: string;
  destination: string;
  formats: Record<string, boolean>;
  status: "queued" | "downloading" | "completed" | "failed";
  progress: number;
  estimatedTime?: string;
  error?: string;
  createdAt: string;
}

// Schema for download request validation
const downloadSchema = z.object({
  url: z.string().url(),
  destination: z.string().optional(),
  formats: z.record(z.boolean()).optional().default({
    mp4: true,
    mov: true,
    mkv: true,
  }),
});

// Path to the downloader script
const downloaderPath = path.join(process.cwd(), 'src', 'server', 'downloader.js');

// Helper function to extract file details from Internet Archive URL
async function getArchiveDetails(url: string) {
  try {
    // Parse the Internet Archive URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    // Internet Archive URLs typically have the format:
    // https://archive.org/details/{identifier}
    if (pathParts[0] !== 'details' || !pathParts[1]) {
      throw new Error("Invalid Internet Archive URL format");
    }
    
    const identifier = pathParts[1];
    
    // Fetch metadata from Internet Archive API
    const response = await axios.get(`https://archive.org/metadata/${identifier}`);
    const metadata = response.data;
    
    if (!metadata || !metadata.files || metadata.files.length === 0) {
      throw new Error("No files found for this identifier");
    }
    
    // Find downloadable files
    const downloadableFiles = metadata.files.filter((file: any) => 
      file.source === 'original' && !file.name.endsWith('_meta.xml')
    );
    
    if (downloadableFiles.length === 0) {
      throw new Error("No downloadable files found");
    }
    
    // Calculate total size
    const totalSize = downloadableFiles.reduce((sum: number, file: any) => 
      sum + (parseInt(file.size) || 0), 0);
    
    // Format size
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };
    
    return {
      identifier,
      fileCount: downloadableFiles.length,
      estimatedSize: formatSize(totalSize),
      files: downloadableFiles.map((file: any) => ({
        name: file.name,
        size: formatSize(parseInt(file.size) || 0),
        format: file.format
      })).slice(0, 5) // Limit to first 5 files
    };
  } catch (error) {
    console.error("Error getting archive details:", error);
    throw new Error("Failed to get archive details");
  }
}

// Function to start the downloader process
function startDownloader(job: DownloadJob) {
  // Default destination if not provided
  const destination = job.destination || path.join(os.homedir(), 'Downloads', 'internet-archive');
  
  // Convert formats object to comma-separated string of enabled formats
  const enabledFormats = Object.entries(job.formats || {})
    .filter(([_, enabled]) => enabled)
    .map(([format]) => format)
    .join(',');
  
  // Start the downloader process
  const process = spawn('node', [
    downloaderPath,
    '--url', job.url,
    '--destination', destination,
    '--formats', enabledFormats
  ], {
    detached: true,
    stdio: 'ignore'
  });
  
  // Detach the process so it runs independently
  process.unref();
  
  console.log(`Started downloader process for ${job.url}`);
}

// Function to get queue from the downloader server
async function getQueue(): Promise<DownloadJob[]> {
  try {
    // Try to connect to the downloader server
    const response = await axios.get('http://localhost:3001/api/queue');
    return response.data.queue || [];
  } catch (error) {
    console.error("Error connecting to downloader server:", error);
    
    // If server is not running, try to read the queue file directly
    try {
      const queuePath = path.join(os.homedir(), '.internet-archive-downloader', 'queue.json');
      const data = await fs.readFile(queuePath, 'utf8');
      return JSON.parse(data);
    } catch (fileError) {
      console.error("Error reading queue file:", fileError);
      return [];
    }
  }
}

// Function to add a job to the queue
async function addToQueue(job: DownloadJob): Promise<DownloadJob> {
  try {
    // Try to connect to the downloader server
    const response = await axios.post('http://localhost:3001/api/queue', {
      url: job.url,
      destination: job.destination
    });
    
    return response.data.job;
  } catch (error) {
    console.error("Error connecting to downloader server:", error);
    
    // If server is not running, start the downloader directly
    startDownloader(job);
    
    return job;
  }
}

// POST handler for new download requests
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate request
    const result = downloadSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request", details: result.error.format() },
        { status: 400 }
      );
    }
    
    // Get URL and destination from validated data
    const { url, destination, formats } = result.data;
    
    // Get archive details
    const details = await getArchiveDetails(url);
    
    // Generate a unique ID for the job
    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Create job object
    const job: DownloadJob = {
      id,
      url,
      destination: destination || path.join(os.homedir(), 'Downloads', 'internet-archive'),
      formats,
      status: "queued",
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    
    // Add to queue
    await addToQueue(job);
    
    // Start the downloader process
    startDownloader(job);
    
    return NextResponse.json({ success: true, job, details });
  } catch (error) {
    console.error("Error processing download request:", error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET handler to retrieve queue status
export async function GET() {
  try {
    const queue = await getQueue();
    return NextResponse.json({ queue });
  } catch (error) {
    console.error("Error retrieving queue:", error);
    return NextResponse.json(
      { error: "Failed to retrieve queue" },
      { status: 500 }
    );
  }
} 