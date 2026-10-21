import type { InventoryItem } from "@/types";

const ATTUNEMENT_TAG = "requires attunement";
const AMMUNITION_TAG = "ammunition";
const AMMO_WEAPON_SUBTYPES = new Set([
  "Blowgun",
  "Hand Crossbow",
  "Heavy Crossbow",
  "Light Crossbow",
  "Longbow",
  "Shortbow",
  "Sling",
]);
const AMMO_NAME_PATTERN = /\b(arrows?|bolts?|sling bullets?|bullets?|needles?)\b/i;

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

function hasTag(item: InventoryItem, expectedTag: string): boolean {
  return (item.tags ?? []).some((value) => normalizeTag(value) === expectedTag);
}

function requiresAttunement(item: InventoryItem): boolean {
  return hasTag(item, ATTUNEMENT_TAG);
}

function requiresAmmunition(item: InventoryItem): boolean {
  if (item.category !== "weapon") return false;
  if (hasTag(item, AMMUNITION_TAG)) return true;
  return AMMO_WEAPON_SUBTYPES.has(item.subtype ?? "");
}

function hasTrackedAmmunition(inventory: InventoryItem[]): boolean {
  return inventory.some((item) => {
    if (item.category !== "consumable") return false;
    if ((item.quantity ?? 0) <= 0) return false;
    if (hasTag(item, AMMUNITION_TAG)) return true;
    return AMMO_NAME_PATTERN.test(item.name);
  });
}

export function buildInventoryCombatReadinessNotes(item: InventoryItem, inventory: InventoryItem[]): string[] {
  const notes: string[] = [];

  if (requiresAttunement(item)) {
    notes.push("Requires attunement; verify attuned state before relying on this item in combat.");
  }

  if (requiresAmmunition(item)) {
    notes.push("Uses ammunition; ammo is not linked or consumed automatically during attacks.");
    if (!hasTrackedAmmunition(inventory)) {
      notes.push("No tracked ammunition found in inventory.");
    }
  }

  return notes;
}

export function appendCombatReadinessNotes(baseNotes: string | undefined, extraNotes: string[]): string | undefined {
  if (extraNotes.length === 0) return baseNotes;

  const combined = new Map<string, string>();
  for (const note of [baseNotes?.trim(), ...extraNotes]) {
    if (!note) continue;
    const normalized = note.trim();
    if (!normalized) continue;
    combined.set(normalized.toLowerCase(), normalized);
  }

  return Array.from(combined.values()).join("\n");
}