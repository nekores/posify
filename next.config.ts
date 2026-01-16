import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  
  // Webpack configuration for Electron compatibility
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
