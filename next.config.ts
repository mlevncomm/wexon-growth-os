import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Sayfanın kendi sürümü: otomatik güncelleme yeni yayını buna göre anlar (/api/surum ile aynı biçim)
  env: { NEXT_PUBLIC_SURUM: (process.env.VERCEL_GIT_COMMIT_SHA || "yerel").slice(0, 12) },
  serverExternalPackages: [
    "@prisma/client",
    "@whiskeysockets/baileys",
    "whatsapp-rust-bridge",
    "libsignal",
    "qrcode",
    "exceljs",
  ],
};

export default nextConfig;
