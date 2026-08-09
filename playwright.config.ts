import { defineConfig, devices } from "@playwright/test";

// Smoke-only Playwright config (HANDOFF §8: "Playwright smoke at 1440×900").
// Assumes the app is already running on port 3100 (started by the gate) OR
// starts its own via webServer. Single desktop viewport per the design's
// canonical frame size.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  // The whole suite shares ONE live Postgres (specs seed/reseed it), so it must
  // run serially. Without this, Playwright defaults to one worker per CPU and
  // parallel db:seed TRUNCATEs race each other. Do not raise without giving each
  // worker its own database.
  workers: 1,
  // Seed the DB once before the suite; clean throwaway artifacts after it.
  // (Per-file reseeding is avoided; state-mutating specs restore via afterAll.)
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  reporter: [["list"]],
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? "http://localhost:3100",
    viewport: { width: 1440, height: 900 },
    trace: "off",
  },
  // Auto-start the production server on 3100 (reusing one if already up). The
  // DB must be seeded first (npm run db:setup); the app reads live Postgres.
  webServer: {
    command: "npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: "msedge",
      // Use the OS-installed Microsoft Edge (Chromium) rather than a downloaded
      // Playwright browser build. This environment could not fetch the pinned
      // chromium binary (network), and Edge is present and Chromium-based, so
      // it gives a faithful desktop-Chromium smoke run at 1440x900.
      use: {
        ...devices["Desktop Edge"],
        channel: "msedge",
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
