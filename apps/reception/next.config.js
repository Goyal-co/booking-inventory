/** @type {import('next').NextConfig} */
module.exports = {
  transpilePackages: ["@booking/ui", "@booking/database", "@booking/validators"],
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};
