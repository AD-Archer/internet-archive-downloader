#!/usr/bin/env node

/**
 * Script to start the Internet Archive downloader server
 * This allows browser-based testing of the downloader
 */

const path = require('path');
const { spawn } = require('child_process');

// Path to the downloader script
const downloaderPath = path.join(__dirname, 'downloader.js');

// Custom port configuration
const port = process.env.PORT || 8124;

// Start the downloader in browser mode
console.log('Starting Internet Archive downloader server...');
console.log(`Downloader script: ${downloaderPath}`);

const server = spawn('node', [
  downloaderPath,
  '--browser',
  '--port', port.toString()
], {
  stdio: 'inherit'
});

// Handle server process events
server.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
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

console.log(`Server starting on port ${port}...`);
console.log('Press Ctrl+C to stop the server'); 