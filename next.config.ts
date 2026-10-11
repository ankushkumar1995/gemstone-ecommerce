import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Mock/stock images are loaded directly in the browser (no server-side
    // optimization) so they render reliably in dev. Swap to optimized real
    // product images on your own domain/CDN later by removing `unoptimized`.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
