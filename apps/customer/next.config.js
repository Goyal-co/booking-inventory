/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@booking/ui",
    "@booking/database",
    "@booking/validators",
    "@booking/pdf",
    "@goyal/ecosystem-contracts",
    "@goyal/storage",
  ],
  serverExternalPackages: ["@prisma/client"],
};

module.exports = nextConfig;
