#!/usr/bin/env node

/**
 * Server-side script for downloading files from Internet Archive
 * This script is meant to be run on the Linux server
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { program } = require('commander');

// Configure command-line options
program
  .version('1.0.0')
  .description('Download files from Internet Archive')
  .option('-u, --url <url>', 'Internet Archive URL')
  .option('-d, --destination <path>', 'Destination path', '/mnt/jellyfin/downloads')
  .option('-i, --identifier <id>', 'Internet Archive identifier (alternative to URL)')
  .option('-q, --queue <file>', 'Path to queue file')
  .parse(process.argv);

const options = program.opts();

// Queue for tracking downloads
const queue = [];

/**
 * Parse Internet Archive URL to extract identifier
 */
function parseArchiveUrl(url) {
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

/**
 * Get metadata for an Internet Archive item
 */
async function getArchiveMetadata(identifier) {
  try {
    const response = await axios.get(`https://archive.org/metadata/${identifier}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching metadata for ${identifier}:`, error.message);
    throw new Error(`Failed to fetch metadata for ${identifier}`);
  }
}

/**
 * Download a file using wget
 */
async function downloadWithWget(url, destination) {
  return new Promise((resolve, reject) => {
    // Ensure destination directory exists
    const dir = path.dirname(destination);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    console.log(`Downloading ${url} to ${destination}`);
    
    // Use wget to download the file
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
          console.log(`Download progress: ${progress}%`);
        }
      }
    });
    
    // Handle completion
    wget.on('close', (code) => {
      if (code === 0) {
        console.log(`Download completed: ${destination}`);
        resolve();
      } else {
        const error = new Error(`wget exited with code ${code}`);
        console.error(error.message);
        reject(error);
      }
    });
    
    // Handle errors
    wget.on('error', (error) => {
      console.error(`Download error: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Process a download from Internet Archive
 */
async function processDownload(url, destination) {
  try {
    // Parse URL to get identifier
    const identifier = url.includes('archive.org') 
      ? parseArchiveUrl(url) 
      : url;
    
    if (!identifier) {
      throw new Error('Invalid Internet Archive URL or identifier');
    }
    
    console.log(`Processing download for identifier: ${identifier}`);
    
    // Get metadata
    const metadata = await getArchiveMetadata(identifier);
    
    if (!metadata || !metadata.files || metadata.files.length === 0) {
      throw new Error(`No files found for ${identifier}`);
    }
    
    // Find downloadable files
    const downloadableFiles = metadata.files.filter(file => 
      file.source === 'original' && !file.name.endsWith('_meta.xml')
    );
    
    if (downloadableFiles.length === 0) {
      throw new Error(`No downloadable files found for ${identifier}`);
    }
    
    // Create destination directory
    const itemDir = path.join(destination, identifier);
    if (!fs.existsSync(itemDir)) {
      fs.mkdirSync(itemDir, { recursive: true });
    }
    
    // Download each file
    for (const file of downloadableFiles) {
      const fileUrl = `https://archive.org/download/${identifier}/${file.name}`;
      const filePath = path.join(itemDir, file.name);
      
      await downloadWithWget(fileUrl, filePath);
    }
    
    console.log(`All files downloaded for ${identifier}`);
    return true;
  } catch (error) {
    console.error(`Error processing download: ${error.message}`);
    return false;
  }
}

/**
 * Process the download queue
 */
async function processQueue() {
  if (queue.length === 0) {
    console.log('Queue is empty');
    return;
  }
  
  const item = queue[0];
  console.log(`Processing queue item: ${item.url}`);
  
  try {
    const success = await processDownload(item.url, item.destination);
    
    // Remove from queue
    queue.shift();
    
    console.log(`Queue item processed. ${queue.length} items remaining.`);
  } catch (error) {
    console.error(`Error processing queue item: ${error.message}`);
    
    // Move failed item to the end of the queue
    const failedItem = queue.shift();
    failedItem.retries = (failedItem.retries || 0) + 1;
    
    if (failedItem.retries < 3) {
      console.log(`Retrying later (attempt ${failedItem.retries}/3)`);
      queue.push(failedItem);
    } else {
      console.error(`Failed to download after 3 attempts: ${failedItem.url}`);
    }
  }
  
  // Process next item after a delay
  if (queue.length > 0) {
    setTimeout(processQueue, 1000);
  }
}

/**
 * Main function
 */
async function main() {
  // Handle direct URL download
  if (options.url) {
    await processDownload(options.url, options.destination);
    return;
  }
  
  // Handle identifier download
  if (options.identifier) {
    await processDownload(options.identifier, options.destination);
    return;
  }
  
  // Handle queue file
  if (options.queue) {
    try {
      const queueData = JSON.parse(fs.readFileSync(options.queue, 'utf8'));
      queue.push(...queueData);
      console.log(`Loaded ${queue.length} items from queue file`);
      processQueue();
    } catch (error) {
      console.error(`Error loading queue file: ${error.message}`);
    }
  } else {
    console.log('No URL, identifier, or queue file specified. Use --help for usage information.');
  }
}

// Run the main function
main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});

// Export functions for testing
module.exports = {
  parseArchiveUrl,
  getArchiveMetadata,
  downloadWithWget,
  processDownload,
  processQueue
}; 