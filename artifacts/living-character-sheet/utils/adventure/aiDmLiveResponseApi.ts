import { API_BASE_URL } from "@/utils/apiUrl";
import type { CampaignRuntimeTurnResponse } from "./aiDmCampaignRuntimeApi";

export interface LiveResponseRequest {
  sessionId: string;
  campaignId: string;
  campaignLabel: string;
  chapterLabel: string;
  difficulty: string;
  stylePreset: string;
  guidance?: string;
  playerInput: string;
  recentEntries: Array<{ role: "system" | "dm" | "player" | "tool"; text: string }>;
}

export interface LiveResponseProgressUpdate {
  kind: "text_chunk" | "completed" | "error" | "timeout";
  text?: string;
  response?: CampaignRuntimeTurnResponse;
  error?: string;
  attemptNumber?: number;
}

export interface LiveResponseStreamHandler {
  onProgress: (update: LiveResponseProgressUpdate) => void;
  onCompleted?: (response: CampaignRuntimeTurnResponse) => void;
  onError?: (error: Error) => void;
}

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const POLL_INTERVAL_MS = 500; // 500ms polling fallback
const MAX_RETRIES = 1;

/**
 * Request a live AI DM response with streaming support.
 * Handles timeouts, retries, and graceful fallback to polling.
 */
export async function requestLiveResponse(
  request: LiveResponseRequest,
  handler: LiveResponseStreamHandler,
  options?: {
    timeoutMs?: number;
    maxRetries?: number;
  }
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options?.maxRetries ?? MAX_RETRIES;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const controller = new AbortController();
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

      try {
        await Promise.race([new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            controller.abort();
            const error = new Error("AI DM response deadline exceeded");
            error.name = "AbortError";
            reject(error);
          }, timeoutMs);
        }), (async () => {
        const response = await fetch(`${API_BASE_URL}/api/adventure/campaign-runtime/turn`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        // Keep the abort deadline active through body streaming and parsing.
        // Headers can arrive promptly while the AI response body stalls indefinitely.

        // Check for network/parsing errors first
        if (!response.ok) {
          const error = await response.text().catch(() => "Unknown error");
          throw new Error(`Server error (${response.status}): ${error}`);
        }

        // Try streaming first; clone response so body can be re-read if streaming fails (Slice C)
        if (response.body) {
          const responseClone = response.clone();
          try {
            await handleStreamingResponse(response, handler);
            return; // Success
          } catch (streamError) {
            // Streaming failed, fall back to full text parsing using the pre-cloned response
            if (streamError instanceof Error && streamError.message.includes("stream")) {
              // Use clone — original body is already consumed by handleStreamingResponse
              const text = await responseClone.text();
              const parsed = JSON.parse(text);
              if (isCampaignRuntimeTurnResponse(parsed)) {
                handler.onProgress({ kind: "completed", response: parsed });
                handler.onCompleted?.(parsed);
                return; // Success
              }
            }
            throw streamError;
          }
        } else {
          // No streaming, read full response
          const text = await response.text();
          const parsed = JSON.parse(text);
          if (isCampaignRuntimeTurnResponse(parsed)) {
            handler.onProgress({ kind: "completed", response: parsed });
            handler.onCompleted?.(parsed);
            return; // Success
          } else {
            throw new Error("Invalid response format");
          }
        }
        })()]);
      } finally {
        if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Handle abort (timeout) specially
      if (lastError.name === "AbortError") {
        if (attempt <= maxRetries) {
          // Signal timeout and allow retry
          handler.onProgress({
            kind: "timeout",
            error: `Request timed out after ${timeoutMs}ms (attempt ${attempt}/${maxRetries + 1})`,
            attemptNumber: attempt,
          });
          // Continue to retry
          continue;
        } else {
          // Final timeout
          handler.onProgress({
            kind: "timeout",
            error: `Connection lost after ${maxRetries + 1} attempts`,
            attemptNumber: attempt,
          });
          handler.onError?.(
            new Error(`Live response request timed out after ${maxRetries + 1} attempts`)
          );
          return;
        }
      }

      // Other errors: retry if we have attempts left
      if (attempt <= maxRetries) {
        handler.onProgress({
          kind: "error",
          error: `Request failed (attempt ${attempt}/${maxRetries + 1}): ${lastError.message}`,
          attemptNumber: attempt,
        });
        continue;
      }

      // Final error
      handler.onProgress({
        kind: "error",
        error: `Request failed after ${maxRetries + 1} attempts: ${lastError.message}`,
        attemptNumber: attempt,
      });
      handler.onError?.(lastError);
      return;
    }
  }

  // Should not reach here, but handle as safety
  handler.onError?.(
    lastError ??
      new Error("Live response request failed for unknown reason")
  );
}

/**
 * Handle streaming response (Transfer-Encoding: chunked or line-delimited JSON).
 */
async function handleStreamingResponse(
  response: Response,
  handler: LiveResponseStreamHandler
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable (streaming not available)");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullResponse = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      fullResponse += chunk;

      // Try to parse line-delimited JSON
      const lines = buffer.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.dmText) {
              // This is a partial dmText chunk
              handler.onProgress({
                kind: "text_chunk",
                text: parsed.dmText,
              });
            }
          } catch {
            // Not JSON, skip
          }
        }
      }

      // Keep last incomplete line in buffer
      buffer = lines[lines.length - 1];
    }

    // Process final buffer
    if (buffer.trim()) {
      const final = JSON.parse(buffer);
      if (isCampaignRuntimeTurnResponse(final)) {
        handler.onProgress({ kind: "completed", response: final });
        handler.onCompleted?.(final);
        return;
      }
    }

    // Try parsing full response as fallback
    if (fullResponse.trim()) {
      const final = JSON.parse(fullResponse);
      if (isCampaignRuntimeTurnResponse(final)) {
        handler.onProgress({ kind: "completed", response: final });
        handler.onCompleted?.(final);
        return;
      }
    }

    throw new Error("No valid response received from stream");
  } finally {
    reader.releaseLock();
  }
}

function isCampaignRuntimeTurnResponse(value: unknown): value is CampaignRuntimeTurnResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.ok === true &&
    typeof v.turn === "object" &&
    v.turn !== null &&
    typeof (v.turn as Record<string, unknown>).dmText === "string"
  );
}
