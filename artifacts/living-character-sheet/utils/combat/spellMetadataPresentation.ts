import type { CombatActionCommand } from "@/types/combatResolution";

type DeclaredSpellPayload = NonNullable<CombatActionCommand["declared"]>;

function spellLevelLabel(spellLevel: number | undefined): string {
  if (!spellLevel || spellLevel < 1) return "cantrip";
  return `level ${spellLevel}`;
}

export function formatSpellCastEventMessage(spellName: string, spellLevel: number | undefined): string {
  return `Cast spell: ${spellName} (${spellLevelLabel(spellLevel)})`;
}

export function formatDeclaredSpellSummary(input: {
  declared: DeclaredSpellPayload;
  resolutionLimitations: string[];
  targetNameById?: Record<string, string>;
  targetOrderIds?: string[];
  spellAttack?: {
    detected: boolean;
    attackBonus?: number;
    declaredAttackRoll?: number;
    declaredCritical?: boolean;
  };
}): string | null {
  const { declared, resolutionLimitations, targetNameById, targetOrderIds, spellAttack } = input;
  const parts: string[] = [];

  if (spellAttack?.detected) {
    const attackBits: string[] = [];
    if (typeof spellAttack.attackBonus === "number") {
      attackBits.push(`bonus +${spellAttack.attackBonus}`);
    }
    if (typeof spellAttack.declaredAttackRoll === "number") {
      attackBits.push(`declared roll ${spellAttack.declaredAttackRoll}`);
      if (spellAttack.declaredCritical) {
        attackBits.push("critical");
      }
    }
    parts.push(`Spell attack${attackBits.length ? ` (${attackBits.join(", ")})` : ""}`);
  }

  if (declared.spell?.mode) {
    parts.push(`Spell mode ${declared.spell.mode}`);
  }

  if (declared.spell?.targetScopeHint && declared.spell.targetScopeHint !== "unknown") {
    parts.push(`Target scope ${declared.spell.targetScopeHint}`);
  }

  if (declared.save) {
    const saveAbility = String(declared.save.saveAbility ?? "").toUpperCase();
    const saveDc = typeof declared.save.dc === "number" ? ` DC ${declared.save.dc}` : "";
    const onSave = declared.save.onSave ? ` (${declared.save.onSave} on save)` : "";
    parts.push(`Save ${saveAbility}${saveDc}${onSave}`);

    const targetRollEntries = Object.entries(declared.save.targetRolls ?? {}).filter(
      ([, roll]) => typeof roll === "number" && Number.isFinite(roll)
    );
    if (targetRollEntries.length > 0) {
      const orderIndexById = new Map<string, number>();
      (targetOrderIds ?? []).forEach((targetId, index) => {
        orderIndexById.set(targetId, index);
      });
      targetRollEntries.sort(([targetA], [targetB]) => {
        const orderA = orderIndexById.get(targetA);
        const orderB = orderIndexById.get(targetB);
        if (typeof orderA === "number" && typeof orderB === "number") return orderA - orderB;
        if (typeof orderA === "number") return -1;
        if (typeof orderB === "number") return 1;
        return targetA.localeCompare(targetB);
      });

      const preview = targetRollEntries
        .slice(0, 3)
        .map(([targetId, roll]) => `${targetNameById?.[targetId] ?? targetId}: ${roll}`)
        .join(", ");
      const overflow = targetRollEntries.length > 3 ? ` (+${targetRollEntries.length - 3} more)` : "";
      parts.push(`Target save rolls ${targetRollEntries.length} (${preview}${overflow})`);
    }
  }

  if ((declared.damagePackets?.length ?? 0) > 0) {
    parts.push(`Damage packets ${declared.damagePackets?.length ?? 0}`);
    const dicePackets = declared.damagePackets?.filter((packet) => packet.resolutionModel === "dice_average" || packet.resolutionModel === "dice_declared_roll") ?? [];
    if (dicePackets.length > 0) {
      const preview = dicePackets
        .slice(0, 2)
        .map((packet) => `${packet.diceExpression ?? "dice"} ${packet.damageType ?? "damage"}`)
        .join(", ");
      const overflow = dicePackets.length > 2 ? ` (+${dicePackets.length - 2} more)` : "";
      parts.push(`Dice damage ${dicePackets.length} (${preview}${overflow})`);
    }
  }

  if ((declared.conditionEffects?.length ?? 0) > 0) {
    const preview = (declared.conditionEffects ?? [])
      .slice(0, 2)
      .map((effect) => {
        const trigger = effect.applyWhen.replaceAll("_", " ");
        const concentration = effect.concentrationLinked ? ", concentration" : "";
        return `${effect.conditionName} (${trigger}${concentration})`;
      })
      .join(", ");
    const overflow = (declared.conditionEffects?.length ?? 0) > 2 ? ` (+${(declared.conditionEffects?.length ?? 0) - 2} more)` : "";
    parts.push(`Condition effects ${declared.conditionEffects?.length ?? 0} (${preview}${overflow})`);
  }

  if (declared.spell?.damageModel && declared.spell.damageModel !== "none") {
    parts.push(`Damage model ${declared.spell.damageModel}`);
  }

  if (declared.spell?.scaling && declared.spell.scaling.levelsAboveBase > 0) {
    const scaling = declared.spell.scaling;
    const supportText = scaling.supported ? `supported (${scaling.source})` : "not safely supported";
    const summaryText = scaling.summary ? ` - ${scaling.summary}` : "";
    parts.push(`Upcast +${scaling.levelsAboveBase} levels: ${supportText}${summaryText}`);
  }

  if (resolutionLimitations.length > 0) {
    parts.push(`Limitations: ${resolutionLimitations.join("; ")}`);
  }

  return parts.length > 0 ? parts.join("\n") : null;
}
