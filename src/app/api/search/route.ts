import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

// Server configuration - use environment variable or default to localhost
const DOWNLOADER_URL = process.env.DOWNLOADER_URL || 'http://localhost:9124/api';

// Mark this route as dynamic to handle search parameters
export const dynamic = 'force-dynamic';

/**
 * GET handler for searching Internet Archive
 */
export async function GET(request: NextRequest) {
  try {
    // Get search query from URL parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    
    if (!query) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }
    
    // Connect to the downloader server
    const response = await axios.get(`${DOWNLOADER_URL}/search`, {
      params: { query }
    });
    
    return NextResponse.json({ results: response.data.results || [] });
  } catch (error) {
    console.error("Error searching Internet Archive:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 