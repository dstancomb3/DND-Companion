/**
 * A versioned, rules-neutral combatant capability catalog.
 * This is an internal DM/engine projection. NEVER send undiscovered
 * enemy capabilities to player-facing combat state or AI prompts.
 *
 * Catalogs describe possible options, not a legal action receipt.
 * Active resources, targets, edition rules and economy are revalidated
 * at execution by the authoritative server.
 */
export type CombatantCapabilityKind = "attack" | "spell" | "feat" | "item" | "feature";
export type CombatantActionTiming = "action" | "bonus_action" | "reaction" | "free" | "special";
export type CombatantTargetPolicy = "hostile" | "ally" | "self" | "creature" | "area" | "none";

export interface CombatantCapability {
  id: string;
  kind: CombatantCapabilityKind;
  name: string;
  timing: CombatantActionTiming;
  targetPolicy: CombatantTargetPolicy;
  sourceId: string;
  sourceKind: "inventory" | "known_spell" | "feat" | "feature" | "attack";
  /**
   * Optional authoritative mechanical definition. Missing mechanics are
   * permitted in the catalog but never considered executable by themselves.
   */
  mechanics?: {
    attackBonus?: number;
    damageDice?: string;
    damageModifier?: number;
    damageType?: string;
    range?: string;
    spellLevel?: number;
    resourceId?: string;
    resourceCost?: number;
  };
}

export interface CombatantCapabilityCatalog {
  schemaVersion: 1;
  combatantId: string;
  revision: number;
  capabilities: CombatantCapability[];
}

export interface CombatantCapabilitySources {
  combatantId: string;
  inventory?: Array<{
    id: string; name: string; category: string; quantity: number; equipped?: boolean;
    attackBonus?: number; damageDice?: string; damageModifier?: number;
    damageType?: string; weaponRange?: string; range?: string;
  }>;
  attacks?: Array<{
    id: string; name: string; attackBonus?: number; damageDice?: string;
    damageModifier?: number; damageType?: string; range?: string;
    linkedInventoryItemId?: string;
  }>;
  spells?: Array<{ id: string; name: string; level: number; prepared?: boolean; timing?: CombatantActionTiming; targetPolicy?: CombatantTargetPolicy }>;
  feats?: Array<{ id: string; name: string; timing?: CombatantActionTiming; targetPolicy?: CombatantTargetPolicy }>;
  features?: Array<{ id: string; name: string; timing?: CombatantActionTiming; targetPolicy?: CombatantTargetPolicy }>;
}

function stableId(kind: string, id: string) { return `${kind}:${id}`; }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }

export function buildCombatantCapabilityCatalog(sources: CombatantCapabilitySources): CombatantCapabilityCatalog {
  const inventory = sources.inventory ?? [];
  const byId = new Map(inventory.map(item => [item.id, item]));
  const covered = new Set((sources.attacks ?? []).map(a => a.linkedInventoryItemId).filter(Boolean));
  const out: CombatantCapability[] = [];
  for (const attack of sources.attacks ?? []) {
    const linked = attack.linkedInventoryItemId ? byId.get(attack.linkedInventoryItemId) : undefined;
    if (attack.linkedInventoryItemId && (!linked || linked.category !== "weapon" || !linked.equipped || linked.quantity <= 0)) continue;
    out.push({
      id: stableId("attack", attack.id), kind: "attack", name: attack.name, timing: "action",
      targetPolicy: "hostile", sourceId: attack.id, sourceKind: "attack",
      mechanics: {
        attackBonus: finite(attack.attackBonus) ? attack.attackBonus : undefined,
        damageDice: attack.damageDice, damageModifier: finite(attack.damageModifier) ? attack.damageModifier : undefined,
        damageType: attack.damageType, range: attack.range,
      },
    });
  }
  for (const item of inventory) {
    if (item.quantity <= 0) continue;
    if (item.category === "weapon" && item.equipped && !covered.has(item.id)) {
      out.push({
        id: stableId("weapon", item.id), kind: "attack", name: item.name, timing: "action",
        targetPolicy: "hostile", sourceId: item.id, sourceKind: "inventory",
        mechanics: {
          attackBonus: finite(item.attackBonus) ? item.attackBonus : undefined,
          damageDice: item.damageDice,
          damageModifier: finite(item.damageModifier) ? item.damageModifier : undefined,
          damageType: item.damageType, range: item.weaponRange ?? item.range,
        },
      });
    } else if (item.category === "consumable") {
      out.push({
        id: stableId("item", item.id), kind: "item", name: item.name,
        timing: "action", targetPolicy: "creature", sourceId: item.id, sourceKind: "inventory",
      });
    }
  }
  for (const spell of sources.spells ?? []) {
    if (!spell.prepared) continue;
    out.push({ id: stableId("spell", spell.id), kind: "spell", name: spell.name,
      timing: spell.timing ?? "action", targetPolicy: spell.targetPolicy ?? "creature",
      sourceId: spell.id, sourceKind: "known_spell", mechanics: { spellLevel: spell.level } });
  }
  for (const feat of sources.feats ?? []) {
    out.push({ id: stableId("feat", feat.id), kind: "feat", name: feat.name,
      timing: feat.timing ?? "special", targetPolicy: feat.targetPolicy ?? "none",
      sourceId: feat.id, sourceKind: "feat" });
  }
  for (const feature of sources.features ?? []) {
    out.push({ id: stableId("feature", feature.id), kind: "feature", name: feature.name,
      timing: feature.timing ?? "special", targetPolicy: feature.targetPolicy ?? "none",
      sourceId: feature.id, sourceKind: "feature" });
  }
  return { schemaVersion: 1, combatantId: sources.combatantId, revision: 0, capabilities: out };
}

/** Strict boundary: never treat catalog membership as proof that an option can execute. */
export function hasExecutableAttackDefinition(capability: CombatantCapability): boolean {
  const m = capability.mechanics;
  return capability.kind === "attack"
    && !!m && finite(m.attackBonus) && finite(m.damageModifier)
    && typeof m.damageType === "string" && m.damageType.trim().length > 0
    && typeof m.damageDice === "string" && /^(?:[1-9]\d*d(?:4|6|8|10|12|20)|[1-9]\d*)(?:\s*[+\-]\s*\d+)?$/i.test(m.damageDice.trim())
    && typeof m.range === "string" && m.range.trim().length > 0;
}
