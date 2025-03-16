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
const QueueManager = require('./queue');

// Configure command-line options
program
  .version('1.0.0')
  .description('Download files from Internet Archive')
  .option('-u, --url <url>', 'Internet Archive URL')
  .option('-d, --destination <path>', 'Destination path', '/mnt/jellyfin/downloads')
  .option('-i, --identifier <id>', 'Internet Archive identifier (alternative to URL)')
  .option('-q, --queue <file>', 'Path to queue file')
  .option('-b, --browser', 'Enable browser download mode for testing')
  .option('-p, --port <number>', 'Port for browser download server', '3001')
  .option('-f, --formats <formats>', 'Comma-separated list of file formats to download', 'mp4,mov,mkv')
  .parse(process.argv);

const options = program.opts();

// Initialize queue manager
const queueManager = new QueueManager(options.queue);

// Flag to track if download process is running
let isProcessing = false;

// Parse formats into an array
const allowedFormats = options.formats ? options.formats.split(',').map(f => f.trim().toLowerCase()) : ['mp4', 'mov', 'mkv'];

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
async function downloadWithWget(url, destination, jobId) {
  return new Promise((resolve, reject) => {
    // Ensure destination directory exists
    const dir = path.dirname(destination);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    console.log(`Downloading ${url} to ${destination}`);
    
    // Update job status
    if (jobId) {
      queueManager.updateItem(jobId, { 
        status: 'downloading',
        progress: 0
      });
    }
    
    // Use wget to download the file
    const wget = spawn('wget', [
      url,
      '-O', destination,
      '--progress=dot:mega'
    ]);
    
    // Track download progress
    wget.stderr.on('data', (data) => {
      const output = data.toString();
      
      // Parse wget output to get progress
      const progressMatch = output.match(/(\d+)%/);
      if (progressMatch && progressMatch[1]) {
        const progress = parseInt(progressMatch[1]);
        
        // Update job status
        if (jobId) {
          queueManager.updateItem(jobId, { 
            status: 'downloading',
            progress
          });
        }
      }
    });
    
    // Handle completion
    wget.on('close', (code) => {
      if (code === 0) {
        console.log(`Download completed: ${destination}`);
        
        // Update job status
        if (jobId) {
          queueManager.updateItem(jobId, { 
            status: 'completed',
            progress: 100
          });
        }
        
        resolve(destination);
      } else {
        console.error(`Download failed with code ${code}`);
        
        // Update job status
        if (jobId) {
          queueManager.updateItem(jobId, { 
            status: 'failed',
            error: `Download failed with code ${code}`
          });
        }
        
        reject(new Error(`Download failed with code ${code}`));
      }
    });
    
    // Handle errors
    wget.on('error', (error) => {
      console.error(`Download error: ${error.message}`);
      
      // Update job status
      if (jobId) {
        queueManager.updateItem(jobId, { 
          status: 'failed',
          error: error.message
        });
      }
      
      reject(error);
    });
  });
}

/**
 * Check if a file should be downloaded based on its extension
 */
function shouldDownloadFile(filename) {
  if (!filename) return false;
  
  // Get the file extension without the dot
  const extension = path.extname(filename).toLowerCase().substring(1);
  
  // Check if the extension is in the allowed formats list
  return allowedFormats.includes(extension);
}

/**
 * Process a download from Internet Archive
 */
async function processDownload(url, destination, jobId) {
  try {
    // Parse URL to get identifier
    const identifier = url.includes('archive.org') 
      ? parseArchiveUrl(url) 
      : url;
    
    if (!identifier) {
      throw new Error('Invalid Internet Archive URL or identifier');
    }
    
    console.log(`Processing download for identifier: ${identifier}`);
    console.log(`Filtering for formats: ${allowedFormats.join(', ')}`);
    
    // Get metadata
    const metadata = await getArchiveMetadata(identifier);
    
    if (!metadata || !metadata.files || metadata.files.length === 0) {
      throw new Error(`No files found for ${identifier}`);
    }
    
    // Find downloadable files that match the allowed formats
    const downloadableFiles = metadata.files.filter(file => 
      file.source === 'original' && 
      !file.name.endsWith('_meta.xml') &&
      shouldDownloadFile(file.name)
    );
    
    if (downloadableFiles.length === 0) {
      throw new Error(`No files matching the selected formats found for ${identifier}`);
    }
    
    console.log(`Found ${downloadableFiles.length} files matching the selected formats`);
    
    // Create destination directory
    const itemDir = path.join(destination, identifier);
    if (!fs.existsSync(itemDir)) {
      fs.mkdirSync(itemDir, { recursive: true });
    }
    
    // Download each file
    for (const file of downloadableFiles) {
      const fileUrl = `https://archive.org/download/${identifier}/${file.name}`;
      const filePath = path.join(itemDir, file.name);
      
      await downloadWithWget(fileUrl, filePath, jobId);
    }
    
    console.log(`All files downloaded for ${identifier}`);
    return true;
  } catch (error) {
    console.error(`Error processing download: ${error.message}`);
    
    // Update job status
    if (jobId) {
      queueManager.updateItem(jobId, { 
        status: 'failed',
        error: error.message
      });
    }
    
    return false;
  }
}

