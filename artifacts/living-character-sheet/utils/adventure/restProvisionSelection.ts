/** The player must explicitly select real, currently held provisions. */
export function validateSelectedRestProvisions(
  provision: { enabled: boolean; itemIds: string[] } | undefined,
  inventory: readonly { id: string; name: string; quantity: number; notes?: string }[],
): { ok: true; debit: { id: string; nextQuantity: number }[] } | { ok: false; reason: string } {
  if (!provision?.enabled) return { ok: true, debit: [] };
  if (provision.itemIds.length > 30 || new Set(provision.itemIds).size !== provision.itemIds.length)
    return { ok: false, reason: "Provision selection is invalid." };
  const debit: { id: string; nextQuantity: number }[] = [];
  for (const id of provision.itemIds) {
    const item = inventory.find(entry => entry.id === id);
    if (!item || !Number.isSafeInteger(item.quantity) || item.quantity < 1)
      return { ok: false, reason: "A selected provision is no longer available." };
    if (!/ration|food|water|drink|provision|meal|waterskin/i.test(`${item.name} ${item.notes ?? ""}`))
      return { ok: false, reason: "A selected item is not recognized as a provision." };
    debit.push({ id, nextQuantity: item.quantity - 1 });
  }
  return { ok: true, debit };
}
