import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist', 'canvas', 'mupdf', 'tesseract.js'],
  turbopack: {},
};

export default nextConfig;
