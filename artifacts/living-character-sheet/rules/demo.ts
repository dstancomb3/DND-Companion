/**
 * Demo Rules
 * 
 * Example rules for foundation slice testing.
 * In production, these would be loaded from JSON/database.
 */

import type { RuleDefinition } from "./schema";

/**
 * Demo Rule 1: Leather Armor grants +1 AC when equipped
 * 
 * Trigger: equip_item with ID matching leather armor
 * Condition: item_equipped (leather armor)
 * Effect: modify AC + 1
 */
export const DEMO_RULE_LEATHER_ARMOR_AC: RuleDefinition = {
  id: "demo_leather_armor_ac",
  schemaVersion: 1,
  name: "Leather Armor AC",
  description: "Leather armor grants +1 AC when equipped",

  trigger: {
    type: "equip_item",
  },

  condition: {
    type: "always",
  },

  effects: [
    {
      type: "modify_stat",
      statKey: "armorClass",
      statValue: 1,
      label: "Leather Armor AC Bonus",
      description: "+1 to AC from equipped leather armor",
    },
  ],

  source: "item",
  sourceId: "leather-armor-item-id",
  scope: "character",
  priority: 0,
  repeatable: false,
  createdAt: Date.now(),
  disabled: false,
};

/**
 * Demo Rule 2: Long rest restores hit die
 * 
 * Trigger: long_rest
 * Condition: always
 * Effect: restore hit die pool
 */
export const DEMO_RULE_LONG_REST_HIT_DIE: RuleDefinition = {
  id: "demo_long_rest_hit_die",
  schemaVersion: 1,
  name: "Long Rest Hit Die Recovery",
  description: "Restore half of max hit die count on long rest",

  trigger: {
    type: "long_rest",
  },

  condition: {
    type: "always",
  },

  effects: [
    {
      type: "restore_resource",
      resourceName: "Hit Dice",
      amount: 3, // Would be calculated as maxHitDice / 2
      label: "Recovery from Long Rest",
      description: "Recover 3 hit dice on long rest",
    },
  ],

  source: "class_feature",
  sourceId: "hit-die-recovery",
  scope: "character",
  priority: 0,
  repeatable: true,
  createdAt: Date.now(),
  disabled: false,
};

/**
 * Demo Rule 3: Equip Cloak of the Bat grants a bat flight action
 * 
 * Trigger: equip_item (cloak)
 * Condition: always
 * Effect: add_action granting "Bat Flight"
 */
export const DEMO_RULE_CLOAK_BAT_FLIGHT: RuleDefinition = {
  id: "demo_cloak_bat_flight",
  schemaVersion: 1,
  name: "Cloak of the Bat Flight Action",
  description: "Grants a bat flight action when the Cloak of the Bat is equipped",

  trigger: {
    type: "equip_item",
  },

  condition: {
    type: "always",
  },

  effects: [
    {
      type: "add_action",
      actionName: "Bat Flight",
      actionType: "bonus_action",
      label: "Bat Flight",
      description: "Transform into a bat and fly for 1 hour (requires concentration). Bonus action to activate.",
    },
  ],

  source: "item",
  sourceId: "cloak-of-bat-item-id",
  scope: "character",
  priority: 10,
  repeatable: false,
  createdAt: Date.now(),
  disabled: false,
};

/**
 * Demo Rule 4: Long rest grants a temporary spell
 * 
 * Trigger: long_rest
 * Condition: always
 * Effect: grant_spell adds a prepared cantrip
 */
export const DEMO_RULE_LONG_REST_SPELL: RuleDefinition = {
  id: "demo_long_rest_spell",
  schemaVersion: 1,
  name: "Long Rest Spell Grant",
  description: "Grant Light cantrip temporarily after long rest",

  trigger: {
    type: "long_rest",
  },

  condition: {
    type: "always",
  },

  effects: [
    {
      type: "grant_spell",
      spellName: "Light (from Rest)",
      label: "Light Cantrip",
      description: "Cantrip granted after long rest as a brief boon. Lasts until next rest.",
    },
  ],

  source: "class_feature",
  sourceId: "rest-spell-grant",
  scope: "character",
  priority: 0,
  repeatable: true,
  createdAt: Date.now(),
  disabled: false,
};

/**
 * Demo Rule 5: Short rest adds "Exhausted" condition (for testing add_condition)
 * 
 * Trigger: short_rest
 * Condition: always
 * Effect: add_condition
 */
