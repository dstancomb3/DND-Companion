import { useCharacter } from "@/context/CharacterContext";
import type { Resource } from "@/types";
import { getRuntimeItemProjectedEffects } from "@/utils/mechanics/runtimeMechanicsCompatibility";

export interface SpellEffectEntry {
  effectId: string;
  itemId: string;
  itemName: string;
  label: string;
  pinned?: boolean;
  description?: string;
  uses: number;
  resetOn: "short_rest" | "long_rest" | "dawn";
}

export interface BuffEffectEntry {
  effectId: string;
  itemId: string;
  itemName: string;
  label: string;
  description?: string;
}

/**
 * Synonym groups: any term within a group matches any other term in that group.
 * All entries should be lowercase.
 */
const SYNONYM_GROUPS: string[][] = [
  ["ki", "focus", "ki point", "ki points", "focus point", "focus points"],
  ["sorcery", "sorcery point", "sorcery points"],
  ["rage", "rage point", "rage points"],
  ["superiority", "superiority die", "superiority dice"],
  ["psi", "psi point", "psi points", "psychic"],
  ["bardic", "bardic inspiration"],
  ["channel divinity", "channel"],
  ["arcane", "arcane point", "arcane points", "arcane recovery"],
  ["wild shape", "wild"],
  ["lay on hands", "lay on hands point"],
  ["sneak attack"],
];

function synonymGroupOf(term: string): number {
  const lower = term.toLowerCase();
  for (let i = 0; i < SYNONYM_GROUPS.length; i++) {
    const group = SYNONYM_GROUPS[i];
    if (group.some((s) => lower.includes(s) || s.includes(lower))) {
      return i;
    }
  }
  return -1;
}

function resourceNamesMatch(resourceName: string, effectResourceName: string): boolean {
  const rLower = resourceName.toLowerCase();
  const eLower = effectResourceName.toLowerCase();
  // Direct substring
  if (rLower.includes(eLower) || eLower.includes(rLower)) return true;
  // Synonym group match
  const rGroup = synonymGroupOf(rLower);
  const eGroup = synonymGroupOf(eLower);
  if (rGroup !== -1 && rGroup === eGroup) return true;
  // Word-level intersection
  const rWords = rLower.split(/\s+/);
  const eWords = eLower.split(/\s+/);
  return rWords.some((w) => w.length > 2 && eWords.includes(w));
}

/**
 * Returns derived info from all currently-equipped items:
 *  - resourceMaxBonuses: maps each effect's resourceName → total bonus
 *  - spellEffects: list of trackable spells granted by equipped items
 *  - buffEffects: list of passive buff effects from equipped items (advantage, immunity, etc.)
 */
export function useEquippedEffects() {
  const { inventory } = useCharacter();

  /** Maps effect.resourceName (original case) → total bonus */
  const resourceMaxBonuses: Array<{ resourceName: string; bonus: number }> = [];
  const spellEffects: SpellEffectEntry[] = [];
  const buffEffects: BuffEffectEntry[] = [];

  for (const item of inventory) {
    if (!item.equipped) continue;
    for (const eff of getRuntimeItemProjectedEffects(item)) {
      if (
        eff.type === "feature" &&
        eff.resourceName &&
        eff.resourceMaxBonus != null
      ) {
        const existing = resourceMaxBonuses.find((e) =>
          e.resourceName.toLowerCase() === eff.resourceName!.toLowerCase()
        );
        if (existing) {
          existing.bonus += eff.resourceMaxBonus;
        } else {
          resourceMaxBonuses.push({
            resourceName: eff.resourceName,
            bonus: eff.resourceMaxBonus,
          });
        }
      }

      if (eff.type === "spell" && eff.uses && eff.uses > 0) {
        spellEffects.push({
          effectId: eff.id,
          itemId: item.id,
          itemName: item.name,
          label: eff.label,
          pinned: eff.pinned,
          description: eff.description,
          uses: eff.uses,
          resetOn: eff.resetOn ?? "long_rest",
        });
      }

      if (eff.type === "buff") {
        buffEffects.push({
          effectId: eff.id,
          itemId: item.id,
          itemName: item.name,
          label: eff.label,
          description: eff.description,
        });
      }
    }
  }

  return { resourceMaxBonuses, spellEffects, buffEffects };
}

/**
 * Given the computed resourceMaxBonuses list, returns the total bonus
 * that applies to the given resource using smart synonym-aware matching.
 */
export function getResourceExtraMax(
  resource: Resource,
  resourceMaxBonuses: Array<{ resourceName: string; bonus: number }>
): number {
  return resourceMaxBonuses
    .filter((entry) => resourceNamesMatch(resource.name, entry.resourceName))
    .reduce((sum, entry) => sum + entry.bonus, 0);
}
