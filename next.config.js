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
};

module.exports = nextConfig; 