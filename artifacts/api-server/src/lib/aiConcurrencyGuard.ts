import type { RequestHandler } from "express";

/**
 * A bounded per-process admission guard. This is NOT distributed quota enforcement:
 * multiple API workers each maintain their own independent occupancy.
 */
export function createAiConcurrencyGuard(maxActive = 4): RequestHandler {
  if (!Number.isSafeInteger(maxActive) || maxActive < 1 || maxActive > 32) {
    throw new Error("Invalid AI concurrency limit");
  }
  let active = 0;
  return (_req, res, next) => {
    if (active >= maxActive) {
      res.setHeader("Retry-After", "2");
      res.status(429).json({
        code: "ai_capacity_exceeded",
        error: "AI requests are busy. Try again shortly.",
      });
      return;
    }
    active++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active--;
      res.off("finish", release);
      res.off("close", release);
    };
    res.once("finish", release);
    res.once("close", release);
    try {
      next();
    } catch (error) {
      release();
      next(error);
    }
  };
}
