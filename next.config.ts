import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.agent.cvm.dev", "*.cvm.dev"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.a.transfermarkt.technology",
        pathname: "/portrait/**",
      },
    ],
  },
};

export default nextConfig;
