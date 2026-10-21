import type { ConditionRemoval } from "@/types";

export interface ConditionInfo {
  description: string;
  defaultRemoveOn: ConditionRemoval[];
  color: string;
}

export const CONDITION_INFO: Record<string, ConditionInfo> = {
  Blinded: {
    description: "Auto-fail checks requiring sight. Attack rolls have disadvantage; attacks against you have advantage.",
    defaultRemoveOn: ["manual"],
    color: "#6B7280",
  },
  Charmed: {
    description: "Can't attack the charmer. Charmer has advantage on social checks with you.",
    defaultRemoveOn: ["manual"],
    color: "#EC4899",
  },
  Deafened: {
    description: "Auto-fail checks requiring hearing.",
    defaultRemoveOn: ["manual"],
    color: "#6B7280",
  },
  Exhaustion: {
    description: "Cumulative penalties based on exhaustion level. Each long rest removes one level.",
    defaultRemoveOn: ["long_rest"],
    color: "#F59E0B",
  },
  Frightened: {
    description: "Disadvantage on checks and attacks while the source is visible. Can't willingly move toward source.",
    defaultRemoveOn: ["save", "manual"],
    color: "#F97316",
  },
  Grappled: {
    description: "Speed is 0. Ends if the grappler is incapacitated or you escape.",
    defaultRemoveOn: ["manual"],
    color: "#8B5CF6",
  },
  Incapacitated: {
    description: "Can't take actions or reactions.",
    defaultRemoveOn: ["manual"],
    color: "#EF4444",
  },
  Invisible: {
    description: "Can't be seen without magic. Attacks have advantage; attacks against you have disadvantage.",
    defaultRemoveOn: ["manual"],
    color: "#A3E635",
  },
  Paralyzed: {
    description: "Incapacitated and can't move or speak. Auto-fail Str/Dex saves. Attacks against you have advantage and score crits within 5 ft.",
    defaultRemoveOn: ["save", "manual"],
    color: "#EF4444",
  },
  Petrified: {
    description: "Transformed into stone. Incapacitated, resistant to all damage, immune to poison and disease.",
    defaultRemoveOn: ["manual"],
    color: "#9CA3AF",
  },
  Poisoned: {
    description: "Disadvantage on attack rolls and ability checks.",
    defaultRemoveOn: ["manual", "short_rest"],
    color: "#22C55E",
  },
  Prone: {
    description: "Disadvantage on attack rolls. Melee attacks within 5 ft have advantage against you. Must use half movement to stand.",
    defaultRemoveOn: ["manual"],
    color: "#F59E0B",
  },
  Restrained: {
    description: "Speed is 0. Attack rolls have disadvantage; attacks against you have advantage. Disadvantage on Dex saves.",
    defaultRemoveOn: ["manual"],
    color: "#8B5CF6",
  },
  Stunned: {
    description: "Incapacitated, can't move. Auto-fail Str/Dex saves. Attacks against you have advantage.",
    defaultRemoveOn: ["save", "manual"],
    color: "#EF4444",
  },
  Unconscious: {
    description: "Incapacitated, unaware of surroundings, drops held items, falls prone. Auto-fail Str/Dex saves. Attacks within 5 ft score critical hits.",
    defaultRemoveOn: ["manual"],
    color: "#EF4444",
  },
};

export const REMOVAL_LABEL: Record<ConditionRemoval, string> = {
  short_rest: "Short Rest",
  long_rest: "Long Rest",
  save: "Saving Throw",
  manual: "Manual",
};

export function getConditionInfo(name: string): ConditionInfo {
  const normalized = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  return (
    CONDITION_INFO[normalized] ??
    CONDITION_INFO[name] ?? {
      description: "A condition affecting your character.",
      defaultRemoveOn: ["manual"] as ConditionRemoval[],
      color: "#6B7280",
    }
  );
}
