import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads per-request data (SQLite, cookies), so Cache Components is off (docs/DECISIONS.md).
  serverExternalPackages: ["better-sqlite3", "sharp", "@paypal/agent-toolkit"],
  // The optimizer resizes only bundled photos and uploads, with no query string: the sample menus (the start page's
  // chips, next/image), demo photos and uploads (src/lib/images/responsive.ts). Any other path gets a 400.
  images: {
    localPatterns: [
      { pathname: "/samples/**", search: "" },
      { pathname: "/demo/**", search: "" },
      { pathname: "/i/**", search: "" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
