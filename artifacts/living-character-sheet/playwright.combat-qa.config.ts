import path from "node:path";
import { defineConfig } from "@playwright/test";

const combatQaWebBaseURL = process.env.COMBAT_QA_WEB_BASE_URL || process.env.SMOKE_WEB_BASE_URL || "http://localhost:8082";
const combatQaApiBaseURL = process.env.COMBAT_QA_API_BASE_URL || process.env.SMOKE_API_BASE_URL || "http://localhost:3100";
const combatQaWebPort = process.env.COMBAT_QA_WEB_PORT || process.env.SMOKE_WEB_PORT || new URL(combatQaWebBaseURL).port || "8082";
const workspaceRoot = path.resolve(__dirname, "..", "..");

export default defineConfig({
  testDir: "./tests/combat-qa",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  metadata: {
    combatQaWebBaseURL,
    combatQaApiBaseURL,
  },
  use: {
    baseURL: combatQaWebBaseURL,
    headless: true,
    viewport: { width: 1366, height: 900 },
  },
  webServer: [
    {
      command: "pnpm --filter @workspace/api-server run dev",
      cwd: workspaceRoot,
      url: `${combatQaApiBaseURL}/api/health`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: process.env.COMBAT_QA_API_PORT || process.env.SMOKE_API_PORT || "3100",
      },
    },
    {
      command: `pnpm --filter @workspace/living-character-sheet run dev -- --port ${combatQaWebPort}`,
      cwd: workspaceRoot,
      url: `${combatQaWebBaseURL}/landing`,
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
