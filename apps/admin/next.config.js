/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  transpilePackages: ["@booking/ui", "@booking/database", "@booking/validators", "@booking/realtime"],
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