/**
 * Process the download queue
 */
async function processQueue() {
  if (isProcessing) {
    return;
  }
  
  const nextItem = queueManager.getNextItem();
  
  if (!nextItem) {
    console.log('No items in queue to process');
    return;
  }
  
  console.log(`Processing queue item: ${nextItem.url}`);
  isProcessing = true;
  
  try {
    await processDownload(nextItem.url, nextItem.destination, nextItem.id);
    console.log(`Queue item processed. Checking for more items...`);
  } catch (error) {
    console.error(`Error processing queue item: ${error.message}`);
    
    // Update retry count
    const retries = (nextItem.retries || 0) + 1;
    
    if (retries < 3) {
      console.log(`Will retry later (attempt ${retries}/3)`);
      queueManager.updateItem(nextItem.id, { 
        retries,
        status: 'queued',
        error: error.message
      });
    } else {
      console.error(`Failed to download after 3 attempts: ${nextItem.url}`);
      queueManager.updateItem(nextItem.id, { 
        status: 'failed',
        error: `Failed after 3 attempts: ${error.message}`
      });
    }
  } finally {
    isProcessing = false;
    
    // Check if there are more items to process
    setTimeout(processQueue, 1000);
  }
}

/**
 * Start a simple HTTP server for browser-based downloads
 */
