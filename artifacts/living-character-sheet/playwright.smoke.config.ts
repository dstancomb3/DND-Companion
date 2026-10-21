import path from "node:path";
import { defineConfig } from "@playwright/test";

const smokeWebBaseURL = process.env.SMOKE_WEB_BASE_URL || process.env.SMOKE_BASE_URL || "http://localhost:8082";
const smokeApiBaseURL = process.env.SMOKE_API_BASE_URL || "http://localhost:3100";
const smokeWebPort = process.env.SMOKE_WEB_PORT || new URL(smokeWebBaseURL).port || "8082";
const workspaceRoot = path.resolve(__dirname, "..", "..");

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  metadata: {
    smokeWebBaseURL,
    smokeApiBaseURL,
  },
  use: {
    baseURL: smokeWebBaseURL,
    headless: true,
    viewport: { width: 1366, height: 900 },
  },
  webServer: [
    {
      command: "pnpm --filter @workspace/api-server run dev",
      cwd: workspaceRoot,
      url: `${smokeApiBaseURL}/api/health`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: process.env.SMOKE_API_PORT || "3100",
      },
    },
    {
      command: `pnpm --filter @workspace/living-character-sheet run dev -- --port ${smokeWebPort}`,
      cwd: workspaceRoot,
      url: `${smokeWebBaseURL}/landing`,
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        ...process.env,
        CI: "1",
        EXPO_NO_INTERACTIVE: "1",
      },
    },
  ],
  reporter: [["list"]],
});
