/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable image optimization for Electron
  images: {
    unoptimized: true,
  },
  
  // Output configuration for Electron
  output: 'standalone',
  
  // Performance optimizations
  experimental: {
    optimizePackageImports: ['@mui/material', '@mui/icons-material'],
  },
  
  // Ensure static files are properly generated
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  
  // Ensure assetPrefix is empty (no prefix needed)
  assetPrefix: '',
  
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
