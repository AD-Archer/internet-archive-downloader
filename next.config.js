/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force Next.js to use SWC for compilation even when Babel config is present
  swcMinify: true,
  compiler: {
    // Enable all SWC compiler features
    styledComponents: false,
  },
  // Other Next.js config options
  reactStrictMode: true,
  eslint: {
    // Enable strict mode for ESLint
    ignoreDuringBuilds: false,
  },
  // Set custom port for development server
  experimental: {
    serverComponentsExternalPackages: [],
  },
  // API routes proxy configuration
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:9124/api/:path*', // Proxy to backend server
      },
    ];
  },
};

module.exports = nextConfig; 