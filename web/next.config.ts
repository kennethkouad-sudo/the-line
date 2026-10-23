import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Only this site may ask for the microphone, and nobody may frame it.
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // The deletion link is a secret: never sent on to other sites, cached or indexed.
        source: "/d/:token",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Until v1.1 the home page is the recorder. The query string (?from=) is kept.
      { source: "/", destination: "/leave", permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
