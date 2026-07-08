import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Restrict to source tests — without this, vitest also picks up the
    // compiled copies in dist/ after a build and runs every test twice.
    include: ["src/**/*.test.ts"],
  },
});
