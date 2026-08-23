import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: [
    "@prisma/client",
    "whatsapp-web.js",
    "qrcode",
    "exceljs",
    "puppeteer",
  ],
};

export default nextConfig;
