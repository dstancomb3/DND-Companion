// This entry point must never silently start an unprotected API.
process.env.CLOUD_PREVIEW_MODE = "true";
import("../artifacts/api-server/dist/index.mjs").catch(error => {
  console.error(error);
  process.exitCode = 1;
});
