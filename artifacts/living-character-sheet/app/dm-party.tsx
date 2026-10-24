import { CompanionRecoveryPanel } from "@/components/CompanionRecoveryPanel";
import { useFocusEffect } from "expo-router";
import { createDmLootDraft, dmLootDraftFromProposal, toDmLootAssignment, hasStructuredLootEffects, type DmLootDraftFields } from "@/utils/dmLootDraft";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { THEMES, useAppSettings } from "@/context/AppSettingsContext";
import { useCharacter } from "@/context/CharacterContext";
import {
  createParty,
  fetchPartyMembers,
  fetchPartyCombatState,
  startPartyInitiative,
  endPartyTurnForBattle,
  createPartyRollRequest,
  createPartyLootAssignments,
  createPartyNoteAssignments,
  resolvePartyRestRequest,
  addCombatNpc,
  removeCombatNpc,
  recoverPartyCompanion,
  updateCombatNpcVisibleStats,
  updateCombatNpcDummyState,
  updateCombatNpcGear,
  endEncounter,
  addToEncounter,
  rollNpcInitiative,
  removePartyMember,
  disbandParty,
  type PartyMemberSummary,
  type PartyCombatState,
  type PartyStatKey,
  type CombatNpcDisposition,
  type CombatNpc,
  type CombatNpcDummyState,
  type CombatNpcStatKey,
  type CombatNpcCoreStats,
  type CombatNpcGearItem,
  type LootAssignmentItem,
} from "@/utils/partyApi";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { getAllCharacters, type SavedCharacter } from "@/utils/characterStorage";
import { getSavedDmNpcs, type SavedDmNpc } from "@/app/dm-npc";
import { getCompendium, saveCustomMonster, updateCustomMonster, isCustomMonster } from "@/utils/monsterApi";
import { getDmNotesPayload, type DmNotesPayload } from "@/utils/dmNotesStorage";
import { getEncounterSetupHandoff, clearEncounterSetupHandoff } from "@/utils/encounterSetupIntent";
import { API_BASE_URL } from "@/utils/apiUrl";
import type { Attack, CampaignLocation, NpcPerson, Quest, CompendiumMonster, CustomMonster } from "@/types";
import { tagsForCategory, subtypesForCategory } from "@/data/itemSubtypes";
import colors from "@/constants/colors";
import { getCombatNpcPresentation } from "@/utils/combat/companionCombatPresentation";
import { buildPartyMemberSheetPath } from "@/utils/partyMemberSheetNavigation";
import { triggerEffect } from "@/utils/triggerEffect";

const DM_WATCH_KEY = "@dm_party_watch";
const DM_WATCH_HISTORY_KEY = "@dm_party_watch_history";
const PLAYER_PARTY_SESSION_KEY = "@party_session";
const POLL_INTERVAL = 3000;

type DmWatchHistoryEntry = {
  code: string;
  lastSeenAt: number;
};

type DmActiveSessionSummary = {
  code: string;
  memberCount: number;
};

const QUICK_ROLL_TYPES: PartyStatKey[] = ["initiative", "perception", "stealth", "dexterity"];
const ALL_ROLL_TYPES: PartyStatKey[] = [
  "initiative",
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
  "strength_save",
  "dexterity_save",
  "constitution_save",
  "intelligence_save",
  "wisdom_save",
  "charisma_save",
  "acrobatics",
  "animal_handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight_of_hand",
  "stealth",
  "survival",
];
const EXTRA_ROLL_TYPES: PartyStatKey[] = ALL_ROLL_TYPES.filter((key) => !QUICK_ROLL_TYPES.includes(key));
type ControlTab = "turn" | "npcs" | "dummies" | "loot" | "notes";
type TargetingTab = "turn" | "loot" | "notes";
type MonsterCrBand = "all" | "0-1" | "2-4" | "5-10" | "11-16" | "17+";
type MonsterSortMode = "name" | "cr-asc" | "cr-desc" | "type";
type CustomMonsterFormData = Omit<CustomMonster, "id" | "createdAt" | "updatedAt">;
type LootAssignmentMode = "selected-players" | "by-player";
type LootRarity = (typeof LOOT_RARITIES)[number];
type LootAttackAbility = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";
type LootDraftItem = DmLootDraftFields & {
  draftId: string;
  targetMemberId: string | null;
  rarity?: LootRarity;
};

const LOOT_RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"] as const;
const LOOT_CATEGORY_GUARDS: LootAssignmentItem["category"][] = ["weapon", "armor", "accessory", "consumable", "quest", "magic", "gear", "treasure", "map", "currency", "component", "junk", "other"];
const LOOT_CATEGORY_ALIASES: Record<string, LootAssignmentItem["category"]> = {
  weapons: "weapon",
  armors: "armor",
  accessories: "accessory",
  consumables: "consumable",
  quests: "quest",
  maps: "map",
  currencies: "currency",
  coins: "currency",
  components: "component",
  materials: "component",
  junks: "junk",
  misc: "other",
  miscellaneous: "other",
  treasures: "treasure",
};

function normalizeLootRarity(raw: unknown): LootRarity | undefined {
  if (typeof raw !== "string") return undefined;
  const normalized = raw.trim().toLowerCase();
  return LOOT_RARITIES.find((rarity) => rarity.toLowerCase() === normalized);
}

const NPC_STAT_PILLS: Array<{ key: CombatNpcStatKey; label: string }> = [
  { key: "speed", label: "SPD" },
  { key: "initiativeBonus", label: "INIT" },
  { key: "strength", label: "STR" },
  { key: "dexterity", label: "DEX" },
  { key: "constitution", label: "CON" },
  { key: "intelligence", label: "INT" },
  { key: "wisdom", label: "WIS" },
  { key: "charisma", label: "CHA" },
];

function parseChallengeRating(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (trimmed.includes("/")) {
    const [a, b] = trimmed.split("/");
    const numerator = Number(a);
    const denominator = Number(b);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
      return numerator / denominator;
    }
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMonsterType(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : "unknown";
}

function monsterMatchesCrBand(cr: number, band: MonsterCrBand): boolean {
  if (band === "all") return true;
  if (band === "0-1") return cr <= 1;
  if (band === "2-4") return cr >= 2 && cr <= 4;
  if (band === "5-10") return cr >= 5 && cr <= 10;
  if (band === "11-16") return cr >= 11 && cr <= 16;
  return cr >= 17;
}

function buildTabTargetSelection(ids: string[]): Record<TargetingTab, string[]> {
  return {
    turn: [...ids],
    loot: [...ids],
    notes: [...ids],
  };
}

function buildTabEncounterSelection(): Record<TargetingTab, string> {
  return {
    turn: "manual",
    loot: "manual",
    notes: "manual",
  };
}

function buildDummySourceId(maxHp: number, armorClass: number) {
  return `dummy:${maxHp}:${armorClass}:${Date.now().toString(36)}`;
}

function isDummyCombatant(sourceId: string | undefined): sourceId is string {
  return typeof sourceId === "string" && sourceId.startsWith("dummy:");
}

function parseDummyMeta(sourceId: string | undefined): { maxHp: number; armorClass: number } {
  if (!isDummyCombatant(sourceId)) {
    return { maxHp: 20, armorClass: 12 };
  }
  const parts = (sourceId as string).split(":");
  const maxHp = Number.parseInt(parts[1] ?? "", 10);
  const armorClass = Number.parseInt(parts[2] ?? "", 10);
  return {
    maxHp: Number.isFinite(maxHp) && maxHp > 0 ? maxHp : 20,
    armorClass: Number.isFinite(armorClass) && armorClass > 0 ? armorClass : 12,
  };
}

function getDefaultDispositionForKey(key: string): CombatNpcDisposition {
  return key.startsWith("char-") ? "passive" : "hostile";
}

function getEncounterLabel(index: number): string {
  let value = index;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return `Encounter ${label || "A"}`;
}

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function parseNumberish(value: unknown, fallback: number): number {
  const raw = typeof value === "string" ? Number.parseInt(value, 10) : typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(raw)) return fallback;
  return Math.floor(raw);
}

function normalizeLootCategory(raw: string): LootAssignmentItem["category"] | null {
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (LOOT_CATEGORY_GUARDS.includes(normalized as LootAssignmentItem["category"])) {
    return normalized as LootAssignmentItem["category"];
  }
  return LOOT_CATEGORY_ALIASES[normalized] ?? null;
}

function isPortableMapImageUri(uri: string): boolean {
  const trimmed = uri.trim();
  if (!trimmed) return false;
  return /^data:image\//i.test(trimmed) || /^https?:\/\//i.test(trimmed);
}

function createLootDraftId() {
  return `loot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildCoreStatsFromDmNpc(npc: SavedDmNpc): CombatNpcCoreStats {
  const dex = parseNumberish(npc.dex, 10);
  return {
    speed: 30,
    initiativeBonus: abilityModifier(dex),
    strength: parseNumberish(npc.str, 10),
    dexterity: dex,
    constitution: parseNumberish(npc.con, 10),
    intelligence: parseNumberish(npc.int, 10),
    wisdom: parseNumberish(npc.wis, 10),
    charisma: parseNumberish(npc.cha, 10),
  };
}

function buildCoreStatsFromCharacter(entry: SavedCharacter): CombatNpcCoreStats {
  const core = entry.snapshot.character;
  return {
    speed: parseNumberish(core.speed, 30),
    initiativeBonus: parseNumberish(core.initiative, 0),
    strength: parseNumberish(core.abilityScores?.strength, 10),
    dexterity: parseNumberish(core.abilityScores?.dexterity, 10),
    constitution: parseNumberish(core.abilityScores?.constitution, 10),
    intelligence: parseNumberish(core.abilityScores?.intelligence, 10),
    wisdom: parseNumberish(core.abilityScores?.wisdom, 10),
    charisma: parseNumberish(core.abilityScores?.charisma, 10),
  };
}

function parseSpeedFromMonster(speed: unknown): number {
  if (typeof speed === "number" && Number.isFinite(speed)) {
    return Math.max(0, Math.floor(speed));
  }

  if (typeof speed === "string") {
    const match = speed.match(/(\d+)/);
    if (!match) return 30;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : 30;
  }

  if (speed && typeof speed === "object") {
    const values = Object.values(speed as Record<string, unknown>);
    for (const value of values) {
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.max(0, Math.floor(value));
      }
      if (typeof value === "string") {
        const match = value.match(/(\d+)/);
        if (match) {
          const parsed = Number.parseInt(match[1], 10);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
    }
  }

  return 30;
}

function buildCoreStatsFromMonster(monster: CompendiumMonster): CombatNpcCoreStats {
  return {
    speed: parseSpeedFromMonster(monster.speed),
    initiativeBonus: abilityModifier(parseNumberish(monster.dexterity, 10)),
    strength: parseNumberish(monster.strength, 10),
    dexterity: parseNumberish(monster.dexterity, 10),
    constitution: parseNumberish(monster.constitution, 10),
    intelligence: parseNumberish(monster.intelligence, 10),
    wisdom: parseNumberish(monster.wisdom, 10),
    charisma: parseNumberish(monster.charisma, 10),
  };
}

function getMonsterDescription(monster: CompendiumMonster): string | null {
  const directDesc = (monster as { desc?: unknown }).desc;
  if (typeof directDesc === "string" && directDesc.trim()) return directDesc.trim();

  const specialDesc = monster.special_abilities?.[0]?.desc?.trim();
  if (specialDesc) return specialDesc;

  const actionDesc = monster.actions?.[0]?.desc?.trim();
  if (actionDesc) return actionDesc;

  if (isCustomMonster(monster) && monster.notes?.trim()) return monster.notes.trim();

  return null;
}

function emptyCustomMonster(): CustomMonsterFormData {
  return {
    name: "",
    size: "Medium",
    type: "Humanoid",
    alignment: "Neutral",
    armor_class: 10,
    hit_points: 10,
    hit_dice: "1d8",
    speed: "30 ft.",
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    challenge_rating: "0",
    actions: [],
    special_abilities: [],
    notes: "",
    level: undefined,
    levelLabel: "",
    loot: [],
  };
}

function buildCustomMonsterForm(monster: CompendiumMonster): CustomMonsterFormData {
  return {
    name: monster.name,
    size: monster.size || "Medium",
    type: monster.type || "Humanoid",
    alignment: monster.alignment || "Neutral",
    armor_class: parseNumberish(monster.armor_class, 10),
    hit_points: parseNumberish(monster.hit_points, 10),
    hit_dice: monster.hit_dice || "1d8",
    speed: typeof monster.speed === "string" ? monster.speed : `${parseSpeedFromMonster(monster.speed)} ft.`,
    strength: parseNumberish(monster.strength, 10),
    dexterity: parseNumberish(monster.dexterity, 10),
    constitution: parseNumberish(monster.constitution, 10),
    intelligence: parseNumberish(monster.intelligence, 10),
    wisdom: parseNumberish(monster.wisdom, 10),
    charisma: parseNumberish(monster.charisma, 10),
    challenge_rating: String(monster.challenge_rating ?? "0"),
    actions: monster.actions?.map((action) => ({ ...action })) ?? [],
    special_abilities: monster.special_abilities?.map((ability) => ({ ...ability })) ?? [],
    notes: getMonsterDescription(monster) ?? "",
    level: isCustomMonster(monster) ? monster.level : undefined,
    levelLabel: isCustomMonster(monster) ? (monster.levelLabel ?? "") : "",
    loot: isCustomMonster(monster) ? (monster.loot?.map((item) => ({ ...item })) ?? []) : [],
  };
}

function buildBaseNpcState(maxHp: number, armorClass: number): { maxHp: number; currentHp: number; armorClass: number; actionUsed: boolean; bonusActionUsed: boolean; reactionUsed: boolean; movementUsed: number } {
  return {
    maxHp: Math.max(1, Math.floor(maxHp)),
    currentHp: Math.max(1, Math.floor(maxHp)),
    armorClass: Math.max(1, Math.floor(armorClass)),
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    movementUsed: 0,
  };
}

function buildDummyStateFromMonster(monster: CompendiumMonster) {
  return buildBaseNpcState(parseNumberish(monster.hit_points, 20), parseNumberish(monster.armor_class, 12));
}

function buildDummyStateFromDmNpc(npc: SavedDmNpc) {
  const level = Math.max(1, parseNumberish(npc.level, 1));
  const conMod = abilityModifier(parseNumberish(npc.con, 10));
  const dexMod = abilityModifier(parseNumberish(npc.dex, 10));
  return buildBaseNpcState(Math.max(6, 8 + (level * Math.max(1, 5 + conMod))), 10 + dexMod);
}

function buildDummyStateFromCharacter(entry: SavedCharacter) {
  const core = entry.snapshot.character;
  return buildBaseNpcState(parseNumberish(core.maxHp, 20), parseNumberish(core.armorClass, 12));
}

function buildAttackRecord(id: string, name: string, attackBonus: number, damageDice: string, damageModifier: number, damageType: string, range?: string, notes?: string): Attack {
  return {
    id,
    name,
    attackBonus,
    damageDice,
    damageModifier,
    damageType,
    range,
    notes,
    reminders: [],
  };
}

function buildUnarmedAttack(name: string, coreStats: CombatNpcCoreStats): Attack {
  const strengthMod = abilityModifier(coreStats.strength);
  return buildAttackRecord(
    `unarmed-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    "Unarmed Strike",
    strengthMod + 2,
    "1d4",
    strengthMod,
    "bludgeoning",
    "5 ft",
    `${name} makes a basic melee strike.`
  );
}

