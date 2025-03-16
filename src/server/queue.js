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
 * Queue item structure
 * @typedef {Object} QueueItem
 * @property {string} id - Unique identifier
 * @property {string} url - Internet Archive URL
 * @property {string} destination - Download destination
 * @property {Object} formats - Object with format keys and boolean values
 * @property {string} status - Status (queued, downloading, completed, failed)
 * @property {number} progress - Download progress (0-100)
 * @property {string} [estimatedTime] - Estimated time remaining
 * @property {string} [error] - Error message if failed
 * @property {string} createdAt - Creation timestamp
 */

/**
 * Queue manager for Internet Archive downloads
 */
class QueueManager {
  /**
   * Create a queue manager
   * @param {string} [queueFile] - Path to queue file
   */
  constructor(queueFile) {
    this.queueFile = queueFile || DEFAULT_QUEUE_PATH;
    // Ensure the directory exists
    ensureDirectoryExists(this.queueFile);
    this.queue = this.loadQueue();
    
    // Set up file watcher to detect external changes
    this.setupFileWatcher();
  }
  
  /**
   * Set up a file watcher to detect external changes to the queue file
   */
  setupFileWatcher() {
    try {
      // Create the file if it doesn't exist
      if (!fs.existsSync(this.queueFile)) {
        this.saveQueue();
      }
      
      // Watch for changes to the queue file
      fs.watchFile(this.queueFile, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          console.log('Queue file changed externally, reloading...');
          this.queue = this.loadQueue();
        }
      });
    } catch (error) {
      console.error('Error setting up file watcher:', error);
    }
  }
  
  /**
   * Load queue from file
   * @returns {QueueItem[]} Queue items
   */
  loadQueue() {
    try {
      if (fs.existsSync(this.queueFile)) {
        const data = fs.readFileSync(this.queueFile, 'utf8');
        try {
          return JSON.parse(data) || [];
        } catch (parseError) {
          console.error('Error parsing queue file:', parseError);
          // Backup the corrupted file
          const backupPath = `${this.queueFile}.backup.${Date.now()}`;
          fs.copyFileSync(this.queueFile, backupPath);
          console.log(`Backed up corrupted queue file to ${backupPath}`);
          return [];
        }
      }
    } catch (error) {
      console.error('Error loading queue:', error);
    }
    
    return [];
  }
  
  /**
   * Save queue to file
   */
  saveQueue() {
    try {
      ensureDirectoryExists(this.queueFile);
      fs.writeFileSync(this.queueFile, JSON.stringify(this.queue, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving queue:', error);
    }
  }
  
  /**
   * Add item to queue
   * @param {QueueItem} item - Queue item
   * @returns {QueueItem} Added item
   */
  addItem(item) {
    // Reload queue to ensure we have the latest version
    this.queue = this.loadQueue();
    
    // Ensure required fields
    const newItem = {
      id: item.id || `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      url: item.url,
      destination: item.destination,
      formats: item.formats || { mp4: true, mov: true, mkv: true },
      status: item.status || 'queued',
      progress: item.progress || 0,
      createdAt: item.createdAt || new Date().toISOString()
    };
    
    // Check if item with same ID already exists
    const existingIndex = this.queue.findIndex(i => i.id === newItem.id);
    if (existingIndex !== -1) {
      // Update existing item
      this.queue[existingIndex] = { ...this.queue[existingIndex], ...newItem };
    } else {
      // Add new item
      this.queue.push(newItem);
    }
    
    this.saveQueue();
    
    return newItem;
  }
  
  /**
   * Get all queue items
   * @returns {QueueItem[]} Queue items
   */
  getItems() {
    // Reload queue to ensure we have the latest version
    this.queue = this.loadQueue();
    return this.queue;
  }
  
  /**
   * Get next item to process
   * @returns {QueueItem|null} Next item or null
   */
  getNextItem() {
    // Reload queue to ensure we have the latest version
    this.queue = this.loadQueue();
    return this.queue.find(item => item.status === 'queued');
  }
  
  /**
   * Get item by ID
   * @param {string} id - Item ID
   * @returns {QueueItem|null} Item or null
   */
  getItem(id) {
    // Reload queue to ensure we have the latest version
    this.queue = this.loadQueue();
    return this.queue.find(item => item.id === id);
  }
  
  /**
   * Update item in queue
   * @param {string} id - Item ID
   * @param {Partial<QueueItem>} updates - Updates to apply
   * @returns {QueueItem|null} Updated item or null
   */
  updateItem(id, updates) {
    // Reload queue to ensure we have the latest version
    this.queue = this.loadQueue();
    
    const index = this.queue.findIndex(item => item.id === id);
    
    if (index === -1) {
      return null;
    }
    
    this.queue[index] = { ...this.queue[index], ...updates };
    this.saveQueue();
    
    return this.queue[index];
  }
  
  /**
   * Remove item from queue
   * @param {string} id - Item ID
   * @returns {boolean} Success
   */
  removeItem(id) {
    // Reload queue to ensure we have the latest version
    this.queue = this.loadQueue();
    
    const index = this.queue.findIndex(item => item.id === id);
    
    if (index === -1) {
      return false;
    }
    
    // Remove the item
    this.queue.splice(index, 1);
    this.saveQueue();
    
    // Verify the item was actually removed
    const verifyQueue = this.loadQueue();
    const stillExists = verifyQueue.some(item => item.id === id);
    
    if (stillExists) {
      console.error(`Failed to remove item ${id} from queue, trying again...`);
      // Try one more time with a direct approach
      this.queue = verifyQueue.filter(item => item.id !== id);
      this.saveQueue();
    }
    
    return true;
  }
  
  /**
   * Clear the entire queue
   * @returns {boolean} Success
   */
  clearQueue() {
    this.queue = [];
    this.saveQueue();
    return true;
  }
}

module.exports = QueueManager; 