#!/bin/bash
# Script to fix Internet Archive Downloader queue issues

echo "Internet Archive Downloader Queue Fix Script"
echo "==========================================="
echo

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script with sudo or as root"
  exit 1
fi

# Stop any running downloader processes
echo "Stopping any running downloader processes..."
pkill -f "node.*downloader"
sleep 2

# Kill any wget processes
echo "Stopping any wget download processes..."
pkill -f wget
sleep 1

# Backup the queue file
QUEUE_FILE="$HOME/.internet-archive-downloader/queue.json"
BACKUP_DIR="$HOME/.internet-archive-downloader/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "Backing up queue file..."
mkdir -p "$BACKUP_DIR"
if [ -f "$QUEUE_FILE" ]; then
  cp "$QUEUE_FILE" "$BACKUP_DIR/queue.json.backup.$TIMESTAMP"
  echo "Queue file backed up to $BACKUP_DIR/queue.json.backup.$TIMESTAMP"
fi

# Reset the queue file
echo "Resetting queue file..."
mkdir -p "$(dirname "$QUEUE_FILE")"
echo "[]" > "$QUEUE_FILE"
chmod 644 "$QUEUE_FILE"

# Remove any lock files
echo "Removing lock files..."
rm -f "$QUEUE_FILE.lock" "$QUEUE_FILE.tmp"

# Check for the updated queue.js file
echo "Checking for updated queue.js file..."
PROJECT_DIR="$HOME/projects/node/internet-archive-downloader"
if [ -d "$PROJECT_DIR" ]; then
  cd "$PROJECT_DIR"
  
  # Pull latest changes if it's a git repository
  if [ -d ".git" ]; then
    echo "Pulling latest changes from git..."
    git pull
  fi
  
  # Install dependencies
  echo "Installing dependencies..."
  npm install
  
  # Start the downloader server
  echo "Starting downloader server..."
  nohup node src/server/downloader.js > downloader.log 2>&1 &
  
  echo "Downloader server started with PID: $!"
  echo "Check downloader.log for output"
else
  echo "Project directory not found at $PROJECT_DIR"
  echo "Please update the script with the correct path"
fi

echo
echo "Queue has been reset and downloader restarted"
echo "You can now add new downloads to the queue" 