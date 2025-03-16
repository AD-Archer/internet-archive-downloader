/**
 * Persistent queue implementation for Internet Archive downloads
 * Stores queue data in a JSON file
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Default queue file location
const DEFAULT_QUEUE_PATH = path.join(os.homedir(), '.internet-archive-downloader', 'queue.json');

// Ensure directory exists
function ensureDirectoryExists(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

/**
 * Queue manager for persistent download tracking
 */
class QueueManager {
  constructor(queuePath = DEFAULT_QUEUE_PATH) {
    this.queuePath = queuePath;
    this.queue = [];
    this.loadQueue();
  }

  /**
   * Load queue from file
   */
  loadQueue() {
    try {
      ensureDirectoryExists(this.queuePath);
      
      if (fs.existsSync(this.queuePath)) {
        const data = fs.readFileSync(this.queuePath, 'utf8');
        this.queue = JSON.parse(data);
        console.log(`Loaded ${this.queue.length} items from queue file: ${this.queuePath}`);
      } else {
        // Initialize empty queue file
        this.saveQueue();
        console.log(`Initialized new queue file: ${this.queuePath}`);
      }
    } catch (error) {
      console.error(`Error loading queue file: ${error.message}`);
      this.queue = [];
    }
  }

  /**
   * Save queue to file
   */
  saveQueue() {
    try {
      ensureDirectoryExists(this.queuePath);
      fs.writeFileSync(this.queuePath, JSON.stringify(this.queue, null, 2), 'utf8');
    } catch (error) {
      console.error(`Error saving queue file: ${error.message}`);
    }
  }

  /**
   * Add item to queue
   */
  addItem(item) {
    this.queue.push(item);
    this.saveQueue();
    return item;
  }

  /**
   * Update an existing queue item
   */
  updateItem(id, updates) {
    const index = this.queue.findIndex(item => item.id === id);
    
    if (index !== -1) {
      this.queue[index] = { ...this.queue[index], ...updates };
      this.saveQueue();
      return this.queue[index];
    }
    
    return null;
  }

  /**
   * Remove item from queue
   */
  removeItem(id) {
    const index = this.queue.findIndex(item => item.id === id);
    
    if (index !== -1) {
      const [removed] = this.queue.splice(index, 1);
      this.saveQueue();
      return removed;
    }
    
    return null;
  }

  /**
   * Get all queue items
   */
  getItems() {
    return this.queue;
  }

  /**
   * Get next item to process
   */
  getNextItem() {
    return this.queue.find(item => item.status === 'queued');
  }

  /**
   * Get item by ID
   */
  getItem(id) {
    return this.queue.find(item => item.id === id);
  }
}

module.exports = QueueManager; 