export const DEMO_RULE_SHORT_REST_CONDITION: RuleDefinition = {
  id: "demo_short_rest_condition",
  schemaVersion: 1,
  name: "Short Rest Fatigue",
  description: "Character gains minor fatigue after short rest",

  trigger: {
    type: "short_rest",
  },

  condition: {
    type: "always",
  },

  effects: [
    {
      type: "add_condition",
      conditionName: "Short Rest Fatigue",
      label: "Short Rest Fatigue Condition",
      description: "Temporary fatigue from insufficient rest. Disadvantage on initiative.",
      removeOn: ["long_rest"],
      durationRounds: undefined,
    },
  ],

  source: "class_feature",
  sourceId: "rest-fatigue",
  scope: "character",
  priority: 0,
  repeatable: false,
  createdAt: Date.now(),
  disabled: false,
};

/**
 * Demo Rule 6: Equip Ring of Protection grants +1 Initiative
 * 
 * Trigger: equip_item
 * Condition: always
 * Effect: modify_stat for initiative
 */
export const DEMO_RULE_RING_INITIATIVE: RuleDefinition = {
  id: "demo_ring_initiative",
  schemaVersion: 1,
  name: "Ring of Protection Initiative",
  description: "Ring grants +1 to initiative rolls when equipped",

  trigger: {
    type: "equip_item",
  },

  condition: {
    type: "always",
  },

  effects: [
    {
      type: "modify_stat",
      statKey: "initiative",
      statValue: 1,
      label: "Ring of Protection +1 Initiative",
      description: "+1 to initiative from Ring of Protection",
    },
  ],

  source: "item",
  sourceId: "ring-of-protection-item-id",
  scope: "character",
  priority: 5,
  repeatable: false,
  createdAt: Date.now(),
  disabled: false,
};

/**
 * CLASS-SPECIFIC RULES
 */

/**
 * Barbarian Class: Rage grants damage resistance
 * 
 * Trigger: manual (activate rage)
 * Condition: always
 * Effect: add_condition (damage resistance)
 */
export const CLASS_RULE_BARBARIAN_RAGE: RuleDefinition = {
  id: "class_barbarian_rage_resistance",
  schemaVersion: 1,
  name: "Barbarian Rage",
  description: "Gain resistance to physical damage while raging",

  trigger: {
    type: "manual",
  },

  condition: {
    type: "always",
  },

  effects: [
    {
      type: "add_condition",
      conditionName: "Raging",
      label: "Rage Active",
      description: "You have resistance to bludgeoning, piercing, and slashing damage.",
      removeOn: ["short_rest"],
      durationRounds: undefined,
    },
  ],

  source: "class_feature",
  sourceId: "barbarian-rage",
  scope: "character",
  priority: 20,
  repeatable: false,
  createdAt: Date.now(),
  disabled: false,
};

/**
 * Wizard Class: Arcane Recovery restores spell slots on short rest
 * 
 * Trigger: short_rest
 * Condition: always
 * Effect: restore_resource (spell slots)
 */
export const CLASS_RULE_WIZARD_ARCANE_RECOVERY: RuleDefinition = {
  id: "class_wizard_arcane_recovery",
  schemaVersion: 1,
  name: "Wizard Arcane Recovery",
  description: "Restore spell slots equal to 1/2 wizard level on short rest",

  trigger: {
    type: "short_rest",
  },

  condition: {
    type: "always",
  },

  effects: [
    {
      type: "restore_resource",
      resourceName: "Spell Slots",
      amount: 2,
      label: "Arcane Recovery",
      description: "Restore 2 spell slots from Arcane Recovery feature (short rest)",
    },
  ],

  source: "class_feature",
  sourceId: "wizard-arcane-recovery",
  scope: "character",
  priority: 0,
  repeatable: true,
  createdAt: Date.now(),
  disabled: false,
};

/**
 * Fighter Class: Second Wind action grants HP restoration
 * 
 * Trigger: manual
 * Condition: always
 * Effect: restore_resource (hit points via action)
 */
export const CLASS_RULE_FIGHTER_SECOND_WIND: RuleDefinition = {
  id: "class_fighter_second_wind",
  schemaVersion: 1,
  name: "Fighter Second Wind",
  description: "Use an action to restore hit points",

  trigger: {
     type: "manual",
  },

  condition: {
    type: "always",
  },

  effects: [
    {
      type: "add_action",
      actionName: "Second Wind",
      actionType: "action",
      label: "Second Wind Action",
      description: "As an action, regain HP equal to 1d10 + fighter level. You can use this feature a number of times equal to your Constitution modifier.",
    },
  ],

  source: "class_feature",
  sourceId: "fighter-second-wind",
  scope: "character",
  priority: 15,
  repeatable: false,
  createdAt: Date.now(),
  disabled: false,
};

