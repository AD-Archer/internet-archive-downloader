#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create the scripts directory if it doesn't exist
const scriptsDir = path.join(process.cwd(), 'scripts');
if (!fs.existsSync(scriptsDir)) {
  fs.mkdirSync(scriptsDir, { recursive: true });
}

// Function to check if a command is available
function isCommandAvailable(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Check if youtube-dl or yt-dlp is installed
const hasYoutubeDl = isCommandAvailable('youtube-dl');
const hasYtDlp = isCommandAvailable('yt-dlp');

if (!hasYoutubeDl && !hasYtDlp) {
  console.error('\x1b[31m%s\x1b[0m', 'ERROR: Neither youtube-dl nor yt-dlp is installed!');
  console.log('\nPlease install youtube-dl or yt-dlp to use this application:');
  console.log('\nOn Ubuntu/Debian:');
  console.log('  sudo apt-get install youtube-dl');
  console.log('\nOn macOS with Homebrew:');
  console.log('  brew install yt-dlp');
  console.log('\nOn Windows:');
  console.log('  Download from https://youtube-dl.org/ or https://github.com/yt-dlp/yt-dlp');
  console.log('\nAfter installation, restart the application.');
  process.exit(1);
} else {
  if (hasYoutubeDl) {
    console.log('\x1b[32m%s\x1b[0m', 'youtube-dl is installed. ✓');
  }
  if (hasYtDlp) {
    console.log('\x1b[32m%s\x1b[0m', 'yt-dlp is installed. ✓');
  }
}

// Check if the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('\x1b[32m%s\x1b[0m', 'Created data directory. ✓');
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'ERROR: Failed to create data directory!');
    console.error(error);
    process.exit(1);
  }
}

console.log('\x1b[32m%s\x1b[0m', 'All dependencies are installed. ✓'); 