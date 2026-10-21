import type { ActionType, ItemCategory, ItemEffectType } from "@/types";

export const ATTACK_COLOR = "#EF4444";
export const SPELL_COLOR = "#8B5CF6";
export const CONSUMABLE_COLOR = "#10B981";
export const BONUS_ACTION_COLOR = "#EAB308";
export const REACTION_COLOR = "#F97316";
export const FREE_ACTION_COLOR = "#06B6D4";

export const ACTION_TYPE_COLORS: Record<ActionType, string> = {
  action: ATTACK_COLOR,
  bonus_action: BONUS_ACTION_COLOR,
  reaction: REACTION_COLOR,
  free: FREE_ACTION_COLOR,
};

export const ITEM_EFFECT_TYPE_COLORS: Record<ItemEffectType, string> = {
  stat_bonus: CONSUMABLE_COLOR,
  attack_damage: ATTACK_COLOR,
  spell: SPELL_COLOR,
  buff: "#3B82F6",
  feature: "#F59E0B",
  note: "#6B7280",
};

export const INVENTORY_CATEGORY_COLORS: Record<ItemCategory, string> = {
  weapon: ATTACK_COLOR,
  armor: "#3B82F6",
  accessory: "#EC4899",
  consumable: CONSUMABLE_COLOR,
  quest: "#F59E0B",
  magic: SPELL_COLOR,
  gear: "#6B7280",
  treasure: "#D97706",
  map: "#14B8A6",
  other: "#6B7280",
};