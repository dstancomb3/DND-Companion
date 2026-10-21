export const WEAPON_SUBTYPES: string[] = [
  "Knuckle Dusters",
  "Club", "Dagger", "Greatclub", "Handaxe", "Javelin",
  "Light Hammer", "Mace", "Quarterstaff", "Sickle", "Spear",
  "Battleaxe", "Flail", "Glaive", "Greataxe", "Greatsword",
  "Halberd", "Lance", "Longsword", "Maul", "Morningstar",
  "Pike", "Rapier", "Scimitar", "Shortsword", "Trident",
  "War Pick", "Warhammer", "Whip",
  "Dart", "Sling", "Shortbow", "Longbow", "Blowgun",
  "Hand Crossbow", "Light Crossbow", "Heavy Crossbow", "Net",
];

export const ARMOR_SUBTYPES: string[] = [
  "Padded Armor", "Leather Armor", "Studded Leather",
  "Hide Armor", "Chain Shirt", "Scale Mail",
  "Breastplate", "Half Plate",
  "Ring Mail", "Chain Mail", "Splint Armor", "Full Plate",
  "Shield",
];

export const ACCESSORY_SUBTYPES: string[] = [
  "Ring", "Amulet", "Necklace", "Cloak", "Belt",
  "Gloves", "Boots", "Helm", "Circlet", "Hat", "Bracers", "Cape",
];

const RARITY_TAGS: string[] = [
  "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact",
];

const WEAPON_TAGS: string[] = [
  "Unarmed Weapon", "Monk Weapon",
  "Finesse", "Light", "Heavy", "Thrown", "Two-Handed", "Versatile",
  "Loading", "Reach", "Special",
  "Magical", "Silvered", "Adamantine", "Mithral", "Masterwork",
  "Requires Attunement", "Cursed", "Returning",
];

const ARMOR_TAGS: string[] = [
  "Magical", "Masterwork", "Silvered", "Adamantine", "Mithral",
  "Cursed", "Requires Attunement", "Stealth Disadvantage",
];

const ACCESSORY_TAGS: string[] = [
  "Wondrous Item", "Ring", "Rod", "Staff", "Wand",
  "Magical", "Masterwork", "Silvered", "Adamantine", "Mithral",
  "Cursed", "Requires Attunement", "Returning",
];

const MAGIC_TAGS: string[] = [
  "Wondrous Item", "Ring", "Rod", "Staff", "Wand",
  "Magical", "Masterwork", "Silvered", "Adamantine", "Mithral",
  "Cursed", "Requires Attunement", "Returning",
];

const CONSUMABLE_TAGS: string[] = [
  "Potion", "Scroll", "Poison", "Ammunition",
  "Magical", "Cursed", "Single Use",
];

const GENERAL_TAGS: string[] = [
  "Magical", "Masterwork", "Silvered", "Adamantine", "Mithral", "Cursed",
];

export function tagsForCategory(category: string): string[] {
  let base: string[];
  switch (category) {
    case "weapon":     base = WEAPON_TAGS;     break;
    case "armor":      base = ARMOR_TAGS;      break;
    case "accessory":  base = ACCESSORY_TAGS;  break;
    case "magic":      base = MAGIC_TAGS;      break;
    case "consumable": base = CONSUMABLE_TAGS; break;
    default:           base = GENERAL_TAGS;    break;
  }
  return base;
}

export function subtypesForCategory(category: string): string[] {
  switch (category) {
    case "weapon":    return WEAPON_SUBTYPES;
    case "armor":     return ARMOR_SUBTYPES;
    case "accessory": return ACCESSORY_SUBTYPES;
    default:          return [];
  }
}
