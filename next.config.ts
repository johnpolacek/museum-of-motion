import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Renamed exhibits keep their old addresses working.
  async redirects() {
    return [
      { source: "/exhibits/paired-entrances", destination: "/exhibits/entrances-and-exits", permanent: true },
      { source: "/exhibits/image-reveal", destination: "/exhibits/reveal", permanent: true },
      { source: "/exhibits/logo-cycle", destination: "/exhibits/cycle", permanent: true },
      { source: "/exhibits/image-zoom", destination: "/exhibits/zoom", permanent: true },
      { source: "/exhibits/enter-and-exit", destination: "/exhibits/interruptible", permanent: true },
      { source: "/exhibits/curve-cover", destination: "/exhibits/curtain", permanent: true },
      { source: "/exhibits/preloader", destination: "/exhibits/count-up", permanent: true },
      { source: "/exhibits/sound-cues", destination: "/", permanent: true },
      { source: "/exhibits/shader-wipe", destination: "/exhibits/shader", permanent: true },
      { source: "/exhibits/scrubbed-statement", destination: "/exhibits/scroll-reveal", permanent: true },
    ];
  },
};

export default nextConfig;
