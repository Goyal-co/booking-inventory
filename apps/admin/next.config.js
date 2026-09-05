/** @type {import('next').NextConfig} */
const path = require("path");

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const useStandalone = !process.env.VERCEL;

const nextConfig = {
  ...(useStandalone ? { output: "standalone" } : {}),
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: [
    "@booking/ui",
    "@booking/database",
    "@booking/validators",
    "@booking/realtime",
    "@booking/pdf",
    "@booking/logger",
    "@goyal/ecosystem-contracts",
    "@goyal/integration-hub",
    "@goyal/storage",
  ],
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**",
    ],
  },
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
