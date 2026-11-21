import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ให้เปิดผ่าน http://127.0.0.1:3000 ได้ตอน dev (ไม่งั้น JS ฝั่ง client ถูกบล็อก)
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
