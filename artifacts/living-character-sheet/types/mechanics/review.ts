import type { ReviewConfidence, ReviewStatus, UnresolvedIssueType, MechanicUnsupportedReason } from "./enums";

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
  reason: MechanicUnsupportedReason;
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