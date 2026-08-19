import { defineConfig, devices } from "@playwright/test";
import { loadTestEnv } from "./tests/e2e/load-test-env";

// Force the whole e2e suite onto the ISOLATED test DB (:5435/ashkeld_test) before
// anything connects. This is what makes `playwright test` safe: global-setup's
// db:reset/db:seed and the webServer below all inherit this DATABASE_URL, so the
// live dev DB on :5434 is never touched. Throws if it isn't the test DB.
const TEST_DATABASE_URL = loadTestEnv();

// Smoke-only Playwright config (HANDOFF §8: "Playwright smoke at 1440×900").
// Assumes the app is already running on port 3100 (started by the gate) OR
// starts its own via webServer. Single desktop viewport per the design's
// canonical frame size.
export default defineConfig({
  // Two real-browser tiers live under tests/: `e2e/` is pure user journeys, and
  // `playwright/` is browser-only NON-journey gates — computed-CSS / rendered-
  // geometry facts (token resolution, touch-target heights, reduced-motion,
  // focus fills) that jsdom cannot compute, so they can't move to the component
  // tier but are not journeys either. testMatch is explicit so Playwright never
  // picks up the Vitest `*.component.test.tsx` files under tests/components/.
  testDir: "./tests",
  testMatch: ["e2e/**/*.spec.ts", "playwright/**/*.spec.ts"],
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
    // Point the served app at the test DB explicitly, and at the isolated e2e
    // build dir so it never serves (or races) the shared .next dev build.
    // reuseExistingServer is FALSE so a stray live-DB server on 3100 is never
    // reused for e2e — the runner starts its own test-DB-backed server.
    env: { DATABASE_URL: TEST_DATABASE_URL, NEXT_DIST_DIR: ".next-e2e" },
    reuseExistingServer: false,
    timeout: 120_000,
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
