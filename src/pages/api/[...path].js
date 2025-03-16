/**
 * API proxy for Internet Archive Downloader
 * This file proxies requests from the Next.js frontend to the downloader server
 */

import axios from 'axios';

// Downloader server URL from environment variable
const DOWNLOADER_URL = process.env.DOWNLOADER_URL || 'http://localhost:9124/api';

/**
 * API route handler that proxies requests to the downloader server
 */
export default async function handler(req, res) {
  try {
    // Get the path from the request
    const { path } = req.query;
    
    // Construct the URL to the downloader server
    const url = `${DOWNLOADER_URL}/${path.join('/')}`;
    
    // Forward the request to the downloader server
    const response = await axios({
      method: req.method,
      url,
      data: req.method !== 'GET' ? req.body : undefined,
      params: req.method === 'GET' ? req.query : undefined,
      headers: {
        'Content-Type': 'application/json',
      },
      validateStatus: () => true, // Don't throw on error status codes
    });
    
    // Return the response from the downloader server
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Error proxying request to downloader server:', error);
    res.status(500).json({ error: 'Failed to proxy request to downloader server' });
  }
} 