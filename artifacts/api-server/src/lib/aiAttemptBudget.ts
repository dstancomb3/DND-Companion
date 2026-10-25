import type { RequestHandler } from "express";

/**
 * Shared process-local fixed-window attempt budget. Deliberately no IP identity:
 * proxy headers are untrusted and are not a user authentication boundary.
 * Multi-process/global quotas remain a separate O05 requirement.
 */
export function createAiAttemptBudget(maxAttempts = 60, windowMs = 60_000, now = () => Date.now()): RequestHandler {
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10_000 ||
      !Number.isSafeInteger(windowMs) || windowMs < 1_000 || windowMs > 3_600_000) {
    throw new Error("Invalid AI attempt budget");
  }
  let windowStart = now();
  let attempts = 0;
  return (_req, res, next) => {
    const current = now();
    if (current < windowStart || current - windowStart >= windowMs) {
      windowStart = current;
      attempts = 0;
    }
    if (attempts >= maxAttempts) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((windowMs - (current - windowStart)) / 1000))));
      res.status(429).json({ code: "ai_attempt_budget_exceeded", error: "Too many AI requests. Try again shortly." });
      return;
    }
    attempts++;
    next();
  };
}
