const { spawn } = require("node:child_process");

const env = {
  ...process.env,
  COMBAT_QA_WEB_BASE_URL: process.env.COMBAT_QA_WEB_BASE_URL || process.env.SMOKE_WEB_BASE_URL || "http://localhost:8082",
  COMBAT_QA_API_BASE_URL: process.env.COMBAT_QA_API_BASE_URL || process.env.SMOKE_API_BASE_URL || "http://localhost:3100",
  COMBAT_QA_API_PORT: process.env.COMBAT_QA_API_PORT || process.env.SMOKE_API_PORT || "3100",
};

const child = spawn("pnpm", ["exec", "playwright", "test", "-c", "playwright.combat-qa.config.ts"], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
