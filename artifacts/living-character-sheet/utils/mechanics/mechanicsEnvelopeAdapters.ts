import type {
  ItemMechanicsBlock,
  ItemMechanicsCompatibilityShape,
  ItemMechanicsImportExportEnvelope,
  MechanicDefinition,
} from "@/types";
import { itemMechanicsBlockToLegacyCompatibility, legacyItemToItemMechanicsBlock } from "./itemMechanicsAdapters";

export interface EnvelopeToRuntimeCompatibilityResult {
  mechanicsBlock: ItemMechanicsBlock;
  compatibilityShape: ItemMechanicsCompatibilityShape;
  validationErrors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fallbackItemMechanicsBlock(validationErrors: string[]): ItemMechanicsBlock {
  return {
    schemaVersion: "v1",
    ownerType: "item",
    mechanics: [],
    review: {
      reviewStatus: "unsupported",
      confidence: "low",
      parserNotes: ["Envelope validation failed; emitted compatibility fallback"],
      unsupportedSegments: validationErrors.map((error) => ({
        rawText: error,
        reason: "missing_required_detail",
      })),
    },
    unresolvedSegments: validationErrors.map((error) => ({
      rawText: error,
      reason: "missing_required_detail",
    })),
  };
}

/**
 * Builds a degraded-but-preserved mechanics block when the envelope schemaVersion is unrecognized.
 * Rather than discarding mechanics entirely, we carry the MechanicDefinition array forward and
 * mark the review state as degraded with notes about the unknown version. This preserves data for
 * future re-normalization once the schema version is formally supported.
 */
function buildDegradedVersionEnvelopeMechanics(
  rawMechanicsBlock: Record<string, unknown>,
  validationErrors: string[]
): ItemMechanicsBlock {
  const rawMechanicsArray = rawMechanicsBlock["mechanics"];
  const mechanics = Array.isArray(rawMechanicsArray)
    ? (rawMechanicsArray as MechanicDefinition[])
    : [];
  const existingReview = isRecord(rawMechanicsBlock["review"]) ? rawMechanicsBlock["review"] : {};
  const existingParserNotes = Array.isArray(existingReview["parserNotes"])
    ? (existingReview["parserNotes"] as string[])
    : [];

  return {
    schemaVersion: "v1",
    ownerType: "item",
    mechanics,
    review: {
      reviewStatus: "needs_review",
      confidence: "low",
      parserNotes: [
        ...validationErrors.map((e) => `[degraded] ${e}`),
        ...existingParserNotes,
        "Mechanics preserved from forward-unknown envelope version; manual review recommended",
      ],
    },
    compatibility: {
      migratedFrom: "legacy_item",
      notes: validationErrors,
    },
    unresolvedSegments:
      mechanics.length === 0
        ? [{ rawText: "No mechanics found in degraded envelope", reason: "missing_required_detail" }]
        : [],
  };
}

export function envelopeToRuntimeCompatibilityItem(envelope: unknown): EnvelopeToRuntimeCompatibilityResult {
  const validationErrors: string[] = [];

  if (!isRecord(envelope)) {
    validationErrors.push("Envelope is not an object");
    const mechanicsBlock = fallbackItemMechanicsBlock(validationErrors);
    return {
      mechanicsBlock,
      compatibilityShape: itemMechanicsBlockToLegacyCompatibility(mechanicsBlock),
      validationErrors,
    };
  }

  const schemaVersionKnown = envelope["schemaVersion"] === "v1";
  if (!schemaVersionKnown) {
    validationErrors.push(`Unsupported schemaVersion: ${String(envelope["schemaVersion"])}`);
  }
  if (envelope["ownerType"] !== "item") {
    validationErrors.push(`Unsupported ownerType: ${String(envelope["ownerType"])}`);
  }

  const maybeMechanics = envelope["mechanics"];

  // Degraded-preservation path: unknown schemaVersion but ownerType is fine and mechanics block
  // is structurally present. Rather than full fallback (data loss), preserve the mechanics array
  // with degraded review marking so future migrations can recover it.
  const ownerTypeValid = envelope["ownerType"] === "item";
  if (!schemaVersionKnown && ownerTypeValid && isRecord(maybeMechanics)) {
    const degradedBlock = buildDegradedVersionEnvelopeMechanics(maybeMechanics, validationErrors);
    return {
      mechanicsBlock: degradedBlock,
      compatibilityShape: itemMechanicsBlockToLegacyCompatibility(degradedBlock),
      validationErrors,
    };
  }

  const mechanicsBlock = validationErrors.length > 0 || !isRecord(maybeMechanics)
    ? fallbackItemMechanicsBlock(validationErrors.length > 0 ? validationErrors : ["Missing mechanics block"])
    : legacyItemToItemMechanicsBlock({ mechanics: maybeMechanics as unknown as ItemMechanicsBlock });

  return {
    mechanicsBlock,
    compatibilityShape: itemMechanicsBlockToLegacyCompatibility(mechanicsBlock),
    validationErrors,
  };
}

export function runtimeCompatibilityItemToEnvelope(input: {
  mechanics?: ItemMechanicsBlock;
  compatibilityShape: ItemMechanicsCompatibilityShape;
  exportedFrom?: string;
  compatibilityHints?: string[];
}): ItemMechanicsImportExportEnvelope {
  const mechanicsBlock = input.mechanics
    ? input.mechanics
    : legacyItemToItemMechanicsBlock({
        ...input.compatibilityShape,
        name: input.exportedFrom,
      });

  const compatibility = {
    ...(mechanicsBlock.compatibility ?? {}),
    migratedFrom: "legacy_item" as const,
    ...(input.compatibilityHints && input.compatibilityHints.length > 0
      ? { notes: [...(mechanicsBlock.compatibility?.notes ?? []), ...input.compatibilityHints] }
      : {}),
  };

  return {
    schemaVersion: "v1",
    ownerType: "item",
    mechanics: {
      ...mechanicsBlock,
      ...(input.exportedFrom ? { exportedFrom: input.exportedFrom } : {}),
    },
    compatibility,
    metadata: {
      exportedAt: Date.now(),
      sourceLabel: input.exportedFrom,
    },
  };
}
