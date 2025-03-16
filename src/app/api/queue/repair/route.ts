import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Path to queue data file
const queueFilePath = path.join(process.cwd(), "data", "queue.json");

/**
 * Attempts to fix corrupted JSON data
 * @param data The potentially corrupted JSON string
 * @returns A valid JSON object or empty default
 */
const fixCorruptedJson = (data: string): { queue: any[] } => {
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
 * Repair queue file API endpoint
 * GET /api/queue/repair
 */
export async function GET(request: NextRequest) {
  try {
    // Check if queue file exists
    if (!fs.existsSync(queueFilePath)) {
      return NextResponse.json({
        success: false,
        message: "Queue file does not exist"
      });
    }
    
    // Create a backup of the current file
    const backupPath = `${queueFilePath}.backup-${Date.now()}`;
    await fs.promises.copyFile(queueFilePath, backupPath);
    
    // Read the file
    const data = await fs.promises.readFile(queueFilePath, "utf-8");
    
    // Try to fix the JSON
    const fixedData = fixCorruptedJson(data);
    
    // Write the fixed data back to the file
    const tempFilePath = `${queueFilePath}.temp`;
    await fs.promises.writeFile(tempFilePath, JSON.stringify(fixedData, null, 2));
    await fs.promises.rename(tempFilePath, queueFilePath);
    
    return NextResponse.json({
      success: true,
      message: "Queue file repaired successfully",
      itemCount: fixedData.queue.length,
      backup: backupPath
    });
  } catch (error) {
    console.error("Error repairing queue file:", error);
    return NextResponse.json({
      success: false,
      message: "Error repairing queue file",
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Reset queue file API endpoint
 * POST /api/queue/repair
 */
export async function POST(request: NextRequest) {
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(queueFilePath);
    if (!fs.existsSync(dataDir)) {
      await fs.promises.mkdir(dataDir, { recursive: true });
    }
    
    // Create a backup of the current file if it exists
    if (fs.existsSync(queueFilePath)) {
      const backupPath = `${queueFilePath}.backup-${Date.now()}`;
      await fs.promises.copyFile(queueFilePath, backupPath);
    }
    
    // Write a new empty queue file
    const emptyQueue = { queue: [] };
    await fs.promises.writeFile(queueFilePath, JSON.stringify(emptyQueue, null, 2));
    
    return NextResponse.json({
      success: true,
      message: "Queue file reset to empty queue"
    });
  } catch (error) {
    console.error("Error resetting queue file:", error);
    return NextResponse.json({
      success: false,
      message: "Error resetting queue file",
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 