import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/sales",
        destination: "/pipelines",
        permanent: true,
      },
      {
        source: "/sales/:path*",
        destination: "/pipelines/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
