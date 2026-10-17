import { defineConfig } from "@playwright/test";

/** E2E runs against the production build (`npm run build` first). Set PW_CHANNEL=chromium to use Playwright's bundled browser. */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    channel: process.env.PW_CHANNEL ?? "msedge",
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    // fake microphone so MediaRecorder works headlessly; the permission prompt is auto-accepted by the browser flag
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  },
  webServer: [
    { command: "npx next start -p 3100", url: "http://localhost:3100", reuseExistingServer: true, timeout: 60_000 },
    {
      // second instance with accounts "configured" (unreachable URL) to test auth enforcement without a real Supabase project
      command: "npx next start -p 3101",
      url: "http://localhost:3101",
      reuseExistingServer: true,
      timeout: 60_000,
      env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test-key" },
    },
  ],
});
