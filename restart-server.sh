#!/bin/bash
# Script to restart the Internet Archive Downloader server

echo "Internet Archive Downloader Server Restart Script"
echo "================================================"
echo

# Stop any running downloader processes
echo "Stopping any running downloader processes..."
pkill -f "node.*downloader"
sleep 2

# Kill any wget processes
echo "Stopping any wget download processes..."
pkill -f wget
sleep 1

# Reset the queue file
QUEUE_FILE="$HOME/.internet-archive-downloader/queue.json"
echo "Checking queue file..."
if [ ! -f "$QUEUE_FILE" ]; then
  echo "Creating empty queue file..."
  mkdir -p "$(dirname "$QUEUE_FILE")"
  echo "[]" > "$QUEUE_FILE"
  chmod 644 "$QUEUE_FILE"
fi

# Remove any lock files
echo "Removing lock files..."
rm -f "$QUEUE_FILE.lock" "$QUEUE_FILE.tmp"

# Start the downloader server
echo "Starting downloader server..."
cd "$(dirname "$0")"
nohup node src/server/downloader.js --browser --port 3001 > downloader.log 2>&1 &

echo "Downloader server started with PID: $!"
echo "Check downloader.log for output"
echo
echo "Server has been restarted"
echo "You can now add new downloads to the queue" 