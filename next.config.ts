import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The MongoDB driver is Node-only (uses child_process, dns, etc.). Keep it
  // external so Next never tries to bundle it for the browser.
  serverExternalPackages: ["mongodb", "mongoose", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
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
