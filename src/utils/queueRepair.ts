import fs from 'fs';
import path from 'path';

/**
 * Utility to check and repair the queue file on application startup
 */

// Path to queue data file
const queueFilePath = path.join(process.cwd(), "data", "queue.json");

/**
 * Attempts to fix corrupted JSON data
 * @param data The potentially corrupted JSON string
 * @returns A valid JSON object or empty default
 */
export const fixCorruptedJson = (data: string): { queue: any[] } => {
  try {
    // First try normal parsing
    return JSON.parse(data);
  } catch (error) {
    console.error("JSON parse error, attempting to fix:", error);
    
    try {
      // Try to fix common JSON corruption issues
      
      // 1. Remove any trailing commas before closing brackets
      let fixedData = data.replace(/,\s*([\]}])/g, '$1');
      
      // 2. Add missing closing brackets if needed
      const openBraces = (data.match(/\{/g) || []).length;
      const closeBraces = (data.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        fixedData = fixedData + '}'.repeat(openBraces - closeBraces);
      }
      
      // 3. Add missing closing square brackets if needed
      const openBrackets = (data.match(/\[/g) || []).length;
      const closeBrackets = (data.match(/\]/g) || []).length;
      if (openBrackets > closeBrackets) {
        fixedData = fixedData + ']'.repeat(openBrackets - closeBrackets);
      }
      
      // Try parsing the fixed data
      return JSON.parse(fixedData);
    } catch (fixError) {
      console.error("Failed to fix JSON, returning empty queue:", fixError);
      
      // If all else fails, return an empty queue
      return { queue: [] };
    }
  }
};

/**
 * Checks and repairs the queue file if needed
 * @returns True if the file was repaired, false otherwise
 */
export const checkAndRepairQueueFile = async (): Promise<boolean> => {
  try {
    // Check if queue file exists
    if (!fs.existsSync(queueFilePath)) {
      console.log("Queue file does not exist, creating empty queue");
      
      // Create data directory if it doesn't exist
      const dataDir = path.dirname(queueFilePath);
      if (!fs.existsSync(dataDir)) {
        await fs.promises.mkdir(dataDir, { recursive: true });
      }
      
      // Create empty queue file
      await fs.promises.writeFile(queueFilePath, JSON.stringify({ queue: [] }, null, 2));
      return true;
    }
    
    // Try to read and parse the file
    try {
      const data = await fs.promises.readFile(queueFilePath, "utf-8");
      JSON.parse(data);
      console.log("Queue file is valid");
      return false; // No repair needed
    } catch (error) {
      console.error("Queue file is corrupted, attempting to repair");
      
      // Create a backup of the corrupted file
      const backupPath = `${queueFilePath}.corrupted-${Date.now()}`;
      await fs.promises.copyFile(queueFilePath, backupPath);
      console.log(`Created backup of corrupted file at ${backupPath}`);
      
      // Read the file and try to fix it
      const data = await fs.promises.readFile(queueFilePath, "utf-8");
      const fixedData = fixCorruptedJson(data);
      
      // Write the fixed data back to the file
      await fs.promises.writeFile(queueFilePath, JSON.stringify(fixedData, null, 2));
      console.log("Queue file repaired successfully");
      
      return true;
    }
  } catch (error) {
    console.error("Error checking/repairing queue file:", error);
    return false;
  }
}; 