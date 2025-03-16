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
const os = require('os');

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
  .option('-s, --search <query>', 'Search Internet Archive and download all results')
  .option('-n, --notifications', 'Enable notifications for download events')
  .option('-c, --concurrent <number>', 'Number of concurrent downloads', '1')
  .option('--skip-existing', 'Skip existing files with matching size')
  .option('--no-index', 'Disable creation of HTML index files')
  .parse(process.argv);

const options = program.opts();

// Initialize queue manager
const queueManager = new QueueManager(options.queue);

// Flag to track if download process is running
let isProcessing = false;
// Track concurrent downloads
let activeDownloads = 0;
const maxConcurrentDownloads = parseInt(options.concurrent) || 1;

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
 * Search Internet Archive for items
 * @param {string} query - Search query
 * @returns {Promise<Array>} Search results
 */
async function searchArchive(query) {
  try {
    const response = await axios.get(`https://archive.org/advancedsearch.php`, {
      params: {
        q: query,
        fl: ['identifier', 'title', 'description', 'mediatype', 'collection', 'creator', 'date'],
        rows: 50,
        page: 1,
        output: 'json'
      }
    });
    
    return response.data?.response?.docs || [];
  } catch (error) {
    console.error(`Error searching Internet Archive:`, error.message);
    throw new Error(`Failed to search Internet Archive: ${error.message}`);
  }
}

/**
 * Download a file using wget
 */
