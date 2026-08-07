import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root so Next.js doesn't get confused by stray lockfiles
  // in the parent workspace (multiple lockfiles were being detected).
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
