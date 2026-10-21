export type MechanicsSchemaVersion = "v1";

export type MechanicDefinitionKind = "action" | "passive";

export type MechanicSourceType =
  | "item"
  | "spell"
  | "class_feature"
  | "racial_trait"
  | "feat_feature"
  | "condition"
  | "manual"
  | "parser"
  | "import"
  | "other";

export type MechanicActionType = "attack" | "spell" | "item" | "feature" | "consumable" | "utility";

export type MechanicActivationType = "action" | "bonus_action" | "reaction" | "minute" | "hour" | "special" | "passive";

export type MechanicAttackSubtype = "weapon_attack" | "unarmed_attack" | "natural_attack" | "spell_attack";

export type MechanicSpellSubtype = "cantrip" | "leveled_spell";

export type MechanicItemSubtype = "activated_item" | "charged_item";

export type MechanicFeatureSubtype = "class_feature" | "racial_trait" | "feat_feature";

export type MechanicConsumableSubtype = "potion" | "scroll" | "single_use_item" | "ammunition_effect";

export type MechanicUtilitySubtype =
  | "help"
  | "dash"
  | "disengage"
  | "dodge"
  | "hide"
  | "search"
  | "study"
  | "influence"
  | "magic"
  | "utilize"
  | "other";

export type MechanicActionSubtype =
  | MechanicAttackSubtype
  | MechanicSpellSubtype
  | MechanicItemSubtype
  | MechanicFeatureSubtype
  | MechanicConsumableSubtype
  | MechanicUtilitySubtype;

export type MechanicPassiveType =
  | "static_bonus"
  | "conditional_bonus"
  | "passive_condition_immunity"
  | "passive_grant"
  | "reactive_triggered"
  | "aura";

export type TargetSelectionMode = "self" | "single" | "multi_select" | "all_in_range" | "area" | "none" | "special";

export type TargetKind = "self" | "ally" | "enemy" | "creature" | "object" | "point" | "area" | "summon_space";

export type MechanicResolutionMode = "attack_roll" | "saving_throw" | "auto" | "heal" | "utility" | "summon" | "none";

export type MechanicEffectType =
  | "damage"
  | "healing"
  | "apply_condition"
  | "remove_condition"
  | "grant_advantage"
  | "grant_disadvantage"
  | "modify_resource"
  | "forced_movement"
  | "movement_modifier"
  | "create_aura"
  | "summon_entity"
  | "create_light"
  | "narrative_only"
  | "unsupported";

export type MechanicResourceType =
  | "action"
  | "bonus_action"
  | "reaction"
  | "movement_feet"
  | "spell_slot"
  | "charge"
  | "item_use"
  | "feature_use"
  | "hit_die"
  | "ki"
  | "sorcery_point"
  | "bardic_inspiration"
  | "rage"
  | "channel_divinity"
  | "lay_on_hands"
  | "custom";

export type MechanicUsageLimitType = "fixed_uses" | "charges" | "slot_consumption" | "pool_spend";

export type MechanicUsageResetType = "short_rest" | "long_rest" | "turn_start" | "turn_end" | "round" | "dawn" | "manual" | "none";

export type MechanicDurationUnit = "instant" | "round" | "minute" | "hour" | "day" | "special" | "until_dismissed";

export type MechanicEndRule =
  | "start_of_source_turn"
  | "end_of_source_turn"
  | "start_of_target_turn"
  | "end_of_target_turn"
  | "save_ends"
  | "concentration_ends"
  | "until_rest"
  | "manual"
  | "special";

export type MechanicTriggerType =
  | "on_turn_start"
  | "on_turn_end"
  | "on_attack_hit"
  | "on_attack_miss"
  | "on_failed_save"
  | "on_successful_save"
  | "on_damage_taken"
  | "on_enter_area"
  | "on_start_in_area"
  | "on_use"
  | "on_equip"
  | "special";

export type LegalityFilterCategory = "allegiance" | "creature_type" | "creature_tag" | "condition_state" | "size" | "disposition" | "target_identity";

export type LegalityOperator = "include" | "exclude";

