import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: [
    "@prisma/client",
    "whatsapp-web.js",
    "@whiskeysockets/baileys",
    "whatsapp-rust-bridge",
    "libsignal",
    "qrcode",
    "exceljs",
    "puppeteer",
  ],
};

export default nextConfig;
