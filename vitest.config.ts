import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    // tests/e2e is Playwright-only (real browser, real server) — run separately
    // with `npx playwright test`, never picked up by the Vitest unit runner.
    exclude: ["node_modules/**", "tests/e2e/**"],
  },
});
