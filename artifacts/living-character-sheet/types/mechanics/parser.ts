import type { CharacterMechanicsBlock, ItemMechanicsBlock } from "./attachments";
import type { ParserMechanicResultKind, ReviewStatus } from "./enums";

type AnyMechanicsBlock = ItemMechanicsBlock | CharacterMechanicsBlock;

export type ParserReviewStatusForKind<TKind extends ParserMechanicResultKind> =
  TKind extends "simple"
    ? Extract<ReviewStatus, "verified" | "needs_review">
    : TKind extends "complex"
      ? Extract<ReviewStatus, "verified" | "needs_review">
      : TKind extends "ambiguous"
        ? Extract<ReviewStatus, "needs_review" | "partial">
        : Extract<ReviewStatus, "partial" | "unsupported">;

export type ParsedItemMechanicsCandidate = ItemMechanicsBlock | CanonicalParsedItemMechanicsOutcome;

export type CanonicalParsedItemMechanicsOutcome = ParsedMechanicsBlockResult<ItemMechanicsBlock>;

interface ParsedMechanicsBlockResultBase<TBlock extends AnyMechanicsBlock, TKind extends ParserMechanicResultKind> {
  kind: TKind;
  ownerType: TBlock["ownerType"];
  mechanicsBlock: TBlock;
  expectedReviewStatus: ParserReviewStatusForKind<TKind>;
  parserNotes?: string[];
}

export interface ParsedSimpleMechanicResult<TBlock extends AnyMechanicsBlock = AnyMechanicsBlock>
  extends ParsedMechanicsBlockResultBase<TBlock, "simple"> {}

export interface ParsedComplexMechanicResult<TBlock extends AnyMechanicsBlock = AnyMechanicsBlock>
  extends ParsedMechanicsBlockResultBase<TBlock, "complex"> {}

export interface ParsedAmbiguousMechanicResult<TBlock extends AnyMechanicsBlock = AnyMechanicsBlock>
  extends ParsedMechanicsBlockResultBase<TBlock, "ambiguous"> {}

export interface ParsedUnsupportedMechanicResult<TBlock extends AnyMechanicsBlock = AnyMechanicsBlock>
  extends ParsedMechanicsBlockResultBase<TBlock, "unsupported"> {}

export type ParsedMechanicsBlockResult<TBlock extends AnyMechanicsBlock = AnyMechanicsBlock> =
  | ParsedSimpleMechanicResult<TBlock>
  | ParsedComplexMechanicResult<TBlock>
  | ParsedAmbiguousMechanicResult<TBlock>
  | ParsedUnsupportedMechanicResult<TBlock>;