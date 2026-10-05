import { defineConfig, devices } from "@playwright/test";

// End-to-end checks against a production build. `pnpm test:e2e` builds, serves on 3124, and runs them.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3124", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: { command: "pnpm build && pnpm start -p 3124", url: "http://localhost:3124", reuseExistingServer: !process.env.CI, timeout: 300_000 },
});
