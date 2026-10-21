const { spawn } = require("node:child_process");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const extraArgs = process.argv.slice(2);
const env = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value != null)
);
delete env.CI;
const requestedPort = env.EXPO_WEB_PORT || "8082";

if (!env.EXPO_OVERRIDE_METRO_CONFIG) {
  const metroConfigPath = path.join(process.cwd(), "metro.config.js");
  env.EXPO_OVERRIDE_METRO_CONFIG = pathToFileURL(metroConfigPath).href;
}

// Respect caller CI settings; do not force CI for local web development.
// Forced CI disables Metro reload and makes it easy to run stale bundles.

if (!env.EXPO_NO_INTERACTIVE) {
  env.EXPO_NO_INTERACTIVE = "1";
}

// Expo doctor occasionally crashes in this environment with undici body-read errors.
if (!env.EXPO_NO_DOCTOR) {
  env.EXPO_NO_DOCTOR = "1";
}

// Expo 54 uses this flag to skip dependency validation during web startup.
if (!env.EXPO_NO_DEPENDENCY_VALIDATION) {
  env.EXPO_NO_DEPENDENCY_VALIDATION = "1";
}

const isWindows = process.platform === "win32";
const child = spawn("pnpm", [
  "exec",
  "expo",
  "start",
  "--web",
  "--port",
  requestedPort,
  ...extraArgs,
], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  // Use the shell on Windows so pnpm command resolution works the same as terminal usage.
  shell: isWindows,
});

child.on("close", (code, signal) => {
  if (signal) {
    process.exit(1);
    return;
  }
  process.exit(typeof code === "number" ? code : 1);
});
