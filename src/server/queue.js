/**
 * Persistent queue implementation for Internet Archive downloads
 * Stores queue data in a JSON file with improved file locking
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Default queue file location
const DEFAULT_QUEUE_PATH = path.join(os.homedir(), '.internet-archive-downloader', 'queue.json');

// Lock file path
const getLockFilePath = (queueFile) => `${queueFile}.lock`;

// Ensure directory exists
function ensureDirectoryExists(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

/**
 * Simple file lock implementation
 */
class FileLock {
  constructor(lockFilePath) {
    this.lockFilePath = lockFilePath;
    this.locked = false;
  }

  /**
   * Acquire lock with timeout
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<boolean>} Success
   */
  async acquire(timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        // Try to create lock file
        fs.writeFileSync(this.lockFilePath, String(process.pid), { flag: 'wx' });
        this.locked = true;
        return true;
      } catch (error) {
        // If file exists, check if lock is stale
        if (error.code === 'EEXIST') {
          try {
            const lockData = fs.readFileSync(this.lockFilePath, 'utf8');
            const lockPid = parseInt(lockData, 10);
            
            // Check if process is still running
            try {
              // On Linux/Unix, sending signal 0 checks if process exists
              process.kill(lockPid, 0);
              // Process exists, wait and retry
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (e) {
              // Process doesn't exist, lock is stale
              fs.unlinkSync(this.lockFilePath);
            }
          } catch (readError) {
            // Can't read lock file, wait and retry
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } else {
          // Other error, wait and retry
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    // Timeout reached
    return false;
  }

  /**
   * Release lock
   */
  release() {
    if (this.locked) {
      try {
        fs.unlinkSync(this.lockFilePath);
        this.locked = false;
      } catch (error) {
        console.error('Error releasing lock:', error);
      }
    }
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
    this.lockFile = getLockFilePath(this.queueFile);
    this.lock = new FileLock(this.lockFile);
    
    // In-memory cache of the queue
    this.queue = [];
    
    // Flag to track if we're currently saving
    this.isSaving = false;
    
    // Ensure the directory exists
    ensureDirectoryExists(this.queueFile);
    
    // Load queue initially
    this.loadQueue();
    
    // Throttled save to reduce disk writes
    this.saveThrottled = this.throttle(this.saveQueue.bind(this), 1000);
    
    // Set up file watcher with debounce
    this.setupFileWatcher();
    
    // Clean up lock file on exit
    process.on('exit', () => {
      if (this.lock.locked) {
        this.lock.release();
      }
    });
  }
  
  /**
   * Throttle function to limit calls
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in ms
   * @returns {Function} Throttled function
   */
  throttle(func, limit) {
    let lastCall = 0;
    let timeout = null;
    
    return function(...args) {
      const now = Date.now();
      
      if (now - lastCall >= limit) {
        lastCall = now;
        return func.apply(this, args);
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          lastCall = Date.now();
          func.apply(this, args);
        }, limit - (now - lastCall));
      }
    };
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
      
      // Debounce variable to prevent multiple reloads
      let debounceTimeout = null;
      
      // Watch for changes to the queue file
      fs.watchFile(this.queueFile, { interval: 2000 }, (curr, prev) => {
        // Skip if we're the ones who modified the file
        if (this.isSaving) {
          return;
        }
        
        if (curr.mtime !== prev.mtime) {
          // Clear any pending debounce
          if (debounceTimeout) {
            clearTimeout(debounceTimeout);
          }
          
          // Set new debounce
          debounceTimeout = setTimeout(() => {
            console.log('Queue file changed externally, reloading...');
            this.loadQueue();
            debounceTimeout = null;
          }, 500);
        }
      });
    } catch (error) {
      console.error('Error setting up file watcher:', error);
    }
  }
  
