import type { CombatActionResult, CombatActionResultReasonCode } from "@/types/combatResolution";
import type { PendingReactionWindow } from "@/types/combatReaction";

function formatReactionTriggerLabel(triggerType: string): string {
  switch (triggerType) {
    case "opportunity_attack":
      return "Opportunity Attack";
    case "counterspell":
      return "Counterspell";
    case "shield":
      return "Shield";
    case "readied_action":
      return "Readied Action";
    case "custom":
      return "Reaction";
    default:
      return triggerType
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

/**
 * Unified combat rejection reason code -> user message mapping.
 * Covers all phases: economy (A), targeting (C), damage/saves (C.5),
 * conditions/concentration (D), and reactions/timing (E).
 */
export function getCombatRejectMessage(reasonCode?: string | null): string {
  switch (reasonCode) {
    case "combat_inactive":
      return "Combat is not active.";
    case "not_your_turn":
      return "It is not your turn.";
    case "actor_incapacitated":
      return "You are incapacitated and cannot take actions.";
    case "movement_blocked_by_condition":
      return "Your current condition prevents movement.";
    case "no_action_available":
      return "No action is available.";
    case "no_bonus_action_available":
      return "No bonus action is available.";
    case "reaction_unavailable":
      return "Your reaction is unavailable.";
    case "reaction_window_required":
      return "A reaction window is required before using this reaction.";
    case "reaction_window_mismatch":
      return "This reaction does not match the active reaction window.";
    case "reaction_trigger_mismatch":
      return "This reaction trigger does not match the active reaction window trigger.";
    case "reaction_declaration_mismatch":
      return "This declared reaction does not match the active reaction context.";
    case "reaction_window_expired":
      return "This reaction window has expired.";
    case "insufficient_movement":
      return "Insufficient movement remaining.";
    case "invalid_target":
      return "Selected targets are invalid.";
    case "invalid_resolution_input":
      return "Resolution input is incomplete for this action.";
    case "unresolved_target_stats":
      return "Some target stats are missing, so outcomes are partial.";
    case "undo_not_allowed_in_active_combat":
      return "Undo is not allowed during active combat.";
    case "unsupported_mode":
      return "That action mode is not supported.";
    default:
      return "Action was rejected.";
  }
}

/**
 * Format combat outcome summary from resolution result.
 * Shows target counts, applied vs preview-only distinction, and unresolved warnings.
 * Returns null if no meaningful summary is available.
 */
export function formatOutcomeSummary(result: CombatActionResult): string | null {
  if (result.remoteApplicationError) return result.remoteApplicationError;
  if (result.remoteApplication?.ok) {
    const receipt = result.remoteApplication;
    if (receipt.replayed) return "This action was already processed.";
    const skipped = receipt.targetResults?.filter(target => target.status !== "applied").length ?? 0;
    return `Action confirmed for ${receipt.appliedCount} target(s).${skipped ? ` ${skipped} outcome(s) were not applied.` : ""}`;
  }
  const targetResults = result.targetResults ?? [];
  const summary = result.resolutionSummary;

  if (!summary || targetResults.length === 0) {
    return null;
  }

  const lines: string[] = [];
  const incompleteCount = summary.targetedCount - summary.resolvedCount;
  const hasNotes = (summary.notes?.length ?? 0) > 0;
  const hasConcentration = Boolean(result.concentrationCheckNeeded);
  const hasNoteworthyOutcome =
    summary.previewOnlyCount > 0
    || incompleteCount > 0
    || hasNotes
    || hasConcentration
    || targetResults.length > 0;

  if (!hasNoteworthyOutcome) {
    return null;
  }

  lines.push(`Targets: ${summary.targetedCount} (resolved ${summary.resolvedCount})`);

  if (result.event?.type === "player_reaction_used") {
    const metadata = result.event.metadata ?? {};
    const trigger = typeof metadata["reactionTriggerType"] === "string" ? formatReactionTriggerLabel(metadata["reactionTriggerType"] as string) : undefined;
    const reactionName = typeof metadata["reactionDeclaredName"] === "string"
      ? (metadata["reactionDeclaredName"] as string)
      : typeof metadata["actionLabel"] === "string"
        ? (metadata["actionLabel"] as string)
        : "Reaction";
    const reactionStatus = incompleteCount > 0 || hasNotes ? "partially resolved" : "resolved";
    lines.push(`Reaction used: ${reactionName}${trigger ? ` (trigger: ${trigger})` : ""} - ${reactionStatus}`);
  }

  if (summary.appliedLocalCount > 0) {
    lines.push(`Applied locally: ${summary.appliedLocalCount}`);
  }
  if (summary.previewOnlyCount > 0) {
    lines.push(`Preview only: ${summary.previewOnlyCount}`);
  }
  if (incompleteCount > 0) {
    lines.push(`Incomplete outcomes: ${incompleteCount}`);
  }

  for (const target of targetResults) {
    const label = target.targetId;
    const status = target.hitOutcome.status;
    const statusLabel =
      status === "hit"
        ? "hit"
          : status === "miss"
            ? "miss"
            : status === "auto"
              ? "automatic"
              : status === "unresolved"
                ? "unresolved"
                : status;

    const hpDamage = Math.max(0, target.damageBreakdown?.hpDamage ?? 0);
    const hpHealing = Math.max(0, target.damageBreakdown?.hpHealing ?? 0);
    const tempAbsorbed = Math.max(0, target.damageBreakdown?.tempHpAbsorbed ?? 0);
    const saveAbility = target.saveOutcome?.saveAbility;
    const saveDc = target.saveOutcome?.dc;
    const saveText = saveAbility && typeof saveDc === "number"
      ? ` ${saveAbility.toUpperCase()} DC ${saveDc} (${target.saveOutcome.status})`
      : "";
    const damagePieces: string[] = [];
    if (hpDamage > 0) damagePieces.push(`${hpDamage} HP`);
    if (hpHealing > 0) damagePieces.push(`${hpHealing} heal`);
    if (tempAbsorbed > 0) damagePieces.push(`${tempAbsorbed} temp`);
    const conditionPieces = (target.conditionResults ?? [])
      .filter((condition) => condition.status === "applied" || condition.status === "removed" || condition.status === "blocked" || condition.status === "unresolved")
      .map((condition) => {
        if (condition.status === "applied") return `${condition.conditionName} applied`;
        if (condition.status === "removed") return `${condition.conditionName} removed`;
        if (condition.status === "blocked") return `${condition.conditionName} blocked`;
        return `${condition.conditionName} unresolved`;
      });

    const scope =
      target.applyState === "preview_only"
        ? "preview"
        : target.applyState === "applied_local"
          ? "applied"
          : "skipped";
    const detailPieces: string[] = [];
    if (damagePieces.length > 0) detailPieces.push(damagePieces.join(" + "));
    if (conditionPieces.length > 0) detailPieces.push(`conditions: ${conditionPieces.join(", ")}`);
    if (target.applyState === "skipped" && typeof target.reason === "string" && target.reason.trim().length > 0) {
      detailPieces.push(`reason: ${target.reason.trim()}`);
    }
    const detailText = detailPieces.length > 0 ? `, ${detailPieces.join("; ")}` : "";
    lines.push(`- ${label}: ${statusLabel}${saveText} (${scope}${detailText})`);
  }

  if (result.concentrationCheckNeeded) {
    lines.push(
      `Concentration: DC ${result.concentrationCheckNeeded.dc} required for current spell.`
    );
  }

  for (const note of summary.notes ?? []) {
    lines.push(note);
  }

  return lines.join("\n");
}

/**
 * Format concentration check message for clear, user-friendly display.
 * Used when damage is applied and a concentration spell is active.
 */
export function formatConcentrationCheckMessage(dc: number, spellName: string): string {
  return `${spellName} concentration save DC ${dc}`;
}

/**
 * Format pending reaction window message for HUD/UI display.
 * Provides context-aware feedback about the active reaction opportunity.
 */
export function formatReactionWindowMessage(pending: PendingReactionWindow): string {
  const lines = [`Reaction opportunity: ${formatReactionTriggerLabel(pending.triggerType)}`];
  if (pending.sourceCommandId) {
    lines.push(`Source: ${pending.sourceCommandId}`);
  }
  lines.push("Use your reaction now or decline this window.");
  return lines.join("\n");
}