/**
 * Rogue Class: Cunning Action allows bonus action dodge/hide/disengage
 * 
 * Trigger: manual
 * Condition: always
 * Effect: add_action for cunning movement
 */
export const CLASS_RULE_ROGUE_CUNNING_ACTION: RuleDefinition = {
  id: "class_rogue_cunning_action",
  schemaVersion: 1,
  name: "Rogue Cunning Action",
  description: "Use bonus action to Dash, Disengage, or Hide each turn",

  trigger: {
     type: "manual",
  },

  condition: {
    type: "always",
  },

  effects: [
    {
      type: "add_action",
      actionName: "Cunning Action",
      actionType: "bonus_action",
      label: "Cunning Action (Rogue)",
      description: "On your turn, you can take a bonus action to Dash, Disengage, or Hide.",
    },
  ],

  source: "class_feature",
  sourceId: "rogue-cunning-action",
  scope: "character",
  priority: 12,
  repeatable: false,
  createdAt: Date.now(),
  disabled: false,
};

export const CLASS_RULES: RuleDefinition[] = [
  CLASS_RULE_BARBARIAN_RAGE,
  CLASS_RULE_WIZARD_ARCANE_RECOVERY,
  CLASS_RULE_FIGHTER_SECOND_WIND,
  CLASS_RULE_ROGUE_CUNNING_ACTION,
];

/**
 * ITEM-SPECIFIC RULES
 */

/**
 * Plate Armor: Grants +1 AC
 * Applied when plate armor is equipped
 */
export const ITEM_RULE_PLATE_ARMOR_AC: RuleDefinition = {
  id: "item_plate_armor_ac",
  schemaVersion: 1,
  name: "Plate Armor AC Bonus",
  description: "Plate armor grants +1 to AC when equipped",

  trigger: {
    type: "equip_item",
  },

  condition: {
    type: "always",
  },

  effects: [
    {
      type: "modify_stat",
      statKey: "armorClass",
      statValue: 1,
      label: "Plate Armor AC Bonus",
      description: "+1 AC from plate armor",
    },
  ],

  source: "item",
  sourceId: "plate-armor-item",
  scope: "character",
  priority: 5,
  repeatable: false,
  createdAt: Date.now(),
  disabled: false,
};

/**
 * Bag of Holding: Grants an extra action to retrieve items
 * Applied when bag of holding is in inventory
 */
export const ITEM_RULE_BAG_OF_HOLDING_ACTION: RuleDefinition = {
  id: "item_bag_of_holding_action",
  schemaVersion: 1,
  name: "Bag of Holding Retrieval",
  description: "Retrieve any item from the bag as a bonus action",

  trigger: {
     type: "equip_item",
  },

  condition: {
    type: "always",
  },

  effects: [
    {
      type: "add_action",
      actionName: "Retrieve from Bag",
      actionType: "bonus_action",
      label: "Bag of Holding",
      description: "Retrieve any item from the bag of holding as a bonus action.",
    },
  ],

  source: "item",
  sourceId: "bag-of-holding-item",
  scope: "character",
  priority: 8,
  repeatable: false,
  createdAt: Date.now(),
  disabled: false,
};

/**
 * +1 Sword: Grants +1 to damage rolls
 * Applied when +1 sword is equipped
 */
export const ITEM_RULE_PLUS_ONE_SWORD: RuleDefinition = {
  id: "item_plus_one_sword_damage",
  schemaVersion: 1,
  name: "+1 Sword Damage",
  description: "Magical sword grants +1 to attack and damage rolls",

  trigger: {
    type: "equip_item",
  },

  condition: {
    type: "always",
  },

  effects: [
    {
      type: "add_action",
      actionName: "Magical Strike",
      actionType: "action",
      label: "+1 Sword Attack",
      description: "Your strikes with this magical sword are enhanced: +1 to attack and damage rolls.",
    },
  ],

  source: "item",
  sourceId: "plus-one-sword-item",
  scope: "character",
  priority: 10,
  repeatable: false,
  createdAt: Date.now(),
  disabled: false,
};

export const ITEM_RULES: RuleDefinition[] = [
  ITEM_RULE_PLATE_ARMOR_AC,
  ITEM_RULE_BAG_OF_HOLDING_ACTION,
  ITEM_RULE_PLUS_ONE_SWORD,
];

export const DEMO_RULES: RuleDefinition[] = [
  DEMO_RULE_LEATHER_ARMOR_AC,
  DEMO_RULE_LONG_REST_HIT_DIE,
  DEMO_RULE_CLOAK_BAT_FLIGHT,
  DEMO_RULE_LONG_REST_SPELL,
  DEMO_RULE_SHORT_REST_CONDITION,
  DEMO_RULE_RING_INITIATIVE,
];
