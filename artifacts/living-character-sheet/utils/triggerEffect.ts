export type EffectType =
  | "long_rest"
  | "short_rest"
  | "potion"
  | "level_up"
  | "nat_20"
  | "nat_1"
  | "low_hp_glow"
  | "deaths_door"
  | "heal_flash"
  | "damage_flash"
  | "poison_haze";

export interface EffectTriggerEvent {
  type: EffectType;
  preview?: boolean;
}

let _trigger: ((event: EffectTriggerEvent) => void) | null = null;

export function registerEffectTrigger(fn: (event: EffectTriggerEvent) => void) {
  _trigger = fn;
}

export function triggerEffect(type: EffectType, options?: { preview?: boolean }) {
  _trigger?.({ type, preview: options?.preview });
}
