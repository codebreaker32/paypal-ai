import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads per-request data (SQLite, cookies), so Cache Components is off (docs/DECISIONS.md).
  serverExternalPackages: ["better-sqlite3", "sharp", "@paypal/agent-toolkit"],
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
