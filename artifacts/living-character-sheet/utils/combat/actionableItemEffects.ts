import type { ActionType, InventoryItem } from "@/types";
import { getRuntimeItemProjectedEffects } from "@/utils/mechanics/runtimeMechanicsCompatibility";

export interface ActionableItemEffect {
  key: string;
  itemId: string;
  effectId: string;
  itemName: string;
  label: string;
  description?: string;
  actionType: ActionType;
  effectType: string;
  maxTargets?: number;
  pinned?: boolean;
  uses?: number;
  resetOn?: "short_rest" | "long_rest" | "dawn";
}

function detectActionType(label: string, description?: string): ActionType | null {
  const text = `${label} ${description ?? ""}`.toLowerCase();
  if (/as a bonus action|bonus action:|^\s*bonus action/m.test(text)) return "bonus_action";
  if (/as a reaction|as your reaction/.test(text)) return "reaction";
  if (/as a free action|free action/.test(text)) return "free";
  if (/as an action|you can use your action|as one action/.test(text)) return "action";
  return null;
}

function appendUsageSupportNote(description: string | undefined, _uses: number | undefined): string | undefined {
  // Uses are now tracked via itemActionUses in CharacterContext; no placeholder note needed.
  return description;
}

export function collectActionableItemEffects(inventory: InventoryItem[]): ActionableItemEffect[] {
  return inventory
    .filter((item) => item.equipped)
    .flatMap((item) =>
      getRuntimeItemProjectedEffects(item)
        .filter((effect) => effect.type !== "stat_bonus" && effect.type !== "attack_damage" && effect.type !== "note" && effect.type !== "spell")
        .flatMap((effect) => {
          const actionType = effect.actionType ?? detectActionType(effect.label, effect.description);
          if (!actionType) {
            return [];
          }
          return [{
            key: `${item.id}-${effect.id}`,
            itemId: item.id,
            effectId: effect.id,
            itemName: item.name,
            label: effect.label,
            description: appendUsageSupportNote(effect.description, effect.uses),
            actionType,
            effectType: effect.type,
            maxTargets: effect.maxTargets,
            pinned: effect.pinned,
            uses: effect.uses,
            resetOn: effect.resetOn,
          }];
        })
    );
}
