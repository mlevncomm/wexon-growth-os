import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "whatsapp-web.js",
    "qrcode",
    "exceljs",
    "puppeteer",
  ],
};

export default nextConfig;
