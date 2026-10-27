/** NPC combat abilities are not necessarily tangible, transferable possessions. */
export function canTransferNpcGear(gear: { id: string; name: string; category?: string }): boolean {
  const name = gear.name.trim().toLowerCase();
  if (gear.id.startsWith("intrinsic-") || gear.id.startsWith("monster-action-")) return false;
  if (/^(unarmed strike|claw|claws|bite|tail|slam|gore|hoof|hooves|tentacle|sting|multiattack)(?: attack)?$/.test(name)) return false;
  return gear.category === "weapon" || gear.category === "armor" || gear.category === "gear";
}
