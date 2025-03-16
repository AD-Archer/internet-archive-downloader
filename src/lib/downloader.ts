import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Interface for download job
export interface DownloadJob {
  id: string;
  url: string;
  destination: string;
  status: "queued" | "downloading" | "completed" | "failed";
  progress: number;
  estimatedTime?: string;
  error?: string;
}

// Interface for download options
export interface DownloadOptions {
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Downloads a file from Internet Archive using wget
 * This is more reliable for large files than using axios
 */
export async function downloadWithWget(
  url: string, 
  destination: string,
  options: DownloadOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ensure destination directory exists
    const dir = path.dirname(destination);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Use wget to download the file
    // --progress=dot:mega shows progress in a way we can parse
    const wget = spawn('wget', [
      url,
      '-O', destination,
      '--progress=dot:mega'
    ]);
    
    // Track download progress
    wget.stderr.on('data', (data) => {
      const output = data.toString();
      
      // Parse wget output to get progress percentage
      if (output.includes('%')) {
        const percentMatch = output.match(/(\d+)%/);
        if (percentMatch && percentMatch[1]) {
          const progress = parseInt(percentMatch[1], 10);
          if (options.onProgress) {
            options.onProgress(progress);
          }
        }
      }
    });
    
    // Handle completion
    wget.on('close', (code) => {
      if (code === 0) {
        if (options.onComplete) {
          options.onComplete();
        }
        resolve();
      } else {
        const error = new Error(`wget exited with code ${code}`);
        if (options.onError) {
          options.onError(error);
        }
        reject(error);
      }
    });
    
    // Handle errors
    wget.on('error', (error) => {
      if (options.onError) {
        options.onError(error);
      }
      reject(error);
    });
  });
}

/**
 * Downloads a file using axios (for smaller files)
 */
export async function downloadWithAxios(
  url: string, 
  destination: string,
  options: DownloadOptions = {}
): Promise<void> {
  try {
    // Ensure destination directory exists
    const dir = path.dirname(destination);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create write stream
    const writer = fs.createWriteStream(destination);
    
    // Download file with progress tracking
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (options.onProgress) {
            options.onProgress(progress);
          }
        }
      }
    });
    
    // Pipe response to file
    response.data.pipe(writer);
    
    // Handle completion
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        if (options.onComplete) {
          options.onComplete();
        }
        resolve();
      });
      
      writer.on('error', (error) => {
        if (options.onError) {
          options.onError(error);
        }
        reject(error);
      });
    });
  } catch (error) {
    if (options.onError && error instanceof Error) {
      options.onError(error);
    }
    throw error;
  }
}

/**
 * Parses an Internet Archive URL to extract the identifier
 */
export function parseArchiveUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    // Internet Archive URLs typically have the format:
    // https://archive.org/details/{identifier}
    if (pathParts[0] === 'details' && pathParts[1]) {
      return pathParts[1];
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing URL:', error);
    return null;
  }
} 