type MechanicsResultKind = "simple" | "complex" | "ambiguous" | "unsupported";
type ReviewStatus = "verified" | "needs_review" | "partial" | "unsupported";
type ReviewConfidence = "high" | "medium" | "low" | "unknown";
type UnsupportedReason =
  | "ambiguous_source"
  | "unsupported_geometry"
  | "unsupported_timing"
  | "unsupported_formula"
  | "unsupported_custom_logic"
  | "missing_required_detail"
  | "other";
type UnresolvedIssueType = "missing" | "ambiguous" | "conflicting" | "unsupported";

export interface SourceEvidence {
  sourceText: string;
  sourcePath?: string;
  excerptLabel?: string;
}

export interface UnresolvedField {
  fieldPath: string;
  issueType: UnresolvedIssueType;
  rawText?: string;
  recommendedAction?: string;
}

export interface UnsupportedSegment {
  rawText: string;
  reason: UnsupportedReason;
  affectedFieldPaths?: string[];
}

export interface ReviewState {
  reviewStatus: ReviewStatus;
  confidence: ReviewConfidence;
  sourceEvidence?: SourceEvidence[];
  unresolvedFields?: UnresolvedField[];
  unsupportedSegments?: UnsupportedSegment[];
  parserNotes?: string[];
  humanNotes?: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function truncateJson(raw: unknown, maxLen = 500): string {
  try {
    const serialized = JSON.stringify(raw);
    if (typeof serialized === "string" && serialized.length > 0) {
      return serialized.slice(0, maxLen);
    }
  } catch {
    // fall back below
  }
  return String(raw).slice(0, maxLen);
}

export function normalizeReviewStatusForMode(status: ReviewStatus, mode?: MechanicsResultKind): ReviewStatus {
  if (!mode) return status;
  if (mode === "simple" || mode === "complex") {
    return status === "verified" || status === "needs_review" ? status : "needs_review";
  }
  if (mode === "ambiguous") {
    return status === "needs_review" || status === "partial" ? status : "needs_review";
  }
  return status === "partial" || status === "unsupported" ? status : "unsupported";
}

export function normalizeSourceEvidence(raw: unknown): SourceEvidence[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .filter((entry) => typeof entry["sourceText"] === "string" && entry["sourceText"].trim().length > 0)
    .map((entry) => ({
      sourceText: (entry["sourceText"] as string).trim(),
      ...(typeof entry["sourcePath"] === "string" && entry["sourcePath"].trim().length > 0 ? { sourcePath: entry["sourcePath"].trim() } : {}),
      ...(typeof entry["excerptLabel"] === "string" && entry["excerptLabel"].trim().length > 0 ? { excerptLabel: entry["excerptLabel"].trim() } : {}),
    }));
}

export function normalizeUnresolvedFields(raw: unknown): UnresolvedField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .filter((entry) => typeof entry["fieldPath"] === "string" && typeof entry["issueType"] === "string")
    .map((entry) => ({
      fieldPath: entry["fieldPath"] as string,
      issueType: entry["issueType"] as UnresolvedIssueType,
      ...(typeof entry["rawText"] === "string" ? { rawText: entry["rawText"] as string } : {}),
      ...(typeof entry["recommendedAction"] === "string" ? { recommendedAction: entry["recommendedAction"] as string } : {}),
    }));
}

export function normalizeUnsupportedSegments(raw: unknown): UnsupportedSegment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .filter((entry) => typeof entry["rawText"] === "string" && typeof entry["reason"] === "string")
    .map((entry) => ({
      rawText: entry["rawText"] as string,
      reason: entry["reason"] as UnsupportedReason,
      ...(Array.isArray(entry["affectedFieldPaths"])
        ? { affectedFieldPaths: (entry["affectedFieldPaths"] as unknown[]).filter((v): v is string => typeof v === "string") }
        : {}),
    }));
}

export function normalizeReviewState(raw: unknown, fallbackStatus: ReviewStatus, parserNotes: string[] = []): ReviewState {
  const review = isRecord(raw) ? raw : {};
  const statusRaw: ReviewStatus =
    typeof review["reviewStatus"] === "string" &&
    (review["reviewStatus"] === "verified" ||
      review["reviewStatus"] === "needs_review" ||
      review["reviewStatus"] === "partial" ||
      review["reviewStatus"] === "unsupported")
      ? (review["reviewStatus"] as ReviewStatus)
      : fallbackStatus;
  const confidence: ReviewConfidence =
    typeof review["confidence"] === "string" &&
    (review["confidence"] === "high" ||
      review["confidence"] === "medium" ||
      review["confidence"] === "low" ||
      review["confidence"] === "unknown")
      ? (review["confidence"] as ReviewConfidence)
      : "unknown";

  const sourceEvidence = normalizeSourceEvidence(review["sourceEvidence"]);
  const unresolvedFields = normalizeUnresolvedFields(review["unresolvedFields"]);
  const unsupportedSegments = normalizeUnsupportedSegments(review["unsupportedSegments"]);
  const parserNotesMerged = [
    ...(Array.isArray(review["parserNotes"]) ? (review["parserNotes"] as unknown[]).filter((v): v is string => typeof v === "string") : []),
    ...parserNotes,
  ];
  const humanNotes = Array.isArray(review["humanNotes"]) ? (review["humanNotes"] as unknown[]).filter((v): v is string => typeof v === "string") : [];

  return {
    reviewStatus: statusRaw,
    confidence,
    ...(sourceEvidence.length > 0 ? { sourceEvidence } : {}),
    ...(unresolvedFields.length > 0 ? { unresolvedFields } : {}),
    ...(unsupportedSegments.length > 0 ? { unsupportedSegments } : {}),
    ...(parserNotesMerged.length > 0 ? { parserNotes: parserNotesMerged } : {}),
    ...(humanNotes.length > 0 ? { humanNotes } : {}),
  };
}
