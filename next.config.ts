import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental features for better file handling
  experimental: {
    // Note: serverComponentsExternalPackages has been moved to serverExternalPackages in newer versions
  },
  
  // Configure API routes for large file uploads
  serverExternalPackages: ['pdf-parse'],
  
  // Performance optimizations for handling many concurrent requests
  serverRuntimeConfig: {
    maxConcurrentUploads: 10,
  },
  
  // Headers configuration for better upload handling
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
          {
            key: 'Connection',
            value: 'keep-alive',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
