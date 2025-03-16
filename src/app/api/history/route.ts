import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { promisify } from "util";

// Path to the history file
const HISTORY_FILE = path.join(process.cwd(), "data", "history.json");

// Ensure the data directory exists
const ensureDataDir = async () => {
  const dataDir = path.join(process.cwd(), "data");
  try {
    await fs.promises.mkdir(dataDir, { recursive: true });
  } catch (error) {
    console.error("Error creating data directory:", error);
  }
};

// Read history from file
const readHistory = async () => {
  await ensureDataDir();
  
  try {
    const data = await fs.promises.readFile(HISTORY_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or is invalid, return empty history
    return { history: [] };
  }
};

// Write history to file
const writeHistory = async (history: any) => {
  await ensureDataDir();
  
  try {
    await fs.promises.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
    return true;
  } catch (error) {
    console.error("Error writing history:", error);
    return false;
  }
};

// GET handler for retrieving download history
export async function GET(request: NextRequest) {
  try {
    // Read history data
    const historyData = await readHistory();
    
    // Get limit from query params
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 100;
    
    // Limit the number of history items returned
    const limitedHistory = {
      history: historyData.history.slice(0, limit)
    };
    
    return NextResponse.json(limitedHistory);
  } catch (error) {
    console.error("Error retrieving history:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server error" 
    }, { status: 500 });
  }
}

// POST handler for adding to download history
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (!data.url) {
      return NextResponse.json({ 
        success: false, 
        message: "Missing required fields" 
      }, { status: 400 });
    }
    
    // Read current history
    const historyData = await readHistory();
    const history = historyData.history || [];
    
    // Add new history item
    const newHistoryItem = {
      id: Date.now().toString(),
      url: data.url,
      downloadPath: data.downloadPath || '/downloads',
      fileTypes: data.fileTypes || [],
      isPlaylist: data.isPlaylist || false,
      status: data.status || 'completed',
      timestamp: new Date().toISOString(),
      message: data.message || 'Download completed',
    };
    
    // Add to the beginning of the array
    history.unshift(newHistoryItem);
    
    // Keep only the last 100 downloads
    if (history.length > 100) {
      history.length = 100;
    }
    
    // Save updated history
    const success = await writeHistory({ history });
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: "History updated",
        id: newHistoryItem.id
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: "Failed to update history" 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error adding to history:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server error" 
    }, { status: 500 });
  }
}

// DELETE handler for clearing history
export async function DELETE(request: NextRequest) {
  try {
    // Write empty history
    const success = await writeHistory({ history: [] });
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: "History cleared" 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: "Failed to clear history" 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error clearing history:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server error" 
    }, { status: 500 });
  }
}

// PATCH handler for updating download status
export async function PATCH(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (!data.id || !data.status) {
      return NextResponse.json({ 
        success: false, 
        message: "Missing required fields" 
      }, { status: 400 });
    }
    
    const historyData = await readHistory();
    const history = historyData.history || [];
    
    // Find and update the download
    const downloadIndex = history.findIndex((item: any) => item.id === data.id);
    
    if (downloadIndex === -1) {
      return NextResponse.json({ 
        success: false, 
        message: "Download not found" 
      }, { status: 404 });
    }
    
    // Update the download status
    history[downloadIndex].status = data.status;
    if (data.message) {
      history[downloadIndex].message = data.message;
    }
    
    // Save updated history
    const success = await writeHistory({ history });
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: "Download status updated" 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: "Failed to update download status" 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error updating download status:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server error" 
    }, { status: 500 });
  }
} 