async function downloadWithWget(url, destination, jobId, fileIndex, totalFiles) {
  return new Promise((resolve, reject) => {
    // Ensure destination directory exists
    const dir = path.dirname(destination);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const fileName = path.basename(destination);
    const progressInfo = fileIndex && totalFiles ? `(${fileIndex}/${totalFiles})` : '';
    console.log(`Downloading ${fileName} ${progressInfo} to ${destination}`);
    
    // Update job status
    if (jobId) {
      queueManager.updateItem(jobId, { 
        status: 'downloading',
        progress: 0,
        currentFile: fileName,
        fileIndex: fileIndex,
        totalFiles: totalFiles,
        startTime: Date.now()
      });
    }
    
    // Use wget to download the file
    const wget = spawn('wget', [
      url,
      '-O', destination,
      '--progress=dot:mega',
      '--continue', // Resume partially downloaded files
      '--retry-connrefused',
      '--waitretry=1',
      '--read-timeout=20',
      '--timeout=15',
      '--tries=5'
    ]);
    
    // Track download progress
    wget.stderr.on('data', (data) => {
      const output = data.toString();
      
      // Parse wget output to get progress
      const progressMatch = output.match(/(\d+)%/);
      if (progressMatch && progressMatch[1]) {
        const progress = parseInt(progressMatch[1]);
        
        // Calculate overall progress if we have multiple files
        let overallProgress = progress;
        if (fileIndex && totalFiles) {
          overallProgress = Math.floor(((fileIndex - 1) * 100 + progress) / totalFiles);
        }
        
        // Calculate estimated time remaining
        const elapsedMs = Date.now() - (queueManager.getItem(jobId)?.startTime || Date.now());
        let estimatedTimeRemaining = null;
        
        if (progress > 0 && elapsedMs > 0) {
          const totalTimeMs = (elapsedMs / progress) * 100;
          const remainingTimeMs = totalTimeMs - elapsedMs;
          
          // Format time remaining
          if (remainingTimeMs > 0) {
            const seconds = Math.floor(remainingTimeMs / 1000) % 60;
            const minutes = Math.floor(remainingTimeMs / (1000 * 60)) % 60;
            const hours = Math.floor(remainingTimeMs / (1000 * 60 * 60));
            
            estimatedTimeRemaining = `${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`;
          }
        }
        
        // Calculate download speed
        const speedMatch = output.match(/(\d+\.?\d*)\s+(KB|MB|GB)\/s/);
        let downloadSpeed = null;
        if (speedMatch && speedMatch[1] && speedMatch[2]) {
          downloadSpeed = `${speedMatch[1]} ${speedMatch[2]}/s`;
        }
        
        // Update job status
        if (jobId) {
          queueManager.updateItem(jobId, { 
            status: 'downloading',
            progress: overallProgress,
            fileProgress: progress,
            currentFile: fileName,
            fileIndex: fileIndex,
            totalFiles: totalFiles,
            estimatedTime: estimatedTimeRemaining,
            downloadSpeed: downloadSpeed
          });
        }
        
        // Log progress to console with more details
        if (downloadSpeed && estimatedTimeRemaining) {
          console.log(`Downloading ${fileName} ${progressInfo}: ${progress}% (${downloadSpeed}, ETA: ${estimatedTimeRemaining})`);
        }
      }
    });
    
    // Handle completion
    wget.on('close', (code) => {
      if (code === 0) {
        console.log(`Download completed: ${fileName} ${progressInfo}`);
        
        // Update job status
        if (jobId) {
          // If this is the last file, mark as completed
          if (!fileIndex || fileIndex === totalFiles) {
            queueManager.updateItem(jobId, { 
              status: 'completed',
              progress: 100,
              fileProgress: 100,
              estimatedTime: null,
              completedAt: new Date().toISOString()
            });
          } else {
            // Otherwise just update the file progress
            queueManager.updateItem(jobId, { 
              fileProgress: 100
            });
          }
        }
        
        resolve(destination);
      } else {
        console.error(`Download failed with code ${code}: ${fileName}`);
        
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
    
    // Update job status to show we're fetching metadata
    if (jobId) {
      queueManager.updateItem(jobId, {
        status: 'fetching_metadata',
        progress: 0,
        message: 'Fetching metadata from Internet Archive'
      });
    }
    
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
    
    // Sort files by size (largest first) to optimize download time perception
    downloadableFiles.sort((a, b) => (b.size || 0) - (a.size || 0));
    
    // Calculate total size
    const totalSizeBytes = downloadableFiles.reduce((sum, file) => sum + (parseInt(file.size) || 0), 0);
    const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);
    
    console.log(`Found ${downloadableFiles.length} files matching the selected formats (${totalSizeMB} MB total)`);
    
    // Update job with file count and size information
    if (jobId) {
      queueManager.updateItem(jobId, {
        totalFiles: downloadableFiles.length,
        totalSize: totalSizeBytes,
        totalSizeFormatted: formatFileSize(totalSizeBytes),
        status: 'queued',
        message: `Ready to download ${downloadableFiles.length} files (${formatFileSize(totalSizeBytes)})`
      });
    }
    
    // Create destination directory
    const itemDir = path.join(destination, identifier);
    if (!fs.existsSync(itemDir)) {
      fs.mkdirSync(itemDir, { recursive: true });
    }
    
    // Save metadata for reference
    fs.writeFileSync(
      path.join(itemDir, '_metadata.json'), 
      JSON.stringify(metadata, null, 2), 
      'utf8'
    );
    
    // Count files that will be downloaded (excluding skipped ones)
    let filesToDownload = downloadableFiles.length;
    let filesSkipped = 0;
    
    // Check for existing files first if skip-existing is enabled
    if (options.skipExisting) {
      for (const file of downloadableFiles) {
        const filePath = path.join(itemDir, file.name);
        if (fs.existsSync(filePath)) {
          try {
            const stats = fs.statSync(filePath);
            if (stats.size === parseInt(file.size)) {
              filesSkipped++;
              filesToDownload--;
            }
          } catch (error) {
            console.error(`Error checking file: ${error.message}`);
          }
        }
      }
      
      if (filesSkipped > 0) {
        console.log(`Skipping ${filesSkipped} already downloaded files with matching size`);
      }
    }
    
    // If all files are skipped, we're done
    if (filesToDownload === 0) {
      console.log(`All files already downloaded for ${identifier}`);
      
      // Update job status
      if (jobId) {
        queueManager.updateItem(jobId, { 
          status: 'completed',
          progress: 100,
          message: 'All files already downloaded',
          completedAt: new Date().toISOString()
        });
      }
      
      // Create index file if enabled
      if (options.index !== false) {
        createIndexFile(itemDir, identifier, downloadableFiles);
      }
      
      return true;
    }
    
    // Download each file
    for (let i = 0; i < downloadableFiles.length; i++) {
      const file = downloadableFiles[i];
      const fileUrl = `https://archive.org/download/${identifier}/${file.name}`;
      const filePath = path.join(itemDir, file.name);
      
      // Skip already completed files with matching size if skip-existing is enabled
      if (options.skipExisting && fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath);
          if (stats.size === parseInt(file.size)) {
            console.log(`Skipping already downloaded file: ${file.name} (${formatFileSize(file.size)})`);
            continue;
          } else {
            console.log(`File size mismatch for ${file.name}, will resume download`);
          }
        } catch (error) {
          console.error(`Error checking file: ${error.message}`);
        }
      }
      
      await downloadWithWget(fileUrl, filePath, jobId, i + 1, downloadableFiles.length);
    }
    
    console.log(`All files downloaded for ${identifier}`);
    
    // Create a simple HTML index file for browsing the downloaded content if enabled
    if (options.index !== false) {
      createIndexFile(itemDir, identifier, downloadableFiles);
    }
    
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
 * Format file size in human-readable format
 */
function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  
  return `${bytes.toFixed(2)} ${units[i]}`;
}

/**
 * Create a simple HTML index file for browsing downloaded content
 */
function createIndexFile(directory, identifier, files) {
  try {
    const indexPath = path.join(directory, 'index.html');
    
    // Generate HTML content
    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Internet Archive - ${identifier}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .file-list { list-style: none; padding: 0; }
        .file-item { padding: 10px; border-bottom: 1px solid #eee; }
        .file-item:hover { background-color: #f5f5f5; }
        .file-link { text-decoration: none; color: #0066cc; display: block; }
        .file-link:hover { text-decoration: underline; }
        .file-meta { color: #666; font-size: 0.9em; margin-top: 5px; }
      </style>
    </head>
    <body>
      <h1>Internet Archive - ${identifier}</h1>
      <p>Downloaded content from <a href="https://archive.org/details/${identifier}" target="_blank">archive.org/details/${identifier}</a></p>
      <h2>Files</h2>
      <ul class="file-list">
    `;
    
    // Add each file
    files.forEach(file => {
      const size = formatFileSize(file.size);
      html += `
        <li class="file-item">
          <a class="file-link" href="./${file.name}">${file.name}</a>
          <div class="file-meta">Size: ${size}</div>
        </li>
      `;
    });
    
    html += `
      </ul>
      <footer>
        <p>Generated by Internet Archive Downloader on ${new Date().toLocaleString()}</p>
      </footer>
    </body>
    </html>
    `;
    
    // Write the file
    fs.writeFileSync(indexPath, html, 'utf8');
    console.log(`Created index file at ${indexPath}`);
  } catch (error) {
    console.error(`Error creating index file: ${error.message}`);
  }
}

/**
 * Process the download queue
 */
async function processQueue() {
  // Check if queue is paused
  if (global.queuePaused === true) {
    console.log('Queue is paused, not processing');
    return;
  }
  
  // Check if we've reached the maximum number of concurrent downloads
  if (activeDownloads >= maxConcurrentDownloads) {
    return;
  }
  
  // Get all queued items
  const queuedItems = queueManager.getItems().filter(item => item.status === 'queued');
  
  if (queuedItems.length === 0) {
    console.log('No items in queue to process');
    return;
  }
  
  // Sort by priority and creation date
  queuedItems.sort((a, b) => {
    // First by priority
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    const priorityA = priorityOrder[a.priority || 'normal'];
    const priorityB = priorityOrder[b.priority || 'normal'];
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Then by creation date (oldest first)
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
  
  // Get the next item to process
  const nextItem = queuedItems[0];
  
  console.log(`Processing queue item: ${nextItem.url} (${activeDownloads + 1}/${maxConcurrentDownloads} active downloads)`);
  activeDownloads++;
  
  // Process the download asynchronously
  processDownload(nextItem.url, nextItem.destination, nextItem.id)
    .then(() => {
      console.log(`Queue item processed: ${nextItem.url}`);
      
      // Send notification if enabled
      if (options.notifications) {
        sendNotification('Download Complete', `Finished downloading ${nextItem.url}`);
      }
    })
    .catch(error => {
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
        
        // Send notification if enabled
        if (options.notifications) {
          sendNotification('Download Failed', `Failed to download ${nextItem.url}: ${error.message}`);
        }
      }
    })
    .finally(() => {
      // Decrement active downloads counter
      activeDownloads--;
      
      // Check for more items to process
      setTimeout(processQueue, 100);
    });
  
  // If we can start more downloads, do so immediately
  if (activeDownloads < maxConcurrentDownloads) {
    setTimeout(processQueue, 100);
  }
}

/**
 * Send a notification (platform-specific)
 */
function sendNotification(title, message) {
  try {
    // For Linux servers, we can use the 'node-notifier' package
    // This is just a placeholder - actual implementation would depend on the server setup
    console.log(`NOTIFICATION: ${title} - ${message}`);
    
    // Log to a notifications file
    const notificationLog = path.join(os.homedir(), '.internet-archive-downloader', 'notifications.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${title}: ${message}\n`;
    
    try {
      // Ensure directory exists
      const dir = path.dirname(notificationLog);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Append to log file
      fs.appendFileSync(notificationLog, logEntry);
    } catch (error) {
      console.error('Error logging notification:', error);
    }
  } catch (error) {
    console.error('Error sending notification:', error);
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
  
  // GET endpoint to retrieve queue stats
  app.get('/api/queue/stats', (req, res) => {
    const items = queueManager.getItems();
    
    const stats = {
      total: items.length,
      queued: items.filter(item => item.status === 'queued').length,
      downloading: items.filter(item => item.status === 'downloading').length,
      completed: items.filter(item => item.status === 'completed').length,
      failed: items.filter(item => item.status === 'failed').length,
      totalSize: items.reduce((sum, item) => sum + (parseInt(item.totalSize) || 0), 0),
      totalSizeFormatted: formatFileSize(items.reduce((sum, item) => sum + (parseInt(item.totalSize) || 0), 0))
    };
    
    res.json({ stats });
  });
  
  // GET endpoint to search Internet Archive
  app.get('/api/search', async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }
      
      const results = await searchArchive(query);
      res.json({ results });
    } catch (error) {
      console.error('Error searching Internet Archive:', error);
      res.status(500).json({ error: 'Failed to search Internet Archive' });
    }
  });
  
  // GET endpoint to retrieve item metadata
  app.get('/api/metadata/:identifier', async (req, res) => {
    try {
      const { identifier } = req.params;
      
      if (!identifier) {
        return res.status(400).json({ error: 'Identifier is required' });
      }
      
      const metadata = await getArchiveMetadata(identifier);
      res.json({ metadata });
    } catch (error) {
      console.error('Error fetching metadata:', error);
      res.status(500).json({ error: 'Failed to fetch metadata' });
    }
  });
  
  // POST endpoint to add download to queue
  app.post('/api/queue', async (req, res) => {
    try {
      const { url, destination, formats, priority } = req.body;
      
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
        priority: priority || 'normal', // Can be 'high', 'normal', 'low'
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
  
  // POST endpoint to add batch downloads to queue
  app.post('/api/queue/batch', async (req, res) => {
    try {
      const { items, destination, formats, priority } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items array is required' });
      }
      
      const jobs = [];
      
      // Process each item
      for (const item of items) {
        if (!item.url && !item.identifier) {
          continue; // Skip invalid items
        }
        
        const url = item.url || item.identifier;
        
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
          priority: priority || 'normal',
          createdAt: new Date().toISOString()
        };
        
        // Add to queue
        queueManager.addItem(job);
        jobs.push(job);
      }
      
      // Start processing queue if not already running
      setTimeout(processQueue, 100);
      
      res.status(201).json({ 
        message: `Added ${jobs.length} downloads to queue`,
        jobs
      });
    } catch (error) {
      console.error('Error adding batch to queue:', error);
      res.status(500).json({ error: 'Failed to add batch downloads to queue' });
    }
  });
  
  // POST endpoint to pause/resume the queue
  app.post('/api/queue/pause', (req, res) => {
    try {
      const { paused } = req.body;
      
      if (paused === true) {
        // Set global flag to pause processing
        global.queuePaused = true;
        res.json({ success: true, message: 'Queue paused' });
      } else {
        // Resume processing
        global.queuePaused = false;
        
        // Restart queue processing
        setTimeout(processQueue, 100);
        
        res.json({ success: true, message: 'Queue resumed' });
      }
    } catch (error) {
      console.error('Error pausing/resuming queue:', error);
      res.status(500).json({ error: 'Failed to pause/resume queue' });
    }
  });
  
  // GET endpoint to check if queue is paused
  app.get('/api/queue/status', (req, res) => {
    res.json({ 
      paused: global.queuePaused === true,
      processing: isProcessing
    });
  });
  
  // POST endpoint to retry a failed download
  app.post('/api/queue/:id/retry', (req, res) => {
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
      
      // Reset the item status
      queueManager.updateItem(id, {
        status: 'queued',
        progress: 0,
        error: null,
        retries: 0
      });
      
      // Start processing queue if not already running
      setTimeout(processQueue, 100);
      
      res.json({ success: true, message: 'Download queued for retry' });
    } catch (error) {
      console.error('Error retrying download:', error);
      res.status(500).json({ error: 'Failed to retry download' });
    }
  });
  
  // POST endpoint to prioritize a download
  app.post('/api/queue/:id/prioritize', (req, res) => {
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
      
      // Update priority
      queueManager.updateItem(id, {
        priority: 'high'
      });
      
      res.json({ success: true, message: 'Download prioritized' });
    } catch (error) {
      console.error('Error prioritizing download:', error);
      res.status(500).json({ error: 'Failed to prioritize download' });
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
      
      // Clear the queue using the new method
      queueManager.clearQueue();
      
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
    console.log(`- GET /api/queue/stats - Get queue statistics`);
    console.log(`- GET /api/queue/status - Check if queue is paused`);
    console.log(`- GET /api/search - Search Internet Archive`);
    console.log(`- GET /api/metadata/:identifier - Get item metadata`);
    console.log(`- POST /api/queue - Add download to queue`);
    console.log(`- POST /api/queue/batch - Add batch downloads to queue`);
    console.log(`- POST /api/queue/pause - Pause/resume the queue`);
    console.log(`- POST /api/queue/:id/retry - Retry a failed download`);
    console.log(`- POST /api/queue/:id/prioritize - Prioritize a download`);
    console.log(`- POST /api/queue/:id/stop - Stop a download`);
    console.log(`- DELETE /api/queue/:id - Remove item from queue`);
    console.log(`- POST /api/queue/clear - Clear the entire queue`);
  });
}

/**
 * Main function
 */
async function main() {
  console.log('Internet Archive Downloader starting...');
  
  // Initialize global state
  global.queuePaused = false;
  
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
  
  // Handle search query
  if (options.search) {
    try {
      console.log(`Searching Internet Archive for: ${options.search}`);
      const results = await searchArchive(options.search);
      
      if (results.length === 0) {
        console.error('No results found for search query');
        process.exit(1);
      }
      
      console.log(`Found ${results.length} results for search query`);
      
      // Add each result to the queue
      for (const result of results) {
        const job = {
          id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          url: result.identifier,
          destination: options.destination,
          status: 'queued',
          progress: 0,
          title: result.title,
          createdAt: new Date().toISOString()
        };
        
        console.log(`Adding to queue: ${result.title} (${result.identifier})`);
        queueManager.addItem(job);
      }
      
      // Start processing the queue
      processQueue();
      
      // Keep the process running
      setInterval(() => {
        processQueue();
      }, 10000);
      
      return;
    } catch (error) {
      console.error('Error searching Internet Archive:', error.message);
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
  if (!options.url && !options.identifier && !options.browser && !options.search) {
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
  searchArchive,
  downloadWithWget,
  processDownload,
  processQueue,
  queueManager
}; 