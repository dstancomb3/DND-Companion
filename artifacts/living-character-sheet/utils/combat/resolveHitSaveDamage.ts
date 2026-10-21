import type {
  CombatTargetAuthority,
  CombatResolutionSummary,
  CombatResolutionTargetSnapshot,
  CombatTargetResolutionResult,
} from "@/types/combatOutcome";
import type { CombatActionCommand, CombatActionResultReasonCode } from "@/types/combatResolution";
import type { CombatConditionResolution, CombatDeclaredConditionEffect } from "@/types/combatConditions";
import { applyDamagePacket } from "@/utils/combat/applyDamagePacket";

interface ResolveHitSaveDamageInput {
  command: CombatActionCommand;
  targetSnapshotsById: Record<string, CombatResolutionTargetSnapshot>;
}

interface ResolveHitSaveDamageResult {
  ok: boolean;
  reasonCode?: CombatActionResultReasonCode;
  targetResults: CombatTargetResolutionResult[];
  summary: CombatResolutionSummary;
  notes?: string[];
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function attackBonusFromCommand(command: CombatActionCommand): number {
  const eventMetadata = command.metadata?.["eventMetadata"] as Record<string, unknown> | undefined;
  const explicit = asNumber(eventMetadata?.["attackBonus"]);
  const spellAttackBonus = asNumber(eventMetadata?.["spellAttackBonus"]);
  return explicit ?? spellAttackBonus ?? 0;
}

function isCritical(command: CombatActionCommand): boolean {
  return command.declared?.attackRoll === 20;
}

function summarize(targetResults: CombatTargetResolutionResult[], notes?: string[]): CombatResolutionSummary {
  const appliedLocal = targetResults.filter((target) => target.applyState === "applied_local");
  const previewOnly = targetResults.filter((target) => target.applyState === "preview_only");

  return {
    targetedCount: targetResults.length,
    resolvedCount: targetResults.filter(
      (target) => target.hitOutcome.status !== "unresolved" && target.saveOutcome.status !== "unresolved"
    ).length,
    appliedLocalCount: appliedLocal.length,
    previewOnlyCount: previewOnly.length,
    totalHpDamageAppliedLocal: appliedLocal.reduce((sum, target) => sum + Math.max(0, target.damageBreakdown?.hpDamage ?? 0), 0),
    totalHpDamagePreview: previewOnly.reduce((sum, target) => sum + Math.max(0, target.damageBreakdown?.hpDamage ?? 0), 0),
    ...(notes && notes.length > 0 ? { notes } : {}),
  };
}

// Phase D: target Paralyzed/Unconscious force a critical hit.
// NOTE: RAW restricts this to melee attacks within 5 ft; range is not tracked in Phase D —
// this is a first-pass approximation. Refine when attack-reach data is available.
function targetHasAutoForcedCrit(snapshot: CombatResolutionTargetSnapshot): boolean {
  return snapshot.conditions?.some((c) => c === "Paralyzed" || c === "Unconscious") ?? false;
}

// Phase D: target Stunned/Paralyzed/Unconscious/Petrified auto-fail Strength and Dexterity saves.
function targetAutoFailsStrDexSave(snapshot: CombatResolutionTargetSnapshot): boolean {
  return (
    snapshot.conditions?.some(
      (c) => c === "Stunned" || c === "Paralyzed" || c === "Unconscious" || c === "Petrified"
    ) ?? false
  );
}

function authorityForMissingSnapshot(): CombatTargetAuthority {
  return {
    mode: "skipped",
    canApplyLocally: false,
    certainty: "unknown",
    reason: "missing_target_snapshot",
  };
}

function authorityForSnapshot(snapshot: CombatResolutionTargetSnapshot): CombatTargetAuthority {
  if (snapshot.authority) {
    return snapshot.authority;
  }

  if (snapshot.isLocalCharacter) {
    return {
      mode: "local_authoritative",
      canApplyLocally: true,
      certainty: "confirmed",
      reason: "local_character",
    };
  }

  return {
    mode: snapshot.targetType === "member" ? "preview_only" : "preview_only",
    canApplyLocally: false,
    certainty: snapshot.mitigationKnown === false ? "limited" : "confirmed",
    reason: snapshot.targetType === "member" ? "remote_member_preview_only" : "remote_npc_preview_only",
  };
}

function applyStateFromAuthority(authority: CombatTargetAuthority): CombatTargetResolutionResult["applyState"] {
  switch (authority.mode) {
    case "local_authoritative":
      return "applied_local";
    case "preview_only":
      return "preview_only";
    default:
      return "skipped";
  }
}

function normalizeTextSet(values?: string[]): Set<string> {
  return new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function buildConcentrationLinkId(command: CombatActionCommand): string {
  return command.source.sourceId;
}

function resolveConditionEffectsForTarget(input: {
  command: CombatActionCommand;
  snapshot: CombatResolutionTargetSnapshot;
  hitPassed: boolean;
  saveOutcomeStatus: CombatTargetResolutionResult["saveOutcome"]["status"];
}): CombatConditionResolution[] {
  const { command, snapshot, hitPassed, saveOutcomeStatus } = input;
  const declaredEffects = command.declared?.conditionEffects ?? [];
  if (declaredEffects.length === 0) return [];

  const activeConditions = normalizeTextSet(snapshot.conditions);
  const conditionImmunities = normalizeTextSet(snapshot.conditionImmunities);
  const concentrationLinkId = buildConcentrationLinkId(command);

  return declaredEffects.map((effect): CombatConditionResolution => {
    const triggered =
      effect.applyWhen === "always"
        ? true
        : effect.applyWhen === "on_hit"
          ? hitPassed
          : effect.applyWhen === "on_failed_save"
            ? saveOutcomeStatus === "failed"
            : hitPassed && saveOutcomeStatus === "failed";

    if (!triggered) {
      return {
        effectType: effect.effectType,
        conditionName: effect.conditionName,
        status: "not_triggered",
        sourceLabel: effect.sourceLabel,
        durationHint: effect.durationHint,
        concentrationLinked: effect.concentrationLinked,
      };
    }

    const normalizedName = effect.conditionName.trim().toLowerCase();
    if (!normalizedName) {
      return {
        effectType: effect.effectType,
        conditionName: effect.conditionName,
        status: "unresolved",
        reason: "condition name missing",
        sourceLabel: effect.sourceLabel,
        durationHint: effect.durationHint,
        concentrationLinked: effect.concentrationLinked,
      };
    }

    if (effect.effectType === "remove_condition") {
      if (!activeConditions.has(normalizedName)) {
        return {
          effectType: effect.effectType,
          conditionName: effect.conditionName,
          status: "not_triggered",
          reason: "condition not currently active",
          sourceLabel: effect.sourceLabel,
          durationHint: effect.durationHint,
          concentrationLinked: effect.concentrationLinked,
        };
      }
      return {
        effectType: effect.effectType,
        conditionName: effect.conditionName,
        status: "removed",
        sourceLabel: effect.sourceLabel,
        durationHint: effect.durationHint,
        concentrationLinked: effect.concentrationLinked,
        concentrationLinkId: effect.concentrationLinked ? concentrationLinkId : undefined,
        sourceName: command.source.sourceName,
      };
    }

    if (conditionImmunities.has(normalizedName)) {
      return {
        effectType: effect.effectType,
        conditionName: effect.conditionName,
        status: "blocked",
        reason: "target condition immunity",
        sourceLabel: effect.sourceLabel,
        durationHint: effect.durationHint,
        concentrationLinked: effect.concentrationLinked,
        sourceName: command.source.sourceName,
      };
    }

    if (activeConditions.has(normalizedName)) {
      return {
        effectType: effect.effectType,
        conditionName: effect.conditionName,
        status: "not_triggered",
        reason: "condition already active",
        sourceLabel: effect.sourceLabel,
        durationHint: effect.durationHint,
        concentrationLinked: effect.concentrationLinked,
        sourceName: command.source.sourceName,
      };
    }

    return {
      effectType: effect.effectType,
      conditionName: effect.conditionName,
      status: "applied",
      sourceLabel: effect.sourceLabel,
      durationHint: effect.durationHint,
      concentrationLinked: effect.concentrationLinked,
      concentrationLinkId: effect.concentrationLinked ? concentrationLinkId : undefined,
      sourceName: command.source.sourceName,
    };
  });
}

export function resolveHitSaveDamage(input: ResolveHitSaveDamageInput): ResolveHitSaveDamageResult {
  const { command, targetSnapshotsById } = input;
  const targets = command.targets?.targetIds ?? [];
  const packets = command.declared?.damagePackets ?? [];
  const conditionEffects: CombatDeclaredConditionEffect[] = command.declared?.conditionEffects ?? [];
  const save = command.declared?.save;
  const onSave = save?.onSave ?? "full";

  const requiresResolution = command.metadata?.["requiresResolution"] === true;
  const isAttack = command.source.sourceType === "attack";
  const requiresAttackPayload = requiresResolution || (isAttack && packets.length > 0);

  if (requiresAttackPayload) {
    const missingAttackRoll = isAttack && typeof command.declared?.attackRoll !== "number";
    const missingDamagePackets = isAttack && packets.length === 0;
    if (missingAttackRoll || missingDamagePackets) {
      return {
        ok: false,
        reasonCode: "invalid_resolution_input",
        targetResults: [],
        summary: summarize([], ["resolution payload missing attack roll or damage packets"]),
      };
    }
  }

  if (targets.length === 0) {
    return {
      ok: true,
      targetResults: [],
      summary: summarize([]),
    };
  }

  const toHitRoll = command.declared?.attackRoll;
  const toHitBonus = attackBonusFromCommand(command);
  const baseCritical = isCritical(command);
  const saveRolls = save?.targetRolls ?? {};
  const declaredSpellMode = command.declared?.spell?.mode;
  const requiresAttackRoll = declaredSpellMode === "attack" || declaredSpellMode === "attack_and_save";
  const isMovementAction = command.action.actionKind === "movement" && command.action.mode === "use";

  const targetResults: CombatTargetResolutionResult[] = [];
  const notes: string[] = [];
  let previewTargetsWithUnknownMitigation = 0;

  const explicitLimitations = command.metadata?.["resolutionLimitations"];
  if (Array.isArray(explicitLimitations)) {
    for (const limitation of explicitLimitations) {
      if (typeof limitation === "string" && limitation.trim().length > 0) {
        notes.push(`resolution limitation: ${limitation}`);
      }
    }
  }

  if (save) {
    if (typeof save.dc !== "number") {
      notes.push("save DC not declared; save outcomes remain unresolved until a DC is provided");
    }
    const hasAnyDeclaredRoll = targets.some((targetId) => typeof saveRolls[targetId] === "number");
    if (!hasAnyDeclaredRoll) {
      notes.push("target save rolls not declared; save outcomes remain unresolved until rolls are provided");
    }
  }
  if (requiresAttackRoll && typeof toHitRoll !== "number") {
    notes.push("spell attack roll was required by declared spell mode, but no attack roll was provided");
  }
  if (isMovementAction) {
    notes.push("movement action resolution remains conservative; condition-based movement restrictions are not fully modeled in economy validation yet");
  }

  for (const targetId of targets) {
    const snapshot = targetSnapshotsById[targetId];
    if (!snapshot) {
      const authority = authorityForMissingSnapshot();
      targetResults.push({
        targetId,
        targetType: "npc",
        hitOutcome: {
          status: "unresolved",
          reason: "target snapshot missing",
        },
        saveOutcome: {
          status: "unresolved",
          reason: "target snapshot missing",
        },
        hpDeltaPreview: 0,
        tempHpConsumedPreview: 0,
        applyState: applyStateFromAuthority(authority),
        authority,
        reason: "target snapshot missing",
      });
      notes.push(`target ${targetId} missing snapshot`);
      continue;
    }

    const authority = authorityForSnapshot(snapshot);

    if (
      authority.mode === "preview_only" &&
      authority.certainty !== "confirmed" &&
      packets.some((packet) => packet.rawAmount > 0 && typeof packet.damageType === "string" && packet.damageType.trim().length > 0)
    ) {
      previewTargetsWithUnknownMitigation += 1;
    }

    // Phase D: per-target critical — auto-forced if target is Paralyzed or Unconscious.
    const forcedCrit = targetHasAutoForcedCrit(snapshot);
    const critical = baseCritical || forcedCrit;
    if (forcedCrit && !baseCritical) {
      notes.push(`auto-crit on target ${targetId}: Paralyzed/Unconscious (Phase D approximation; does not model melee-range constraint)`);
    }

    let hitPassed = true;
    const hitOutcome: CombatTargetResolutionResult["hitOutcome"] = { status: "auto" };
    if (requiresAttackRoll && typeof toHitRoll !== "number") {
      hitOutcome.status = "unresolved";
      hitOutcome.reason = "spell attack roll missing";
      hitPassed = false;
    } else if (typeof toHitRoll === "number") {
      if (typeof snapshot.armorClass !== "number") {
        hitOutcome.status = "unresolved";
        hitOutcome.attackRoll = toHitRoll;
        hitOutcome.attackBonus = toHitBonus;
        hitOutcome.totalToHit = toHitRoll + toHitBonus;
        hitOutcome.reason = "target armor class unavailable";
        hitPassed = false;
      } else {
        const totalToHit = toHitRoll + toHitBonus;
        hitPassed = totalToHit >= snapshot.armorClass;
        hitOutcome.status = hitPassed ? "hit" : "miss";
        hitOutcome.attackRoll = toHitRoll;
        hitOutcome.attackBonus = toHitBonus;
        hitOutcome.totalToHit = totalToHit;
        hitOutcome.targetArmorClass = snapshot.armorClass;
      }
    }

    const saveRoll = saveRolls[targetId];
    let savePassed = false;
    const saveOutcome: CombatTargetResolutionResult["saveOutcome"] = {
      status: "none",
      ...(save?.saveAbility ? { saveAbility: save.saveAbility } : {}),
      ...(typeof save?.dc === "number" ? { dc: save.dc } : {}),
      ...(save?.onSave ? { onSave: save.onSave } : {}),
    };
    if (save) {
      if (typeof save.dc !== "number" || typeof saveRoll !== "number") {
        saveOutcome.status = "unresolved";
        saveOutcome.reason = "save dc/roll unavailable";
      } else {
        savePassed = saveRoll >= save.dc;
        saveOutcome.status = savePassed ? "passed" : "failed";
        saveOutcome.roll = saveRoll;
        saveOutcome.total = saveRoll;
      }
    }

    // Phase D: auto-fail Str/Dex saves for Stunned/Paralyzed/Unconscious/Petrified targets.
    if (save && targetAutoFailsStrDexSave(snapshot)) {
      const saveAbilityLower = (save.saveAbility ?? "").toLowerCase();
      if (saveAbilityLower === "str" || saveAbilityLower === "dex") {
        savePassed = false;
        saveOutcome.status = "failed";
        saveOutcome.reason = "auto-fail: target condition";
        notes.push(`auto-fail ${save.saveAbility} save on target ${targetId}: condition`);
      }
    }

    if (!hitPassed) {
      targetResults.push({
        targetId,
        targetType: snapshot.targetType,
        hitOutcome,
        saveOutcome,
        hpDeltaPreview: 0,
        tempHpConsumedPreview: 0,
        applyState: "skipped",
        authority: { ...authority, mode: "skipped", canApplyLocally: false },
        reason: hitOutcome.reason ?? "attack missed",
      });
      continue;
    }

    const conditionResults = resolveConditionEffectsForTarget({
      command,
      snapshot,
      hitPassed,
      saveOutcomeStatus: saveOutcome.status,
    });

    if (save && saveOutcome.status === "unresolved") {
      targetResults.push({
        targetId,
        targetType: snapshot.targetType,
        hitOutcome,
        saveOutcome,
        conditionResults,
        hpDeltaPreview: 0,
        tempHpConsumedPreview: 0,
        applyState: "skipped",
        authority: { ...authority, mode: "skipped", canApplyLocally: false },
        reason: saveOutcome.reason ?? "save unresolved",
      });
      continue;
    }

    let effectivePackets = packets;
    if (save && saveOutcome.status === "passed") {
      if (onSave === "none" || onSave === "negates") {
        effectivePackets = [];
      } else if (onSave === "half") {
        effectivePackets = packets.map((packet) => ({
          ...packet,
          rawAmount: packet.rawAmount > 0
            ? Math.floor(Math.max(0, packet.rawAmount) / 2)
            : packet.rawAmount,
        }));
      }
    }

    const resolution = applyDamagePacket({
      packets: effectivePackets,
      isCritical: critical,
      currentHp: typeof snapshot.currentHp === "number" ? snapshot.currentHp : 0,
      tempHp: typeof snapshot.tempHp === "number" ? snapshot.tempHp : 0,
      damageResistances: snapshot.damageResistances,
      damageImmunities: snapshot.damageImmunities,
      vulnerabilityMultiplier: snapshot.vulnerabilityMultiplier,
    });

    for (const conditionResult of conditionResults) {
      if (conditionResult.status === "applied") {
        notes.push(`condition ${conditionResult.conditionName} applied to target ${targetId}`);
      } else if (conditionResult.status === "blocked") {
        notes.push(`condition ${conditionResult.conditionName} blocked on target ${targetId}: ${conditionResult.reason ?? "blocked"}`);
      } else if (conditionResult.status === "unresolved") {
        notes.push(`condition ${conditionResult.conditionName} unresolved on target ${targetId}: ${conditionResult.reason ?? "unresolved"}`);
      }
    }

    targetResults.push({
      targetId,
      targetType: snapshot.targetType,
      hitOutcome,
      saveOutcome,
      damageBreakdown: resolution.breakdown,
      conditionResults,
      hpDeltaPreview: resolution.hpDelta,
      tempHpConsumedPreview: resolution.breakdown.tempHpAbsorbed,
      applyState: applyStateFromAuthority(authority),
      authority,
    });
  }

  if (previewTargetsWithUnknownMitigation > 0) {
    notes.push(
      `Preview damage may ignore unknown resistances or immunities for ${previewTargetsWithUnknownMitigation} remote target${previewTargetsWithUnknownMitigation === 1 ? "" : "s"}.`
    );
  }

  const unresolvedTargets = targetResults.some((target) => target.hitOutcome.status === "unresolved" || target.saveOutcome.status === "unresolved");
  const summary = summarize(targetResults, notes.length > 0 ? notes : undefined);

  return {
    ok: true,
    reasonCode: unresolvedTargets ? "unresolved_target_stats" : undefined,
    targetResults,
    summary,
    ...(notes.length > 0 ? { notes } : {}),
  };
}
