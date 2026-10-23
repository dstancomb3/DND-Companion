const { spawnSync } = require("node:child_process");
const path = require("node:path");
const manager = process.env.npm_execpath;
if (!manager || !path.basename(manager).includes("pnpm")) throw new Error("Run this build with pnpm run build:preview");
const env = { ...process.env, CI: "1", EXPO_NO_DOTENV: "1", EXPO_PUBLIC_API_SAME_ORIGIN: "true" };
for (const args of [["run", "typecheck:libs"], ["--filter", "@workspace/living-character-sheet", "run", "build:web"], ["--filter", "@workspace/api-server", "run", "build"]]) {
  const result = spawnSync(process.execPath, [manager, ...args], { cwd: path.resolve(__dirname, ".."), env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
