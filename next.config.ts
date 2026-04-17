import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'export',
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
    dangerouslyAllowSVG: true,
    domains: ['lh3.googleusercontent.com'],
  },
  sassOptions: {
    includePaths: [
      path.join(process.cwd()),
      path.join(process.cwd(), 'node_modules'),
    ],
    silenceDeprecations: ['legacy-js-api', 'import', 'mixed-decls'],
  },
};

export default nextConfig;
