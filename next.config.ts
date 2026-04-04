import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['socket.io', 'socket.io-client', 'express'],

  // Empty turbopack config silences the webpack conflict warning
  turbopack: {},

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'thumbnails.libretro.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