function startBrowserServer(port) {
  const express = require('express');
  const cors = require('cors');
  const app = express();
  
  // Enable CORS for all routes
  app.use(cors());
  
  // Parse JSON request body
  app.use(express.json());
  
  // GET endpoint to retrieve queue
  app.get('/api/queue', (req, res) => {
    res.json({ queue: queueManager.getItems() });
  });
  
  // POST endpoint to add download to queue
  app.post('/api/queue', async (req, res) => {
    try {
      const { url, destination, formats } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }
      
      // Create job
      const job = {
        id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        url,
        destination: destination || options.destination,
        formats: formats || {
          mp4: true,
          mov: true,
          mkv: true
        },
        status: 'queued',
        progress: 0,
        createdAt: new Date().toISOString()
      };
      
      // Add to queue
      queueManager.addItem(job);
      
      // Start processing queue if not already running
      setTimeout(processQueue, 100);
      
      res.status(201).json({ 
        message: 'Download added to queue',
        job
      });
    } catch (error) {
      console.error('Error adding to queue:', error);
      res.status(500).json({ error: 'Failed to add download to queue' });
    }
  });
  
  // DELETE endpoint to remove an item from the queue
  app.delete('/api/queue/:id', (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: 'Item ID is required' });
      }
      
      // Get the item first to check if it's currently downloading
      const item = queueManager.getItem(id);
      
      if (!item) {
        return res.status(404).json({ error: 'Item not found in queue' });
      }
      
      // If the item is currently downloading, try to stop it first
      if (item.status === 'downloading') {
        // This is a best-effort approach and may not work in all cases
        try {
          // On macOS/Linux, use ps and grep to find wget processes
          const { execSync } = require('child_process');
          const psOutput = execSync('ps aux').toString();
          
          // Look for wget processes with the item's URL
          const lines = psOutput.split('\n').filter(line => 
            line.includes('wget') && line.includes(item.url)
          );
          
          // Extract PIDs and kill them
          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length > 1) {
              const pid = parts[1];
              try {
                execSync(`kill ${pid}`);
                console.log(`Killed process ${pid} for download ${id}`);
              } catch (killError) {
                console.error(`Failed to kill process ${pid}:`, killError);
              }
            }
          });
        } catch (processError) {
          console.error("Error trying to kill wget processes:", processError);
        }
      }
      
      // Remove the item from the queue
      const success = queueManager.removeItem(id);
      
      if (success) {
        res.json({ success: true, message: 'Item removed from queue' });
      } else {
        res.status(404).json({ error: 'Item not found in queue' });
      }
    } catch (error) {
      console.error('Error removing item from queue:', error);
      res.status(500).json({ error: 'Failed to remove item from queue' });
    }
  });
  
  // POST endpoint to stop a download
  app.post('/api/queue/:id/stop', (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: 'Item ID is required' });
      }
      
      // Get the item
      const item = queueManager.getItem(id);
      
      if (!item) {
        return res.status(404).json({ error: 'Item not found in queue' });
      }
      
      // If the item is currently downloading, try to stop it
      if (item.status === 'downloading') {
        // This is a best-effort approach and may not work in all cases
        try {
          // On macOS/Linux, use ps and grep to find wget processes
          const { execSync } = require('child_process');
          const psOutput = execSync('ps aux').toString();
          
          // Look for wget processes with the item's URL
          const lines = psOutput.split('\n').filter(line => 
            line.includes('wget') && line.includes(item.url)
          );
          
          // Extract PIDs and kill them
          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length > 1) {
              const pid = parts[1];
              try {
                execSync(`kill ${pid}`);
                console.log(`Killed process ${pid} for download ${id}`);
              } catch (killError) {
                console.error(`Failed to kill process ${pid}:`, killError);
              }
            }
          });
        } catch (processError) {
          console.error("Error trying to kill wget processes:", processError);
        }
        
        // Update the item status
        queueManager.updateItem(id, {
          status: 'failed',
          error: 'Download stopped by user'
        });
        
        res.json({ success: true, message: 'Download stopped' });
      } else {
        // If not downloading, just update the status
        queueManager.updateItem(id, {
          status: 'failed',
          error: 'Download stopped by user'
        });
        
        res.json({ success: true, message: 'Download marked as stopped' });
      }
    } catch (error) {
      console.error('Error stopping download:', error);
      res.status(500).json({ error: 'Failed to stop download' });
    }
  });
  
  // POST endpoint to clear the entire queue
  app.post('/api/queue/clear', (req, res) => {
    try {
      // Get all items
      const items = queueManager.getItems();
      
      // Try to stop any active downloads
      items.forEach(item => {
        if (item.status === 'downloading') {
          try {
            // On macOS/Linux, use ps and grep to find wget processes
            const { execSync } = require('child_process');
            const psOutput = execSync('ps aux').toString();
            
            // Look for wget processes with the item's URL
            const lines = psOutput.split('\n').filter(line => 
              line.includes('wget') && line.includes(item.url)
            );
            
            // Extract PIDs and kill them
            lines.forEach(line => {
              const parts = line.trim().split(/\s+/);
              if (parts.length > 1) {
                const pid = parts[1];
                try {
                  execSync(`kill ${pid}`);
                  console.log(`Killed process ${pid} for download ${item.id}`);
                } catch (killError) {
                  console.error(`Failed to kill process ${pid}:`, killError);
                }
              }
            });
          } catch (processError) {
            console.error("Error trying to kill wget processes:", processError);
          }
        }
      });
      
      // Clear the queue
      queueManager.queue = [];
      queueManager.saveQueue();
      
      res.json({ success: true, message: 'Queue cleared' });
    } catch (error) {
      console.error('Error clearing queue:', error);
      res.status(500).json({ error: 'Failed to clear queue' });
    }
  });
  
  // Start server
  app.listen(port, () => {
    console.log(`Browser download server running at http://localhost:${port}`);
    console.log(`API endpoints:`);
    console.log(`- GET /api/queue - Get current queue`);
    console.log(`- POST /api/queue - Add download to queue`);
    console.log(`- DELETE /api/queue/:id - Remove item from queue`);
    console.log(`- POST /api/queue/:id/stop - Stop a download`);
    console.log(`- POST /api/queue/clear - Clear the entire queue`);
  });
}

/**
 * Main function
 */
async function main() {
  console.log('Internet Archive Downloader starting...');
  
  // Start browser server if requested
  if (options.browser) {
    try {
      // Check if express is installed
      require.resolve('express');
      startBrowserServer(options.port);
    } catch (error) {
      console.error('Express is required for browser mode. Install with: npm install express cors');
      process.exit(1);
    }
  }
  
  // Handle direct URL download
  if (options.url) {
    const job = {
      id: Date.now().toString(),
      url: options.url,
      destination: options.destination,
      status: 'queued',
      progress: 0,
      createdAt: new Date().toISOString()
    };
    
    queueManager.addItem(job);
    await processDownload(options.url, options.destination, job.id);
    return;
  }
  
  // Handle identifier download
  if (options.identifier) {
    const job = {
      id: Date.now().toString(),
      url: options.identifier,
      destination: options.destination,
      status: 'queued',
      progress: 0,
      createdAt: new Date().toISOString()
    };
    
    queueManager.addItem(job);
    await processDownload(options.identifier, options.destination, job.id);
    return;
  }
  
  // Start processing the queue
  if (!options.url && !options.identifier && !options.browser) {
    console.log('Starting queue processor...');
    processQueue();
    
    // Keep the process running
    setInterval(() => {
      processQueue();
    }, 10000);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

// Export functions for testing
module.exports = {
  parseArchiveUrl,
  getArchiveMetadata,
  downloadWithWget,
  processDownload,
  processQueue,
  queueManager
}; 