// A request timeout bounds model-provider occupancy, not billing or client retries.
// Disable implicit SDK retries: callers must explicitly decide if a logical AI
// operation is safe to repeat, especially when idempotency receipts are absent.
export const AI_UPSTREAM_REQUEST_OPTIONS = Object.freeze({
  timeout: 120_000,
  maxRetries: 0,
});
