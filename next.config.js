/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Set server port to 9123
  experimental: {
    serverComponentsExternalPackages: ['child_process'],
  },
};

module.exports = nextConfig; 