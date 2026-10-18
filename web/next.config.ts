import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async redirects() {
    return [
      // Until v1.1 the home page is the recorder. The query string (?from=) is kept.
      { source: "/", destination: "/leave", permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
