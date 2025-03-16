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
    this.queueFile = queueFile || path.join(os.tmpdir(), 'archive-download-queue.json');
    this.queue = this.loadQueue();
  }
  
  /**
   * Load queue from file
   * @returns {QueueItem[]} Queue items
   */
  loadQueue() {
    try {
      if (fs.existsSync(this.queueFile)) {
        const data = fs.readFileSync(this.queueFile, 'utf8');
        return JSON.parse(data);
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
    // Ensure required fields
    const newItem = {
      id: item.id || `job_${Date.now()}`,
      url: item.url,
      destination: item.destination,
      formats: item.formats || { mp4: true, mov: true, mkv: true },
      status: item.status || 'queued',
      progress: item.progress || 0,
      createdAt: item.createdAt || new Date().toISOString()
    };
    
    this.queue.push(newItem);
    this.saveQueue();
    
    return newItem;
  }
  
  /**
   * Get all queue items
   * @returns {QueueItem[]} Queue items
   */
  getItems() {
    return this.queue;
  }
  
  /**
   * Get next item to process
   * @returns {QueueItem|null} Next item or null
   */
  getNextItem() {
    return this.queue.find(item => item.status === 'queued');
  }
  
  /**
   * Update item in queue
   * @param {string} id - Item ID
   * @param {Partial<QueueItem>} updates - Updates to apply
   * @returns {QueueItem|null} Updated item or null
   */
  updateItem(id, updates) {
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
    const index = this.queue.findIndex(item => item.id === id);
    
    if (index === -1) {
      return false;
    }
    
    this.queue.splice(index, 1);
    this.saveQueue();
    
    return true;
  }

  /**
   * Get item by ID
   */
  getItem(id) {
    return this.queue.find(item => item.id === id);
  }
}

module.exports = QueueManager; 