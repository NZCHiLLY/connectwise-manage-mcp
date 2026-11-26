import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);
const _pkg = _require("../package.json") as { version: string };

export interface BuildInfo {
  sha: string;
  builtAt: string;
  version: string;
  image: string;
}

// Read per call, not at import, so a stubbed environment is honoured in tests.
export function getBuildInfo(): BuildInfo {
  return {
    sha: process.env.BUILD_SHA ?? "unknown",
    builtAt: process.env.BUILD_DATE ?? "unknown",
    version: _pkg.version,
    image: process.env.IMAGE_VERSION ?? "unknown",
  };
}

export function healthPayload(transport: string) {
  return {
    status: "ok",
    transport,
    timestamp: new Date().toISOString(),
    build: getBuildInfo(),
  };
}
