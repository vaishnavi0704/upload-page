import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    dirs: ['pages', 'components', 'lib', 'src'],
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Add this to skip type checking entirely during build
  productionBrowserSourceMaps: false,
};

export default nextConfig;
