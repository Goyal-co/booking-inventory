/** @type {import('next').NextConfig} */
const path = require("path");

const useStandalone = !process.env.VERCEL;

module.exports = {
  ...(useStandalone ? { output: "standalone" } : {}),
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: [
    "@booking/ui",
    "@booking/database",
    "@booking/validators",
    "@booking/logger",
    "@goyal/ecosystem-contracts",
    "@goyal/storage",
  ],
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**",
    ],
  },
};