  /**
   * Load queue from file with locking
   * @returns {QueueItem[]} Queue items
   */
  async loadQueue() {
    try {
      // Acquire lock
      const lockAcquired = await this.lock.acquire();
      
      if (!lockAcquired) {
        console.warn('Could not acquire lock to load queue, using cached version');
        return this.queue;
      }
      
      try {
        if (fs.existsSync(this.queueFile)) {
          const data = fs.readFileSync(this.queueFile, 'utf8');
          
          if (!data || data.trim() === '') {
            // Empty file, initialize with empty array
            this.queue = [];
            fs.writeFileSync(this.queueFile, '[]', 'utf8');
          } else {
            try {
              this.queue = JSON.parse(data) || [];
            } catch (parseError) {
              console.error('Error parsing queue file:', parseError);
              // Backup the corrupted file
              const backupPath = `${this.queueFile}.backup.${Date.now()}`;
              fs.copyFileSync(this.queueFile, backupPath);
              console.log(`Backed up corrupted queue file to ${backupPath}`);
              
              // Reset queue and write empty array
              this.queue = [];
              fs.writeFileSync(this.queueFile, '[]', 'utf8');
            }
          }
        } else {
          // File doesn't exist, create it
          this.queue = [];
          fs.writeFileSync(this.queueFile, '[]', 'utf8');
        }
      } finally {
        // Release lock
        this.lock.release();
      }
    } catch (error) {
      console.error('Error loading queue:', error);
    }
    
    return this.queue;
  }
  
  /**
   * Save queue to file with locking
   */
  async saveQueue() {
    try {
      // Set saving flag to prevent file watcher from reloading
      this.isSaving = true;
      
      // Acquire lock
      const lockAcquired = await this.lock.acquire();
      
      if (!lockAcquired) {
        console.warn('Could not acquire lock to save queue, will retry later');
        // Schedule retry
        setTimeout(() => this.saveQueue(), 500);
        this.isSaving = false;
        return;
      }
      
      try {
        ensureDirectoryExists(this.queueFile);
        
        // Write to temporary file first
        const tempFile = `${this.queueFile}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(this.queue, null, 2), 'utf8');
        
        // Rename temp file to actual file (atomic operation)
        fs.renameSync(tempFile, this.queueFile);
      } finally {
        // Release lock
        this.lock.release();
        
        // Reset saving flag after a short delay to ensure file watcher doesn't trigger
        setTimeout(() => {
          this.isSaving = false;
        }, 100);
      }
    } catch (error) {
      console.error('Error saving queue:', error);
      this.isSaving = false;
    }
  }
  
  /**
   * Add item to queue
   * @param {QueueItem} item - Queue item
   * @returns {QueueItem} Added item
   */
  async addItem(item) {
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
    
    // Load latest queue
    await this.loadQueue();
    
    // Check if item with same ID already exists
    const existingIndex = this.queue.findIndex(i => i.id === newItem.id);
    if (existingIndex !== -1) {
      // Update existing item
      this.queue[existingIndex] = { ...this.queue[existingIndex], ...newItem };
    } else {
      // Add new item
      this.queue.push(newItem);
    }
    
    // Save queue
    this.saveThrottled();
    
    return newItem;
  }
  
  /**
   * Get all queue items
   * @returns {QueueItem[]} Queue items
   */
  async getItems() {
    // Load latest queue
    await this.loadQueue();
    return this.queue;
  }
  
  /**
   * Get next item to process
   * @returns {QueueItem|null} Next item or null
   */
  async getNextItem() {
    // Load latest queue
    await this.loadQueue();
    return this.queue.find(item => item.status === 'queued');
  }
  
  /**
   * Get item by ID
   * @param {string} id - Item ID
   * @returns {QueueItem|null} Item or null
   */
  async getItem(id) {
    // Load latest queue
    await this.loadQueue();
    return this.queue.find(item => item.id === id);
  }
  
  /**
   * Update item in queue
   * @param {string} id - Item ID
   * @param {Partial<QueueItem>} updates - Updates to apply
   * @returns {QueueItem|null} Updated item or null
   */
  async updateItem(id, updates) {
    // Load latest queue
    await this.loadQueue();
    
    const index = this.queue.findIndex(item => item.id === id);
    
    if (index === -1) {
      return null;
    }
    
    this.queue[index] = { ...this.queue[index], ...updates };
    
    // Save queue
    this.saveThrottled();
    
    return this.queue[index];
  }
  
  /**
   * Remove item from queue
   * @param {string} id - Item ID
   * @returns {boolean} Success
   */
  async removeItem(id) {
    // Load latest queue
    await this.loadQueue();
    
    const index = this.queue.findIndex(item => item.id === id);
    
    if (index === -1) {
      return false;
    }
    
    // Remove the item
    this.queue.splice(index, 1);
    
    // Save queue
    await this.saveQueue();
    
    return true;
  }
  
  /**
   * Clear the entire queue
   * @returns {boolean} Success
   */
  async clearQueue() {
    this.queue = [];
    await this.saveQueue();
    return true;
  }
}

module.exports = QueueManager; 