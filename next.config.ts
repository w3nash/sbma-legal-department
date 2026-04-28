import type { NextConfig } from "next";
import "./env";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "250mb",
    },
  },
};

export default nextConfig;
