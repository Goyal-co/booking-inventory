/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@booking/ui", "@booking/database", "@booking/validators", "@booking/pdf"],
  serverExternalPackages: ["@prisma/client"],
};

module.exports = nextConfig;
