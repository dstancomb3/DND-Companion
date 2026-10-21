import {
  normalizeReviewState,
  normalizeReviewStatusForMode,
  normalizeUnsupportedSegments,
  truncateJson,
  type ReviewState,
  type UnsupportedSegment,
} from "./mechanicsReviewCoercion";

export type ParserMechanicsResultKind = "simple" | "complex" | "ambiguous" | "unsupported";

const VALID_MECHANICS_RESULT_KIND = new Set(["simple", "complex", "ambiguous", "unsupported"]);

interface ItemMechanicsBlockCompat {
  schemaVersion: "v1";
  ownerType: "item";
  mechanics: Record<string, unknown>[];
  review: ReviewState;
  references?: Record<string, unknown>[];
  compatibility?: Record<string, unknown>;
  unresolvedSegments?: UnsupportedSegment[];
  exportedFrom?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fallbackMechanicsBlock(raw: unknown, mode?: ParserMechanicsResultKind, parserNotes: string[] = []): ItemMechanicsBlockCompat {
  const fallbackStatus = mode === "unsupported" ? "unsupported" : "partial";
  return {
    schemaVersion: "v1",
    ownerType: "item",
    mechanics: [],
    review: {
      reviewStatus: fallbackStatus,
      confidence: "low",
      parserNotes: parserNotes.length > 0 ? parserNotes : ["Malformed mechanics payload downgraded to unsupported"],
      unsupportedSegments: [
        {
          rawText: truncateJson(raw),
          reason: "missing_required_detail",
        },
      ],
    },
  };
}

function extractKindAndBlock(raw: unknown): { mode?: ParserMechanicsResultKind; parserNotes: string[]; mechanicsRaw: unknown } {
  if (!isRecord(raw)) {
    return { parserNotes: [], mechanicsRaw: raw };
  }

  if (typeof raw["kind"] === "string" && VALID_MECHANICS_RESULT_KIND.has(raw["kind"])) {
    return {
      mode: raw["kind"] as ParserMechanicsResultKind,
      parserNotes: Array.isArray(raw["parserNotes"])
        ? (raw["parserNotes"] as unknown[]).filter((v): v is string => typeof v === "string")
        : [],
      mechanicsRaw: raw["mechanicsBlock"],
    };
  }

  return { parserNotes: [], mechanicsRaw: raw };
}

export function normalizeParserItemMechanics(raw: unknown): ItemMechanicsBlockCompat | null {
  if (raw == null) return null;

  const { mode, parserNotes, mechanicsRaw } = extractKindAndBlock(raw);
  if (!isRecord(mechanicsRaw)) {
    return fallbackMechanicsBlock(raw, mode, parserNotes);
  }

  const mechanicsArray = Array.isArray(mechanicsRaw["mechanics"]) ? (mechanicsRaw["mechanics"] as unknown[]).filter(isRecord) : [];
  const baseFallbackStatus = mode === "unsupported" ? "unsupported" : "needs_review";
  const review = normalizeReviewState(mechanicsRaw["review"], baseFallbackStatus, parserNotes);
  const coercedStatus = normalizeReviewStatusForMode(review.reviewStatus, mode);

  const unresolvedSegments = normalizeUnsupportedSegments(mechanicsRaw["unresolvedSegments"]);
  const references = Array.isArray(mechanicsRaw["references"]) ? (mechanicsRaw["references"] as unknown[]).filter(isRecord) : [];
  const compatibility = isRecord(mechanicsRaw["compatibility"]) ? mechanicsRaw["compatibility"] : undefined;
  const exportedFrom = typeof mechanicsRaw["exportedFrom"] === "string" ? mechanicsRaw["exportedFrom"] : undefined;

  const hasInvalidEnvelope = mechanicsRaw["schemaVersion"] !== "v1" || mechanicsRaw["ownerType"] !== "item";
  const normalizedUnsupported = hasInvalidEnvelope
    ? [
        ...normalizeUnsupportedSegments(review.unsupportedSegments),
        {
          rawText: truncateJson({ schemaVersion: mechanicsRaw["schemaVersion"], ownerType: mechanicsRaw["ownerType"] }),
          reason: "missing_required_detail" as const,
        },
      ]
    : normalizeUnsupportedSegments(review.unsupportedSegments);

  return {
    schemaVersion: "v1",
    ownerType: "item",
    mechanics: mechanicsArray,
    review: {
      ...review,
      reviewStatus: coercedStatus,
      ...(normalizedUnsupported.length > 0 ? { unsupportedSegments: normalizedUnsupported } : {}),
    },
    ...(references.length > 0 ? { references } : {}),
    ...(compatibility ? { compatibility } : {}),
    ...(unresolvedSegments.length > 0 ? { unresolvedSegments } : {}),
    ...(exportedFrom ? { exportedFrom } : {}),
  };
}