function parseMonsterAttack(monster: CompendiumMonster, action: { name: string; desc: string }, index: number): Attack | null {
  const desc = action.desc ?? "";
  const toHitMatch = desc.match(/([+-]\d+)\s*to hit/i);
  const hitMatch = desc.match(/Hit:\s*(?:\d+\s*\()?([0-9]+d[0-9]+)(?:\s*([+-]\s*\d+))?\)?\s*([a-zA-Z]+) damage/i);
  if (!toHitMatch || !hitMatch) return null;
  const attackBonus = parseNumberish(toHitMatch[1].replace(/\s+/g, ""), abilityModifier(parseNumberish(monster.strength, 10)) + 2);
  const damageModifier = hitMatch[2] ? parseNumberish(hitMatch[2].replace(/\s+/g, ""), 0) : 0;
  const rangeMatch = desc.match(/reach\s+(\d+\s*ft\.?)/i) ?? desc.match(/range\s+([0-9/ ]+\s*ft\.?)/i);
  return buildAttackRecord(
    `monster-${monster.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
    action.name,
    attackBonus,
    hitMatch[1],
    damageModifier,
    hitMatch[3].toLowerCase(),
    rangeMatch?.[1],
    desc
  );
}

function buildMonsterAttacks(monster: CompendiumMonster): Attack[] {
  const parsed = (monster.actions ?? [])
    .map((action, index) => parseMonsterAttack(monster, action, index))
    .filter((attack): attack is Attack => Boolean(attack));
  return parsed.length > 0 ? parsed : [buildUnarmedAttack(monster.name, buildCoreStatsFromMonster(monster))];
}

function buildGearAttack(item: CombatNpcGearItem): Attack | null {
  if (!item.equipped || !item.damageDice || !item.damageType) return null;
  return buildAttackRecord(
    item.id,
    item.name,
    item.attackBonus ?? 0,
    item.damageDice,
    item.damageModifier ?? 0,
    item.damageType,
    item.range,
    item.notes
  );
}

function formatRollLabel(stat: PartyStatKey): string {
  switch (stat) {
    case "initiative":
      return "Initiative Roll";
    case "strength":
      return "Strength Check";
    case "dexterity":
      return "Dexterity Check";
    case "constitution":
      return "Constitution Check";
    case "intelligence":
      return "Intelligence Check";
    case "wisdom":
      return "Wisdom Check";
    case "charisma":
      return "Charisma Check";
    case "strength_save":
      return "Strength Save";
    case "dexterity_save":
      return "Dexterity Save";
    case "constitution_save":
      return "Constitution Save";
    case "intelligence_save":
      return "Intelligence Save";
    case "wisdom_save":
      return "Wisdom Save";
    case "charisma_save":
      return "Charisma Save";
    case "animal_handling":
      return "Animal Handling";
    case "sleight_of_hand":
      return "Sleight of Hand";
    default:
      return stat.charAt(0).toUpperCase() + stat.slice(1).replace(/_/g, " ");
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HpBar({ current, max, tempHp }: { current: number; max: number; tempHp: number }) {
  const c = useColors();
  const pct = max > 0 ? Math.min(1, current / max) : 0;
  const hpColor = pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#facc15" : "#f87171";

  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 11, color: c.mutedForeground }}>HP</Text>
        <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "700" }}>
          {current}/{max}{tempHp > 0 ? ` +${tempHp}` : ""}
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.border, overflow: "hidden" }}>
        <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: hpColor, borderRadius: 3 }} />
      </View>
    </View>
  );
}

function MemberCard({
  member,
  initiativeTotal,
  isCurrentTurn,
  disableThemes,
  onPressName,
  onRemove,
  removing,
}: {
  member: PartyMemberSummary;
  initiativeTotal?: number;
  isCurrentTurn?: boolean;
  disableThemes: boolean;
  onPressName?: () => void;
  onRemove?: () => void;
  removing?: boolean;
}) {
  const c = useColors();
  const conditions = (member.conditions ?? []) as Array<{ id: string; name: string }>;
  const core = member.coreStats;
  const profileUri = member.presentation?.profileImageUri?.trim() || "";
  const personalTheme = !disableThemes && member.presentation?.themeId ? THEMES[member.presentation.themeId as keyof typeof THEMES] : null;
  const accent = member.presentation?.accentHex || personalTheme?.palette.primary || c.primary;
  const cardBg = personalTheme?.palette.card || c.card;
  const cardBorder = isCurrentTurn ? "#22C55E" : accent;
  const localBg = personalTheme?.palette.background || c.background;
  const localBorder = personalTheme?.palette.border || c.border;
  const localMuted = personalTheme?.palette.mutedForeground || c.mutedForeground;
  const localFg = personalTheme?.palette.foreground || c.foreground;
  const stat = (value: number | null | undefined) => (typeof value === "number" ? `${value >= 0 ? "+" : ""}${value}` : "--");

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder + "88" }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          {profileUri ? (
            <Image source={{ uri: profileUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { borderColor: accent + "66", backgroundColor: accent + "1A" }]}>
              <Feather name="user" size={16} color={accent} />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {onPressName ? (
                <TouchableOpacity onPress={onPressName} hitSlop={6} style={{ alignSelf: "flex-start" }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: localFg }} numberOfLines={1}>
                    {member.characterName}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ fontSize: 15, fontWeight: "700", color: localFg }} numberOfLines={1}>
                  {member.characterName}
                </Text>
              )}
              {isCurrentTurn && (
                <View style={{ backgroundColor: "#22C55E22", borderColor: "#22C55E", borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#22C55E", letterSpacing: 0.5 }}>CURRENT TURN</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 12, color: localMuted }}>{member.characterClass}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {typeof initiativeTotal === "number" && (
            <View style={[styles.acBadge, { backgroundColor: "#22C55E22", borderColor: "#22C55E55" }]}>
              <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "600" }}>INIT</Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#22C55E" }}>{initiativeTotal}</Text>
            </View>
          )}
          <View style={[styles.acBadge, { backgroundColor: accent + "22", borderColor: accent + "55" }]}>
            <Text style={{ fontSize: 10, color: localMuted, fontWeight: "600" }}>AC</Text>
            <Text style={{ fontSize: 16, fontWeight: "800", color: accent }}>{member.armorClass}</Text>
          </View>
          {!!onRemove && (
            <TouchableOpacity
              onPress={onRemove}
              disabled={removing}
              style={[styles.removeBtn, { borderColor: "#f87171" + "66", opacity: removing ? 0.6 : 1 }]}
            >
              <Feather name={removing ? "loader" : "user-minus"} size={14} color="#f87171" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <HpBar current={member.currentHp} max={member.maxHp} tempHp={member.tempHp} />

      <View style={{ marginTop: 8, gap: 6 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
            <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>SPD {core?.speed ?? "--"}</Text>
          </View>
          <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
            <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>INIT {stat(core?.initiativeBonus)}</Text>
          </View>
          <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
            <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>STR {stat(core?.strength)}</Text>
          </View>
          <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
            <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>DEX {stat(core?.dexterity)}</Text>
          </View>
          <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
            <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>CON {stat(core?.constitution)}</Text>
          </View>
          <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
            <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>INT {stat(core?.intelligence)}</Text>
          </View>
          <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
            <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>WIS {stat(core?.wisdom)}</Text>
          </View>
          <View style={[styles.conditionBadge, { borderColor: localBorder, backgroundColor: localBg }]}>
            <Text style={{ fontSize: 10, color: localMuted, fontWeight: "700" }}>CHA {stat(core?.charisma)}</Text>
          </View>
        </View>
      </View>

      {conditions.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {conditions.map((cond) => (
            <View key={cond.id} style={[styles.conditionBadge, { backgroundColor: "#f97316" + "22", borderColor: "#f97316" + "55" }]}>
              <Text style={{ fontSize: 10, color: "#f97316", fontWeight: "600" }}>{cond.name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ConditionBadges({ conditions }: { conditions: Array<{ id: string; name: string }> }) {
  if (conditions.length === 0) return null;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
      {conditions.map((cond) => (
        <View key={cond.id} style={[styles.conditionBadge, { backgroundColor: "#f97316" + "22", borderColor: "#f97316" + "55" }]}>
          <Text style={{ fontSize: 10, color: "#f97316", fontWeight: "600" }}>{cond.name}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DmPartyScreen() {
  const c = useColors();
  const { settings, updateSettings } = useAppSettings();
  const { showStatusPill } = useCharacter();

  const [watchedCode, setWatchedCode] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<DmActiveSessionSummary[]>([]);
  const [loadingActiveSessions, setLoadingActiveSessions] = useState(false);
  const [members, setMembers] = useState<PartyMemberSummary[]>([]);
  const [codeInput, setCodeInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [combatState, setCombatState] = useState<PartyCombatState | null>(null);
  const [selectedTargetsByTab, setSelectedTargetsByTab] = useState<Record<TargetingTab, string[]>>(buildTabTargetSelection([]));
  const [selectedEncounterControlIdByTab, setSelectedEncounterControlIdByTab] = useState<Record<TargetingTab, string>>(buildTabEncounterSelection());
  const [selectedNpcIdsForEncounter, setSelectedNpcIdsForEncounter] = useState<string[]>([]);
  const [selectedStat, setSelectedStat] = useState<PartyStatKey | null>(null);
  const [showAllRollTypes, setShowAllRollTypes] = useState(false);
  const [sendingRollPrompt, setSendingRollPrompt] = useState(false);
  const [startingInitiative, setStartingInitiative] = useState(false);
  const [advancingTurn, setAdvancingTurn] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [savedDmNpcs, setSavedDmNpcs] = useState<SavedDmNpc[]>([]);
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>([]);
  const [compendiumMonsters, setCompendiumMonsters] = useState<CompendiumMonster[]>([]);
  const [monsterSearchText, setMonsterSearchText] = useState("");
  const [monsterFilterTab, setMonsterFilterTab] = useState<"official" | "custom">("official");
  const [showMonsterFilters, setShowMonsterFilters] = useState(false);
  const [monsterCrBand, setMonsterCrBand] = useState<MonsterCrBand>("all");
  const [monsterTypeFilter, setMonsterTypeFilter] = useState("all");
  const [monsterSortMode, setMonsterSortMode] = useState<MonsterSortMode>("name");
  const [showMonsterPicker, setShowMonsterPicker] = useState(false);
  const [expandedCompendiumMonsterKey, setExpandedCompendiumMonsterKey] = useState<string | null>(null);
  const [showCustomMonsterForm, setShowCustomMonsterForm] = useState(false);
  const [editingMonsterId, setEditingMonsterId] = useState<string | null>(null);
  const [customMonsterForm, setCustomMonsterForm] = useState<CustomMonsterFormData>(emptyCustomMonster());
  const [loadingMonsters, setLoadingMonsters] = useState(false);
  const [pendingNpcDisposition, setPendingNpcDisposition] = useState<Record<string, CombatNpcDisposition>>({});
  const [lootImportText, setLootImportText] = useState("");
  const [assigningLoot, setAssigningLoot] = useState(false);
  const [activeControlTab, setActiveControlTab] = useState<ControlTab>("turn");
  const [lootPromptText, setLootPromptText] = useState("");
  const [lootPromptRarity, setLootPromptRarity] = useState<string[]>([]);
  const [lootPromptTypes, setLootPromptTypes] = useState<LootAssignmentItem["category"][]>([]);
  const [generatingLoot, setGeneratingLoot] = useState(false);
  const [lootAssignmentMode, setLootAssignmentMode] = useState<LootAssignmentMode>("selected-players");
  const [lootDraftItems, setLootDraftItems] = useState<LootDraftItem[]>([]);
  const [activeLootCategoryEditorId, setActiveLootCategoryEditorId] = useState<string | null>(null);
  const [activeLootAdvancedEditorId, setActiveLootAdvancedEditorId] = useState<string | null>(null);
  const [sendingNotes, setSendingNotes] = useState(false);
  const [isTurnRollControlsCollapsed, setIsTurnRollControlsCollapsed] = useState(true);
  const [resolvingRestRequestId, setResolvingRestRequestId] = useState<string | null>(null);
  const [dmNotesPayload, setDmNotesPayload] = useState<DmNotesPayload>({ quests: [], people: [], locations: [], notes: [], items: [], planes: [] });
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [selectedQuestIds, setSelectedQuestIds] = useState<string[]>([]);
  const [includeRelatedPeople, setIncludeRelatedPeople] = useState(true);
  const [includeRelatedLocations, setIncludeRelatedLocations] = useState(true);
  const [selectedDummyEncounterId, setSelectedDummyEncounterId] = useState<string>("manual");
  const [dummyNameInput, setDummyNameInput] = useState("Training Dummy");

  const headerCardColor = c.card;
  const headerBorderColor = c.border;
  const headerMutedColor = c.mutedForeground;
  const headerPrimaryColor = c.primary;
  const [dummyMaxHpInput, setDummyMaxHpInput] = useState("30");
  const [dummyArmorClassInput, setDummyArmorClassInput] = useState("12");
  const [dummyInitiativeBonusInput, setDummyInitiativeBonusInput] = useState("0");
  const [dummySpeedInput, setDummySpeedInput] = useState("30");
  const [dummyDisposition, setDummyDisposition] = useState<CombatNpcDisposition>("hostile");
  const [selectedNpcImportEncounterId, setSelectedNpcImportEncounterId] = useState<string>("manual");
  const [creatingDummy, setCreatingDummy] = useState(false);
  const [npcInitiativeInputById, setNpcInitiativeInputById] = useState<Record<string, string>>({});
  const [rollingNpcInitiativeId, setRollingNpcInitiativeId] = useState<string | null>(null);
  const [addingToEncounter, setAddingToEncounter] = useState(false);
  const [updatingNpcDummyStateId, setUpdatingNpcDummyStateId] = useState<string | null>(null);
  const [npcAttackRollsById, setNpcAttackRollsById] = useState<Record<string, { attackRoll: string; damageRoll: string }>>({});
  const [expandedNpcAttackId, setExpandedNpcAttackId] = useState<string | null>(null);
  const [npcGearFormOpenById, setNpcGearFormOpenById] = useState<Record<string, boolean>>({});
  const [npcGearFormById, setNpcGearFormById] = useState<Record<string, Partial<CombatNpcGearItem>>>({});
  const [isBattleLogExpanded, setIsBattleLogExpanded] = useState(false);
  const battleLogScrollRef = useRef<ScrollView | null>(null);

  // Encounter setup handoff context: loaded from dm-monsters when user stages monsters
  const [encounterHandoffContext, setEncounterHandoffContext] = useState<ReturnType<typeof getEncounterSetupHandoff>>(null);
  const [showHandoffContinuationBanner, setShowHandoffContinuationBanner] = useState(false);

  const loadWatchHistory = useCallback(async (): Promise<DmWatchHistoryEntry[]> => {
    const raw = await AsyncStorage.getItem(DM_WATCH_HISTORY_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as DmWatchHistoryEntry[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((entry) => typeof entry?.code === "string" && typeof entry?.lastSeenAt === "number")
        .map((entry) => ({
          code: entry.code.toUpperCase(),
          lastSeenAt: entry.lastSeenAt,
        }));
    } catch {
      return [];
    }
  }, []);

  const saveWatchHistory = useCallback(async (entries: DmWatchHistoryEntry[]) => {
    const deduped = Array.from(
      new Map(
        entries.map((entry) => [
          entry.code.toUpperCase(),
          { code: entry.code.toUpperCase(), lastSeenAt: entry.lastSeenAt },
        ])
      ).values()
    )
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .slice(0, 8);
    await AsyncStorage.setItem(DM_WATCH_HISTORY_KEY, JSON.stringify(deduped));
  }, []);

  const upsertWatchHistoryEntry = useCallback(async (code: string) => {
    const normalizedCode = code.toUpperCase();
    const entries = await loadWatchHistory();
    await saveWatchHistory([
      { code: normalizedCode, lastSeenAt: Date.now() },
      ...entries.filter((entry) => entry.code !== normalizedCode),
    ]);
  }, [loadWatchHistory, saveWatchHistory]);

  const removeWatchHistoryEntry = useCallback(async (code: string) => {
    const normalizedCode = code.toUpperCase();
    const entries = await loadWatchHistory();
    await saveWatchHistory(entries.filter((entry) => entry.code !== normalizedCode));
  }, [loadWatchHistory, saveWatchHistory]);

  // Load and detect encounter handoff on mount
  useEffect(() => {
    const handoff = getEncounterSetupHandoff();
    if (handoff) {
      setEncounterHandoffContext(handoff);
      setShowHandoffContinuationBanner(true);
      // Pre-select the target battle if known
      if (handoff.targetBattleId) {
        setSelectedNpcImportEncounterId(handoff.targetBattleId);
      }
    }
  }, []);

  const sortedMembers = React.useMemo(() => {
    const initiativeMap = new Map((combatState?.initiative ?? []).map((entry) => [entry.memberId, entry.initiativeTotal]));
    return [...members].sort((a, b) => {
      const ai = initiativeMap.get(a.id);
      const bi = initiativeMap.get(b.id);
      const aHas = typeof ai === "number";
      const bHas = typeof bi === "number";
      if (aHas && bHas) return (bi as number) - (ai as number);
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return a.characterName.localeCompare(b.characterName);
    });
  }, [members, combatState?.initiative]);

  const groupedMembers = React.useMemo(() => {
    const battleByParticipant = combatState?.participantBattleById ?? {};
    const groups = new Map<string, PartyMemberSummary[]>();

    for (const member of sortedMembers) {
      const battleId = battleByParticipant[member.id] ?? "no-battle";
      if (!groups.has(battleId)) groups.set(battleId, []);
      groups.get(battleId)!.push(member);
    }

    const orderedBattleIds = [...groups.keys()].sort((a, b) => {
      if (a === "no-battle") return 1;
      if (b === "no-battle") return -1;
      return a.localeCompare(b);
    });

    return orderedBattleIds.map((battleId, idx) => ({
      battleId,
      label: battleId === "no-battle" ? "No Active Encounter" : getEncounterLabel(idx + 1),
      members: groups.get(battleId) ?? [],
    }));
  }, [sortedMembers, combatState?.participantBattleById]);

  const encounterControlOptions = React.useMemo(() => {
    return groupedMembers.map((group) => ({
      ...group,
      controlLabel: group.battleId === "no-battle" ? "Unassigned Players" : group.label,
    }));
  }, [groupedMembers]);

  const availableEncounterNpcs = useMemo(() => (combatState?.combatNpcs ?? []).filter(
    npc => !npc.companionAdmission?.detachedAt
  ), [combatState?.combatNpcs]);

  const activeTargetTab: TargetingTab = activeControlTab === "loot" || activeControlTab === "notes"
    ? activeControlTab
    : "turn";
  const selectedTargets = selectedTargetsByTab[activeTargetTab];
  const selectedEncounterControlId = selectedEncounterControlIdByTab[activeTargetTab];
  const turnSelectedTargets = selectedTargetsByTab.turn;
  const lootSelectedTargets = selectedTargetsByTab.loot;
  const notesSelectedTargets = selectedTargetsByTab.notes;
  const turnEncounterControlId = selectedEncounterControlIdByTab.turn;

  const selectedEncounterGroup = React.useMemo(() => {
    if (selectedEncounterControlId === "manual") return null;
    return encounterControlOptions.find((group) => group.battleId === selectedEncounterControlId) ?? null;
  }, [encounterControlOptions, selectedEncounterControlId]);

  const displayedTurnOrder = React.useMemo(() => {
    if (!combatState || turnEncounterControlId === "manual") return [];
    const turnEncounterGroup = encounterControlOptions.find((group) => group.battleId === turnEncounterControlId) ?? null;
    if (!turnEncounterGroup) return [];
    if (turnEncounterGroup.battleId === "no-battle") return [];
    return combatState.battleTurnOrderById?.[turnEncounterGroup.battleId] ?? [];
  }, [combatState, encounterControlOptions, turnEncounterControlId]);

  const selectionSummaryText = selectedEncounterGroup
    ? `${selectedEncounterGroup.controlLabel}: ${selectedTargets.length}/${selectedEncounterGroup.members.length} selected`
    : `Targets: ${selectedTargets.length}/${members.length} selected`;

  const turnEncounterGroup = React.useMemo(() => {
    if (turnEncounterControlId === "manual") return null;
    return encounterControlOptions.find((group) => group.battleId === turnEncounterControlId) ?? null;
  }, [encounterControlOptions, turnEncounterControlId]);

  const turnOrderLabel = turnEncounterGroup ? `TURN ORDER · ${turnEncounterGroup.controlLabel.toUpperCase()}` : "TURN ORDER";

  const getCurrentTurnIdForBattle = useCallback((battleId: string | null | undefined) => {
    if (!combatState) return null;
    if (!battleId || battleId === "no-battle") return null;
    return combatState.currentTurnIdByBattle?.[battleId] ?? null;
  }, [combatState]);

  const resolveBattleIdForTab = useCallback((tab: TargetingTab) => {
    const selectedBattleId = selectedEncounterControlIdByTab[tab];
    if (selectedBattleId !== "manual" && selectedBattleId !== "no-battle") return selectedBattleId;
    const uniqueBattleIds = [...new Set(
      selectedTargetsByTab[tab]
        .map((id) => combatState?.participantBattleById?.[id])
        .filter((battleId): battleId is string => typeof battleId === "string" && battleId.length > 0)
    )];
    return uniqueBattleIds.length === 1 ? uniqueBattleIds[0] : undefined;
  }, [combatState?.participantBattleById, selectedEncounterControlIdByTab, selectedTargetsByTab]);

  const turnPreviewTurnId = React.useMemo(() => {
    const battleId = resolveBattleIdForTab("turn");
    if (battleId) return combatState?.currentTurnIdByBattle?.[battleId] ?? null;
    return null;
  }, [combatState?.currentTurnIdByBattle, resolveBattleIdForTab]);

  useEffect(() => {
    setSelectedEncounterControlIdByTab((prev) => {
      let changed = false;
      const next = { ...prev };
      (Object.keys(next) as TargetingTab[]).forEach((tab) => {
        if (next[tab] === "manual") return;
        const optionExists = encounterControlOptions.some((group) => group.battleId === next[tab]);
        if (!optionExists) {
          next[tab] = "manual";
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [encounterControlOptions]);

  useEffect(() => {
    const validIds = new Set(members.map((member) => member.id));
    setSelectedTargetsByTab((prev) => {
      let changed = false;
      const next = { ...prev };
      (Object.keys(next) as TargetingTab[]).forEach((tab) => {
        const filtered = next[tab].filter((id) => validIds.has(id));
        if (filtered.length !== next[tab].length) {
          next[tab] = filtered;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [members]);

  useEffect(() => {
    const validIds = new Set(members.map((member) => member.id));
    const fallbackTargetId = lootSelectedTargets[0] ?? members[0]?.id ?? null;
    setLootDraftItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const currentTarget = item.targetMemberId && validIds.has(item.targetMemberId) ? item.targetMemberId : null;
        const nextTarget = lootAssignmentMode === "by-player" ? (currentTarget ?? fallbackTargetId) : currentTarget;
        if (nextTarget !== item.targetMemberId) {
          changed = true;
          return { ...item, targetMemberId: nextTarget };
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [lootAssignmentMode, lootSelectedTargets, members]);

  useEffect(() => {
    const validBattleIds = new Set(encounterControlOptions.map((option) => option.battleId));
    if (selectedDummyEncounterId !== "manual" && !validBattleIds.has(selectedDummyEncounterId)) {
      setSelectedDummyEncounterId("manual");
    }
  }, [encounterControlOptions, selectedDummyEncounterId]);

  useEffect(() => {
    const validBattleIds = new Set(encounterControlOptions.map((option) => option.battleId));
    if (selectedNpcImportEncounterId !== "manual" && !validBattleIds.has(selectedNpcImportEncounterId)) {
      setSelectedNpcImportEncounterId("manual");
    }
  }, [encounterControlOptions, selectedNpcImportEncounterId]);

  useEffect(() => {
    const validNpcIds = new Set((combatState?.combatNpcs ?? []).filter(npc => !npc.companionAdmission?.detachedAt).map((npc) => npc.id));
    setSelectedNpcIdsForEncounter((prev) => {
      const filtered = prev.filter((id) => validNpcIds.has(id));
      return filtered.length !== prev.length ? filtered : prev;
    });
  }, [combatState?.combatNpcs]);

  const pendingRestRequests = React.useMemo(() => {
    return (combatState?.restRequests ?? []).filter((request) => request.status === "pending");
  }, [combatState?.restRequests]);

  const dummyCombatants = React.useMemo(() => {
    return (combatState?.combatNpcs ?? []).filter((npc) => isDummyCombatant(npc.sourceId));
  }, [combatState?.combatNpcs]);

  const sortedBattleLog = React.useMemo(() => {
    const rows = combatState?.eventLog ?? [];
    return [...rows].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [combatState?.eventLog]);

  const resolveBattleLogParticipantLabel = React.useCallback((participantId: unknown) => {
    if (typeof participantId !== "string" || !participantId.trim()) return "—";
    if (participantId === "environment") return "DM";

    return members.find((member) => member.id === participantId)?.characterName
      ?? combatState?.combatNpcs.find((npc) => npc.id === participantId)?.name
      ?? "Source unavailable";
  }, [combatState?.combatNpcs, members]);

  const formatBattleLogMessage = React.useCallback((evt: { type: string; message: string; metadata?: Record<string, unknown> }) => {
    if (evt.type === "turn_advanced") {
      return `Turn advanced from ${resolveBattleLogParticipantLabel(evt.metadata?.from)} to ${resolveBattleLogParticipantLabel(evt.metadata?.to)}.`;
    }
    return evt.message;
  }, [resolveBattleLogParticipantLabel]);

  useEffect(() => {
    if (!isBattleLogExpanded || sortedBattleLog.length === 0) return;
    const frame = requestAnimationFrame(() => {
      battleLogScrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [isBattleLogExpanded, sortedBattleLog.length]);

  const monsterTypeOptions = React.useMemo(() => {
    const types = new Set<string>();
    compendiumMonsters.forEach((monster) => {
      const isCustom = isCustomMonster(monster);
      if (monsterFilterTab === "official" && isCustom) return;
      if (monsterFilterTab === "custom" && !isCustom) return;
      types.add(normalizeMonsterType(monster.type));
    });
    return ["all", ...[...types].sort((a, b) => a.localeCompare(b))];
  }, [compendiumMonsters, monsterFilterTab]);

  const filteredCompendiumMonsters = React.useMemo(() => {
    const search = monsterSearchText.trim().toLowerCase();
    return compendiumMonsters
      .filter((monster) => {
        const isCustom = isCustomMonster(monster);
        if (monsterFilterTab === "official" && isCustom) return false;
        if (monsterFilterTab === "custom" && !isCustom) return false;
        const monsterType = normalizeMonsterType(monster.type);
        const cr = parseChallengeRating(monster.challenge_rating);
        if (monsterTypeFilter !== "all" && monsterType !== monsterTypeFilter) return false;
        if (!monsterMatchesCrBand(cr, monsterCrBand)) return false;
        if (!search) return true;

        const searchHaystack = [
          monster.name,
          monster.size,
          monster.type,
          "subtype" in monster ? monster.subtype : undefined,
          "group" in monster ? monster.group : undefined,
          monster.alignment,
          monster.challenge_rating,
        ]
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .map((value) => value.toLowerCase());

        return searchHaystack.some((value) => value.includes(search));
      })
      .sort((a, b) => {
        if (monsterSortMode === "name") return a.name.localeCompare(b.name);
        if (monsterSortMode === "cr-asc") {
          const aCr = parseChallengeRating(a.challenge_rating);
          const bCr = parseChallengeRating(b.challenge_rating);
          if (aCr !== bCr) return aCr - bCr;
          return a.name.localeCompare(b.name);
        }
        if (monsterSortMode === "cr-desc") {
          const aCr = parseChallengeRating(a.challenge_rating);
          const bCr = parseChallengeRating(b.challenge_rating);
          if (aCr !== bCr) return bCr - aCr;
          return a.name.localeCompare(b.name);
        }
        const byType = normalizeMonsterType(a.type).localeCompare(normalizeMonsterType(b.type));
        return byType !== 0 ? byType : a.name.localeCompare(b.name);
      })
      .slice(0, 24);
  }, [compendiumMonsters, monsterCrBand, monsterFilterTab, monsterSearchText, monsterSortMode, monsterTypeFilter]);

  useEffect(() => {
    if (monsterTypeFilter !== "all" && !monsterTypeOptions.includes(monsterTypeFilter)) {
      setMonsterTypeFilter("all");
    }
  }, [monsterTypeFilter, monsterTypeOptions]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeRef = useRef<string | null>(null);
  const sessionGoneHandledRef = useRef(false);

  // ── Polling ──────────────────────────────────────────────────────────────────

  const fetchMembers = useCallback(async (code: string): Promise<PartyMemberSummary[]> => {
    const result = await fetchPartyMembers(code);
    return [...result.members].sort((a, b) => {
      const nameCompare = a.characterName.localeCompare(b.characterName, undefined, { sensitivity: "base" });
      if (nameCompare !== 0) return nameCompare;
      return a.id.localeCompare(b.id);
    });
  }, []);

  const refreshCombat = useCallback(async (code: string) => {
    try {
      const state = await fetchPartyCombatState(code);
      setCombatState(state);
    } catch {}
  }, []);

  const refreshActiveSessions = useCallback(async () => {
    setLoadingActiveSessions(true);
    try {
      const entries = await loadWatchHistory();
      const dmWatchCodeRaw = await AsyncStorage.getItem(DM_WATCH_KEY);
      const playerSessionRaw = await AsyncStorage.getItem(PLAYER_PARTY_SESSION_KEY);
      let playerPartyCode: string | null = null;
      if (playerSessionRaw) {
        try {
          const parsed = JSON.parse(playerSessionRaw) as { partyCode?: unknown };
          if (typeof parsed?.partyCode === "string" && parsed.partyCode.trim().length > 0) {
            playerPartyCode = parsed.partyCode.trim().toUpperCase();
          }
        } catch {
          playerPartyCode = null;
        }
      }

      const candidateEntries = [
        ...entries,
        ...(dmWatchCodeRaw?.trim() ? [{ code: dmWatchCodeRaw.trim().toUpperCase(), lastSeenAt: Date.now() }] : []),
        ...(playerPartyCode ? [{ code: playerPartyCode, lastSeenAt: Date.now() }] : []),
      ];

      const dedupedEntries = Array.from(
        new Map(candidateEntries.map((entry) => [entry.code, entry])).values()
      );

      if (dedupedEntries.length === 0) {
        setActiveSessions([]);
        return;
      }

      const checks = await Promise.all(dedupedEntries.map(async (entry) => {
        try {
          const result = await fetchMembers(entry.code);
          return {
            entry,
            session: { code: entry.code, memberCount: result.length } as DmActiveSessionSummary,
          };
        } catch {
          return { entry, session: null as DmActiveSessionSummary | null };
        }
      }));

      const valid = checks
        .filter((item): item is { entry: DmWatchHistoryEntry; session: DmActiveSessionSummary } => item.session !== null)
        .sort((a, b) => b.entry.lastSeenAt - a.entry.lastSeenAt);

      setActiveSessions(valid.map((item) => item.session));
      await saveWatchHistory(valid.map((item) => item.entry));
    } finally {
      setLoadingActiveSessions(false);
    }
  }, [fetchMembers, loadWatchHistory, saveWatchHistory]);

  const loadCompendiumMonsters = useCallback(async (forceRefresh = false) => {
    if (loadingMonsters || (!forceRefresh && compendiumMonsters.length > 0)) return;
    setLoadingMonsters(true);
    try {
      setError(null);
      const monsters = await getCompendium({ forceRefresh });
      setCompendiumMonsters(monsters);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load compendium monsters.");
    } finally {
      setLoadingMonsters(false);
    }
  }, [compendiumMonsters.length, loadingMonsters]);

  useEffect(() => {
    if (activeControlTab !== "npcs") return;
    void loadCompendiumMonsters();
  }, [activeControlTab, loadCompendiumMonsters]);

  const handleToggleMonsterPicker = useCallback(() => {
    setShowMonsterPicker((prev) => {
      const next = !prev;
      if (!next) setExpandedCompendiumMonsterKey(null);
      if (next && !loadingMonsters && compendiumMonsters.length === 0) {
        void loadCompendiumMonsters();
      }
      return next;
    });
  }, [compendiumMonsters.length, loadCompendiumMonsters, loadingMonsters]);

  const closeCustomMonsterForm = useCallback(() => {
    setShowCustomMonsterForm(false);
    setEditingMonsterId(null);
    setCustomMonsterForm(emptyCustomMonster());
  }, []);

  const handleCustomizeMonster = useCallback((monster: CompendiumMonster) => {
    setCustomMonsterForm(buildCustomMonsterForm(monster));
    setEditingMonsterId(isCustomMonster(monster) ? monster.id : null);
    setShowCustomMonsterForm(true);
  }, []);

  const handleSaveCustomMonster = useCallback(async () => {
    if (!customMonsterForm.name.trim()) {
      Alert.alert("Validation", "Monster name is required.");
      return;
    }

    try {
      if (editingMonsterId) {
        const updated = await updateCustomMonster(editingMonsterId, customMonsterForm);
        if (updated) {
          setCompendiumMonsters((prev) => prev.map((monster) => (isCustomMonster(monster) && monster.id === editingMonsterId ? updated : monster)));
        }
      } else {
        const created = await saveCustomMonster(customMonsterForm);
        setCompendiumMonsters((prev) => [created, ...prev]);
        setMonsterFilterTab("custom");
        setMonsterSearchText(created.name);
      }
      closeCustomMonsterForm();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save monster.");
    }
  }, [closeCustomMonsterForm, customMonsterForm, editingMonsterId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const isSessionGoneError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    return message.includes("party session not found") || message.includes("expired");
  }, []);

  const sessionGoneMessage = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    if (message.includes("expired")) return "Watched party session expired.";
    return "Watched party was disbanded.";
  }, []);

  const handleWatchedSessionGone = useCallback(async (err: unknown) => {
    if (sessionGoneHandledRef.current) return;
    sessionGoneHandledRef.current = true;
    const staleCode = codeRef.current;

    stopPolling();
    codeRef.current = null;
    setWatchedCode(null);
    setMembers([]);
    setCombatState(null);
    setLastUpdated(null);
    setSelectedTargetsByTab(buildTabTargetSelection([]));
    setSelectedEncounterControlIdByTab(buildTabEncounterSelection());
    setError(sessionGoneMessage(err));

    await AsyncStorage.removeItem(DM_WATCH_KEY);
    if (staleCode) {
      await removeWatchHistoryEntry(staleCode);
    }
    await refreshActiveSessions();
  }, [sessionGoneMessage, stopPolling, removeWatchHistoryEntry, refreshActiveSessions]);

  const startPolling = useCallback((code: string) => {
    sessionGoneHandledRef.current = false;
    codeRef.current = code;
    stopPolling();
    pollRef.current = setInterval(async () => {
      if (!codeRef.current) return;
      try {
        const result = await fetchMembers(codeRef.current);
        setMembers(result);
        setLastUpdated(new Date());
        await refreshCombat(codeRef.current);
      } catch (err: unknown) {
        if (isSessionGoneError(err)) {
          await handleWatchedSessionGone(err);
        }
      }
    }, POLL_INTERVAL);
  }, [stopPolling, fetchMembers, refreshCombat, isSessionGoneError, handleWatchedSessionGone]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    if (!watchedCode) return;
    let mounted = true;
    void (async () => {
      const [npcs, chars] = await Promise.all([getSavedDmNpcs(), getAllCharacters()]);
      if (!mounted) return;
      setSavedDmNpcs(npcs);
      setSavedCharacters(chars);
    })();
    return () => {
      mounted = false;
    };
  }, [watchedCode]);

  useFocusEffect(useCallback(() => {
    let mounted = true;
    void (async () => {
      const payload = await getDmNotesPayload();
      if (!mounted) return;
      setDmNotesPayload(payload);
    })();
    return () => {
      mounted = false;
    };
  }, [watchedCode, activeControlTab]));

  // ── Restore persisted session ────────────────────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(DM_WATCH_KEY).then(async (stored) => {
      if (stored) {
        try {
          const result = await fetchMembers(stored);
          setWatchedCode(stored);
          setMembers(result);
          setLastUpdated(new Date());
          codeRef.current = stored;
          setSelectedTargetsByTab(buildTabTargetSelection(result.map((m) => m.id)));
          setSelectedEncounterControlIdByTab(buildTabEncounterSelection());
          await refreshCombat(stored);
          await upsertWatchHistoryEntry(stored);
          startPolling(stored);
        } catch {
          // Code expired or invalid — clear it
          await AsyncStorage.removeItem(DM_WATCH_KEY);
        }
      }
      setIsRestoring(false);
    });
  }, [fetchMembers, refreshCombat, startPolling, upsertWatchHistoryEntry]);

  useEffect(() => {
    if (isRestoring || watchedCode) return;
    void refreshActiveSessions();
  }, [isRestoring, watchedCode, refreshActiveSessions]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleJoin = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) {
      setError("Enter a party code to observe.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchMembers(code);
      setWatchedCode(code);
      setMembers(result);
      setLastUpdated(new Date());
      codeRef.current = code;
      setSelectedTargetsByTab(buildTabTargetSelection(result.map((m) => m.id)));
      setSelectedEncounterControlIdByTab(buildTabEncounterSelection());
      await AsyncStorage.setItem(DM_WATCH_KEY, code);
      await upsertWatchHistoryEntry(code);
      await refreshCombat(code);
      startPolling(code);
      setCodeInput("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Party not found. Check the code and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleWatchSavedSession = async (code: string) => {
    setCodeInput(code);
    setError(null);
    setIsLoading(true);
    try {
      const result = await fetchMembers(code);
      setWatchedCode(code);
      setMembers(result);
      setLastUpdated(new Date());
      codeRef.current = code;
      setSelectedTargetsByTab(buildTabTargetSelection(result.map((m) => m.id)));
      setSelectedEncounterControlIdByTab(buildTabEncounterSelection());
      await AsyncStorage.setItem(DM_WATCH_KEY, code);
      await upsertWatchHistoryEntry(code);
      await refreshCombat(code);
      startPolling(code);
      setCodeInput("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Party not found. Check the code and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { code } = await createParty();
      const normalizedCode = code.toUpperCase();
      let result: PartyMemberSummary[] = [];
      try {
        result = await fetchMembers(normalizedCode);
      } catch {
        // New party can briefly return no members while it initializes.
      }
      setWatchedCode(normalizedCode);
      setMembers(result);
      setLastUpdated(new Date());
      codeRef.current = normalizedCode;
      setSelectedTargetsByTab(buildTabTargetSelection(result.map((m) => m.id)));
      setSelectedEncounterControlIdByTab(buildTabEncounterSelection());
      await AsyncStorage.setItem(DM_WATCH_KEY, normalizedCode);
      await upsertWatchHistoryEntry(normalizedCode);
      try {
        await refreshCombat(normalizedCode);
      } catch {
        // Keep watching even if combat state is not initialized yet.
      }
      startPolling(normalizedCode);
      setCodeInput("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create party.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTarget = (id: string) => {
    setSelectedEncounterControlIdByTab((prev) => ({ ...prev, [activeTargetTab]: "manual" }));
    setSelectedTargetsByTab((prev) => ({
      ...prev,
      [activeTargetTab]: prev[activeTargetTab].includes(id)
        ? prev[activeTargetTab].filter((value) => value !== id)
        : [...prev[activeTargetTab], id],
    }));
  };

  const selectAllTargets = () => {
    setSelectedEncounterControlIdByTab((prev) => ({ ...prev, [activeTargetTab]: "manual" }));
    setSelectedTargetsByTab((prev) => ({ ...prev, [activeTargetTab]: members.map((m) => m.id) }));
  };

  const selectEncounterControl = useCallback((battleId: string) => {
    setSelectedEncounterControlIdByTab((prev) => ({ ...prev, [activeTargetTab]: battleId }));
    if (battleId === "manual") return;
    const group = encounterControlOptions.find((entry) => entry.battleId === battleId);
    setSelectedTargetsByTab((prev) => ({
      ...prev,
      [activeTargetTab]: group?.members.map((member) => member.id) ?? [],
    }));
  }, [activeTargetTab, encounterControlOptions]);

  const handleStartInitiative = async () => {
    if (!watchedCode) return;
    if (turnSelectedTargets.length === 0 && selectedNpcIdsForEncounter.length === 0 && (combatState?.combatNpcs?.length ?? 0) === 0) {
      setError("Select at least one player or add a battle NPC before starting initiative.");
      return;
    }
    setStartingInitiative(true);
    try {
      setError(null);
      const initiativeStartResult = await startPartyInitiative(
        watchedCode,
        false,
        turnSelectedTargets,
        selectedNpcIdsForEncounter.length > 0 ? selectedNpcIdsForEncounter : undefined,
      );
      if (turnSelectedTargets.length > 0) {
        await createPartyRollRequest(watchedCode, {
          statKey: "initiative",
          label: "Initiative",
          targetMemberIds: turnSelectedTargets,
          battleId: initiativeStartResult.battleId,
        });
      }
      await refreshCombat(watchedCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start initiative.");
    } finally {
      setStartingInitiative(false);
    }
  };

  const cycleDisposition = (key: string) => {
    setPendingNpcDisposition((prev) => {
      const current = prev[key] ?? getDefaultDispositionForKey(key);
      const next: CombatNpcDisposition = current === "hostile" ? "passive" : current === "passive" ? "friendly" : "hostile";
      return { ...prev, [key]: next };
    });
  };

  const getDispositionColors = (disposition: CombatNpcDisposition) => {
    if (disposition === "hostile") return { fg: "#ef4444", bg: "#ef444422", border: "#ef444455" };
    if (disposition === "friendly") return { fg: "#22c55e", bg: "#22c55e22", border: "#22c55e55" };
    return { fg: "#f59e0b", bg: "#f59e0b22", border: "#f59e0b55" };
  };

  const handleCreateDummy = async () => {
    if (!watchedCode) {
      setError("Join a party before creating dummies.");
      return;
    }

    const name = dummyNameInput.trim() || `Dummy ${dummyCombatants.length + 1}`;
    const maxHp = Math.max(1, Number.parseInt(dummyMaxHpInput, 10) || 1);
    const armorClass = Math.max(1, Number.parseInt(dummyArmorClassInput, 10) || 1);
    const initiativeBonus = Number.parseInt(dummyInitiativeBonusInput, 10) || 0;
    const speed = Math.max(0, Number.parseInt(dummySpeedInput, 10) || 30);
    const sourceId = buildDummySourceId(maxHp, armorClass);
    const battleId = selectedDummyEncounterId !== "manual" && selectedDummyEncounterId !== "no-battle"
      ? selectedDummyEncounterId
      : undefined;

    setCreatingDummy(true);
    try {
      setError(null);
      await addCombatNpc(watchedCode, {
        name,
        sourceType: "manual",
        sourceId,
        disposition: dummyDisposition,
        initiativeTotal: initiativeBonus,
        battleId,
        coreStats: {
          speed,
          initiativeBonus,
        },
        dummyState: {
          maxHp,
          currentHp: maxHp,
          armorClass,
          actionUsed: false,
        },
        visibleStatKeys: [],
      });

      await refreshCombat(watchedCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create dummy character.");
    } finally {
      setCreatingDummy(false);
    }
  };

  const handleDummyUseAction = async (npcId: string, currentState: { actionUsed: boolean }) => {
    if (!watchedCode) return;
    try {
      setError(null);
      await updateCombatNpcDummyState(watchedCode, npcId, {
        actionUsed: !currentState.actionUsed,
      });
      await refreshCombat(watchedCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update dummy action state.");
    }
  };

  const handleDummyHeal = async (
    npcId: string,
    amount = 5,
    currentState: { maxHp: number; currentHp: number }
  ) => {
    if (!watchedCode) return;
    try {
      setError(null);
      await updateCombatNpcDummyState(watchedCode, npcId, {
        currentHp: Math.min(currentState.maxHp, currentState.currentHp + amount),
      });
      await refreshCombat(watchedCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to heal dummy.");
    }
  };

  const handleDummyEndTurn = async (npcId: string) => {
    if (!watchedCode) return;
    const battleId = combatState?.participantBattleById?.[npcId];
    if (!battleId) return;
    setAdvancingTurn(true);
    try {
      await endPartyTurnForBattle(watchedCode, battleId, true);
      await refreshCombat(watchedCode);
    } finally {
      setAdvancingTurn(false);
    }
  };

  const handleUpdateNpcDummyState = async (npcId: string, patch: Partial<CombatNpcDummyState>) => {
    if (!watchedCode) return;
    setUpdatingNpcDummyStateId(npcId);
    try {
      setError(null);
      await updateCombatNpcDummyState(watchedCode, npcId, patch);
      await refreshCombat(watchedCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update NPC state.");
    } finally {
      setUpdatingNpcDummyStateId(null);
    }
  };

  const handleInitNpcDummyState = async (npc: CombatNpc) => {
    if (!watchedCode || npc.dummyState) return;
    let initialState: ReturnType<typeof buildBaseNpcState>;
    if (npc.sourceType === "monster") {
      const monster = compendiumMonsters.find((m) => (isCustomMonster(m) ? m.id : m.slug) === npc.sourceId);
      initialState = monster ? buildDummyStateFromMonster(monster) : buildBaseNpcState(20, 12);
    } else if (npc.sourceType === "dm-npc") {
      const dmNpc = savedDmNpcs.find((n) => n.id === npc.sourceId);
      initialState = dmNpc ? buildDummyStateFromDmNpc(dmNpc) : buildBaseNpcState(20, 12);
    } else if (npc.sourceType === "character") {
      const char = savedCharacters.find((c) => c.id === npc.sourceId);
      initialState = char ? buildDummyStateFromCharacter(char) : buildBaseNpcState(20, 12);
    } else {
      initialState = buildBaseNpcState(npc.coreStats.constitution ?? 20, 12);
    }
    await handleUpdateNpcDummyState(npc.id, initialState);
  };

  const handleUpdateNpcGear = async (npcId: string, gear: CombatNpcGearItem[]) => {
    if (!watchedCode) return;
    try {
      setError(null);
      await updateCombatNpcGear(watchedCode, npcId, { gear });
      await refreshCombat(watchedCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update NPC gear.");
    }
  };

  const handleAddNpcToCombat = useCallback(async (
    payload: { name: string; sourceType: "dm-npc" | "character" | "manual" | "monster"; sourceId?: string; key: string; coreStats: CombatNpcCoreStats; battleId?: string }
  ) => {
    if (!watchedCode) {
      setError("Join a party before adding battle NPCs.");
      return;
    }
    try {
      setError(null);
      const disposition = pendingNpcDisposition[payload.key] ?? getDefaultDispositionForKey(payload.key);
      await addCombatNpc(watchedCode, {
        name: payload.name.trim() || "Unnamed NPC",
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        disposition,
        initiativeTotal: payload.coreStats.initiativeBonus,
        battleId: payload.battleId,
        coreStats: payload.coreStats,
        visibleStatKeys: [],
      });
      await refreshCombat(watchedCode);
      if (payload.sourceType === "monster") {
        showStatusPill(`Monster added: ${payload.name.trim() || "Unnamed Monster"}`, "positive");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add NPC to battle.");
    }
  }, [pendingNpcDisposition, refreshCombat, showStatusPill, watchedCode]);

  /**
   * Import all monsters staged in the encounter handoff from dm-monsters screen.
   * Called when user confirms they want to add the staged monsters to a specific battle.
   */
  const handleImportHandoffMonsters = useCallback(async () => {
    if (!encounterHandoffContext || encounterHandoffContext.selectedMonsters.length === 0 || !watchedCode) return;

    // Verify that the target encounter still exists (if known), otherwise user must select one
    let targetBattleId = encounterHandoffContext.targetBattleId;
    if (!targetBattleId) {
      // Ask user to pick a battle before importing
      Alert.alert("Select Encounter", "Please choose an encounter to add these monsters to.", [
        { text: "OK" },
      ]);
      return;
    }

    // Validate battle still exists; if not, ask user to pick a new one
    const validBattleIds = new Set(
      Object.values(combatState?.participantBattleById ?? {}).filter(
        (bid) => bid && bid !== "no-battle"
      )
    );

    if (!validBattleIds.has(targetBattleId)) {
      Alert.alert("Encounter Not Found", "The selected encounter no longer exists. Please choose a different one.", [
        { text: "OK" },
      ]);
      setShowHandoffContinuationBanner(false);
      clearEncounterSetupHandoff();
      return;
    }

    // Load compendium to get monster stats for lookup
    let monsterLookup: Record<string, CompendiumMonster | undefined> = {};
    try {
      const compendium = await getCompendium();
      monsterLookup = Object.fromEntries(
        compendium.map((m) => [isCustomMonster(m) ? m.id : m.slug, m])
      );
    } catch {
      // If compendium load fails, proceed with fallback stats (will be less accurate)
    }

    // Helper to get core stats from monster or use fallback
    const getCoreStatsForMonster = (monsterId: string, fallback: CombatNpcCoreStats): CombatNpcCoreStats => {
      const monster = monsterLookup[monsterId];
      if (!monster) return fallback;

      const abilityModifier = (score: number) => Math.floor((score - 10) / 2);
      return {
        speed: typeof monster.speed === "number" ? monster.speed : parseInt((monster.speed as string) || "30", 10),
        initiativeBonus: abilityModifier(parseInt((monster.dexterity as unknown as string) || "10", 10)),
        strength: parseInt((monster.strength as unknown as string) || "10", 10),
        dexterity: parseInt((monster.dexterity as unknown as string) || "10", 10),
        constitution: parseInt((monster.constitution as unknown as string) || "10", 10),
        intelligence: parseInt((monster.intelligence as unknown as string) || "10", 10),
        wisdom: parseInt((monster.wisdom as unknown as string) || "10", 10),
        charisma: parseInt((monster.charisma as unknown as string) || "10", 10),
      };
    };

    const fallbackCoreStats: CombatNpcCoreStats = {
      speed: 30,
      initiativeBonus: 0,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };

    // Import each staged monster
    try {
      setError(null);
      for (const stagedMonster of encounterHandoffContext.selectedMonsters) {
        for (let i = 0; i < stagedMonster.quantity; i += 1) {
          const copyName =
            stagedMonster.quantity > 1
              ? `${stagedMonster.customName || stagedMonster.monsterId} ${i + 1}`
              : stagedMonster.customName || stagedMonster.monsterId;

          await handleAddNpcToCombat({
            name: copyName,
            sourceType: "monster",
            sourceId: stagedMonster.monsterId,
            key: `handoff-${stagedMonster.monsterId}-${i}`,
            battleId: targetBattleId,
            coreStats: getCoreStatsForMonster(stagedMonster.monsterId, fallbackCoreStats),
          });
        }
      }

      // Success! Clear the handoff context
      setShowHandoffContinuationBanner(false);
      clearEncounterSetupHandoff();
      setEncounterHandoffContext(null);
      showStatusPill(
        `Added ${encounterHandoffContext.selectedMonsters.reduce((sum, m) => sum + m.quantity, 0)} monsters from setup`,
        "positive"
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to import monsters from setup.");
    }
  }, [encounterHandoffContext, watchedCode, combatState, handleAddNpcToCombat, showStatusPill]);

  /**
   * Discard the encounter handoff context (user explicitly cancels).
   */
  const handleDiscardHandoff = useCallback(() => {
    clearEncounterSetupHandoff();
    setEncounterHandoffContext(null);
    setShowHandoffContinuationBanner(false);
  }, []);

  const handleRemoveCombatNpc = async (npcId: string) => {
    if (!watchedCode) return;
    try {
      setError(null);
      await removeCombatNpc(watchedCode, npcId);
      await refreshCombat(watchedCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove NPC from battle.");
    }
  };

  const [endingEncounterId, setEndingEncounterId] = useState<string | null>(null);

  const handleEndEncounter = async (battleId: string) => {
    if (!watchedCode) return;
    setEndingEncounterId(battleId);
    try {
      setError(null);
      await endEncounter(watchedCode, battleId);
      setSelectedNpcIdsForEncounter([]);
      await refreshCombat(watchedCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to end encounter.");
    } finally {
      setEndingEncounterId(null);
    }
  };

  const handleAddToEncounter = async (battleId: string) => {
    if (!watchedCode) return;
    const npcIdsToAdd = selectedNpcIdsForEncounter.filter(
      (id) => !combatState?.participantBattleById?.[id]
    );
    const memberIdsToAdd = turnSelectedTargets.filter(
      (id) => !combatState?.participantBattleById?.[id]
    );
    if (npcIdsToAdd.length === 0 && memberIdsToAdd.length === 0) return;
    setAddingToEncounter(true);
    try {
      setError(null);
      await addToEncounter(watchedCode, battleId, memberIdsToAdd, npcIdsToAdd);
      if (memberIdsToAdd.length > 0) {
        await createPartyRollRequest(watchedCode, {
          statKey: "initiative",
          label: "Initiative",
          targetMemberIds: memberIdsToAdd,
          battleId,
        });
      }
      await refreshCombat(watchedCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add to encounter.");
    } finally {
      setAddingToEncounter(false);
    }
  };

  const handleRollNpcInitiative = async (npcId: string, manualRoll?: number) => {
    if (!watchedCode) return;
    const npc = combatState?.combatNpcs.find((n) => n.id === npcId);
    if (!npc) return;
    const sourceRoll = manualRoll ?? Math.floor(Math.random() * 20) + 1;
    const roll = Math.max(1, Math.min(20, Math.floor(sourceRoll)));
    const bonus = npc.coreStats.initiativeBonus ?? 0;
    setRollingNpcInitiativeId(npcId);
    try {
      setError(null);
      await rollNpcInitiative(watchedCode, npcId, roll, bonus);
      setNpcInitiativeInputById((prev) => ({ ...prev, [npcId]: "" }));
      await refreshCombat(watchedCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to roll NPC initiative.");
    } finally {
      setRollingNpcInitiativeId(null);
    }
  };

  const handleToggleNpcVisibleStat = async (npcId: string, statKey: CombatNpcStatKey) => {
    if (!watchedCode || !combatState) return;
    const npc = combatState.combatNpcs.find((entry) => entry.id === npcId);
    if (!npc) return;

    const currentlyVisible = npc.visibleStatKeys ?? [];
    const next = currentlyVisible.includes(statKey)
      ? currentlyVisible.filter((key) => key !== statKey)
      : [...currentlyVisible, statKey];

    try {
      setError(null);
      await updateCombatNpcVisibleStats(watchedCode, npcId, { visibleStatKeys: next });
      await refreshCombat(watchedCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update NPC stat visibility.");
    }
  };

  const handleResolveRestRequest = async (requestId: string, status: "approved" | "denied") => {
    if (!watchedCode) return;
    setResolvingRestRequestId(requestId);
    try {
      setError(null);
      await resolvePartyRestRequest(watchedCode, requestId, { status, resolvedBy: "dm" });
      await refreshCombat(watchedCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resolve rest request.");
    } finally {
      setResolvingRestRequestId(null);
    }
  };

  const handlePromptRoll = async () => {
    if (!watchedCode || turnSelectedTargets.length === 0 || !selectedStat) return;
    setSendingRollPrompt(true);
    try {
      setError(null);
      const label = formatRollLabel(selectedStat);
      await createPartyRollRequest(watchedCode, {
        statKey: selectedStat,
        label,
        targetMemberIds: turnSelectedTargets,
        battleId: resolveBattleIdForTab("turn"),
      });
      await refreshCombat(watchedCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create roll prompt.");
    } finally {
      setSendingRollPrompt(false);
    }
  };

  const parseLootImport = useCallback((raw: string): LootAssignmentItem[] => {
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^[-*•]\s+/, ""))
      .filter(Boolean)
      .map((line) => {
        let name = line;
        let quantity = 1;
        let category: LootAssignmentItem["category"] = "other";

        const categoryMatch = line.match(/^([a-zA-Z][a-zA-Z_\-\s]*)\s*:\s*(.+)$/);
        if (categoryMatch) {
          const maybeCategory = normalizeLootCategory(categoryMatch[1]);
          if (maybeCategory) {
            category = maybeCategory;
            name = categoryMatch[2].trim();
          }
        }

        const qtyPrefix = name.match(/^(\d+)\s*[xX]?\s+(.+)$/);
        if (qtyPrefix) {
          quantity = Math.max(1, Number.parseInt(qtyPrefix[1], 10) || 1);
          name = qtyPrefix[2].trim();
        } else {
          const qtySuffix = name.match(/^(.+?)\s+[xX](\d+)$/);
          if (qtySuffix) {
            name = qtySuffix[1].trim();
            quantity = Math.max(1, Number.parseInt(qtySuffix[2], 10) || 1);
          }
        }

        return {
          name,
          quantity,
          category,
        };
      })
      .filter((item) => item.name.length > 0);
  }, []);

  const getDefaultLootTargetId = useCallback(() => {
    return lootSelectedTargets[0] ?? members[0]?.id ?? null;
  }, [lootSelectedTargets, members]);

  const buildLootDraftItems = useCallback((items: DmLootDraftFields[]) => {
    const fallbackTargetId = getDefaultLootTargetId();
    return items.map<LootDraftItem>((item) => ({
      ...createDmLootDraft(item),
      rarity: normalizeLootRarity(item.rarity),
      draftId: createLootDraftId(),
      targetMemberId: lootAssignmentMode === "by-player" ? fallbackTargetId : null,
    }));
  }, [getDefaultLootTargetId, lootAssignmentMode]);

  const updateLootDraftItem = useCallback((draftId: string, updates: Partial<LootDraftItem>) => {
    setLootDraftItems((prev) => prev.map((item) => item.draftId === draftId
      ? { ...item, ...updates, reviewAcknowledged: Object.keys(updates).some(key => !["reviewAcknowledged", "targetMemberId", "quantity"].includes(key)) ? false : updates.reviewAcknowledged ?? item.reviewAcknowledged }
      : item));
  }, []);

  const addBlankLootDraftItem = useCallback(() => {
    setLootDraftItems((prev) => ([
      ...prev,
      {
        draftId: createLootDraftId(),
        name: "",
        quantity: 1,
        category: "other",
        notes: "",
        value: undefined,
        rarity: undefined,
        subtype: "",
        tags: [],
        properties: "",
        description: "",
        mapImageUri: "",
        attackAbility: undefined,
        isProficient: undefined,
        damageDice: "",
        damageType: "",
        weaponRange: "",
        targetMemberId: lootAssignmentMode === "by-player" ? getDefaultLootTargetId() : null,
      },
    ]));
  }, [getDefaultLootTargetId, lootAssignmentMode]);

  const removeLootDraftItem = useCallback((draftId: string) => {
    setLootDraftItems((prev) => prev.filter((item) => item.draftId !== draftId));
  }, []);

  const duplicateLootDraftItem = useCallback((draftId: string) => {
    setLootDraftItems((prev) => {
      const index = prev.findIndex((item) => item.draftId === draftId);
      if (index < 0) return prev;
      const source = prev[index];
      const clone: LootDraftItem = {
        ...source,
        draftId: createLootDraftId(),
      };
      const next = [...prev];
      next.splice(index + 1, 0, clone);
      return next;
    });
  }, []);

  const toggleLootDraftTag = useCallback((draftId: string, tag: string) => {
    setLootDraftItems((prev) => prev.map((item) => {
      if (item.draftId !== draftId) return item;
      const currentTags = item.tags ?? [];
      const nextTags = currentTags.includes(tag)
        ? currentTags.filter((value) => value !== tag)
        : [...currentTags, tag];
      return { ...item, tags: nextTags, reviewAcknowledged: false };
    }));
  }, []);

  const handlePickLootDraftMapImage = useCallback(async (draftId: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to attach a map image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const mimeType = asset.mimeType && asset.mimeType.startsWith("image/") ? asset.mimeType : "image/jpeg";
      if (asset.base64 && asset.base64.length > 0) {
        updateLootDraftItem(draftId, { mapImageUri: `data:${mimeType};base64,${asset.base64}` });
        return;
      }

      if (asset.uri && isPortableMapImageUri(asset.uri)) {
        updateLootDraftItem(draftId, { mapImageUri: asset.uri });
        return;
      }

      if (asset.uri) {
        try {
          if (Platform.OS === "web") {
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (typeof reader.result === "string" && reader.result.length > 0) {
                  resolve(reader.result);
                } else {
                  reject(new Error("Image conversion failed"));
                }
              };
              reader.onerror = () => reject(new Error("Image conversion failed"));
              reader.readAsDataURL(blob);
            });
            updateLootDraftItem(draftId, { mapImageUri: dataUrl });
            return;
          }

          const encoded = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (encoded && encoded.length > 0) {
            updateLootDraftItem(draftId, { mapImageUri: `data:${mimeType};base64,${encoded}` });
            return;
          }
        } catch {
          // falls through to alert below
        }
      }

      Alert.alert("Image unavailable", "Could not convert this image to a shareable format. Please try another image or use a public URL.");
    }
  }, [updateLootDraftItem]);

  const getLootDistributionPool = useCallback(() => {
    const preferred = lootSelectedTargets.filter((id) => members.some((member) => member.id === id));
    if (preferred.length > 0) return preferred;
    return members.map((member) => member.id);
  }, [lootSelectedTargets, members]);

  const applyRoundRobinLootTargets = useCallback(() => {
    const pool = getLootDistributionPool();
    if (pool.length === 0) {
      setError("No available players to distribute loot.");
      return;
    }

    setLootAssignmentMode("by-player");
    setLootDraftItems((prev) => prev.map((item, idx) => ({
      ...item,
      targetMemberId: pool[idx % pool.length],
    })));
    setError(null);
  }, [getLootDistributionPool]);

  const applyEvenSplitLootTargets = useCallback(() => {
    const pool = getLootDistributionPool();
    if (pool.length === 0) {
      setError("No available players to distribute loot.");
      return;
    }

    const counts = new Map(pool.map((memberId) => [memberId, 0]));

    setLootAssignmentMode("by-player");
    setLootDraftItems((prev) => prev.map((item) => {
      const sorted = [...pool].sort((a, b) => {
        const diff = (counts.get(a) ?? 0) - (counts.get(b) ?? 0);
        return diff !== 0 ? diff : a.localeCompare(b);
      });
      const nextTarget = sorted[0];
      counts.set(nextTarget, (counts.get(nextTarget) ?? 0) + 1);
      return {
        ...item,
        targetMemberId: nextTarget,
      };
    }));
    setError(null);
  }, [getLootDistributionPool]);

  const prepareLootItemsFromText = useCallback(() => {
    const source = lootImportText.trim();
    if (!source) {
      setLootDraftItems([]);
      setError("Paste loot lines first to prepare assignments.");
      return;
    }

    const items = parseLootImport(lootImportText);
    if (items.length === 0) {
      setLootDraftItems([]);
      setError("No valid loot lines found. Example: map: 1x Old Mine Blueprint");
      return;
    }

    setLootDraftItems(buildLootDraftItems(items));
    setLootImportText(items.map((item) => `${item.category}: ${item.quantity}x ${item.name}`).join("\n"));
    setError(null);
  }, [buildLootDraftItems, parseLootImport, lootImportText]);

  const toggleLootRarity = useCallback((rarity: string) => {
    setLootPromptRarity((prev) => prev.includes(rarity) ? prev.filter((r) => r !== rarity) : [...prev, rarity]);
  }, []);

  const toggleLootType = useCallback((type: LootAssignmentItem["category"]) => {
    setLootPromptTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  }, []);

  const handleGenerateLootFromPrompt = useCallback(async () => {
    if (!lootPromptText.trim()) {
      setError("Enter a prompt before generating loot.");
      return;
    }

    setGeneratingLoot(true);
    try {
      setError(null);
      const resp = await fetch(`${API_BASE_URL}/api/ai/generate-loot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: lootPromptText.trim(),
          rarity: lootPromptRarity,
          categories: lootPromptTypes,
        }),
      });

      const parsed = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const message = (parsed as { error?: string }).error ?? `Failed to generate loot (${resp.status})`;
        throw new Error(message);
      }

      if (!Array.isArray(parsed.proposedItems)) throw new Error("AI returned an invalid loot list.");
      const aiItems: DmLootDraftFields[] = parsed.proposedItems.map((raw: unknown) => {
        const draft = dmLootDraftFromProposal(raw);
        const rarity = draft.tags?.map(normalizeLootRarity).find((value): value is LootRarity => Boolean(value));
        return { ...draft, rarity, tags: draft.tags?.filter(tag => !normalizeLootRarity(tag)) };
      });

      if (aiItems.length === 0) {
        setError("AI did not return any usable loot items for that prompt.");
        return;
      }

      setLootDraftItems(buildLootDraftItems(aiItems));
      setLootImportText(aiItems.map((item) => `${item.category}: ${item.quantity}x ${item.name}`).join("\n"));
      setLootPromptRarity([]);
      setLootPromptTypes([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate loot from prompt.");
    } finally {
      setGeneratingLoot(false);
    }
  }, [buildLootDraftItems, lootPromptText, lootPromptRarity, lootPromptTypes]);

  const handleAssignLootDraft = useCallback(async () => {
    if (!watchedCode) {
      setError("Join a party before assigning loot.");
      return;
    }
    if (lootDraftItems.length === 0) {
      setError("Import or add loot rows before assigning.");
      return;
    }

    let normalizedItems: Array<{ draftId: string; targetMemberId: string | null; assignment: LootAssignmentItem }>;
    try {
      normalizedItems = lootDraftItems.map(item => ({ draftId: item.draftId, targetMemberId: item.targetMemberId, assignment: toDmLootAssignment(item) }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid loot draft.");
      return;
    }

    if (normalizedItems.length === 0) {
      setError("Each loot row needs an item name before assigning.");
      return;
    }

    if (lootAssignmentMode === "selected-players" && lootSelectedTargets.length === 0) {
      setError("Select at least one player target for shared loot.");
      return;
    }

    if (lootAssignmentMode === "by-player" && normalizedItems.some((item) => !item.targetMemberId)) {
      setError("Choose a player target for every loot row before assigning.");
      return;
    }

    setAssigningLoot(true);
    try {
      setError(null);
      if (lootAssignmentMode === "selected-players") {
        await createPartyLootAssignments(watchedCode, {
          targetMemberIds: lootSelectedTargets,
          items: normalizedItems.map(item => item.assignment),
          assignedBy: "dm",
        });
      } else {
        const grouped = new Map<string, LootAssignmentItem[]>();
        normalizedItems.forEach(({ targetMemberId, assignment }) => {
          if (!targetMemberId) return;
          if (!grouped.has(targetMemberId)) grouped.set(targetMemberId, []);
          grouped.get(targetMemberId)!.push(assignment);
        });

        await Promise.all(
          [...grouped.entries()].map(([targetMemberId, items]) =>
            createPartyLootAssignments(watchedCode, {
              targetMemberIds: [targetMemberId],
              items,
              assignedBy: "dm",
            })
          )
        );
      }

      setLootImportText("");
      setLootDraftItems([]);
      await refreshCombat(watchedCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to assign loot.");
    } finally {
      setAssigningLoot(false);
    }
  }, [watchedCode, lootDraftItems, lootAssignmentMode, lootSelectedTargets, refreshCombat]);

  const lootDraftPreview = React.useMemo(() => {
    if (lootDraftItems.length === 0) return [] as Array<{ targetMemberId: string; targetName: string; items: LootDraftItem[] }>;

    if (lootAssignmentMode === "selected-players") {
      return lootSelectedTargets
        .map((targetMemberId) => {
          const targetName = members.find((member) => member.id === targetMemberId)?.characterName;
          if (!targetName) return null;
          return {
            targetMemberId,
            targetName,
            items: lootDraftItems,
          };
        })
        .filter((entry): entry is { targetMemberId: string; targetName: string; items: LootDraftItem[] } => entry !== null);
    }

    const grouped = new Map<string, LootDraftItem[]>();
    lootDraftItems.forEach((item) => {
      if (!item.targetMemberId) return;
      if (!grouped.has(item.targetMemberId)) grouped.set(item.targetMemberId, []);
      grouped.get(item.targetMemberId)!.push(item);
    });

    return [...grouped.entries()].map(([targetMemberId, items]) => ({
      targetMemberId,
      targetName: members.find((member) => member.id === targetMemberId)?.characterName ?? "Unknown",
      items,
    }));
  }, [lootDraftItems, lootAssignmentMode, lootSelectedTargets, members]);

  const lootDraftValidation = React.useMemo(() => {
    return Object.fromEntries(
      lootDraftItems.map((item) => [
        item.draftId,
        {
          missingName: item.name.trim().length === 0,
          missingTarget: lootAssignmentMode === "by-player" && !item.targetMemberId,
          unreviewed: !!item.needsReview && !item.reviewAcknowledged,
        },
      ])
    ) as Record<string, { missingName: boolean; missingTarget: boolean; unreviewed: boolean }>;
  }, [lootDraftItems, lootAssignmentMode]);

  const hasLootDraftValidationIssues = React.useMemo(() => {
    return Object.values(lootDraftValidation).some((entry) => entry.missingName || entry.missingTarget || entry.unreviewed);
  }, [lootDraftValidation]);

  const handleSendQuestNotes = useCallback(async () => {
    if (!watchedCode) {
      setError("Join a party before sending notes.");
      return;
    }
    if (notesSelectedTargets.length === 0) {
      setError("Select at least one target player.");
      return;
    }

    // Re-read saved DM state so editor changes cannot send a stale quest status.
    const currentDmNotesPayload = await getDmNotesPayload();
    setDmNotesPayload(currentDmNotesPayload);
    const selectedQuests = currentDmNotesPayload.quests.filter((q) => selectedQuestIds.includes(q.id));
    const selectedNotes = currentDmNotesPayload.notes.filter((note) => selectedNoteIds.includes(note.id));
    if (selectedQuests.length === 0 && selectedNotes.length === 0) {
      setError("Select at least one quest or journal note from DM Notes.");
      return;
    }

    const selectedQuestIdSet = new Set(selectedQuests.map((q) => q.id));
    const selectedLocationIdSet = new Set(selectedQuests.flatMap((q) => q.locationTags || []));
    const linkedLocations = (() => {
      if (!includeRelatedLocations) return [] as CampaignLocation[];

      const locationById = new Map(currentDmNotesPayload.locations.map((location) => [location.id, location] as const));
      const includeLocationIds = new Set<string>();

      selectedLocationIdSet.forEach((locationId) => {
        let cursor = locationById.get(locationId);
        const seen = new Set<string>();
        while (cursor && !seen.has(cursor.id)) {
          seen.add(cursor.id);
          includeLocationIds.add(cursor.id);
          const parentId = cursor.parentLocationId;
          cursor = parentId ? locationById.get(parentId) : undefined;
        }
      });

      return currentDmNotesPayload.locations.filter((location) => includeLocationIds.has(location.id));
    })();
    const linkedPeople = includeRelatedPeople
      ? currentDmNotesPayload.people.filter((p) => (p.questTags || []).some((id) => selectedQuestIdSet.has(id)))
      : [];

    setSendingNotes(true);
    try {
      setError(null);
      await createPartyNoteAssignments(watchedCode, {
        targetMemberIds: notesSelectedTargets,
        payload: {
          notes: selectedNotes,
          quests: selectedQuests,
          people: linkedPeople,
          locations: linkedLocations,
        },
        assignedBy: "dm",
      });
      await refreshCombat(watchedCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send notes.");
    } finally {
      setSendingNotes(false);
    }
  }, [watchedCode, notesSelectedTargets, selectedQuestIds, selectedNoteIds, includeRelatedPeople, includeRelatedLocations, refreshCombat]);

  const handleAdvanceTurn = async () => {
    if (!watchedCode) return;
    setAdvancingTurn(true);
    try {
      await endPartyTurnForBattle(watchedCode, resolveBattleIdForTab("turn"), true);
      await refreshCombat(watchedCode);
    } finally {
      setAdvancingTurn(false);
    }
  };

  const handleRemoveMember = (member: PartyMemberSummary) => {
    if (!watchedCode) return;

    const performRemove = async () => {
      setRemovingMemberId(member.id);
      try {
        await removePartyMember(member.id, watchedCode);
        const result = await fetchMembers(watchedCode);
        setMembers(result);
        await refreshCombat(watchedCode);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to remove player.";
        if (Platform.OS === "web") window.alert(message);
        else Alert.alert("Unable to remove player", message);
      } finally {
        setRemovingMemberId(null);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined"
        ? window.confirm(`Remove ${member.characterName} from this party?`)
        : true;
      if (confirmed) {
        void performRemove();
      }
      return;
    }

    Alert.alert(
      "Remove Player",
      `Remove ${member.characterName} from this party?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void performRemove() },
      ]
    );
  };

  const handleDisconnect = () => {
    const doDisconnect = async () => {
      stopPolling();
      codeRef.current = null;
      setWatchedCode(null);
      setMembers([]);
      setLastUpdated(null);
      await AsyncStorage.removeItem(DM_WATCH_KEY);
      await refreshActiveSessions();
    };

    if (Platform.OS === "web") {
      doDisconnect();
      return;
    }

    Alert.alert("Stop Watching", "Disconnect from party observation?", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: doDisconnect },
    ]);
  };

  const handleEndParty = () => {
    if (!watchedCode) return;

    const doEndParty = async () => {
      const code = watchedCode;
      try {
        await disbandParty(code);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to end party.";
        if (Platform.OS === "web") window.alert(message);
        else Alert.alert("Unable to end party", message);
        return;
      }
      stopPolling();
      codeRef.current = null;
      setWatchedCode(null);
      setMembers([]);
      setLastUpdated(null);
      await AsyncStorage.removeItem(DM_WATCH_KEY);
      await removeWatchHistoryEntry(code);
      await refreshActiveSessions();
    };

    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined"
        ? window.confirm("Disband the party? All members will be removed.")
        : true;
      if (confirmed) void doEndParty();
      return;
    }

    Alert.alert(
      "End Party",
      "Disband the entire party? All members will be removed and you will be disconnected.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "End Party", style: "destructive", onPress: () => void doEndParty() },
      ]
    );
  };

  const handleRefresh = async () => {
    if (!codeRef.current) return;
    setRefreshing(true);
    try {
      const result = await fetchMembers(codeRef.current);
      setMembers(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenMemberSheet = (targetMemberId: string) => {
    router.push(buildPartyMemberSheetPath(targetMemberId, "dm-party") as any);
  };

  // ── Loading restore ──────────────────────────────────────────────────────────

  if (isRestoring) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={c.primary} />
      </SafeAreaView>
    );
  }

  // ── Watching state ───────────────────────────────────────────────────────────

  if (watchedCode) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["bottom"]}>
        <ScrollHintScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.primary} />
          }
        >
          {/* Party header */}
          <View style={[styles.partyHeader, { backgroundColor: headerCardColor, borderColor: headerBorderColor }]}> 
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <View style={[styles.dmBadge, { backgroundColor: headerPrimaryColor + "22", borderColor: headerPrimaryColor + "55" }]}>
                  <Feather name="eye" size={10} color={headerPrimaryColor} />
                  <Text style={{ fontSize: 9, color: headerPrimaryColor, fontWeight: "800", letterSpacing: 0.5 }}>DM VIEW</Text>
                </View>
                <Text style={{ fontSize: 11, color: headerMutedColor, fontWeight: "600", letterSpacing: 1 }}>PARTY CODE</Text>
              </View>
              <Text style={{ fontSize: 28, fontWeight: "900", color: headerPrimaryColor, letterSpacing: 2 }}>{watchedCode}</Text>
              <Text style={{ fontSize: 12, color: headerMutedColor }}>
                {members.length} member{members.length !== 1 ? "s" : ""}
                {lastUpdated ? ` · updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                {" · "}auto-refreshes every 3s
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={handleEndParty} style={[styles.disconnectBtn, { borderColor: "#ef4444" + "88", backgroundColor: "#ef444422" }]}>
                <Feather name="user-x" size={14} color="#ef4444" />
                <Text style={{ fontSize: 13, color: "#ef4444", fontWeight: "700" }}>End Party</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDisconnect} style={[styles.disconnectBtn, { borderColor: "#f87171" + "55" }]}>
                <Feather name="wifi-off" size={14} color="#f87171" />
                <Text style={{ fontSize: 13, color: "#f87171", fontWeight: "700" }}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border, gap: 10 }]}>
            <TouchableOpacity
              onPress={() => setIsTurnRollControlsCollapsed((prev) => !prev)}
              activeOpacity={0.8}
              style={{ gap: 4 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: c.foreground }}>DM Turn & Roll Controls</Text>
                <Feather name={isTurnRollControlsCollapsed ? "chevron-down" : "chevron-up"} size={16} color={c.mutedForeground} />
              </View>
              <Text style={{ fontSize: 12, color: c.mutedForeground }}>
                Current turn: <Text style={{ color: c.foreground, fontWeight: "700" }}>
                  {turnPreviewTurnId === combatState?.environmentTurnId
                    ? "Environment"
                    : members.find((m) => m.id === turnPreviewTurnId)?.characterName
                      ?? combatState?.combatNpcs?.find((npc) => npc.id === turnPreviewTurnId)?.name
                      ?? "-"}
                </Text>
              </Text>
            </TouchableOpacity>

            {!isTurnRollControlsCollapsed && (
            <>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => setActiveControlTab("turn")}
                style={[
                  styles.controlTab,
                  {
                    borderColor: activeControlTab === "turn" ? c.primary : c.border,
                    backgroundColor: activeControlTab === "turn" ? c.primary + "22" : c.background,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: activeControlTab === "turn" ? c.primary : c.mutedForeground }}>
                  Turn & Rolls
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveControlTab("npcs")}
                style={[
                  styles.controlTab,
                  {
                    borderColor: activeControlTab === "npcs" ? c.primary : c.border,
                    backgroundColor: activeControlTab === "npcs" ? c.primary + "22" : c.background,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: activeControlTab === "npcs" ? c.primary : c.mutedForeground }}>
                  Battle NPCs
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveControlTab("loot")}
                style={[
                  styles.controlTab,
                  {
                    borderColor: activeControlTab === "loot" ? c.primary : c.border,
                    backgroundColor: activeControlTab === "loot" ? c.primary + "22" : c.background,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: activeControlTab === "loot" ? c.primary : c.mutedForeground }}>
                  Loot Import
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveControlTab("dummies")}
                style={[
                  styles.controlTab,
                  {
                    borderColor: activeControlTab === "dummies" ? c.primary : c.border,
                    backgroundColor: activeControlTab === "dummies" ? c.primary + "22" : c.background,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: activeControlTab === "dummies" ? c.primary : c.mutedForeground }}>
                  Dummies
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveControlTab("notes")}
                style={[
                  styles.controlTab,
                  {
                    borderColor: activeControlTab === "notes" ? c.primary : c.border,
                    backgroundColor: activeControlTab === "notes" ? c.primary + "22" : c.background,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: activeControlTab === "notes" ? c.primary : c.mutedForeground }}>
                  Notes
                </Text>
              </TouchableOpacity>
            </View>

            {activeControlTab === "turn" && displayedTurnOrder.length > 0 && (
              <View style={[styles.orderStrip, { borderColor: c.border, backgroundColor: c.background }]}>
                <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700", marginBottom: 4 }}>{turnOrderLabel}</Text>
                <Text style={{ fontSize: 11, color: c.foreground, lineHeight: 16 }}>
                  {displayedTurnOrder
                    .map((id) => (
                      id === combatState?.environmentTurnId
                        ? "Environment"
                        : members.find((m) => m.id === id)?.characterName
                          ?? combatState?.combatNpcs?.find((npc) => npc.id === id)?.name
                          ?? "Unknown"
                    ))
                    .join("  >  ")}
                </Text>
              </View>
            )}

            {activeControlTab === "turn" && (
            <View style={[styles.controlGroup, { borderColor: c.border, backgroundColor: c.background }]}> 
              <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>TURN FLOW</Text>

              {encounterControlOptions.length > 1 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>ENCOUNTER PRESET</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => selectEncounterControl("manual")}
                      style={[
                        styles.chip,
                        {
                          borderColor: selectedEncounterControlId === "manual" ? c.primary : c.border,
                          backgroundColor: selectedEncounterControlId === "manual" ? c.primary + "22" : c.background,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, color: selectedEncounterControlId === "manual" ? c.primary : c.mutedForeground, fontWeight: "700" }}>
                        Manual Selection
                      </Text>
                    </TouchableOpacity>
                    {encounterControlOptions.map((group) => (
                      <TouchableOpacity
                        key={group.battleId}
                        onPress={() => selectEncounterControl(group.battleId)}
                        style={[
                          styles.chip,
                          {
                            borderColor: selectedEncounterControlId === group.battleId ? c.primary : c.border,
                            backgroundColor: selectedEncounterControlId === group.battleId ? c.primary + "22" : c.background,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 11, color: selectedEncounterControlId === group.battleId ? c.primary : c.mutedForeground, fontWeight: "700" }}>
                          {group.controlLabel} ({group.members.length})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>
                  TARGETS ({selectedTargets.length}/{members.length}) SELECTED
                </Text>
                <TouchableOpacity onPress={selectAllTargets}>
                  <Text style={{ fontSize: 12, color: c.primary, fontWeight: "700" }}>Select All</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {members.map((member) => {
                  const selected = selectedTargets.includes(member.id);
                  return (
                    <TouchableOpacity
                      key={member.id}
                      onPress={() => toggleTarget(member.id)}
                      style={[
                        styles.chip,
                        {
                          borderRadius: 8,
                          borderColor: selected ? c.primary : c.border,
                          backgroundColor: selected ? c.primary + "22" : c.background,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, color: selected ? c.primary : c.mutedForeground, fontWeight: "700" }}>{member.characterName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {availableEncounterNpcs.length > 0 && (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>
                      NPCS / MONSTERS ({selectedNpcIdsForEncounter.length}/{availableEncounterNpcs.length}) SELECTED
                    </Text>
                    <TouchableOpacity onPress={() => {
                      const allIds = availableEncounterNpcs.map((n) => n.id);
                      setSelectedNpcIdsForEncounter((prev) => prev.length === allIds.length ? [] : allIds);
                    }}>
                      <Text style={{ fontSize: 12, color: c.primary, fontWeight: "700" }}>
                        {selectedNpcIdsForEncounter.length === availableEncounterNpcs.length ? "Deselect All" : "Select All"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {availableEncounterNpcs.map((npc) => {
                      const selected = selectedNpcIdsForEncounter.includes(npc.id);
                      const dispositionColors = getDispositionColors(npc.disposition);
                      return (
                        <TouchableOpacity
                          key={npc.id}
                          onPress={() => setSelectedNpcIdsForEncounter((prev) =>
                            prev.includes(npc.id) ? prev.filter((id) => id !== npc.id) : [...prev, npc.id]
                          )}
                          style={[
                            styles.chip,
                            {
                              borderRadius: 8,
                              borderColor: selected ? dispositionColors.border : c.border,
                              backgroundColor: selected ? dispositionColors.bg : c.background,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 5,
                            },
                          ]}
                        >
                          <Feather name="shield" size={10} color={selected ? dispositionColors.fg : c.mutedForeground} />
                          <Text style={{ fontSize: 11, color: selected ? dispositionColors.fg : c.mutedForeground, fontWeight: "700" }}>{npc.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {pendingRestRequests.length > 0 && (
                <View style={{ gap: 8, marginTop: 4 }}>
                  <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>
                    REST REQUESTS ({pendingRestRequests.length})
                  </Text>
                  {pendingRestRequests.map((request) => {
                    const requesterName = members.find((member) => member.id === request.requestedByMemberId)?.characterName ?? "A player";
                    const accent = request.restType === "short_rest" ? "#0EA5E9" : "#8B5CF6";
                    return (
                      <View key={request.id} style={[styles.errorBox, { borderColor: accent + "55", backgroundColor: accent + "11" }]}> 
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: "700", color: c.foreground }}>
                            {request.restType === "short_rest" ? "Short Rest" : "Long Rest"} Request
                          </Text>
                          <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                            {requesterName} requested this for {request.targetMemberIds.length} party member(s).
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          <TouchableOpacity
                            onPress={() => void handleResolveRestRequest(request.id, "denied")}
                            disabled={resolvingRestRequestId === request.id}
                            style={[styles.chip, { borderColor: "#ef444455", backgroundColor: "#ef444422" }]}
                          >
                            <Text style={{ fontSize: 11, color: "#ef4444", fontWeight: "700" }}>Deny</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => void handleResolveRestRequest(request.id, "approved")}
                            disabled={resolvingRestRequestId === request.id}
                            style={[styles.chip, { borderColor: accent + "55", backgroundColor: accent + "22" }]}
                          >
                            <Text style={{ fontSize: 11, color: accent, fontWeight: "700" }}>
                              {resolvingRestRequestId === request.id ? "..." : "Approve"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {(() => {
                // Determine if "Add to Encounter" mode is active:
                // The DM has selected an active encounter AND there are unassigned NPCs/members selected
                const activeBattleId = turnEncounterControlId !== "manual" && turnEncounterControlId !== "no-battle"
                  ? turnEncounterControlId
                  : null;
                const unassignedSelectedNpcIds = selectedNpcIdsForEncounter.filter(
                  (id) => !combatState?.participantBattleById?.[id]
                );
                const unassignedSelectedMemberIds = turnSelectedTargets.filter(
                  (id) => !combatState?.participantBattleById?.[id]
                );
                const canAddToEncounter = !!activeBattleId && (unassignedSelectedNpcIds.length > 0 || unassignedSelectedMemberIds.length > 0);
                const hasAnything = turnSelectedTargets.length > 0 || selectedNpcIdsForEncounter.length > 0 || availableEncounterNpcs.length > 0;
                const isDisabled = canAddToEncounter
                  ? (addingToEncounter || (unassignedSelectedNpcIds.length === 0 && unassignedSelectedMemberIds.length === 0))
                  : (startingInitiative || !hasAnything);

                return (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => canAddToEncounter ? void handleAddToEncounter(activeBattleId!) : void handleStartInitiative()}
                      disabled={isDisabled}
                      style={[
                        styles.btnPrimary,
                        styles.btnHalf,
                        { backgroundColor: c.primary, opacity: isDisabled ? 0.55 : 1 },
                      ]}
                    >
                      <Feather name={canAddToEncounter ? "user-plus" : "play-circle"} size={14} color="#fff" />
                      <Text style={styles.btnText}>
                        {canAddToEncounter
                          ? (addingToEncounter ? "Adding..." : "Add to Encounter")
                          : (startingInitiative ? "Starting..." : "Start Encounter")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleAdvanceTurn}
                      disabled={advancingTurn}
                      style={[styles.btnPrimary, styles.btnHalf, { backgroundColor: c.primary, opacity: advancingTurn ? 0.7 : 1 }]}
                    >
                      <Feather name="skip-forward" size={14} color="#fff" />
                      <Text style={styles.btnText}>{advancingTurn ? "Advancing..." : "Advance Turn"}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}

              <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>QUICK ROLLS</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {QUICK_ROLL_TYPES.map((stat) => (
                  <TouchableOpacity
                    key={stat}
                    onPress={() => setSelectedStat(stat)}
                    style={[
                      styles.chip,
                      {
                        borderColor: selectedStat === stat ? c.primary : c.border,
                        backgroundColor: selectedStat === stat ? c.primary + "22" : c.background,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11, color: selectedStat === stat ? c.primary : c.mutedForeground, fontWeight: "700" }}>
                      {formatRollLabel(stat)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => setShowAllRollTypes((v) => !v)}
                activeOpacity={0.75}
                style={{
                  paddingVertical: 6,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderTopWidth: 1,
                  borderTopColor: c.border,
                }}
              >
                <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>
                  ALL ROLL TYPES ({EXTRA_ROLL_TYPES.length})
                </Text>
                <Feather name={showAllRollTypes ? "chevron-up" : "chevron-down"} size={14} color={c.mutedForeground} />
              </TouchableOpacity>

              {showAllRollTypes && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {EXTRA_ROLL_TYPES.map((stat) => (
                    <TouchableOpacity
                      key={stat}
                      onPress={() => setSelectedStat(stat)}
                      style={[
                        styles.chip,
                        {
                          borderColor: selectedStat === stat ? c.primary : c.border,
                          backgroundColor: selectedStat === stat ? c.primary + "22" : c.background,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, color: selectedStat === stat ? c.primary : c.mutedForeground, fontWeight: "700" }}>
                        {formatRollLabel(stat)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity
                onPress={handlePromptRoll}
                disabled={sendingRollPrompt || selectedTargets.length === 0 || !selectedStat}
                style={[styles.btnPrimary, styles.btnFull, { backgroundColor: c.primary, opacity: sendingRollPrompt || selectedTargets.length === 0 || !selectedStat ? 0.6 : 1 }]}
              >
                <Feather name="send" size={14} color="#fff" />
                <Text style={styles.btnText}>{sendingRollPrompt ? "Prompting..." : selectedStat ? `Prompt ${formatRollLabel(selectedStat)}` : "Select a Roll Type"}</Text>
              </TouchableOpacity>
            </View>
            )}

            {activeControlTab === "npcs" && (
            <View style={[styles.controlGroup, { borderColor: c.border, backgroundColor: c.background }]}>
              {/* Handoff Continuation Banner */}
              {showHandoffContinuationBanner && encounterHandoffContext && (
                <View style={[styles.controlGroup, { borderColor: c.primary, backgroundColor: c.primary + "11", marginBottom: 12 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Feather name="arrow-right" size={14} color={c.primary} />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: c.primary, flex: 1 }}>
                      Continuing Monster Setup
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: c.foreground, marginBottom: 12, lineHeight: 16 }}>
                    {encounterHandoffContext.selectedMonsters.length} monster{encounterHandoffContext.selectedMonsters.length !== 1 ? "s" : ""} staged from DM Monsters. Select an encounter below and confirm to add them.
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.chip, { flex: 1, borderColor: c.primary, backgroundColor: c.primary + "22" }]}
                      onPress={handleImportHandoffMonsters}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: c.primary }}>Confirm & Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chip, { flex: 1, borderColor: c.border, backgroundColor: c.card }]}
                      onPress={handleDiscardHandoff}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground }}>Discard</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>BATTLE NPCS</Text>
              <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                Import created DM NPCs or saved characters as combat NPCs. Hostile = red, Passive = yellow, Friendly = green.
              </Text>

              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>PLACE IMPORTS IN ENCOUNTER</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedNpcImportEncounterId("manual")}
                    style={[
                      styles.chip,
                      {
                        borderColor: selectedNpcImportEncounterId === "manual" ? c.primary : c.border,
                        backgroundColor: selectedNpcImportEncounterId === "manual" ? c.primary + "22" : c.background,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11, color: selectedNpcImportEncounterId === "manual" ? c.primary : c.mutedForeground, fontWeight: "700" }}>
                      Unassigned
                    </Text>
                  </TouchableOpacity>
                  {encounterControlOptions
                    .filter((group) => group.battleId !== "no-battle")
                    .map((group) => (
                      <TouchableOpacity
                        key={group.battleId}
                        onPress={() => setSelectedNpcImportEncounterId(group.battleId)}
                        style={[
                          styles.chip,
                          {
                            borderColor: selectedNpcImportEncounterId === group.battleId ? c.primary : c.border,
                            backgroundColor: selectedNpcImportEncounterId === group.battleId ? c.primary + "22" : c.background,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 11, color: selectedNpcImportEncounterId === group.battleId ? c.primary : c.mutedForeground, fontWeight: "700" }}>
                          {group.controlLabel}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </View>

              <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700", marginTop: 2 }}>
                NPC stat pills are now controlled per NPC below. Tap each stat to show/hide it for players.
              </Text>

              {savedDmNpcs.slice(0, 6).map((npc) => {
                const key = `dm-${npc.id}`;
                const disposition = pendingNpcDisposition[key] ?? getDefaultDispositionForKey(key);
                const dc = getDispositionColors(disposition);
                return (
                  <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => cycleDisposition(key)}
                      style={[styles.chip, { borderColor: dc.border, backgroundColor: dc.bg }]}
                    >
                      <Text style={{ fontSize: 11, color: dc.fg, fontWeight: "700", textTransform: "capitalize" }}>{disposition}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => void handleAddNpcToCombat({
                        name: npc.name || "Unnamed NPC",
                        sourceType: "dm-npc",
                        sourceId: npc.id,
                        key,
                        coreStats: buildCoreStatsFromDmNpc(npc),
                        battleId: selectedNpcImportEncounterId,
                      })}
                      style={[styles.chip, { borderColor: c.primary + "55", backgroundColor: c.primary + "22", flex: 1 }]}
                    >
                      <Text style={{ fontSize: 11, color: c.primary, fontWeight: "700" }}>Add NPC: {npc.name || "Unnamed NPC"}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {savedCharacters.slice(0, 6).map((sc) => {
                const key = `char-${sc.id}`;
                const disposition = pendingNpcDisposition[key] ?? getDefaultDispositionForKey(key);
                const dc = getDispositionColors(disposition);
                return (
                  <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => cycleDisposition(key)}
                      style={[styles.chip, { borderColor: dc.border, backgroundColor: dc.bg }]}
                    >
                      <Text style={{ fontSize: 11, color: dc.fg, fontWeight: "700", textTransform: "capitalize" }}>{disposition}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => void handleAddNpcToCombat({
                        name: sc.name || "Unnamed Character",
                        sourceType: "character",
                        sourceId: sc.id,
                        key,
                        coreStats: buildCoreStatsFromCharacter(sc),
                        battleId: selectedNpcImportEncounterId,
                      })}
                      style={[styles.chip, { borderColor: c.primary + "55", backgroundColor: c.primary + "22", flex: 1 }]}
                    >
                      <Text style={{ fontSize: 11, color: c.primary, fontWeight: "700" }}>Add Character as NPC: {sc.name}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {(() => {
                const key = "monster-compendium";
                const disposition = pendingNpcDisposition[key] ?? getDefaultDispositionForKey(key);
                const dc = getDispositionColors(disposition);
                return (
                  <>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => cycleDisposition(key)}
                        style={[styles.chip, { borderColor: dc.border, backgroundColor: dc.bg }]}
                      >
                        <Text style={{ fontSize: 11, color: dc.fg, fontWeight: "700", textTransform: "capitalize" }}>{disposition}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleToggleMonsterPicker}
                        style={[styles.chip, { borderColor: "#F97316" + "55", backgroundColor: "#F97316" + "22", flex: 1, opacity: loadingMonsters && compendiumMonsters.length === 0 ? 0.75 : 1 }]}
                      >
                        <Text style={{ fontSize: 11, color: "#F97316", fontWeight: "700" }}>
                          {loadingMonsters && compendiumMonsters.length === 0
                            ? "Loading Monster Compendium..."
                            : showMonsterPicker
                              ? "Hide Monster Compendium"
                              : "Add Monster from Compendium"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {showMonsterPicker && (
                      <View style={{ gap: 8 }}>
                        <TextInput
                          value={monsterSearchText}
                          onChangeText={setMonsterSearchText}
                          placeholder="Filter by name, type, or CR"
                          placeholderTextColor={c.mutedForeground}
                          style={[styles.input, { borderColor: c.border, backgroundColor: c.card, color: c.foreground, fontSize: 13, paddingVertical: 8 }]}
                        />

                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {(["official", "custom"] as const).map((tab) => (
                            <TouchableOpacity
                              key={tab}
                              onPress={() => setMonsterFilterTab(tab)}
                              style={[
                                styles.chip,
                                {
                                  flex: 1,
                                  justifyContent: "center",
                                  borderColor: monsterFilterTab === tab ? c.primary : c.border,
                                  backgroundColor: monsterFilterTab === tab ? c.primary + "22" : c.background,
                                },
                              ]}
                            >
                              <Text style={{ fontSize: 11, fontWeight: "700", color: monsterFilterTab === tab ? c.primary : c.mutedForeground, textTransform: "capitalize" }}>
                                {tab}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => setShowMonsterFilters((prev) => !prev)}
                            style={[
                              styles.chip,
                              {
                                borderColor: showMonsterFilters ? c.primary : c.border,
                                backgroundColor: showMonsterFilters ? c.primary + "22" : c.background,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              },
                            ]}
                          >
                            <Feather name={showMonsterFilters ? "chevron-up" : "sliders"} size={12} color={showMonsterFilters ? c.primary : c.mutedForeground} />
                            <Text style={{ fontSize: 11, fontWeight: "700", color: showMonsterFilters ? c.primary : c.mutedForeground }}>
                              Filters
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setMonsterCrBand("all");
                              setMonsterTypeFilter("all");
                              setMonsterSortMode("name");
                            }}
                            style={[styles.chip, { borderColor: c.border, backgroundColor: c.background }]}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground }}>Reset</Text>
                          </TouchableOpacity>
                        </View>

                        {showMonsterFilters && (
                          <View style={[styles.controlGroup, { borderColor: c.border, backgroundColor: c.card, gap: 6 }]}> 
                            <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>CR BAND</Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                              {([
                                { id: "all", label: "All" },
                                { id: "0-1", label: "CR 0-1" },
                                { id: "2-4", label: "CR 2-4" },
                                { id: "5-10", label: "CR 5-10" },
                                { id: "11-16", label: "CR 11-16" },
                                { id: "17+", label: "CR 17+" },
                              ] as Array<{ id: MonsterCrBand; label: string }>).map((band) => (
                                <TouchableOpacity
                                  key={band.id}
                                  onPress={() => setMonsterCrBand(band.id)}
                                  style={[
                                    styles.chip,
                                    {
                                      borderColor: monsterCrBand === band.id ? c.primary : c.border,
                                      backgroundColor: monsterCrBand === band.id ? c.primary + "22" : c.background,
                                    },
                                  ]}
                                >
                                  <Text style={{ fontSize: 11, color: monsterCrBand === band.id ? c.primary : c.mutedForeground, fontWeight: "700" }}>
                                    {band.label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>

                            <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>TYPE</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
                              {monsterTypeOptions.map((typeOption) => {
                                const label = typeOption === "all"
                                  ? "All Types"
                                  : typeOption.replace(/(^|\s)\S/g, (chr) => chr.toUpperCase());
                                const selected = monsterTypeFilter === typeOption;
                                return (
                                  <TouchableOpacity
                                    key={typeOption}
                                    onPress={() => setMonsterTypeFilter(typeOption)}
                                    style={[
                                      styles.chip,
                                      {
                                        borderColor: selected ? c.primary : c.border,
                                        backgroundColor: selected ? c.primary + "22" : c.background,
                                      },
                                    ]}
                                  >
                                    <Text style={{ fontSize: 11, color: selected ? c.primary : c.mutedForeground, fontWeight: "700" }}>
                                      {label}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>

                            <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>SORT</Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                              {([
                                { id: "name", label: "Name" },
                                { id: "cr-asc", label: "CR Asc" },
                                { id: "cr-desc", label: "CR Desc" },
                                { id: "type", label: "Type" },
                              ] as Array<{ id: MonsterSortMode; label: string }>).map((mode) => (
                                <TouchableOpacity
                                  key={mode.id}
                                  onPress={() => setMonsterSortMode(mode.id)}
                                  style={[
                                    styles.chip,
                                    {
                                      borderColor: monsterSortMode === mode.id ? c.primary : c.border,
                                      backgroundColor: monsterSortMode === mode.id ? c.primary + "22" : c.background,
                                    },
                                  ]}
                                >
                                  <Text style={{ fontSize: 11, color: monsterSortMode === mode.id ? c.primary : c.mutedForeground, fontWeight: "700" }}>
                                    {mode.label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        )}

                        {loadingMonsters && compendiumMonsters.length === 0 ? (
                          <View style={{ paddingVertical: 8, alignItems: "center" }}>
                            <ActivityIndicator size="small" color={c.primary} />
                          </View>
                        ) : compendiumMonsters.length === 0 ? (
                          <View style={{ gap: 8, alignItems: "flex-start" }}>
                            <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                              No monsters are loaded yet. Retry to fetch the compendium.
                            </Text>
                            <TouchableOpacity
                              onPress={() => void loadCompendiumMonsters(true)}
                              style={[styles.chip, { borderColor: c.border, backgroundColor: c.card }]}
                            >
                              <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "700" }}>Retry Monster Load</Text>
                            </TouchableOpacity>
                          </View>
                        ) : filteredCompendiumMonsters.length === 0 ? (
                          <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                            No monsters match this filter.
                          </Text>
                        ) : (
                          filteredCompendiumMonsters.map((monster) => {
                            const isCustom = isCustomMonster(monster);
                            const monsterId = isCustom ? monster.id : monster.slug;
                            const monsterKey = `monster-${monsterId}`;
                            const isExpanded = expandedCompendiumMonsterKey === monsterKey;
                            const customMonster = isCustom ? (monster as CustomMonster) : null;
                            const cardDescription = isCustom
                              ? (customMonster?.notes?.trim() || null)
                              : getMonsterDescription(monster);
                            const levelStr = customMonster?.level !== undefined
                              ? (customMonster.levelLabel ? `${customMonster.levelLabel} (Lv ${customMonster.level})` : `Level ${customMonster.level}`)
                              : null;
                            const actionsCount = customMonster?.actions?.length ?? 0;
                            const abilitiesCount = customMonster?.special_abilities?.length ?? 0;
                            const lootCount = customMonster?.loot?.length ?? 0;

                            return (
                              <View key={monsterKey} style={[styles.monsterCard, { backgroundColor: c.card, borderColor: isExpanded ? c.primary + "66" : c.border }]}>
                                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                                  <TouchableOpacity
                                    onPress={() => setExpandedCompendiumMonsterKey((prev) => (prev === monsterKey ? null : monsterKey))}
                                    activeOpacity={0.7}
                                    style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
                                  >
                                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                                      <Text style={[styles.monsterName, { color: c.foreground }]}>{monster.name}</Text>
                                      {isCustom ? (
                                        <View style={[styles.customPill, { backgroundColor: c.primary + "22", borderColor: c.primary + "55" }]}>
                                          <Text style={{ fontSize: 10, fontWeight: "700", color: c.primary }}>CUSTOM</Text>
                                        </View>
                                      ) : null}
                                    </View>
                                    <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={c.mutedForeground} style={{ marginLeft: 4 }} />
                                  </TouchableOpacity>
                                  {!isCustom ? (
                                    <TouchableOpacity
                                      style={{ width: 28, height: 28, justifyContent: "center", alignItems: "center", borderRadius: colors.radius, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, marginLeft: 8 }}
                                      onPress={() => handleCustomizeMonster(monster)}
                                      activeOpacity={0.7}
                                    >
                                      <Feather name="copy" size={13} color={c.mutedForeground} />
                                    </TouchableOpacity>
                                  ) : null}
                                  {isCustom ? (
                                    <TouchableOpacity
                                      style={{ width: 28, height: 28, justifyContent: "center", alignItems: "center", borderRadius: colors.radius, borderWidth: 1, borderColor: c.primary + "55", backgroundColor: c.primary + "18", marginLeft: 8 }}
                                      onPress={() => handleCustomizeMonster(monster)}
                                      activeOpacity={0.7}
                                    >
                                      <Feather name="edit-2" size={13} color={c.primary} />
                                    </TouchableOpacity>
                                  ) : null}
                                </View>

                                <Text style={[styles.monsterMeta, { color: c.mutedForeground }]}>
                                  {monster.size} {monster.type} • AC {monster.armor_class} • HP {monster.hit_points} • CR {monster.challenge_rating}
                                </Text>
                                {monster.alignment ? (
                                  <Text style={[styles.monsterMeta, { color: c.mutedForeground }]}>{monster.alignment}</Text>
                                ) : null}

                                {isCustom && (levelStr || actionsCount > 0 || abilitiesCount > 0 || lootCount > 0) ? (
                                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6, marginTop: 2 }}>
                                    {levelStr ? (
                                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c.primary + "18", borderWidth: 1, borderColor: c.primary + "44" }}>
                                        <Feather name="star" size={10} color={c.primary} />
                                        <Text style={{ fontSize: 11, color: c.primary, fontWeight: "600" }}>{levelStr}</Text>
                                      </View>
                                    ) : null}
                                    {actionsCount > 0 ? (
                                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c.background, borderWidth: 1, borderColor: c.border }}>
                                        <Feather name="zap" size={10} color={c.mutedForeground} />
                                        <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "500" }}>{actionsCount} action{actionsCount !== 1 ? "s" : ""}</Text>
                                      </View>
                                    ) : null}
                                    {abilitiesCount > 0 ? (
                                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c.background, borderWidth: 1, borderColor: c.border }}>
                                        <Feather name="book-open" size={10} color={c.mutedForeground} />
                                        <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "500" }}>{abilitiesCount} abilit{abilitiesCount !== 1 ? "ies" : "y"}</Text>
                                      </View>
                                    ) : null}
                                    {lootCount > 0 ? (
                                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: c.background, borderWidth: 1, borderColor: c.border }}>
                                        <Feather name="package" size={10} color={c.mutedForeground} />
                                        <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "500" }}>{lootCount} loot item{lootCount !== 1 ? "s" : ""}</Text>
                                      </View>
                                    ) : null}
                                  </View>
                                ) : null}

                                {isExpanded && cardDescription ? (
                                  <Text style={[styles.monsterDescription, { color: c.mutedForeground }]}>
                                    {cardDescription}
                                  </Text>
                                ) : null}

                                {isExpanded ? (
                                  <View style={{ marginTop: 10, gap: 10 }}>
                                    <View style={{ backgroundColor: c.background, borderRadius: 8, padding: 10 }}>
                                      <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground, marginBottom: 8, letterSpacing: 0.5 }}>ABILITY SCORES</Text>
                                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                        {(["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const).map((abbr, index) => {
                                          const val = parseNumberish([monster.strength, monster.dexterity, monster.constitution, monster.intelligence, monster.wisdom, monster.charisma][index], 10);
                                          const mod = abilityModifier(val);
                                          return (
                                            <View key={abbr} style={{ alignItems: "center", flex: 1 }}>
                                              <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "600" }}>{abbr}</Text>
                                              <Text style={{ fontSize: 14, color: c.foreground, fontWeight: "700" }}>{val}</Text>
                                              <Text style={{ fontSize: 11, color: c.mutedForeground }}>{mod >= 0 ? `+${mod}` : mod}</Text>
                                            </View>
                                          );
                                        })}
                                      </View>
                                    </View>

                                    <View style={{ flexDirection: "row", gap: 8 }}>
                                      <View style={{ flex: 1, backgroundColor: c.background, borderRadius: 8, padding: 8 }}>
                                        <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "600", marginBottom: 2 }}>SPEED</Text>
                                        <Text style={{ fontSize: 13, color: c.foreground }}>{typeof monster.speed === "string" ? monster.speed : `${parseSpeedFromMonster(monster.speed)} ft.`}</Text>
                                      </View>
                                      {monster.hit_dice ? (
                                        <View style={{ flex: 1, backgroundColor: c.background, borderRadius: 8, padding: 8 }}>
                                          <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "600", marginBottom: 2 }}>HIT DICE</Text>
                                          <Text style={{ fontSize: 13, color: c.foreground }}>{monster.hit_dice}</Text>
                                        </View>
                                      ) : null}
                                    </View>

                                    {monster.special_abilities && monster.special_abilities.length > 0 ? (
                                      <View>
                                        <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground, marginBottom: 6, letterSpacing: 0.5 }}>SPECIAL ABILITIES</Text>
                                        {monster.special_abilities.map((ability, index) => (
                                          <View key={index} style={{ marginBottom: 8 }}>
                                            <Text style={{ fontSize: 13, color: c.foreground, fontWeight: "600" }}>{ability.name}.</Text>
                                            <Text style={{ fontSize: 12, color: c.mutedForeground, lineHeight: 18, marginTop: 2 }}>{ability.desc}</Text>
                                          </View>
                                        ))}
                                      </View>
                                    ) : null}

                                    {monster.actions && monster.actions.length > 0 ? (
                                      <View>
                                        <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground, marginBottom: 6, letterSpacing: 0.5 }}>ACTIONS</Text>
                                        {monster.actions.map((action, index) => (
                                          <View key={index} style={{ marginBottom: 8 }}>
                                            <Text style={{ fontSize: 13, color: c.foreground, fontWeight: "600" }}>{action.name}.</Text>
                                            <Text style={{ fontSize: 12, color: c.mutedForeground, lineHeight: 18, marginTop: 2 }}>{action.desc}</Text>
                                          </View>
                                        ))}
                                      </View>
                                    ) : null}

                                    {customMonster?.loot && customMonster.loot.length > 0 ? (
                                      <View>
                                        <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground, marginBottom: 6, letterSpacing: 0.5 }}>LOOT</Text>
                                        {customMonster.loot.map((item, index) => (
                                          <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                            <Feather name="package" size={12} color={c.mutedForeground} />
                                            <Text style={{ fontSize: 12, color: c.foreground }}>{item.quantity > 1 ? `${item.quantity}x ` : ""}{item.name}{item.category ? ` (${item.category})` : ""}</Text>
                                          </View>
                                        ))}
                                      </View>
                                    ) : null}
                                  </View>
                                ) : null}

                                <View style={styles.monsterActions}>
                                  <TouchableOpacity
                                    onPress={() => void handleAddNpcToCombat({
                                      name: monster.name || "Unnamed Monster",
                                      sourceType: "monster",
                                      sourceId: monsterId,
                                      key,
                                      coreStats: buildCoreStatsFromMonster(monster),
                                      battleId: selectedNpcImportEncounterId,
                                    })}
                                    style={[styles.monsterBtn, { backgroundColor: c.primary + "33", flex: 1 }]}
                                    activeOpacity={0.7}
                                  >
                                    <Feather name="plus-circle" size={12} color={c.primary} />
                                    <Text style={[styles.monsterBtnText, { color: c.primary }]}>{selectedNpcImportEncounterId !== "manual" ? "Add to Encounter" : "Add"}</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          })
                        )}
                      </View>
                    )}
                  </>
                );
              })()}
            </View>
            )}

            {activeControlTab === "dummies" && (
            <View style={[styles.controlGroup, { borderColor: c.border, backgroundColor: c.background }]}> 
              <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>DUMMIES</Text>
              <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                Spawn disposable test combatants with quick card controls for action usage, healing, turn advancement, and removal.
              </Text>

              {encounterControlOptions.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>PLACE IN ENCOUNTER</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setSelectedDummyEncounterId("manual")}
                      style={[
                        styles.chip,
                        {
                          borderColor: selectedDummyEncounterId === "manual" ? c.primary : c.border,
                          backgroundColor: selectedDummyEncounterId === "manual" ? c.primary + "22" : c.background,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, color: selectedDummyEncounterId === "manual" ? c.primary : c.mutedForeground, fontWeight: "700" }}>
                        No Encounter
                      </Text>
                    </TouchableOpacity>
                    {encounterControlOptions
                      .filter((group) => group.battleId !== "no-battle")
                      .map((group) => (
                        <TouchableOpacity
                          key={group.battleId}
                          onPress={() => setSelectedDummyEncounterId(group.battleId)}
                          style={[
                            styles.chip,
                            {
                              borderColor: selectedDummyEncounterId === group.battleId ? c.primary : c.border,
                              backgroundColor: selectedDummyEncounterId === group.battleId ? c.primary + "22" : c.background,
                            },
                          ]}
                        >
                          <Text style={{ fontSize: 11, color: selectedDummyEncounterId === group.battleId ? c.primary : c.mutedForeground, fontWeight: "700" }}>
                            {group.controlLabel}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  value={dummyNameInput}
                  onChangeText={setDummyNameInput}
                  placeholder="Dummy name"
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.input, { flex: 1, borderColor: c.border, backgroundColor: c.card, color: c.foreground }]}
                />
                <TextInput
                  value={dummyMaxHpInput}
                  onChangeText={setDummyMaxHpInput}
                  placeholder="HP"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="number-pad"
                  style={[styles.input, styles.dummyStatInput, { borderColor: c.border, backgroundColor: c.card, color: c.foreground }]}
                />
                <TextInput
                  value={dummyArmorClassInput}
                  onChangeText={setDummyArmorClassInput}
                  placeholder="AC"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="number-pad"
                  style={[styles.input, styles.dummyStatInput, { borderColor: c.border, backgroundColor: c.card, color: c.foreground }]}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  value={dummyInitiativeBonusInput}
                  onChangeText={setDummyInitiativeBonusInput}
                  placeholder="Init"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="number-pad"
                  style={[styles.input, styles.dummyStatInput, { borderColor: c.border, backgroundColor: c.card, color: c.foreground }]}
                />
                <TextInput
                  value={dummySpeedInput}
                  onChangeText={setDummySpeedInput}
                  placeholder="Speed"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="number-pad"
                  style={[styles.input, styles.dummyStatInput, { borderColor: c.border, backgroundColor: c.card, color: c.foreground }]}
                />
                <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  {(["hostile", "passive", "friendly"] as CombatNpcDisposition[]).map((disposition) => {
                    const colorsByDisposition = getDispositionColors(disposition);
                    const selected = dummyDisposition === disposition;
                    return (
                      <TouchableOpacity
                        key={disposition}
                        onPress={() => setDummyDisposition(disposition)}
                        style={[
                          styles.chip,
                          {
                            borderColor: selected ? colorsByDisposition.border : c.border,
                            backgroundColor: selected ? colorsByDisposition.bg : c.background,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 11, color: selected ? colorsByDisposition.fg : c.mutedForeground, fontWeight: "700", textTransform: "capitalize" }}>
                          {disposition}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                onPress={() => void handleCreateDummy()}
                disabled={creatingDummy}
                style={[styles.btnPrimary, styles.btnFull, { backgroundColor: c.primary, opacity: creatingDummy ? 0.6 : 1 }]}
              >
                <Feather name="plus-circle" size={14} color="#fff" />
                <Text style={styles.btnText}>{creatingDummy ? "Creating..." : "Create Dummy"}</Text>
              </TouchableOpacity>

              {dummyCombatants.length === 0 ? (
                <Text style={{ fontSize: 11, color: c.mutedForeground }}>No dummy characters yet.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {dummyCombatants.map((npc) => {
                    const parsedMeta = parseDummyMeta(npc.sourceId);
                    const dummyState = npc.dummyState ?? {
                      maxHp: parsedMeta.maxHp,
                      currentHp: parsedMeta.maxHp,
                      armorClass: parsedMeta.armorClass,
                      actionUsed: false,
                    };
                    const battleId = combatState?.participantBattleById?.[npc.id];
                    const battleLabel = encounterControlOptions.find((group) => group.battleId === battleId)?.controlLabel ?? "No Encounter";
                    const currentTurnId = getCurrentTurnIdForBattle(battleId);
                    const hpPercent = Math.max(0, Math.min(1, dummyState.currentHp / Math.max(1, dummyState.maxHp)));
                    return (
                      <View key={npc.id} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}> 
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                          <View style={{ flex: 1, gap: 4 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <Text style={{ fontSize: 15, fontWeight: "800", color: c.foreground }}>{npc.name}</Text>
                              {currentTurnId === npc.id && (
                                <View style={{ backgroundColor: "#22C55E22", borderColor: "#22C55E", borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#22C55E", letterSpacing: 0.4 }}>CURRENT TURN</Text>
                                </View>
                              )}
                              {dummyState.actionUsed && (
                                <View style={{ backgroundColor: "#f59e0b22", borderColor: "#f59e0b66", borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#f59e0b", letterSpacing: 0.4 }}>ACTION USED</Text>
                                </View>
                              )}
                            </View>
                            <Text style={{ fontSize: 12, color: c.mutedForeground }}>{battleLabel}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => void handleRemoveCombatNpc(npc.id)}
                            style={[styles.removeBtn, { borderColor: "#f87171" + "66" }]}
                          >
                            <Feather name="trash-2" size={14} color="#f87171" />
                          </TouchableOpacity>
                        </View>

                        <View style={{ gap: 4, marginTop: 8 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={{ fontSize: 11, color: c.mutedForeground }}>HP</Text>
                            <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "700" }}>
                              {dummyState.currentHp}/{dummyState.maxHp}
                            </Text>
                          </View>
                          <View style={{ height: 6, borderRadius: 3, backgroundColor: c.border, overflow: "hidden" }}>
                            <View style={{ width: `${hpPercent * 100}%`, height: "100%", backgroundColor: hpPercent > 0.5 ? "#4ade80" : hpPercent > 0.25 ? "#facc15" : "#f87171" }} />
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                          <View style={[styles.conditionBadge, { borderColor: c.border, backgroundColor: c.background }]}>
                            <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>AC {dummyState.armorClass}</Text>
                          </View>
                          <View style={[styles.conditionBadge, { borderColor: c.border, backgroundColor: c.background }]}>
                            <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>INIT {npc.coreStats.initiativeBonus >= 0 ? `+${npc.coreStats.initiativeBonus}` : npc.coreStats.initiativeBonus}</Text>
                          </View>
                          <View style={[styles.conditionBadge, { borderColor: c.border, backgroundColor: c.background }]}>
                            <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>SPD {npc.coreStats.speed}</Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                          <TouchableOpacity
                            onPress={() => void handleDummyUseAction(npc.id, { actionUsed: dummyState.actionUsed })}
                            style={[styles.chip, { borderColor: dummyState.actionUsed ? "#f59e0b55" : c.border, backgroundColor: dummyState.actionUsed ? "#f59e0b22" : c.background }]}
                          >
                            <Text style={{ fontSize: 11, color: dummyState.actionUsed ? "#f59e0b" : c.foreground, fontWeight: "700" }}>
                              {dummyState.actionUsed ? "Reset Action" : "Use Action"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => void handleDummyHeal(npc.id, 5, { maxHp: dummyState.maxHp, currentHp: dummyState.currentHp })}
                            style={[styles.chip, { borderColor: "#22c55e55", backgroundColor: "#22c55e22" }]}
                          >
                            <Text style={{ fontSize: 11, color: "#22c55e", fontWeight: "700" }}>Heal +5</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => void handleDummyEndTurn(npc.id)}
                            disabled={advancingTurn || !battleId}
                            style={[styles.chip, { borderColor: c.primary + "55", backgroundColor: c.primary + "22", opacity: advancingTurn || !battleId ? 0.6 : 1 }]}
                          >
                            <Text style={{ fontSize: 11, color: c.primary, fontWeight: "700" }}>
                              {advancingTurn && currentTurnId === npc.id ? "Ending..." : "End Turn"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
            )}

            {activeControlTab !== "npcs" && activeControlTab !== "turn" && (
            <View style={[styles.controlGroup, { borderColor: c.border, backgroundColor: c.background }]}> 
              {encounterControlOptions.length > 1 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>ENCOUNTER PRESET</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => selectEncounterControl("manual")}
                      style={[
                        styles.chip,
                        {
                          borderColor: selectedEncounterControlId === "manual" ? c.primary : c.border,
                          backgroundColor: selectedEncounterControlId === "manual" ? c.primary + "22" : c.background,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, color: selectedEncounterControlId === "manual" ? c.primary : c.mutedForeground, fontWeight: "700" }}>
                        Manual Selection
                      </Text>
                    </TouchableOpacity>
                    {encounterControlOptions.map((group) => (
                      <TouchableOpacity
                        key={group.battleId}
                        onPress={() => selectEncounterControl(group.battleId)}
                        style={[
                          styles.chip,
                          {
                            borderColor: selectedEncounterControlId === group.battleId ? c.primary : c.border,
                            backgroundColor: selectedEncounterControlId === group.battleId ? c.primary + "22" : c.background,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 11, color: selectedEncounterControlId === group.battleId ? c.primary : c.mutedForeground, fontWeight: "700" }}>
                          {group.controlLabel} ({group.members.length})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>
                  TARGETS ({selectedTargets.length}/{selectedEncounterGroup?.members.length ?? members.length})
                </Text>
                <TouchableOpacity onPress={selectAllTargets}>
                  <Text style={{ fontSize: 12, color: c.primary, fontWeight: "700" }}>Select All</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {members.map((member) => {
                  const selected = selectedTargets.includes(member.id);
                  return (
                    <TouchableOpacity
                      key={member.id}
                      onPress={() => toggleTarget(member.id)}
                      style={[
                        styles.chip,
                        {
                          borderRadius: 8,
                          borderColor: selected ? c.primary : c.border,
                          backgroundColor: selected ? c.primary + "22" : c.background,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, color: selected ? c.primary : c.mutedForeground, fontWeight: "700" }}>{member.characterName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            )}

            {activeControlTab === "loot" && (
            <View style={[styles.controlGroup, { borderColor: c.border, backgroundColor: c.background }]}> 
              <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>LOOT IMPORT & ASSIGN</Text>
              <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                Import or generate loot, edit the draft, then assign it using one final action.
              </Text>
              <TextInput
                value={lootPromptText}
                onChangeText={setLootPromptText}
                placeholder="e.g. generate items that will help the party fight spiders"
                placeholderTextColor={c.mutedForeground}
                style={[styles.input, { borderColor: c.border, backgroundColor: c.card, color: c.foreground }]}
              />
              <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>RARITY GUARDRAILS</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {LOOT_RARITIES.map((rarity) => {
                  const selected = lootPromptRarity.includes(rarity);
                  return (
                    <TouchableOpacity
                      key={rarity}
                      onPress={() => toggleLootRarity(rarity)}
                      style={[
                        styles.chip,
                        {
                          borderColor: selected ? c.primary : c.border,
                          backgroundColor: selected ? c.primary + "22" : c.background,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, color: selected ? c.primary : c.mutedForeground, fontWeight: "700" }}>{rarity}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>TYPE GUARDRAILS</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {LOOT_CATEGORY_GUARDS.map((type) => {
                  const selected = lootPromptTypes.includes(type);
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => toggleLootType(type)}
                      style={[
                        styles.chip,
                        {
                          borderColor: selected ? c.primary : c.border,
                          backgroundColor: selected ? c.primary + "22" : c.background,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, color: selected ? c.primary : c.mutedForeground, fontWeight: "700", textTransform: "capitalize" }}>{type}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                onPress={() => void handleGenerateLootFromPrompt()}
                disabled={generatingLoot}
                style={[styles.btnPrimary, styles.btnFull, { backgroundColor: c.primary, opacity: generatingLoot ? 0.6 : 1 }]}
              >
                <Feather name="star" size={14} color="#fff" />
                <Text style={styles.btnText}>{generatingLoot ? "Generating..." : "Generate Draft From Prompt"}</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                Paste one item per line. Optional formats: "2x Potion of Healing" or "weapon: Longsword".
              </Text>
              <TextInput
                value={lootImportText}
                onChangeText={setLootImportText}
                placeholder="e.g. 2x Potion of Healing\nmagic: Ring of Jumping"
                placeholderTextColor={c.mutedForeground}
                multiline
                style={[styles.lootInput, { borderColor: c.border, backgroundColor: c.card, color: c.foreground }]}
              />
              <TouchableOpacity
                onPress={prepareLootItemsFromText}
                style={[styles.chip, { borderColor: c.border, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6 }]}
              >
                <Feather name="list" size={14} color={c.foreground} />
                <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "700" }}>Import / Parse Into Draft</Text>
              </TouchableOpacity>

              <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>ASSIGNMENT MODE</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {[
                  { key: "selected-players", label: "Same Loot to Selected Players" },
                  { key: "by-player", label: "Distribute by Player" },
                ].map((mode) => {
                  const selected = lootAssignmentMode === mode.key;
                  return (
                    <TouchableOpacity
                      key={mode.key}
                      onPress={() => setLootAssignmentMode(mode.key as LootAssignmentMode)}
                      style={[
                        styles.chip,
                        {
                          borderColor: selected ? c.primary : c.border,
                          backgroundColor: selected ? c.primary + "22" : c.background,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, color: selected ? c.primary : c.mutedForeground, fontWeight: "700" }}>{mode.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                {lootAssignmentMode === "selected-players"
                  ? "Use the shared target chips above to give every selected player the same full draft."
                  : "Assign each draft row to a specific player before sending loot."}
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <TouchableOpacity
                  onPress={addBlankLootDraftItem}
                  style={[styles.chip, { borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 6 }]}
                >
                  <Feather name="plus" size={14} color={c.foreground} />
                  <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "700" }}>Add Draft Row</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setLootDraftItems([]);
                    setActiveLootCategoryEditorId(null);
                    setActiveLootAdvancedEditorId(null);
                  }}
                  style={[styles.chip, { borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 6 }]}
                >
                  <Feather name="trash-2" size={14} color={c.foreground} />
                  <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "700" }}>Clear Draft</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={applyEvenSplitLootTargets}
                  disabled={lootDraftItems.length === 0}
                  style={[styles.chip, { borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 6, opacity: lootDraftItems.length === 0 ? 0.6 : 1 }]}
                >
                  <Feather name="grid" size={14} color={c.foreground} />
                  <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "700" }}>Even Split</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={applyRoundRobinLootTargets}
                  disabled={lootDraftItems.length === 0}
                  style={[styles.chip, { borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 6, opacity: lootDraftItems.length === 0 ? 0.6 : 1 }]}
                >
                  <Feather name="refresh-cw" size={14} color={c.foreground} />
                  <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "700" }}>Round Robin</Text>
                </TouchableOpacity>
              </View>

              {lootDraftItems.length > 0 && (
                <View style={{ gap: 10 }}>
                  <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>EDITABLE LOOT DRAFT</Text>
                  {lootDraftItems.map((item, idx) => {
                    const rowValidation = lootDraftValidation[item.draftId] ?? { missingName: false, missingTarget: false, unreviewed: false };
                    const hasRowError = rowValidation.missingName || rowValidation.missingTarget || rowValidation.unreviewed;
                    const isCategoryEditorOpen = activeLootCategoryEditorId === item.draftId;
                    const isAdvancedEditorOpen = activeLootAdvancedEditorId === item.draftId;
                    const subtypeOptions = subtypesForCategory(item.category);
                    const tagOptions = tagsForCategory(item.category);
                    return (
                      <View
                        key={item.draftId}
                        style={[
                          styles.chip,
                          {
                            borderColor: hasRowError ? "#ef4444" : c.border,
                            backgroundColor: hasRowError ? "#ef444411" : c.background,
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 12,
                            gap: 10,
                          },
                        ]}
                      > 
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>Row {idx + 1}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <TouchableOpacity onPress={() => setActiveLootAdvancedEditorId((prev) => prev === item.draftId ? null : item.draftId)}>
                              <Feather name={isAdvancedEditorOpen ? "chevron-up" : "sliders"} size={14} color={c.mutedForeground} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => duplicateLootDraftItem(item.draftId)}>
                              <Feather name="copy" size={14} color={c.mutedForeground} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => removeLootDraftItem(item.draftId)}>
                              <Feather name="x" size={14} color={c.mutedForeground} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <TextInput
                          value={item.name}
                          onChangeText={(value) => updateLootDraftItem(item.draftId, { name: value })}
                          placeholder="Item name"
                          placeholderTextColor={c.mutedForeground}
                          style={[styles.input, { borderColor: rowValidation.missingName ? "#ef4444" : c.border, backgroundColor: c.card, color: c.foreground }]}
                        />
                        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                          <View style={styles.quantityControlRow}>
                            <TouchableOpacity
                              onPress={() => updateLootDraftItem(item.draftId, { quantity: Math.max(1, item.quantity - 1) })}
                              style={[styles.quantityStepperBtn, { borderColor: c.border, backgroundColor: c.card }]}
                            >
                              <Feather name="minus" size={12} color={c.foreground} />
                            </TouchableOpacity>
                            <TextInput
                              value={String(item.quantity)}
                              onChangeText={(value) => {
                                const parsed = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);
                                updateLootDraftItem(item.draftId, { quantity: Number.isFinite(parsed) ? Math.max(1, parsed) : 1 });
                              }}
                              placeholder="1"
                              placeholderTextColor={c.mutedForeground}
                              keyboardType="numeric"
                              style={[styles.quantityInputCompact, { borderColor: c.border, backgroundColor: c.card, color: c.foreground }]}
                            />
                            <TouchableOpacity
                              onPress={() => updateLootDraftItem(item.draftId, { quantity: item.quantity + 1 })}
                              style={[styles.quantityStepperBtn, { borderColor: c.border, backgroundColor: c.card }]}
                            >
                              <Feather name="plus" size={12} color={c.foreground} />
                            </TouchableOpacity>
                          </View>
                          <View style={{ flex: 1, gap: 6 }}>
                            <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>CATEGORY</Text>
                            <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <View style={[styles.chip, { borderColor: c.primary, backgroundColor: c.primary + "22", paddingHorizontal: 8, paddingVertical: 4 }]}>
                                <Text style={{ fontSize: 10, color: c.primary, fontWeight: "700", textTransform: "capitalize" }}>{item.category}</Text>
                              </View>
                              <TouchableOpacity
                                disabled={hasStructuredLootEffects(item)}
                                onPress={() => setActiveLootCategoryEditorId((prev) => prev === item.draftId ? null : item.draftId)}
                                style={[styles.chip, { borderColor: c.border, paddingHorizontal: 8, paddingVertical: 4 }]}
                              >
                                <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>{hasStructuredLootEffects(item) ? "Linked to effects" : isCategoryEditorOpen ? "Hide" : "Change"}</Text>
                              </TouchableOpacity>
                            </View>
                            {isCategoryEditorOpen && (
                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                                {LOOT_CATEGORY_GUARDS.map((category) => {
                                  const active = item.category === category;
                                  return (
                                    <TouchableOpacity
                                      key={`${item.draftId}-${category}`}
                                      onPress={() => {
                                        updateLootDraftItem(item.draftId, { category });
                                        setActiveLootCategoryEditorId(null);
                                      }}
                                      style={[
                                        styles.chip,
                                        {
                                          paddingHorizontal: 8,
                                          paddingVertical: 4,
                                          borderColor: active ? c.primary : c.border,
                                          backgroundColor: active ? c.primary + "22" : c.card,
                                        },
                                      ]}
                                    >
                                      <Text style={{ fontSize: 10, color: active ? c.primary : c.mutedForeground, fontWeight: "700", textTransform: "capitalize" }}>{category}</Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        </View>
                        <TextInput
                          value={item.notes ?? ""}
                          onChangeText={(value) => updateLootDraftItem(item.draftId, { notes: value })}
                          placeholder="Optional notes"
                          placeholderTextColor={c.mutedForeground}
                          multiline
                          style={[styles.input, { minHeight: 64, borderColor: c.border, backgroundColor: c.card, color: c.foreground }]}
                        />
                        {isAdvancedEditorOpen && (
                          <View style={{ gap: 8, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 10, backgroundColor: c.card }}>
                            <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>
                              ADVANCED ITEM FORGE FIELDS
                            </Text>
                            <View style={{ gap: 6 }}>
                              <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>VALUE (GP)</Text>
                              <TextInput
                                value={typeof item.value === "number" && Number.isFinite(item.value) ? String(item.value) : ""}
                                onChangeText={(value) => {
                                  const trimmed = value.trim();
                                  if (!trimmed) {
                                    updateLootDraftItem(item.draftId, { value: undefined });
                                    return;
                                  }
                                  const parsed = Number.parseFloat(trimmed.replace(/[^0-9.]/g, ""));
                                  updateLootDraftItem(item.draftId, { value: Number.isFinite(parsed) ? Math.max(0, parsed) : undefined });
                                }}
                                placeholder="e.g. 50"
                                placeholderTextColor={c.mutedForeground}
                                keyboardType="numeric"
                                style={[styles.input, { borderColor: c.border, backgroundColor: c.background, color: c.foreground }]}
                              />
                            </View>

                            <View style={{ gap: 6 }}>
                              <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>PROPERTIES / EFFECTS</Text>
                              <TextInput
                                value={item.properties ?? ""}
                                onChangeText={(value) => updateLootDraftItem(item.draftId, { properties: value })}
                                placeholder="Mechanical effects, limitations, triggers"
                                placeholderTextColor={c.mutedForeground}
                                multiline
                                style={[styles.input, { minHeight: 56, borderColor: c.border, backgroundColor: c.background, color: c.foreground }]}
                              />
                            </View>

                            <View style={{ gap: 6 }}>
                              <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>FLAVOR DESCRIPTION</Text>
                              <TextInput
                                value={item.description ?? ""}
                                onChangeText={(value) => updateLootDraftItem(item.draftId, { description: value })}
                                placeholder="Narrative description shown to players"
                                placeholderTextColor={c.mutedForeground}
                                multiline
                                style={[styles.input, { minHeight: 56, borderColor: c.border, backgroundColor: c.background, color: c.foreground }]}
                              />
                            </View>

                            <View style={{ gap: 6 }}>
                              <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>RARITY</Text>
                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                                {LOOT_RARITIES.map((rarity) => {
                                  const active = item.rarity === rarity;
                                  return (
                                    <TouchableOpacity
                                      key={`${item.draftId}-rarity-${rarity}`}
                                      onPress={() => updateLootDraftItem(item.draftId, { rarity: active ? undefined : rarity })}
                                      style={[
                                        styles.chip,
                                        {
                                          paddingHorizontal: 8,
                                          paddingVertical: 4,
                                          borderColor: active ? c.primary : c.border,
                                          backgroundColor: active ? c.primary + "22" : c.background,
                                        },
                                      ]}
                                    >
                                      <Text style={{ fontSize: 10, color: active ? c.primary : c.mutedForeground, fontWeight: "700" }}>{rarity}</Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </View>

                            {subtypeOptions.length > 0 && (
                              <View style={{ gap: 6 }}>
                                <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>SUBTYPE</Text>
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                                  {subtypeOptions.map((subtype) => {
                                    const active = item.subtype === subtype;
                                    return (
                                      <TouchableOpacity
                                        key={`${item.draftId}-subtype-${subtype}`}
                                        onPress={() => updateLootDraftItem(item.draftId, { subtype: active ? "" : subtype })}
                                        style={[
                                          styles.chip,
                                          {
                                            paddingHorizontal: 8,
                                            paddingVertical: 4,
                                            borderColor: active ? c.primary : c.border,
                                            backgroundColor: active ? c.primary + "22" : c.background,
                                          },
                                        ]}
                                      >
                                        <Text style={{ fontSize: 10, color: active ? c.primary : c.mutedForeground, fontWeight: "700" }}>{subtype}</Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              </View>
                            )}

                            {item.category === "map" && (
                              <View style={{ gap: 6 }}>
                                <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>MAP IMAGE (UPLOAD OR URL)</Text>
                                {item.mapImageUri ? (
                                  <View style={{ gap: 6 }}>
                                    <Image
                                      source={{ uri: item.mapImageUri }}
                                      resizeMode="cover"
                                      style={{ width: "100%", height: 120, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.background }}
                                    />
                                    <View style={{ flexDirection: "row", gap: 8 }}>
                                      <TouchableOpacity
                                        onPress={() => void handlePickLootDraftMapImage(item.draftId)}
                                        style={[styles.chip, { borderColor: c.border, backgroundColor: c.background, flexDirection: "row", alignItems: "center", gap: 6 }]}
                                      >
                                        <Feather name="image" size={13} color={c.foreground} />
                                        <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "700" }}>Replace Upload</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        onPress={() => updateLootDraftItem(item.draftId, { mapImageUri: "" })}
                                        style={[styles.chip, { borderColor: "#ef444455", backgroundColor: "#ef444422", flexDirection: "row", alignItems: "center", gap: 6 }]}
                                      >
                                        <Feather name="trash-2" size={13} color="#ef4444" />
                                        <Text style={{ fontSize: 11, color: "#ef4444", fontWeight: "700" }}>Remove Image</Text>
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                ) : (
                                  <TouchableOpacity
                                    onPress={() => void handlePickLootDraftMapImage(item.draftId)}
                                    style={[styles.chip, { borderColor: c.border, backgroundColor: c.background, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }]}
                                  >
                                    <Feather name="image" size={13} color={c.foreground} />
                                    <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "700" }}>Upload Map Image</Text>
                                  </TouchableOpacity>
                                )}
                                <TextInput
                                  value={item.mapImageUri ?? ""}
                                  onChangeText={(value) => updateLootDraftItem(item.draftId, { mapImageUri: value })}
                                  placeholder="https://.../map.png"
                                  placeholderTextColor={c.mutedForeground}
                                  autoCapitalize="none"
                                  style={[styles.input, { borderColor: c.border, backgroundColor: c.background, color: c.foreground }]}
                                />
                              </View>
                            )}

                            {hasStructuredLootEffects(item) && <Text style={{ color: c.mutedForeground, fontSize: 11 }}>Category and combat fields are linked to this item's effects and are read-only here.</Text>}
                            {item.category === "weapon" && (
                              <View pointerEvents={hasStructuredLootEffects(item) ? "none" : "auto"} style={{ gap: 8, opacity: hasStructuredLootEffects(item) ? 0.6 : 1 }}>
                                <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>WEAPON STATS</Text>
                                <View style={{ gap: 6 }}>
                                  <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>ATTACK ABILITY</Text>
                                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                                    {(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as LootAttackAbility[]).map((ability) => {
                                      const active = item.attackAbility === ability;
                                      return (
                                        <TouchableOpacity
                                          key={`${item.draftId}-ability-${ability}`}
                                          onPress={() => updateLootDraftItem(item.draftId, { attackAbility: ability })}
                                          style={[
                                            styles.chip,
                                            {
                                              paddingHorizontal: 8,
                                              paddingVertical: 4,
                                              borderColor: active ? c.primary : c.border,
                                              backgroundColor: active ? c.primary + "22" : c.background,
                                            },
                                          ]}
                                        >
                                          <Text style={{ fontSize: 10, color: active ? c.primary : c.mutedForeground, fontWeight: "700" }}>{ability.toUpperCase()}</Text>
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </View>
                                </View>

                                <View style={{ gap: 6 }}>
                                  <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>PROFICIENCY</Text>
                                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                                    {[
                                      { label: "Proficient", value: true },
                                      { label: "Not Proficient", value: false },
                                    ].map((entry) => {
                                      const active = item.isProficient === entry.value;
                                      return (
                                        <TouchableOpacity
                                          key={`${item.draftId}-prof-${entry.label}`}
                                          onPress={() => updateLootDraftItem(item.draftId, { isProficient: entry.value })}
                                          style={[
                                            styles.chip,
                                            {
                                              paddingHorizontal: 8,
                                              paddingVertical: 4,
                                              borderColor: active ? c.primary : c.border,
                                              backgroundColor: active ? c.primary + "22" : c.background,
                                            },
                                          ]}
                                        >
                                          <Text style={{ fontSize: 10, color: active ? c.primary : c.mutedForeground, fontWeight: "700" }}>{entry.label}</Text>
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </View>
                                </View>

                                <View style={{ flexDirection: "row", gap: 8 }}>
                                  <View style={{ flex: 1, gap: 6 }}>
                                    <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>DAMAGE DICE</Text>
                                    <TextInput
                                      value={item.damageDice ?? ""}
                                      onChangeText={(value) => updateLootDraftItem(item.draftId, { damageDice: value })}
                                      placeholder="e.g. 1d8"
                                      placeholderTextColor={c.mutedForeground}
                                      style={[styles.input, { borderColor: c.border, backgroundColor: c.background, color: c.foreground }]}
                                    />
                                  </View>
                                  <View style={{ flex: 1, gap: 6 }}>
                                    <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>DAMAGE TYPE</Text>
                                    <TextInput
                                      value={item.damageType ?? ""}
                                      onChangeText={(value) => updateLootDraftItem(item.draftId, { damageType: value })}
                                      placeholder="e.g. slashing"
                                      placeholderTextColor={c.mutedForeground}
                                      style={[styles.input, { borderColor: c.border, backgroundColor: c.background, color: c.foreground }]}
                                    />
                                  </View>
                                </View>

                                <View style={{ gap: 6 }}>
                                  <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>WEAPON RANGE</Text>
                                  <TextInput
                                    value={item.weaponRange ?? ""}
                                    onChangeText={(value) => updateLootDraftItem(item.draftId, { weaponRange: value })}
                                    placeholder="e.g. melee, 30/120 ft"
                                    placeholderTextColor={c.mutedForeground}
                                    style={[styles.input, { borderColor: c.border, backgroundColor: c.background, color: c.foreground }]}
                                  />
                                </View>
                              </View>
                            )}

                            <View style={{ gap: 6 }}>
                              <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>ITEM TAGS</Text>
                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                                {tagOptions.map((tag) => {
                                  const active = (item.tags ?? []).includes(tag);
                                  return (
                                    <TouchableOpacity
                                      key={`${item.draftId}-tag-${tag}`}
                                      onPress={() => toggleLootDraftTag(item.draftId, tag)}
                                      style={[
                                        styles.chip,
                                        {
                                          paddingHorizontal: 8,
                                          paddingVertical: 4,
                                          borderColor: active ? c.primary : c.border,
                                          backgroundColor: active ? c.primary + "22" : c.background,
                                        },
                                      ]}
                                    >
                                      <Text style={{ fontSize: 10, color: active ? c.primary : c.mutedForeground, fontWeight: "700" }}>{tag}</Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </View>
                          </View>
                        )}
                        {item.needsReview && (
                          <View style={{ gap: 6 }}>
                            <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Review item effects before assigning. Unsupported effects still require manual handling.</Text>
                            {item.inventoryItem?.equippedEffects?.map(effect => <Text key={effect.id} style={{ color: c.foreground, fontSize: 12 }}>{effect.label}{effect.description ? `: ${effect.description}` : ""}{effect.uses != null ? ` (${effect.uses} uses; ${effect.resetOn ?? "reset unspecified"})` : ""}</Text>)}
                            {item.inventoryItem?.mechanics?.mechanics.map(mechanic => <Text key={mechanic.mechanicId} style={{ color: c.foreground, fontSize: 12 }}>{mechanic.name}{mechanic.description ? `: ${mechanic.description}` : ""}</Text>)}
                            <TouchableOpacity onPress={() => updateLootDraftItem(item.draftId, { reviewAcknowledged: !item.reviewAcknowledged })} accessibilityRole="checkbox" accessibilityState={{ checked: !!item.reviewAcknowledged }}>
                              <Text style={{ color: c.primary, fontWeight: "700" }}>{item.reviewAcknowledged ? "✓ Effects reviewed" : "Confirm effects reviewed"}</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        {lootAssignmentMode === "by-player" && (
                          <View style={{ gap: 6 }}>
                            <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>ASSIGN TO</Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                              {members.map((member) => {
                                const active = item.targetMemberId === member.id;
                                return (
                                  <TouchableOpacity
                                    key={`${item.draftId}-${member.id}`}
                                    onPress={() => updateLootDraftItem(item.draftId, { targetMemberId: member.id })}
                                    style={[
                                      styles.chip,
                                      {
                                        borderColor: active ? c.primary : rowValidation.missingTarget ? "#ef4444" : c.border,
                                        backgroundColor: active ? c.primary + "22" : c.card,
                                      },
                                    ]}
                                  >
                                    <Text style={{ fontSize: 10, color: active ? c.primary : c.mutedForeground, fontWeight: "700" }}>{member.characterName}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                            {rowValidation.missingTarget && (
                              <Text style={{ fontSize: 10, color: "#ef4444" }}>Pick a player target for this row.</Text>
                            )}
                          </View>
                        )}
                        {rowValidation.missingName && (
                          <Text style={{ fontSize: 10, color: "#ef4444" }}>Item name is required.</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {lootDraftItems.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>ASSIGNMENT PREVIEW</Text>
                  {lootDraftPreview.length === 0 ? (
                    <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                      {lootAssignmentMode === "selected-players"
                        ? "Select one or more players above to preview shared loot assignments."
                        : "Pick a player for each row to preview distribution."}
                    </Text>
                  ) : (
                    lootDraftPreview.map((entry) => (
                      <View key={entry.targetMemberId} style={[styles.chip, { borderColor: c.border, backgroundColor: c.background, borderRadius: 10, padding: 10 }]}> 
                        <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "700" }}>{entry.targetName}</Text>
                        <View style={{ marginTop: 6, gap: 4 }}>
                          {entry.items.map((draft) => (
                            <Text key={`${entry.targetMemberId}-${draft.draftId}`} style={{ fontSize: 11, color: c.mutedForeground }}>
                              {draft.quantity}x {draft.name || "Unnamed item"} ({draft.category})
                            </Text>
                          ))}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              <TouchableOpacity
                onPress={() => void handleAssignLootDraft()}
                disabled={assigningLoot || lootDraftItems.length === 0 || hasLootDraftValidationIssues}
                style={[styles.btnPrimary, styles.btnFull, { backgroundColor: c.primary, opacity: assigningLoot || lootDraftItems.length === 0 || hasLootDraftValidationIssues ? 0.6 : 1 }]}
              >
                <Feather name="gift" size={14} color="#fff" />
                <Text style={styles.btnText}>{assigningLoot ? "Assigning..." : lootAssignmentMode === "selected-players" ? "Assign Loot to Selected Players" : "Assign Loot by Player"}</Text>
              </TouchableOpacity>

              {!!combatState?.lootAssignments?.length && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>Recent Assignments</Text>
                  {combatState.lootAssignments.slice(0, 8).map((assignment) => {
                    const targetName = members.find((m) => m.id === assignment.targetMemberId)?.characterName ?? "Unknown";
                    return (
                      <View key={assignment.id} style={[styles.chip, { borderColor: c.border, backgroundColor: c.background, flexDirection: "row", justifyContent: "space-between" }]}>
                        <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "600", flex: 1 }}>
                          {assignment.item.quantity}x {assignment.item.name}{" -> "}{targetName}
                        </Text>
                        <Text style={{ fontSize: 10, color: assignment.claimedAt ? "#22C55E" : c.mutedForeground, fontWeight: "700" }}>
                          {assignment.claimedAt ? "CLAIMED" : "PENDING"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
            )}

            {activeControlTab === "notes" && (
            <View style={[styles.controlGroup, { borderColor: c.border, backgroundColor: c.background }]}> 
              <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700", letterSpacing: 0.4 }}>QUESTS AND NOTES DELIVERY</Text>
              <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                Send selected DM quests and journal notes to players. Optionally include people and locations linked to quests.
              </Text>
              <TouchableOpacity onPress={() => router.push("/dm-notes")} style={[styles.chip, { borderColor: c.border, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6 }]}>
                <Feather name="book-open" size={14} color={c.foreground} />
                <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "700" }}>Open DM Notes Menu</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {dmNotesPayload.quests.map((quest) => {
                  const selected = selectedQuestIds.includes(quest.id);
                  return (
                    <TouchableOpacity
                      key={quest.id}
                      onPress={() => setSelectedQuestIds((prev) => prev.includes(quest.id) ? prev.filter((id) => id !== quest.id) : [...prev, quest.id])}
                      style={[
                        styles.chip,
                        {
                          borderColor: selected ? c.primary : c.border,
                          backgroundColor: selected ? c.primary + "22" : c.background,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, color: selected ? c.primary : c.mutedForeground, fontWeight: "700" }}>{quest.name} ({quest.status})</Text>
                    </TouchableOpacity>
                  );
                })}
                {dmNotesPayload.quests.length === 0 && (
                  <Text style={{ fontSize: 11, color: c.mutedForeground }}>No DM quests found yet. Create them in DM Notes Menu.</Text>
                )}
              </View>
              <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>JOURNAL NOTES</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {dmNotesPayload.notes.map((note) => {
                  const selected = selectedNoteIds.includes(note.id);
                  return (
                    <TouchableOpacity key={note.id}
                      onPress={() => setSelectedNoteIds((prev) => prev.includes(note.id) ? prev.filter((id) => id !== note.id) : [...prev, note.id])}
                      style={[styles.chip, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary + "22" : c.background }]}>
                      <Text style={{ fontSize: 11, color: selected ? c.primary : c.mutedForeground, fontWeight: "700" }}>{note.title}</Text>
                    </TouchableOpacity>
                  );
                })}
                {dmNotesPayload.notes.length === 0 && (
                  <Text style={{ fontSize: 11, color: c.mutedForeground }}>No DM journal notes found yet.</Text>
                )}
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setIncludeRelatedPeople((v) => !v)}
                  style={[styles.chip, { borderColor: includeRelatedPeople ? c.primary : c.border, backgroundColor: includeRelatedPeople ? c.primary + "22" : c.background }]}
                >
                  <Text style={{ fontSize: 11, color: includeRelatedPeople ? c.primary : c.mutedForeground, fontWeight: "700" }}>Include linked People</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIncludeRelatedLocations((v) => !v)}
                  style={[styles.chip, { borderColor: includeRelatedLocations ? c.primary : c.border, backgroundColor: includeRelatedLocations ? c.primary + "22" : c.background }]}
                >
                  <Text style={{ fontSize: 11, color: includeRelatedLocations ? c.primary : c.mutedForeground, fontWeight: "700" }}>Include linked Locations</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => void handleSendQuestNotes()}
                disabled={sendingNotes || notesSelectedTargets.length === 0}
                style={[styles.btnPrimary, styles.btnFull, { backgroundColor: c.primary, opacity: sendingNotes || notesSelectedTargets.length === 0 ? 0.6 : 1 }]}
              >
                <Feather name="send" size={14} color="#fff" />
                <Text style={styles.btnText}>{sendingNotes ? "Sending..." : "Send Quests and Notes to Selected Players"}</Text>
              </TouchableOpacity>

              {!!combatState?.noteAssignments?.length && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>Recent Note Assignments</Text>
                  {combatState.noteAssignments.slice(0, 8).map((assignment) => {
                    const targetName = members.find((m) => m.id === assignment.targetMemberId)?.characterName ?? "Unknown";
                    return (
                      <View key={assignment.id} style={[styles.chip, { borderColor: c.border, backgroundColor: c.background, flexDirection: "row", justifyContent: "space-between" }]}>
                        <Text style={{ fontSize: 11, color: c.foreground, fontWeight: "600", flex: 1 }}>
                          {assignment.payload.notes?.length ?? 0} note(s), {assignment.payload.quests.length} quest(s) {" -> "}{targetName}
                        </Text>
                        <Text style={{ fontSize: 10, color: assignment.acceptedAt ? "#22C55E" : c.mutedForeground, fontWeight: "700" }}>
                          {assignment.acceptedAt ? "ACCEPTED" : "PENDING"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
            )}

            {activeControlTab === "turn" && !!combatState?.rollRequests?.length && (
              <View style={{ width: "100%", gap: 6 }}>
                <Text style={{ fontSize: 12, color: c.mutedForeground, fontWeight: "700" }}>Recent Prompts</Text>
                {combatState.rollRequests.slice(0, 4).map((request) => {
                  const answered = request.responses.length;
                  const total = request.targetMemberIds.length;
                  return (
                    <View key={request.id} style={[styles.errorBox, { borderColor: c.border, backgroundColor: c.background }]}> 
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "700" }}>{request.label}</Text>
                        <Text style={{ fontSize: 11, color: c.mutedForeground }}>{answered}/{total} responses</Text>
                        {request.responses.length > 0 && (
                          <Text style={{ fontSize: 11, color: c.mutedForeground }}>
                            {request.responses
                              .map((r) => {
                                const name = members.find((m) => m.id === r.memberId)?.characterName ?? "Unknown";
                                return `${name}: ${r.total}`;
                              })
                              .join("  |  ")}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            </>
            )}
          </View>

          {error ? (
            <View style={[styles.errorBox, { borderColor: "#f87171" + "55", backgroundColor: "#f87171" + "11" }]}>
              <Feather name="alert-circle" size={14} color="#f87171" />
              <Text style={{ fontSize: 13, color: "#f87171", flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          {combatState !== null && combatState !== undefined && (
            <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border, gap: 8 }]}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsBattleLogExpanded((prev) => !prev)}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: c.foreground }}>Battle Log</Text>
                  <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>({sortedBattleLog.length})</Text>
                </View>
                <Feather name={isBattleLogExpanded ? "chevron-up" : "chevron-down"} size={15} color={c.mutedForeground} />
              </TouchableOpacity>
              {isBattleLogExpanded && (
                <View style={[styles.eventLogBox, { borderColor: c.border, backgroundColor: c.background }]}>
                  {sortedBattleLog.length === 0 ? (
                    <View style={{ padding: 16, alignItems: "center" }}>
                      <Text style={{ fontSize: 12, color: c.mutedForeground, textAlign: "center" }}>
                        No events recorded yet. Events appear here during live encounters.
                      </Text>
                    </View>
                  ) : (
                    <ScrollView
                      ref={battleLogScrollRef}
                      showsVerticalScrollIndicator
                      onContentSizeChange={() => battleLogScrollRef.current?.scrollToEnd({ animated: true })}
                      contentContainerStyle={{ padding: 10, gap: 6 }}
                    >
                      {sortedBattleLog.map((evt) => {
                        const actorName = evt.memberId
                          ? members.find((m) => m.id === evt.memberId)?.characterName
                            ?? combatState?.combatNpcs.find((n) => n.id === evt.memberId)?.name
                            ?? "Source unavailable"
                          : "System";
                        return (
                          <Text key={evt.id} style={{ fontSize: 12, color: c.mutedForeground, lineHeight: 17 }}>
                            [{new Date(evt.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}] {actorName}: {formatBattleLogMessage(evt)}
                          </Text>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>
          )}

          <View style={{ width: "100%", alignItems: "flex-end" }}>
            <TouchableOpacity
              onPress={() => updateSettings({ disablePartyCardThemes: !settings.disablePartyCardThemes })}
              style={[styles.chip, { borderColor: settings.disablePartyCardThemes ? c.primary : c.border, backgroundColor: settings.disablePartyCardThemes ? c.primary + "22" : c.background }]}
            >
              <Text style={{ fontSize: 11, color: settings.disablePartyCardThemes ? c.primary : c.mutedForeground, fontWeight: "700" }}>
                Disable Themes: {settings.disablePartyCardThemes ? "ON" : "OFF"}
              </Text>
            </TouchableOpacity>
          </View>

          {sortedMembers.length === 0 && (combatState?.combatNpcs?.length ?? 0) === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
              <Feather name="users" size={32} color={c.mutedForeground} />
              <Text style={{ color: c.mutedForeground, fontSize: 14, textAlign: "center" }}>
                No party members yet.{"\n"}Players join using code{" "}
                <Text style={{ color: c.primary, fontWeight: "700" }}>{watchedCode}</Text>.
              </Text>
            </View>
          ) : (() => {
            // Build unified encounter groups: collect all battle IDs, then for each group
            // show members + NPCs sorted by initiative descending.
            const initiativeMap = new Map(
              (combatState?.initiative ?? []).map((e) => [e.memberId, e.initiativeTotal])
            );

            // Gather all battle IDs from members and NPCs
            const allBattleIds = new Set<string>();
            for (const m of sortedMembers) {
              allBattleIds.add(combatState?.participantBattleById?.[m.id] ?? "no-battle");
            }
            for (const npc of (combatState?.combatNpcs ?? [])) {
              allBattleIds.add(combatState?.participantBattleById?.[npc.id] ?? "no-battle");
            }

            const orderedBattleIds = [...allBattleIds].sort((a, b) => {
              if (a === "no-battle") return 1;
              if (b === "no-battle") return -1;
              return a.localeCompare(b);
            });

            let encounterIdx = 0;
            return orderedBattleIds.map((bid) => {
              const isActiveBattle = bid !== "no-battle";
              const label = isActiveBattle ? getEncounterLabel(++encounterIdx) : "No Active Encounter";

              const membersInGroup = sortedMembers.filter(
                (m) => (combatState?.participantBattleById?.[m.id] ?? "no-battle") === bid
              );
              const npcsInGroup = (combatState?.combatNpcs ?? []).filter(
                (npc) => (combatState?.participantBattleById?.[npc.id] ?? "no-battle") === bid
              );
              const totalCount = membersInGroup.length + npcsInGroup.length;

              // Sort members + NPCs together by initiative descending, unrolled last
              type ParticipantEntry = { kind: "member"; id: string } | { kind: "npc"; id: string };
              const allParticipants: ParticipantEntry[] = [
                ...membersInGroup.map((m): ParticipantEntry => ({ kind: "member", id: m.id })),
                ...npcsInGroup.map((npc): ParticipantEntry => ({ kind: "npc", id: npc.id })),
              ].sort((a, b) => {
                const ai = initiativeMap.get(a.id);
                const bi = initiativeMap.get(b.id);
                if (typeof ai === "number" && typeof bi === "number") return bi - ai;
                if (typeof ai === "number") return -1;
                if (typeof bi === "number") return 1;
                return 0;
              });

              const currentTurnId = getCurrentTurnIdForBattle(bid);

              return (
                <View key={bid} style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "800", letterSpacing: 0.5 }}>
                      {label} ({totalCount})
                    </Text>
                    {isActiveBattle && (
                      <TouchableOpacity
                        onPress={() => void handleEndEncounter(bid)}
                        disabled={endingEncounterId === bid}
                        style={[styles.chip, { borderColor: "#f87171" + "66", backgroundColor: "#f87171" + "11", flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 8 }]}
                      >
                        <Feather name="x-circle" size={11} color="#f87171" />
                        <Text style={{ fontSize: 10, color: "#f87171", fontWeight: "800" }}>
                          {endingEncounterId === bid ? "Ending..." : "End Encounter"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {allParticipants.map((p) => {
                    if (p.kind === "member") {
                      const m = membersInGroup.find((mem) => mem.id === p.id)!;
                      const initiativeTotal = initiativeMap.get(m.id);
                      return (
                        <MemberCard
                          key={m.id}
                          member={m}
                          initiativeTotal={initiativeTotal}
                          isCurrentTurn={currentTurnId === m.id}
                          disableThemes={settings.disablePartyCardThemes}
                          onPressName={() => handleOpenMemberSheet(m.id)}
                          onRemove={() => handleRemoveMember(m)}
                          removing={removingMemberId === m.id}
                        />
                      );
                    }

                    // NPC card
                    const npc = npcsInGroup.find((n) => n.id === p.id)!;
                    const colorsByDisposition = getDispositionColors(npc.disposition);
                    const initiativeTotal = initiativeMap.get(npc.id);
                    const visibleStatKeys = npc.visibleStatKeys ?? [];
                    const conditions = npc.conditions ?? [];
                    const presentation = getCombatNpcPresentation(npc, members, null);
                    const manualInitInput = npcInitiativeInputById[npc.id] ?? "";
                    const bonus = npc.coreStats.initiativeBonus ?? 0;

                    return (
                      <View key={npc.id} style={[styles.card, { backgroundColor: c.card, borderColor: colorsByDisposition.border }]}>
                        {/* Header row */}
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colorsByDisposition.bg, borderWidth: 1, borderColor: colorsByDisposition.border, alignItems: "center", justifyContent: "center" }}>
                              <Feather name="shield" size={15} color={colorsByDisposition.fg} />
                            </View>
                            <View>
                              <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground }}>{presentation.displayName}</Text>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text style={{ fontSize: 12, color: colorsByDisposition.fg, fontWeight: "700", textTransform: "capitalize" }}>{npc.disposition}</Text>
                                <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>{presentation.badgeLabel}</Text>
                              </View>
                            </View>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            {typeof initiativeTotal === "number" && (
                              <View style={[styles.acBadge, { backgroundColor: "#22C55E22", borderColor: "#22C55E55" }]}>
                                <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "600" }}>INIT</Text>
                                <Text style={{ fontSize: 14, fontWeight: "800", color: "#22C55E" }}>{initiativeTotal}</Text>
                              </View>
                            )}
                            <TouchableOpacity onPress={() => void handleRemoveCombatNpc(npc.id)} style={[styles.removeBtn, { borderColor: "#f87171" + "66" }]}>
                              <Feather name="trash-2" size={14} color="#f87171" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <ConditionBadges conditions={conditions} />
                        {npc.companionAdmission?.detachedAt && (
                          <CompanionRecoveryPanel npc={npc} members={members} revision={combatState?.stateRevision} colors={c}
                            onRecover={async payload => {
                              try {
                                await recoverPartyCompanion(watchedCode!, npc.id, payload);
                              } catch (failure) {
                                await refreshCombat(watchedCode!).catch(() => {});
                                throw failure;
                              }
                              await refreshCombat(watchedCode!);
                              showStatusPill("Companion restored; ready for encounter placement.", "positive");
                            }} />
                        )}


                        {/* Initiative section */}
                        {!npc.companionAdmission?.detachedAt && (
                        <View style={{ marginTop: 8, gap: 6 }}>
                          <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>
                            INITIATIVE {typeof initiativeTotal !== "number" ? "(not rolled)" : `· ${initiativeTotal}`}{bonus !== 0 ? ` (bonus: ${bonus >= 0 ? "+" : ""}${bonus})` : ""}
                          </Text>
                          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                            <TextInput
                              value={manualInitInput}
                              onChangeText={(text) => setNpcInitiativeInputById((prev) => ({ ...prev, [npc.id]: text.replace(/[^0-9]/g, "") }))}
                              placeholder="d20 roll"
                              placeholderTextColor={c.mutedForeground}
                              keyboardType="number-pad"
                              style={[styles.input ?? {}, { flex: 1, height: 34, borderWidth: 1, borderColor: c.border, borderRadius: 6, paddingHorizontal: 8, color: c.foreground, backgroundColor: c.background, fontSize: 13 }]}
                            />
                            <TouchableOpacity
                              onPress={() => {
                                const parsed = parseInt(manualInitInput, 10);
                                void handleRollNpcInitiative(npc.id, !isNaN(parsed) && parsed >= 1 && parsed <= 20 ? parsed : undefined);
                              }}
                              disabled={rollingNpcInitiativeId === npc.id}
                              style={[styles.chip, { borderColor: c.primary + "66", backgroundColor: c.primary + "22", flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 10 }]}
                            >
                              <Feather name="zap" size={11} color={c.primary} />
                              <Text style={{ fontSize: 11, color: c.primary, fontWeight: "800" }}>
                                {rollingNpcInitiativeId === npc.id ? "..." : manualInitInput ? "Set" : "Auto Roll"}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        )}
                        {/* Visible stats */}
                        <View style={{ marginTop: 6, gap: 6 }}>
                          <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>PLAYER-VISIBLE NPC STATS</Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            {NPC_STAT_PILLS.map((pill) => {
                              const isVisible = visibleStatKeys.includes(pill.key);
                              const rawValue = npc.coreStats?.[pill.key];
                              const value = typeof rawValue === "number"
                                ? (pill.key === "initiativeBonus" ? `${rawValue >= 0 ? "+" : ""}${rawValue}` : `${rawValue}`)
                                : "--";
                              return (
                                <TouchableOpacity
                                  key={`${npc.id}-${pill.key}`}
                                  onPress={() => void handleToggleNpcVisibleStat(npc.id, pill.key)}
                                  style={[styles.conditionBadge, { borderColor: isVisible ? c.primary : c.border, backgroundColor: isVisible ? c.primary + "22" : c.background }]}
                                >
                                  <Text style={{ fontSize: 10, color: isVisible ? c.primary : c.mutedForeground, fontWeight: "800" }}>
                                    {pill.label} {value}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>

                        {currentTurnId === npc.id && (
                          <View style={{ marginTop: 8, alignSelf: "flex-start", borderWidth: 1, borderColor: "#22C55E", backgroundColor: "#22C55E22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 10, color: "#22C55E", fontWeight: "800", letterSpacing: 0.4 }}>CURRENT TURN</Text>
                          </View>
                        )}

                        {/* ── HP and AC controls ─────────────────────────────*/}
                        {npc.dummyState ? (
                          <>
                            <View style={{ marginTop: 8, flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              {/* HP */}
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#f87171" + "55", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                                <Text style={{ fontSize: 10, color: "#f87171", fontWeight: "700" }}>HP</Text>
                                <TouchableOpacity
                                  onPress={() => void handleUpdateNpcDummyState(npc.id, { currentHp: Math.max(0, (npc.dummyState?.currentHp ?? 0) - 1) })}
                                  style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#f87171" + "22", alignItems: "center", justifyContent: "center" }}
                                >
                                  <Feather name="minus" size={10} color="#f87171" />
                                </TouchableOpacity>
                                <Text style={{ fontSize: 14, fontWeight: "800", color: c.foreground, minWidth: 28, textAlign: "center" }}>
                                  {npc.dummyState.currentHp}/{npc.dummyState.maxHp}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => void handleUpdateNpcDummyState(npc.id, { currentHp: Math.min(npc.dummyState!.maxHp, (npc.dummyState?.currentHp ?? 0) + 1) })}
                                  style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#4ade80" + "22", alignItems: "center", justifyContent: "center" }}
                                >
                                  <Feather name="plus" size={10} color="#4ade80" />
                                </TouchableOpacity>
                              </View>
                              {/* AC */}
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                                <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>AC</Text>
                                <Text style={{ fontSize: 14, fontWeight: "800", color: c.foreground }}>{npc.dummyState.armorClass}</Text>
                              </View>
                            </View>

                            {/* Action economy */}
                            <View style={{ marginTop: 8, flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                              {(
                                [
                                  { key: "actionUsed" as const, label: "Action" },
                                  { key: "bonusActionUsed" as const, label: "Bonus" },
                                  { key: "reactionUsed" as const, label: "Reaction" },
                                ] as const
                              ).map(({ key, label }) => {
                                const used = npc.dummyState?.[key] ?? false;
                                return (
                                  <TouchableOpacity
                                    key={key}
                                    onPress={() => void handleUpdateNpcDummyState(npc.id, { [key]: !used })}
                                    style={[styles.chip, { borderColor: used ? "#f87171" + "99" : "#4ade80" + "99", backgroundColor: used ? "#f87171" + "22" : "#4ade80" + "22" }]}
                                    disabled={updatingNpcDummyStateId === npc.id}
                                  >
                                    <Feather name={used ? "x-circle" : "check-circle"} size={10} color={used ? "#f87171" : "#4ade80"} />
                                    <Text style={{ fontSize: 10, color: used ? "#f87171" : "#4ade80", fontWeight: "700" }}>{label}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                              {/* Movement */}
                              {(() => {
                                const speed = npc.coreStats.speed ?? 30;
                                const movementUsed = npc.dummyState?.movementUsed ?? 0;
                                const remaining = Math.max(0, speed - movementUsed);
                                return (
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 }}>
                                      <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>
                                        MOV {remaining}/{speed} ft
                                      </Text>
                                    </View>
                                    {[5, 10, 15, 30].filter((n) => n <= speed).map((ft) => (
                                      <TouchableOpacity
                                        key={ft}
                                        onPress={() => void handleUpdateNpcDummyState(npc.id, { movementUsed: Math.min(speed, movementUsed + ft) })}
                                        style={{ borderWidth: 1, borderColor: "#F97316" + "55", backgroundColor: "#F97316" + "22", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 3 }}
                                        disabled={remaining === 0}
                                      >
                                        <Text style={{ fontSize: 9, color: "#F97316", fontWeight: "700" }}>-{ft}</Text>
                                      </TouchableOpacity>
                                    ))}
                                    {movementUsed > 0 && (
                                      <TouchableOpacity
                                        onPress={() => void handleUpdateNpcDummyState(npc.id, { movementUsed: 0 })}
                                        style={{ borderWidth: 1, borderColor: c.border, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 3 }}
                                      >
                                        <Text style={{ fontSize: 9, color: c.mutedForeground, fontWeight: "700" }}>↺</Text>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                );
                              })()}
                            </View>

                            {/* ── Attacks ──────────────────────────────────────*/}
                            {(() => {
                              const monster = npc.sourceType === "monster"
                                ? compendiumMonsters.find((m) => (isCustomMonster(m) ? m.id : m.slug) === npc.sourceId)
                                : undefined;
                              const monsterAttacks = monster ? buildMonsterAttacks(monster) : [];
                              const gearAttacks = (npc.gear ?? []).map(buildGearAttack).filter((a): a is Attack => Boolean(a));
                              const attacks = [...monsterAttacks, ...gearAttacks];
                              if (attacks.length === 0) return null;
                              return (
                                <View style={{ marginTop: 8, gap: 4 }}>
                                  <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>ATTACKS</Text>
                                  {attacks.map((atk) => {
                                    const rollKey = `${npc.id}-${atk.id}`;
                                    const isExpanded = expandedNpcAttackId === rollKey;
                                    const rolls = npcAttackRollsById[rollKey];
                                    return (
                                      <View key={rollKey} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, overflow: "hidden" }}>
                                        <TouchableOpacity
                                          onPress={() => setExpandedNpcAttackId(isExpanded ? null : rollKey)}
                                          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, backgroundColor: c.card }}
                                        >
                                          <View>
                                            <Text style={{ fontSize: 12, fontWeight: "700", color: c.foreground }}>{atk.name}</Text>
                                            <Text style={{ fontSize: 10, color: c.mutedForeground }}>
                                              {atk.attackBonus >= 0 ? "+" : ""}{atk.attackBonus} to hit · {atk.damageDice}{atk.damageModifier !== 0 ? ` ${atk.damageModifier >= 0 ? "+" : ""}${atk.damageModifier}` : ""} {atk.damageType}
                                              {atk.range ? ` · ${atk.range}` : ""}
                                            </Text>
                                          </View>
                                          <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={c.mutedForeground} />
                                        </TouchableOpacity>
                                        {isExpanded && (
                                          <View style={{ padding: 8, gap: 6, backgroundColor: c.background }}>
                                            <TouchableOpacity
                                              onPress={() => {
                                                const d20 = Math.floor(Math.random() * 20) + 1;
                                                if (settings.effects.enabled && settings.effects.critFailBurst) {
                                                  if (d20 === 20) triggerEffect("nat_20");
                                                  if (d20 === 1) triggerEffect("nat_1");
                                                }
                                                const attackTotal = Math.max(1, d20 + atk.attackBonus);
                                                const dmgParts = atk.damageDice.split("d");
                                                const rawNumDice = parseInt(dmgParts[0] ?? "1", 10);
                                                const rawDieSize = parseInt(dmgParts[1] ?? "6", 10);
                                                const numDice = Number.isFinite(rawNumDice) ? Math.max(1, rawNumDice) : 1;
                                                const dieSize = Number.isFinite(rawDieSize) ? Math.max(1, rawDieSize) : 6;
                                                let dmgTotal = atk.damageModifier;
                                                for (let i = 0; i < numDice; i++) dmgTotal += Math.floor(Math.random() * dieSize) + 1;
                                                const finalDamage = Math.max(1, dmgTotal);
                                                setNpcAttackRollsById((prev) => ({
                                                  ...prev,
                                                  [rollKey]: { attackRoll: `d20(${d20}) = ${attackTotal}`, damageRoll: `${finalDamage} ${atk.damageType}` },
                                                }));
                                              }}
                                              style={[styles.chip, { borderColor: c.primary + "55", backgroundColor: c.primary + "22", alignSelf: "flex-start" }]}
                                            >
                                              <Feather name="zap" size={10} color={c.primary} />
                                              <Text style={{ fontSize: 11, color: c.primary, fontWeight: "700" }}>Roll Attack + Damage</Text>
                                            </TouchableOpacity>
                                            {rolls && (
                                              <View style={{ gap: 2 }}>
                                                <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "700" }}>Attack: {rolls.attackRoll}</Text>
                                                <Text style={{ fontSize: 12, color: "#f97316", fontWeight: "700" }}>Damage: {rolls.damageRoll}</Text>
                                              </View>
                                            )}
                                          </View>
                                        )}
                                      </View>
                                    );
                                  })}
                                </View>
                              );
                            })()}

                            {/* ── Gear management ──────────────────────────────*/}
                            <View style={{ marginTop: 8 }}>
                              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <Text style={{ fontSize: 11, color: c.mutedForeground, fontWeight: "700" }}>GEAR</Text>
                                <TouchableOpacity
                                  onPress={() => setNpcGearFormOpenById((prev) => ({ ...prev, [npc.id]: !prev[npc.id] }))}
                                  style={[styles.chip, { borderColor: c.primary + "55", backgroundColor: c.primary + "22" }]}
                                >
                                  <Feather name="plus" size={10} color={c.primary} />
                                  <Text style={{ fontSize: 10, color: c.primary, fontWeight: "700" }}>Add Item</Text>
                                </TouchableOpacity>
                              </View>
                              {(npc.gear ?? []).length > 0 && (
                                <View style={{ gap: 4 }}>
                                  {(npc.gear ?? []).map((item) => (
                                    <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: c.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 }}>
                                      <TouchableOpacity
                                        onPress={() => {
                                          const updated = (npc.gear ?? []).map((g) => g.id === item.id ? { ...g, equipped: !g.equipped } : g);
                                          void handleUpdateNpcGear(npc.id, updated);
                                        }}
                                      >
                                        <Feather name={item.equipped ? "check-square" : "square"} size={13} color={item.equipped ? c.primary : c.mutedForeground} />
                                      </TouchableOpacity>
                                      <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 12, color: c.foreground, fontWeight: "600" }}>{item.name}</Text>
                                        {item.damageDice && <Text style={{ fontSize: 10, color: c.mutedForeground }}>{item.damageDice} {item.damageType}</Text>}
                                      </View>
                                      <TouchableOpacity
                                        onPress={() => {
                                          const updated = (npc.gear ?? []).filter((g) => g.id !== item.id);
                                          void handleUpdateNpcGear(npc.id, updated);
                                        }}
                                      >
                                        <Feather name="trash-2" size={12} color="#f87171" />
                                      </TouchableOpacity>
                                    </View>
                                  ))}
                                </View>
                              )}
                              {npcGearFormOpenById[npc.id] && (
                                <View style={{ marginTop: 6, gap: 6, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, backgroundColor: c.background }}>
                                  <TextInput
                                    placeholder="Item name"
                                    placeholderTextColor={c.mutedForeground}
                                    value={npcGearFormById[npc.id]?.name ?? ""}
                                    onChangeText={(text) => setNpcGearFormById((prev) => ({ ...prev, [npc.id]: { ...prev[npc.id], name: text } }))}
                                    style={{ borderWidth: 1, borderColor: c.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, color: c.foreground, backgroundColor: c.card }}
                                  />
                                  <View style={{ flexDirection: "row", gap: 6 }}>
                                    <TextInput
                                      placeholder="Dice (e.g. 1d8)"
                                      placeholderTextColor={c.mutedForeground}
                                      value={npcGearFormById[npc.id]?.damageDice ?? ""}
                                      onChangeText={(text) => setNpcGearFormById((prev) => ({ ...prev, [npc.id]: { ...prev[npc.id], damageDice: text } }))}
                                      style={{ flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, color: c.foreground, backgroundColor: c.card }}
                                    />
                                    <TextInput
                                      placeholder="Type (e.g. slashing)"
                                      placeholderTextColor={c.mutedForeground}
                                      value={npcGearFormById[npc.id]?.damageType ?? ""}
                                      onChangeText={(text) => setNpcGearFormById((prev) => ({ ...prev, [npc.id]: { ...prev[npc.id], damageType: text } }))}
                                      style={{ flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, color: c.foreground, backgroundColor: c.card }}
                                    />
                                  </View>
                                  <TouchableOpacity
                                    onPress={() => {
                                      const form = npcGearFormById[npc.id] ?? {};
                                      if (!form.name?.trim()) return;
                                      const newItem: CombatNpcGearItem = {
                                        id: `gear-${Date.now()}`,
                                        name: form.name.trim(),
                                        category: "weapon",
                                        equipped: true,
                                        damageDice: form.damageDice?.trim() || undefined,
                                        damageType: form.damageType?.trim() || undefined,
                                      };
                                      void handleUpdateNpcGear(npc.id, [...(npc.gear ?? []), newItem]);
                                      setNpcGearFormById((prev) => ({ ...prev, [npc.id]: {} }));
                                      setNpcGearFormOpenById((prev) => ({ ...prev, [npc.id]: false }));
                                    }}
                                    style={[styles.chip, { borderColor: c.primary + "55", backgroundColor: c.primary + "22", alignSelf: "flex-start" }]}
                                  >
                                    <Text style={{ fontSize: 11, color: c.primary, fontWeight: "700" }}>Add</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>

                            {/* End Turn */}
                            {currentTurnId === npc.id && (
                              <TouchableOpacity
                                onPress={() => void handleDummyEndTurn(npc.id)}
                                disabled={advancingTurn}
                                style={[styles.btn, { backgroundColor: "#22C55E22", borderColor: "#22C55E", borderWidth: 1, marginTop: 10 }]}
                              >
                                <Feather name="skip-forward" size={13} color="#22C55E" />
                                <Text style={{ fontSize: 13, fontWeight: "700", color: "#22C55E" }}>
                                  {advancingTurn ? "Ending..." : "End NPC Turn"}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </>
                        ) : (
                          <TouchableOpacity
                            onPress={() => void handleInitNpcDummyState(npc)}
                            disabled={updatingNpcDummyStateId === npc.id}
                            style={[styles.chip, { borderColor: c.primary + "55", backgroundColor: c.primary + "22", alignSelf: "flex-start", marginTop: 8 }]}
                          >
                            <Feather name="activity" size={10} color={c.primary} />
                            <Text style={{ fontSize: 10, color: c.primary, fontWeight: "700" }}>
                              {updatingNpcDummyStateId === npc.id ? "Initializing..." : "Enable Turn Controls"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            });
          })()}
        </ScrollHintScrollView>

        <Modal visible={showCustomMonsterForm} animationType="slide" transparent onRequestClose={closeCustomMonsterForm}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: c.background }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: c.foreground }}>
                  {editingMonsterId ? "Edit Monster" : "Customize Monster"}
                </Text>
                <TouchableOpacity onPress={closeCustomMonsterForm} activeOpacity={0.6}>
                  <Feather name="x" size={20} color={c.foreground} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: c.mutedForeground }]}>NAME</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                    value={customMonsterForm.name}
                    onChangeText={(text) => setCustomMonsterForm((prev) => ({ ...prev, name: text }))}
                    placeholder="e.g. Goblin Rider"
                    placeholderTextColor={c.mutedForeground}
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: c.mutedForeground }]}>DESCRIPTION</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground, minHeight: 88, textAlignVertical: "top" }]}
                    value={customMonsterForm.notes ?? ""}
                    onChangeText={(text) => setCustomMonsterForm((prev) => ({ ...prev, notes: text }))}
                    placeholder="Monster description, notes, or customization notes..."
                    placeholderTextColor={c.mutedForeground}
                    multiline
                  />
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formField, styles.formRowHalf]}>
                    <Text style={[styles.formLabel, { color: c.mutedForeground }]}>SIZE</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                      value={customMonsterForm.size}
                      onChangeText={(text) => setCustomMonsterForm((prev) => ({ ...prev, size: text }))}
                    />
                  </View>
                  <View style={[styles.formField, styles.formRowHalf]}>
                    <Text style={[styles.formLabel, { color: c.mutedForeground }]}>TYPE</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                      value={customMonsterForm.type}
                      onChangeText={(text) => setCustomMonsterForm((prev) => ({ ...prev, type: text }))}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formField, styles.formRowHalf]}>
                    <Text style={[styles.formLabel, { color: c.mutedForeground }]}>AC</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                      keyboardType="number-pad"
                      value={customMonsterForm.armor_class.toString()}
                      onChangeText={(text) => setCustomMonsterForm((prev) => ({ ...prev, armor_class: parseInt(text, 10) || 10 }))}
                    />
                  </View>
                  <View style={[styles.formField, styles.formRowHalf]}>
                    <Text style={[styles.formLabel, { color: c.mutedForeground }]}>HP</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                      keyboardType="number-pad"
                      value={customMonsterForm.hit_points.toString()}
                      onChangeText={(text) => setCustomMonsterForm((prev) => ({ ...prev, hit_points: parseInt(text, 10) || 1 }))}
                    />
                  </View>
                </View>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: c.mutedForeground }]}>CHALLENGE RATING</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                    value={customMonsterForm.challenge_rating}
                    onChangeText={(text) => setCustomMonsterForm((prev) => ({ ...prev, challenge_rating: text }))}
                    placeholder="e.g. 1/4 or 5"
                    placeholderTextColor={c.mutedForeground}
                  />
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formField, styles.formRowHalf]}>
                    <Text style={[styles.formLabel, { color: c.mutedForeground }]}>LEVEL (optional)</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                      keyboardType="number-pad"
                      value={customMonsterForm.level !== undefined ? customMonsterForm.level.toString() : ""}
                      onChangeText={(text) => setCustomMonsterForm((prev) => ({ ...prev, level: text === "" ? undefined : parseInt(text, 10) || undefined }))}
                    />
                  </View>
                  <View style={[styles.formField, styles.formRowHalf]}>
                    <Text style={[styles.formLabel, { color: c.mutedForeground }]}>LEVEL LABEL</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                      value={customMonsterForm.levelLabel ?? ""}
                      onChangeText={(text) => setCustomMonsterForm((prev) => ({ ...prev, levelLabel: text }))}
                    />
                  </View>
                </View>

                <Text style={[styles.formLabel, { color: c.mutedForeground, marginTop: 12, marginBottom: 8 }]}>ABILITY SCORES</Text>
                <View style={styles.formRow}>
                  {(["strength", "dexterity", "constitution"] as const).map((ability) => (
                    <View key={ability} style={[styles.formField, styles.formRowThird]}>
                      <Text style={[styles.formLabel, { color: c.mutedForeground }]}>{ability.slice(0, 3).toUpperCase()}</Text>
                      <TextInput
                        style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                        keyboardType="number-pad"
                        value={customMonsterForm[ability].toString()}
                        onChangeText={(text) => setCustomMonsterForm((prev) => ({ ...prev, [ability]: parseInt(text, 10) || 10 }))}
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.formRow}>
                  {(["intelligence", "wisdom", "charisma"] as const).map((ability) => (
                    <View key={ability} style={[styles.formField, styles.formRowThird]}>
                      <Text style={[styles.formLabel, { color: c.mutedForeground }]}>{ability.slice(0, 3).toUpperCase()}</Text>
                      <TextInput
                        style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
                        keyboardType="number-pad"
                        value={customMonsterForm[ability].toString()}
                        onChangeText={(text) => setCustomMonsterForm((prev) => ({ ...prev, [ability]: parseInt(text, 10) || 10 }))}
                      />
                    </View>
                  ))}
                </View>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: c.mutedForeground }]}>ACTIONS</Text>
                  {(customMonsterForm.actions ?? []).map((action, idx) => (
                    <View key={idx} style={styles.arrayItemRow}>
                      <View style={styles.arrayItemFields}>
                        <TextInput
                          style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground, fontSize: 13 }]}
                          placeholder="Action name"
                          placeholderTextColor={c.mutedForeground}
                          value={action.name}
                          onChangeText={(text) => setCustomMonsterForm((prev) => {
                            const next = [...(prev.actions ?? [])];
                            next[idx] = { ...next[idx], name: text };
                            return { ...prev, actions: next };
                          })}
                        />
                        <TextInput
                          style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground, fontSize: 12, minHeight: 60, textAlignVertical: "top", marginTop: 4 }]}
                          placeholder="Description"
                          placeholderTextColor={c.mutedForeground}
                          value={action.desc}
                          onChangeText={(text) => setCustomMonsterForm((prev) => {
                            const next = [...(prev.actions ?? [])];
                            next[idx] = { ...next[idx], desc: text };
                            return { ...prev, actions: next };
                          })}
                          multiline
                        />
                      </View>
                      <TouchableOpacity style={[styles.deleteBtn, { borderColor: "#EF4444" + "55" }]} onPress={() => setCustomMonsterForm((prev) => {
                        const next = [...(prev.actions ?? [])];
                        next.splice(idx, 1);
                        return { ...prev, actions: next };
                      })} activeOpacity={0.7}>
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={[styles.addArrayBtn, { borderColor: c.border }]} onPress={() => setCustomMonsterForm((prev) => ({ ...prev, actions: [...(prev.actions ?? []), { name: "", desc: "" }] }))} activeOpacity={0.7}>
                    <Feather name="plus" size={14} color={c.primary} />
                    <Text style={{ fontSize: 12, color: c.primary, fontWeight: "600" }}>Add Action</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: c.mutedForeground }]}>SPECIAL ABILITIES</Text>
                  {(customMonsterForm.special_abilities ?? []).map((ability, idx) => (
                    <View key={idx} style={styles.arrayItemRow}>
                      <View style={styles.arrayItemFields}>
                        <TextInput
                          style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground, fontSize: 13 }]}
                          placeholder="Ability name"
                          placeholderTextColor={c.mutedForeground}
                          value={ability.name}
                          onChangeText={(text) => setCustomMonsterForm((prev) => {
                            const next = [...(prev.special_abilities ?? [])];
                            next[idx] = { ...next[idx], name: text };
                            return { ...prev, special_abilities: next };
                          })}
                        />
                        <TextInput
                          style={[styles.formInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground, fontSize: 12, minHeight: 60, textAlignVertical: "top", marginTop: 4 }]}
                          placeholder="Description"
                          placeholderTextColor={c.mutedForeground}
                          value={ability.desc}
                          onChangeText={(text) => setCustomMonsterForm((prev) => {
                            const next = [...(prev.special_abilities ?? [])];
                            next[idx] = { ...next[idx], desc: text };
                            return { ...prev, special_abilities: next };
                          })}
                          multiline
                        />
                      </View>
                      <TouchableOpacity style={[styles.deleteBtn, { borderColor: "#EF4444" + "55" }]} onPress={() => setCustomMonsterForm((prev) => {
                        const next = [...(prev.special_abilities ?? [])];
                        next.splice(idx, 1);
                        return { ...prev, special_abilities: next };
                      })} activeOpacity={0.7}>
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={[styles.addArrayBtn, { borderColor: c.border }]} onPress={() => setCustomMonsterForm((prev) => ({ ...prev, special_abilities: [...(prev.special_abilities ?? []), { name: "", desc: "" }] }))} activeOpacity={0.7}>
                    <Feather name="plus" size={14} color={c.primary} />
                    <Text style={{ fontSize: 12, color: c.primary, fontWeight: "600" }}>Add Ability</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: c.mutedForeground }]}>LOOT / ITEMS</Text>
                  {(customMonsterForm.loot ?? []).map((item, idx) => (
                    <View key={idx} style={[styles.arrayItemRow, { alignItems: "center" }]}>
                      <View style={[styles.arrayItemFields, { flexDirection: "row", gap: 6 }]}>
                        <TextInput
                          style={[styles.formInput, { flex: 3, backgroundColor: c.card, borderColor: c.border, color: c.foreground, fontSize: 13 }]}
                          placeholder="Item name"
                          placeholderTextColor={c.mutedForeground}
                          value={item.name}
                          onChangeText={(text) => setCustomMonsterForm((prev) => {
                            const next = [...(prev.loot ?? [])];
                            next[idx] = { ...next[idx], name: text };
                            return { ...prev, loot: next };
                          })}
                        />
                        <TextInput
                          style={[styles.formInput, { flex: 1, backgroundColor: c.card, borderColor: c.border, color: c.foreground, fontSize: 13 }]}
                          placeholder="Qty"
                          placeholderTextColor={c.mutedForeground}
                          keyboardType="number-pad"
                          value={item.quantity.toString()}
                          onChangeText={(text) => setCustomMonsterForm((prev) => {
                            const next = [...(prev.loot ?? [])];
                            next[idx] = { ...next[idx], quantity: parseInt(text, 10) || 1 };
                            return { ...prev, loot: next };
                          })}
                        />
                      </View>
                      <TouchableOpacity style={[styles.deleteBtn, { borderColor: "#EF4444" + "55" }]} onPress={() => setCustomMonsterForm((prev) => {
                        const next = [...(prev.loot ?? [])];
                        next.splice(idx, 1);
                        return { ...prev, loot: next };
                      })} activeOpacity={0.7}>
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={[styles.addArrayBtn, { borderColor: c.border }]} onPress={() => setCustomMonsterForm((prev) => ({ ...prev, loot: [...(prev.loot ?? []), { name: "", quantity: 1 }] }))} activeOpacity={0.7}>
                    <Feather name="plus" size={14} color={c.primary} />
                    <Text style={{ fontSize: 12, color: c.primary, fontWeight: "600" }}>Add Item</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: c.card, borderWidth: 1, borderColor: c.border }]} onPress={closeCustomMonsterForm} activeOpacity={0.7}>
                    <Text style={[styles.actionBtnText, { color: c.foreground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: c.primary }]} onPress={() => void handleSaveCustomMonster()} activeOpacity={0.7}>
                    <Text style={[styles.actionBtnText, { color: c.primaryForeground }]}>{editingMonsterId ? "Update" : "Save Custom"}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    );
  }

  // ── Join state ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["bottom"]}>
      <ScrollHintScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
        {/* Title */}
        <View style={{ alignItems: "center", paddingTop: 16, gap: 8 }}>
          <View style={[styles.iconCircle, { backgroundColor: c.primary + "22" }]}>
            <Feather name="eye" size={32} color={c.primary} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: c.foreground }}>DM Party View</Text>
          <Text style={{ fontSize: 14, color: c.mutedForeground, textAlign: "center", lineHeight: 20 }}>
            Observe your party's HP, AC, and conditions in real time.{"\n"}
            No character sheet required — DM sessions are read-only.
          </Text>
        </View>

        {/* Join section */}
        <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground, marginBottom: 4 }}>Create a Party</Text>
          <Text style={{ fontSize: 13, color: c.mutedForeground, marginBottom: 12 }}>
            Start a new party session and instantly begin observing it.
          </Text>
          {isLoading ? (
            <ActivityIndicator color={c.primary} />
          ) : (
            <TouchableOpacity onPress={handleCreate} style={[styles.btn, { backgroundColor: c.primary }]}>
              <Feather name="plus-circle" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Create Party</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Join section */}
        <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground, marginBottom: 4 }}>Join a Party</Text>
          <Text style={{ fontSize: 13, color: c.mutedForeground, marginBottom: 12 }}>
            Enter the party code to start observing. Ask a player to share their code.
          </Text>
          {isLoading ? (
            <ActivityIndicator color={c.primary} />
          ) : (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={codeInput}
                onChangeText={setCodeInput}
                placeholder="e.g. WOLF-42"
                placeholderTextColor={c.mutedForeground}
                autoCapitalize="characters"
                style={[styles.input, { backgroundColor: c.background, borderColor: c.border, color: c.foreground, flex: 1 }]}
                returnKeyType="join"
                onSubmitEditing={handleJoin}
              />
              <TouchableOpacity onPress={handleJoin} style={[styles.btn, { backgroundColor: c.primary }]}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Watch</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: c.card, borderColor: c.border, gap: 10 }]}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: c.foreground }}>Active Sessions</Text>
          <Text style={{ fontSize: 13, color: c.mutedForeground }}>
            Rejoin currently active sessions you have watched recently.
          </Text>
          {loadingActiveSessions ? (
            <ActivityIndicator color={c.primary} />
          ) : activeSessions.length === 0 ? (
            <Text style={{ fontSize: 13, color: c.mutedForeground }}>No active sessions found.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {activeSessions.map((session) => (
                <View
                  key={session.code}
                  style={{
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 10,
                    backgroundColor: c.background,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: c.foreground }}>{session.code}</Text>
                    <Text style={{ fontSize: 12, color: c.mutedForeground }}>
                      {session.memberCount} member{session.memberCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => void handleWatchSavedSession(session.code)}
                    disabled={isLoading}
                    style={[styles.btn, { backgroundColor: c.primary, minWidth: 82, opacity: isLoading ? 0.6 : 1 }]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Watch</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Info callout */}
        <View style={[styles.infoBox, { borderColor: c.primary + "40", backgroundColor: c.primary + "0D" }]}>
          <Feather name="info" size={14} color={c.primary} style={{ marginTop: 1 }} />
          <Text style={{ fontSize: 13, color: c.mutedForeground, flex: 1, lineHeight: 19 }}>
            Players create or join the party from their{" "}
            <Text style={{ color: c.foreground, fontWeight: "600" }}>Sheet → Party</Text> button.
            The DM observer session persists across restarts — enter the code once and it stays connected.
          </Text>
        </View>

        {error ? (
          <View style={[styles.errorBox, { borderColor: "#f87171" + "55", backgroundColor: "#f87171" + "11" }]}>
            <Feather name="alert-circle" size={14} color="#f87171" />
            <Text style={{ fontSize: 13, color: "#f87171", flex: 1 }}>{error}</Text>
          </View>
        ) : null}
      </ScrollHintScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  card: {
    borderRadius: colors.radius * 1.5,
    borderWidth: 1,
    padding: 14,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  acBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 50,
  },
  conditionBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  partyHeader: {
    borderRadius: colors.radius * 1.5,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  dmBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  disconnectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  removeBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    borderRadius: colors.radius * 1.5,
    borderWidth: 1,
    padding: 16,
  },
  infoBox: {
    borderRadius: colors.radius,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  btnHalf: {
    flex: 1,
  },
  btnFull: {
    width: "100%",
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  dummyStatInput: {
    width: 72,
    textAlign: "center",
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  controlTab: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  controlGroup: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  orderStrip: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  eventLogBox: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 140,
    maxHeight: 220,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    borderTopLeftRadius: colors.radius * 2,
    borderTopRightRadius: colors.radius * 2,
    maxHeight: "85%",
    overflow: "hidden",
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: colors.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  formRowHalf: {
    flex: 1,
  },
  formRowThird: {
    flex: 1,
  },
  formActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
  },
  actionBtn: {
    flex: 1,
    borderRadius: colors.radius,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  arrayItemRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    alignItems: "flex-start",
  },
  arrayItemFields: {
    flex: 1,
    gap: 6,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: colors.radius,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  addArrayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: colors.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  monsterCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  monsterName: {
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
  },
  monsterMeta: {
    fontSize: 12,
  },
  monsterDescription: {
    fontSize: 12,
    lineHeight: 18,
  },
  customPill: {
    marginLeft: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  monsterActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  monsterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  monsterBtnText: {
    fontSize: 11,
    fontWeight: "600",
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "System",
  },
  quantityControlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quantityStepperBtn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityInputCompact: {
    width: 56,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 6,
    textAlign: "center",
    fontSize: 13,
    fontFamily: "System",
  },
  lootInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 92,
    textAlignVertical: "top",
    fontSize: 13,
    fontWeight: "600",
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
