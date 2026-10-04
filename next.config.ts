import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Renamed exhibits keep their old addresses working.
  async redirects() {
    return [{ source: "/exhibits/paired-entrances", destination: "/exhibits/entrances-and-exits", permanent: true }];
  },
};

export default nextConfig;
