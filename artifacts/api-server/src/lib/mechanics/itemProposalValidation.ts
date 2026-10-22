// Creation counts are positive integers. Signed inventory-change deltas have a separate contract.
export function validateCreationItem(item: Record<string, unknown>): void {
  if (typeof item.name !== "string" || !item.name.trim() || item.name.length > 500) {
    throw new Error("Item name must be nonempty and at most 500 characters");
  }
  if (item.quantity !== undefined && (!Number.isSafeInteger(item.quantity) || Number(item.quantity) <= 0)) {
    throw new Error("Item creation quantity must be a positive safe integer");
  }
  for (const key of ["value", "weight"]) {
    if (item[key] != null && (typeof item[key] !== "number" || !Number.isFinite(item[key]) || Number(item[key]) < 0)) {
      throw new Error(`Item ${key} must be a finite nonnegative number`);
    }
  }
  // Validate supplied structures before permissive compatibility normalizers can erase them.
  visit(item, 0);
}

function visit(value: unknown, depth: number): void {
  if (depth > 24) throw new Error("Item mechanics nesting exceeds limit");
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Item numbers must be finite");
  if (Array.isArray(value)) {
    if (value.length > 200) throw new Error("Item array exceeds limit");
    for (const entry of value) visit(entry, depth + 1);
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (["dice", "damageDice", "attackDamageDice"].includes(key) && entry != null && entry !== "") {
        const match = typeof entry === "string" ? /^(\d{1,3})d(\d{1,4})(?:\s*[+-]\s*\d{1,5})?$/i.exec(entry.trim()) : null;
        if (!match || Number(match[1]) < 1 || Number(match[1]) > 100 || Number(match[2]) < 2 || Number(match[2]) > 1000) {
          throw new Error("Item dice must use bounded NdS notation");
        }
      }
      if (["damageType", "attackDamageType"].includes(key) && entry != null && entry !== ""
        && (typeof entry !== "string" || !["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder", "other"].includes(entry.trim().toLowerCase()))) {
        throw new Error("Unknown item damage type");
      }
      if (key === "uses" && entry != null && (typeof entry !== "number" || !Number.isSafeInteger(entry) || entry <= 0)) {
        throw new Error("Item uses must be a positive safe integer");
      }
      visit(entry, depth + 1);
    }
  }
}

// Sort object keys and ignore generated effect IDs; all other metadata is conservative identity.
export function itemProposalVariantKey(item: Record<string, unknown>): string {
  const { id: _id, quantity: _quantity, confidence: _confidence, needsReview: _review, ...identity } = item;
  function stable(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
      .filter(([key]) => key !== "id").sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, stable(v)]));
    return value;
  }
  return JSON.stringify(stable({ ...identity, name: String(item.name).trim().toLowerCase(), tags: Array.isArray(item.tags) ? [...item.tags].sort() : [] }));
}

export function hasUnsupportedDamageResponse(text: string): boolean {
  return /\b(?:reflect\w*|immun\w*|resistan\w*|absorb\w*|retaliat\w*)\b|\bnegat\w*\b.{0,30}\bdamage\b/i.test(text);
}
