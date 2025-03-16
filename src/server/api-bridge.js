/**
 * API Bridge for Internet Archive Downloader
 * This file provides a bridge between the frontend and backend for Next.js
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');

// Create Express app
const app = express();
const port = process.env.PORT || 9124;

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:9123', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON request body
app.use(express.json());

// API routes prefix
app.use('/api', (req, res, next) => {
  // Log API requests
  console.log(`API Request: ${req.method} ${req.path}`);
  next();
});

// Start the downloader server
function startDownloaderServer() {
  const downloaderPath = path.join(__dirname, 'downloader.js');
  
  console.log('Starting Internet Archive downloader server...');
  console.log(`Downloader script: ${downloaderPath}`);
  
  const server = spawn('node', [
    downloaderPath,
    '--browser',
    '--port', port.toString()
  ], {
    stdio: 'pipe' // Capture output
  });
  
  // Handle server output
  server.stdout.on('data', (data) => {
    console.log(`Downloader: ${data}`);
  });
  
  server.stderr.on('data', (data) => {
    console.error(`Downloader error: ${data}`);
  });
  
  // Handle server process events
  server.on('error', (error) => {
    console.error('Failed to start downloader server:', error);
  });
  
  server.on('close', (code) => {
    console.log(`Downloader server exited with code ${code}`);
    // Restart server if it crashes
    if (code !== 0) {
      console.log('Restarting downloader server...');
      setTimeout(startDownloaderServer, 5000);
    }
  });
  
  // Handle clean shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    server.kill('SIGINT');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    server.kill('SIGTERM');
    process.exit(0);
  });
  
  return server;
}

// Start the downloader server
const downloaderServer = startDownloaderServer();

// Start the server
app.listen(port, () => {
  console.log(`API Bridge server running at http://localhost:${port}`);
}); 