/** @type {import('next').NextConfig} */
module.exports = {
  transpilePackages: [
    "@booking/ui",
    "@booking/database",
    "@booking/validators",
    "@goyal/ecosystem-contracts",
  ],
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};
