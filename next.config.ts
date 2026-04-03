import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "a.mktgcdn.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
