import multer from "multer";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { RuntimeConflictError } from "./routes/party";
import { logAIIdempotencyHealthCheck } from "./lib/aiIdempotencyHealthCheck";

import { createCloudPreview } from "./lib/cloudPreview";
import { createAiConcurrencyGuard } from "./lib/aiConcurrencyGuard";
import { createAiAttemptBudget } from "./lib/aiAttemptBudget";

const app: Express = express();
const cloudPreview = createCloudPreview();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
cloudPreview?.protect(app);
if (!cloudPreview) app.use(cors());
// Model-backed endpoints have a tighter streaming JSON limit than other app APIs.
// This runs before the general body parser; oversized requests never reach a model.
app.use("/api/ai", express.json({ limit: "4mb" }));
app.use("/api/adventure/campaign-runtime/turn", express.json({ limit: "4mb" }));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

const aiGuard = createAiConcurrencyGuard();
const aiBudget = createAiAttemptBudget();
app.use("/api/ai", aiBudget, aiGuard);
app.use("/api/adventure/campaign-runtime/turn", aiBudget, aiGuard);
app.use("/api", router);
cloudPreview?.serve(app);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof RuntimeConflictError) {
    const conflictCode = err.currentRevision === null ? "stale_runtime_state" : "revision_conflict";
    res.status(409).json({
      code: conflictCode,
      expectedRevision: err.expectedRevision,
      currentRevision: err.currentRevision,
      error:
        conflictCode === "stale_runtime_state"
          ? "Runtime state is stale — refresh authoritative state and retry"
          : "State revision conflict — retry with current state",
    });
    return;
  }
  if (err instanceof multer.MulterError && err.code.startsWith("LIMIT_")) {
    res.status(413).json({ code: "ai_input_too_large", error: "AI image upload exceeds the supported limits." });
    return;
  }
  if (typeof err === "object" && err !== null && "type" in err && err.type === "entity.too.large") {
    res.status(413).json({ code: "ai_input_too_large", error: "Request exceeds the supported input size." });
    return;
  }
  logger.error(err, "Unhandled route error");
  res.status(500).json({ error: "Internal server error" });
});

/**
 * Run health checks at server startup.
 * This should be called after the server binds to a port.
 */
export async function runStartupHealthChecks(): Promise<void> {
  await logAIIdempotencyHealthCheck();
}

export default app;
