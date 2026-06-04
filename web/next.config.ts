import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Go serves the HTML/JS/CSS files directly from memory via go:embed
  output: "export",

  // every route becomes a real folder: /about is /about/index.html
  trailingSlash: true,

  images: {
    // image optimization requires a server so we disable it
    unoptimized: true,
  },
};

export default nextConfig;
