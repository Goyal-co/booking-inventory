/** @type {import('next').NextConfig} */
const path = require("path");

const useStandalone = !process.env.VERCEL;

const nextConfig = {
  ...(useStandalone ? { output: "standalone" } : {}),
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: [
    "@booking/ui",
    "@booking/database",
    "@booking/validators",
    "@booking/pdf",
    "@booking/logger",
    "@goyal/ecosystem-contracts",
    "@goyal/storage",
  ],
  serverExternalPackages: ["@prisma/client"],
};

module.exports = nextConfig;
