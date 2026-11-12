import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".scratch/**",
    ".claude/**",
    ".superpowers/**",
    "public/samples/**",
    // Generated test and local output.
    "test-results/**",
    "playwright-report/**",
    "artifacts/**",
    "data/**",
    "coverage/**",
    // The demo video is its own package (video/remotion, Remotion + JSX) with its own tooling.
    "video/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
