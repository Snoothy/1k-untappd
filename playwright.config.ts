import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    browserName: "chromium",
    baseURL: "http://127.0.0.1:4321",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4321 --ignore-lock",
    url: "http://127.0.0.1:4321/1k-untappd/",
    reuseExistingServer: !process.env.CI,
  },
});
