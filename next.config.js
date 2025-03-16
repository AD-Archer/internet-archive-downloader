/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable both App Router and Pages Router
  reactStrictMode: true,
  
  // Environment variables to expose to the browser
  env: {
    DOWNLOADER_URL: process.env.DOWNLOADER_URL || 'http://localhost:9124/api',
  },
  
  // API routes configuration
  async rewrites() {
    return [
      // Rewrite API requests to the App Router API
      {
        source: '/api/:path*',
        destination: '/app/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig; 