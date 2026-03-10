import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const repoName = "codex-slot";

const nextConfig: NextConfig = {
  turbopack: {
    root: currentDir,
  },
  output: isGithubActions ? "export" : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: isGithubActions ? `/${repoName}` : "",
  assetPrefix: isGithubActions ? `/${repoName}/` : undefined,
};

export default nextConfig;