export type MechanicQuantityMode = "exact" | "up_to" | "all";

export type MechanicRangeOrigin = "self" | "touch" | "weapon" | "sight" | "special";

export type MechanicShapeType = "radius" | "cone" | "line" | "cube" | "sphere" | "special";

export type MechanicConditionName =
  | "blinded"
  | "charmed"
  | "deafened"
  | "exhausted"
  | "frightened"
  | "grappled"
  | "incapacitated"
  | "invisible"
  | "paralyzed"
  | "petrified"
  | "poisoned"
  | "prone"
  | "restrained"
  | "stunned"
  | "unconscious"
  | "hidden"
  | "custom";

export type MechanicConditionApplication = "apply" | "suppress" | "grant_immunity";

export type MechanicConditionIntensity = "normal" | "contextual";

export type MechanicEffectApplication = "on_hit" | "on_fail_save" | "on_success_save" | "immediate" | "persistent";

export type MechanicEffectStacking = "replace" | "refresh" | "stack" | "parallel";

export type MechanicModifyResourceOperation = "spend" | "restore" | "set_minimum";

export type MechanicMovementDirection = "push" | "pull" | "away" | "toward" | "up" | "down" | "other";

export type MechanicMovementModifierMode = "set_speed" | "add_speed" | "halve_speed" | "zero_speed";

export type MechanicAttackResolutionType = "melee_weapon" | "ranged_weapon" | "melee_spell" | "ranged_spell" | "other";

export type MechanicBonusSource = "derived" | "explicit";

export type MechanicDcSource = "derived" | "explicit";

export type MechanicOnSaveOutcome = "none" | "half" | "negates" | "partial";

export type MechanicUtilityKind =
  | "help"
  | "dash"
  | "disengage"
  | "dodge"
  | "hide"
  | "search"
  | "study"
  | "influence"
  | "magic"
  | "utilize"
  | "other";

export type MechanicAbility = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";

export type MechanicDamageType =
  | "acid"
  | "bludgeoning"
  | "cold"
  | "fire"
  | "force"
  | "lightning"
  | "necrotic"
  | "piercing"
  | "poison"
  | "psychic"
  | "radiant"
  | "slashing"
  | "thunder"
  | "other";

export type MechanicCreatureType =
  | "aberration"
  | "beast"
  | "celestial"
  | "construct"
  | "dragon"
  | "elemental"
  | "fey"
  | "fiend"
  | "giant"
  | "humanoid"
  | "monstrosity"
  | "ooze"
  | "plant"
  | "undead"
  | "custom";

export type MechanicDisposition = "hostile" | "non_hostile" | "neutral";

export type MechanicSize = "Tiny" | "Small" | "Medium" | "Large" | "Huge" | "Gargantuan";

export type MechanicTargetIdentity = "self";

export type MechanicResourceSpendWhen = "on_activate" | "on_hit" | "on_failed_save" | "on_confirm";

export type MechanicUsageScope = "item" | "feature" | "spell" | "action";

export type MechanicScalingKind = "slot_level" | "character_level" | "cantrip_level" | "resource_spend" | "custom";

export type MechanicAdvantageScope = "attack_roll" | "saving_throw" | "ability_check" | "damage_roll" | "skill_check" | "death_save" | "other";

export type MechanicUnsupportedReason =
  | "ambiguous_source"
  | "unsupported_geometry"
  | "unsupported_timing"
  | "unsupported_formula"
  | "unsupported_custom_logic"
  | "missing_required_detail"
  | "other";

export type ReviewStatus = "verified" | "needs_review" | "partial" | "unsupported";

export type ReviewConfidence = "high" | "medium" | "low" | "unknown";

export type UnresolvedIssueType = "missing" | "ambiguous" | "conflicting" | "unsupported";

export type MechanicsOwnerType = "item" | "character";

export type MechanicReferenceOrigin = "embedded" | "local_library";

export type MechanicsCompatibilitySource = "legacy_item" | "legacy_character" | "parser_v0" | "manual_editor_v0";

export type ParserMechanicResultKind = "simple" | "complex" | "ambiguous" | "unsupported";