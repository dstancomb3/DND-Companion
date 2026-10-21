import type { CombatActionSourceType } from "@/types/combatResolution";
import type { CombatDeclaredReaction, SupportedReactionDeclarationKind } from "@/types/combatReaction";

export interface BuildDeclaredReactionInput {
  triggerType?: string;
  sourceType: CombatActionSourceType;
  sourceName: string;
  spellLevel?: number;
}

export interface BuildDeclaredReactionOutput {
  declared?: CombatDeclaredReaction;
  limitation?: string;
  inferredTriggerType?: string;
}

function sourceHintFromSourceType(sourceType: CombatActionSourceType): CombatDeclaredReaction["sourceHint"] {
  if (sourceType === "prepared_spell" || sourceType === "item_spell") return "spell";
  if (sourceType === "class_feature") return "class_feature";
  if (sourceType === "item_action" || sourceType === "consumable") return "item";
  return "custom";
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function inferTriggerType(input: BuildDeclaredReactionInput): string | undefined {
  if (typeof input.triggerType === "string" && input.triggerType.trim().length > 0) {
    return input.triggerType.trim();
  }

  const normalizedName = normalizeText(input.sourceName);
  if (normalizedName.includes("counterspell")) return "counterspell";
  if (normalizedName === "shield" || normalizedName.includes("reaction: shield")) return "shield";
  if (normalizedName.includes("opportunity")) return "opportunity_attack";
  if (normalizedName.includes("readied")) return "readied_action";
  return undefined;
}

function buildSupportedDeclaredReaction(input: {
  triggerType: string;
  sourceHint: CombatDeclaredReaction["sourceHint"];
  sourceName: string;
  spellLevel?: number;
}): CombatDeclaredReaction | undefined {
  const { triggerType, sourceHint, sourceName, spellLevel } = input;
  const normalizedTrigger = normalizeText(triggerType);

  if (normalizedTrigger === "opportunity_attack") {
    return {
      reactionKind: "opportunity_attack",
      reactionName: "Opportunity Attack",
      triggerKind: "opportunity_attack",
      sourceHint,
      targetHint: "single_target",
      effectHints: [
        {
          effectType: "opportunity_attack",
          details: sourceName,
        },
      ],
    };
  }

  if (normalizedTrigger === "shield") {
    return {
      reactionKind: "shield",
      reactionName: "Shield",
      triggerKind: "shield",
      sourceHint,
      targetHint: "self",
      effectHints: [
        {
          effectType: "ac_bonus",
          bonus: 5,
          durationText: "until the start of your next turn",
        },
      ],
    };
  }

  if (normalizedTrigger === "counterspell") {
    return {
      reactionKind: "counterspell",
      reactionName: "Counterspell",
      triggerKind: "counterspell",
      sourceHint,
      targetHint: "single_target",
      effectHints: [
        {
          effectType: "counterspell_attempt",
          ...(typeof spellLevel === "number" && Number.isFinite(spellLevel)
            ? { counterLevel: Math.max(0, Math.floor(spellLevel)) }
            : {}),
        },
      ],
    };
  }

  if (normalizedTrigger === "readied_action") {
    return {
      reactionKind: "readied_action",
      reactionName: "Readied Action",
      triggerKind: "readied_action",
      sourceHint,
      targetHint: "unknown",
      effectHints: [
        {
          effectType: "readied_action_execute",
          details: sourceName,
        },
      ],
    };
  }

  return undefined;
}

export function isSupportedDeclaredReactionKind(value: string): value is SupportedReactionDeclarationKind {
  return value === "opportunity_attack" || value === "shield" || value === "counterspell" || value === "readied_action";
}

export function buildDeclaredReaction(input: BuildDeclaredReactionInput): BuildDeclaredReactionOutput {
  const sourceHint = sourceHintFromSourceType(input.sourceType);
  const inferredTriggerType = inferTriggerType(input);
  if (!inferredTriggerType) {
    return {};
  }

  const declared = buildSupportedDeclaredReaction({
    triggerType: inferredTriggerType,
    sourceHint,
    sourceName: input.sourceName,
    spellLevel: input.spellLevel,
  });

  if (!declared) {
    return {
      inferredTriggerType,
      limitation: `Reaction trigger ${inferredTriggerType} is not in the bounded C4 supported declaration set.`,
    };
  }

  return {
    declared,
    inferredTriggerType,
  };
}
