import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  FlatList,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import { Card } from "@/components/ui/Card";
import { StatRow } from "@/components/ui/StatRow";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AbilityBlock } from "@/components/ui/AbilityBlock";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { getConditionInfo, REMOVAL_LABEL, CONDITION_INFO } from "@/data/conditions";
import { useEffectiveStats } from "@/hooks/useEffectiveStats";
import { useEquippedEffects } from "@/hooks/useEquippedEffects";
import { LevelUpModal } from "@/components/sheet/LevelUpModal";
import { ReferenceCompendium } from "@/components/sheet/ReferenceCompendium";
import { CompanionForm } from "@/components/ui/CompanionForm";
import type { Feat } from "@/types";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useParty } from "@/context/PartyContext";
import { addCombatNpc } from "@/utils/partyApi";
import { auditLevelUp } from "@/data/progression/engine";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { getZeroHpState, normalizeDeathSaveState } from "@/utils/combat/zeroHpLifecycle";
import { buildCompanionCombatNpcPayload } from "@/utils/combat/companionProjection";
import { buildAiDmSessionPath, buildAiDmSessionRouteParams } from "@/utils/aiDmRouteDefs";
import { AiDmSessionAwarenessPlaceholderStrip } from "@/components/adventure/AiDmSessionAwarenessPlaceholderStrip";
import { useAdventureSessionAwareness } from "@/context/AdventureSessionContext";

function formatSheetActionTypeLabel(actionType?: "action" | "bonus_action" | "reaction" | "free"): string {
  switch (actionType) {
    case "bonus_action":
      return "Bonus Action";
    case "reaction":
      return "Reaction";
    case "free":
      return "Free Action";
    default:
      return "Action";
  }
}

function getAbilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function fmtMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

const ALL_CONDITIONS = Object.keys(CONDITION_INFO);
const SHEET_HELP_COACHMARK_DISMISSED_KEY = "@sheet_help_coachmark_dismissed_v1";

const CURRENCY_META = {
  cp: { label: "CP", color: "#B45309", tint: "#F59E0B22" },
  sp: { label: "SP", color: "#64748B", tint: "#94A3B822" },
  ep: { label: "EP", color: "#0F766E", tint: "#14B8A622" },
  gp: { label: "GP", color: "#CA8A04", tint: "#FACC1522" },
  pp: { label: "PP", color: "#0369A1", tint: "#38BDF822" },
} as const;

type SheetTab = "overview" | "details" | "companions" | "reference";

export default function SheetScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    aiDmReturnSessionId?: string;
    aiDmReturnTitle?: string;
    aiDmReturnMode?: string;
    aiDmReturnDifficulty?: string;
    aiDmReturnStylePreset?: string;
    aiDmReturnStartInCombat?: string;
    aiDmReturnGuidance?: string;
    aiDmReturnCampaignId?: string;
    aiDmReturnCampaignLabel?: string;
    aiDmReturnChapterLabel?: string;
  }>();
  const { settings } = useAppSettings();
  const { partyCode, memberId, combatState } = useParty();
  const { awarenessPlaceholder, clearActiveSession } = useAdventureSessionAwareness();
  const {
    character,
    updateHp,
    updateCharacter,
    updateCurrency,
    conditions,
    removeCondition,
    addCondition,
    decrementCondition,
    setConditionDuration,
    passiveFeatures,
    classFeatures,
    resources,
    quests,
    pinQuest,
    pendingLevelUps,
    companions,
    deleteCompanion,
    addCompanion,
    updateCompanion,
    recordDeathSaveSuccess,
    recordDeathSaveFailure,
    stabilizeAtZeroHp,
    resetDeathSaveTracking,
  } = useCharacter();
  const eff = useEffectiveStats();
  const { buffEffects } = useEquippedEffects();
  const deathSaves = useMemo(() => normalizeDeathSaveState(character.deathSaves), [character.deathSaves]);
  const zeroHpState = useMemo(() => getZeroHpState({ currentHp: character.currentHp, deathSaves: character.deathSaves }), [character.currentHp, character.deathSaves]);
  const hasDeathSaveTracking = deathSaves.successes > 0 || deathSaves.failures > 0 || deathSaves.stable || deathSaves.dead;
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [conditionModalVisible, setConditionModalVisible] = useState(false);
  const [conditionSearch, setConditionSearch] = useState("");
  const [durationEditId, setDurationEditId] = useState<string | null>(null);
  const [durationPickerType, setDurationPickerType] = useState<"rounds" | "concentration" | "encounter" | "untilLongRest" | "manual">("manual");
  const [durationPickerValue, setDurationPickerValue] = useState("3");
  const [levelUpVisible, setLevelUpVisible] = useState(false);
  const [featModalVisible, setFeatModalVisible] = useState(false);
  const [editingFeat, setEditingFeat] = useState<Feat | null>(null);
  const [featName, setFeatName] = useState("");
  const [featDesc, setFeatDesc] = useState("");
  const [featSource, setFeatSource] = useState("");
  const [companionFormVisible, setCompanionFormVisible] = useState(false);
  const [editingCompanion, setEditingCompanion] = useState<typeof companions[0] | null>(null);
  const [projectingCompanionId, setProjectingCompanionId] = useState<string | null>(null);
  const [editingCurrencyKey, setEditingCurrencyKey] = useState<keyof typeof character.currency | null>(null);
  const [currencyEditorValue, setCurrencyEditorValue] = useState("");
  const webHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [helpVisible, setHelpVisible] = useState(false);
  const [helpTitle, setHelpTitle] = useState("What is this?");
  const [helpBody, setHelpBody] = useState("");
  const [showHelpCoachmark, setShowHelpCoachmark] = useState(false);
  const [sheetTab, setSheetTab] = useState<SheetTab>("overview");
  const [detailAlignment, setDetailAlignment] = useState(character.alignment ?? "");
  const [detailLanguages, setDetailLanguages] = useState((character.languages ?? []).join(", "));
  const [detailToolProficiencies, setDetailToolProficiencies] = useState((character.toolProficiencies ?? []).join(", "));
  const [detailWeaponMasteries, setDetailWeaponMasteries] = useState((character.weaponMasteries ?? []).join(", "));
  const [detailTrait, setDetailTrait] = useState(character.personalityTrait ?? "");
  const [detailIdeal, setDetailIdeal] = useState(character.ideal ?? "");
  const [detailBond, setDetailBond] = useState(character.bond ?? "");
  const [detailFlaw, setDetailFlaw] = useState(character.flaw ?? "");
  const [detailNotes, setDetailNotes] = useState(character.notes ?? "");
  const returnSessionId = typeof params.aiDmReturnSessionId === "string" ? params.aiDmReturnSessionId : "";
  const canReturnToAdventure = returnSessionId.length > 0;

  function handleReturnToAdventure() {
    if (!canReturnToAdventure) return;
    router.push({
      pathname: buildAiDmSessionPath(returnSessionId),
      params: buildAiDmSessionRouteParams({
        source: "sheet-return",
        mode: typeof params.aiDmReturnMode === "string" && params.aiDmReturnMode ? params.aiDmReturnMode : "campaign_scaffold",
        title: typeof params.aiDmReturnTitle === "string" && params.aiDmReturnTitle ? params.aiDmReturnTitle : "Adventure",
        difficulty: typeof params.aiDmReturnDifficulty === "string" && params.aiDmReturnDifficulty ? params.aiDmReturnDifficulty : "balanced",
        stylePreset: typeof params.aiDmReturnStylePreset === "string" && params.aiDmReturnStylePreset ? params.aiDmReturnStylePreset : "cinematic",
        startInCombat: params.aiDmReturnStartInCombat === "1",
        guidanceText: typeof params.aiDmReturnGuidance === "string" ? params.aiDmReturnGuidance : "",
        campaignId: typeof params.aiDmReturnCampaignId === "string" ? params.aiDmReturnCampaignId : "",
        campaignLabel: typeof params.aiDmReturnCampaignLabel === "string" ? params.aiDmReturnCampaignLabel : "",
        chapterLabel: typeof params.aiDmReturnChapterLabel === "string" ? params.aiDmReturnChapterLabel : "",
      }),
    } as any);
  }

  function handleEndAdventureSession() {
    Alert.alert("End Adventure Session", "Clear active adventure session awareness on this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Session",
        style: "destructive",
        onPress: () => {
          void clearActiveSession();
        },
      },
    ]);
  }

  function showHelp(title: string, explanation: string) {
    if (!settings.enableLongPressHelpPopups) return;
    setHelpTitle(title);
    setHelpBody(explanation);
    setHelpVisible(true);
  }

  function parseCommaList(value: string): string[] | undefined {
    const next = value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    return next.length > 0 ? next : undefined;
  }

  function saveDetailFields() {
    updateCharacter({
      alignment: detailAlignment.trim() || undefined,
      languages: parseCommaList(detailLanguages),
      toolProficiencies: parseCommaList(detailToolProficiencies),
      weaponMasteries: parseCommaList(detailWeaponMasteries),
      personalityTrait: detailTrait.trim() || undefined,
      ideal: detailIdeal.trim() || undefined,
      bond: detailBond.trim() || undefined,
      flaw: detailFlaw.trim() || undefined,
      notes: detailNotes,
    });
  }

  function startWebHold(action: () => void) {
    if (Platform.OS !== "web") return;
    if (webHoldTimerRef.current) clearTimeout(webHoldTimerRef.current);
    webHoldTimerRef.current = setTimeout(() => {
      action();
      webHoldTimerRef.current = null;
    }, 360);
  }

  async function handleAddCompanionToCombat(companion: (typeof companions)[number]) {
    if (!partyCode || !memberId) {
      Alert.alert("Join a party first", "Companions can only be projected into combat while in a party session.");
      return;
    }

    setProjectingCompanionId(companion.id);
    try {
      const ownerBattleId = combatState?.participantBattleById?.[memberId] ?? undefined;
      const payload = buildCompanionCombatNpcPayload({
        companion,
        ownerMemberId: memberId,
        ownerCharacterId: character.id,
        battleId: ownerBattleId,
      });
      await addCombatNpc(partyCode, payload);
      Alert.alert("Companion added", `${companion.name} was projected into party combat.`);
    } catch {
      Alert.alert("Unable to add companion", "Could not project this companion into combat right now.");
    } finally {
      setProjectingCompanionId(null);
    }
  }

  function endWebHold() {
    if (Platform.OS !== "web") return;
    if (webHoldTimerRef.current) {
      clearTimeout(webHoldTimerRef.current);
      webHoldTimerRef.current = null;
    }
  }

  const HELP_TEXT = {
    hp: "Your HP is how much damage you can take before dropping to 0. At 0 HP, you are incapacitated and need healing or stabilization.",
    ac: "Armor Class (AC) is the target number enemies must meet or beat to hit you with an attack.",
    initiative: "Initiative decides turn order at combat start. Higher numbers act earlier.",
    speed: "Speed is how far you can move on your turn, usually in feet.",
    proficiencyBonus: "Your proficiency bonus is added to rolls you are proficient with, like trained skills, proficient saves, weapon attacks, and spell attacks.",
    passivePerception: "Passive Perception is your always-on awareness: 10 + Perception modifier.",
    strength: "Strength measures raw physical power. It powers melee attack and damage rolls with most non-finesse weapons, athletic feats, carrying/lifting, grappling, shoving, and Strength saving throws. Main skill: Athletics.",
    dexterity: "Dexterity measures agility and reflexes. It affects AC in light/medium armor, initiative, Dexterity saving throws, stealth, sleight of hand, acrobatics, and attack/damage with finesse or ranged weapons.",
    constitution: "Constitution measures toughness and stamina. It determines your max HP gain per level, Concentration checks to maintain spells after taking damage, and Constitution saving throws against poison, disease, and endurance effects.",
    intelligence: "Intelligence measures reasoning and memory. It drives knowledge and investigation checks, Intelligence saving throws, and spellcasting for classes like Wizard. Main skills: Arcana, History, Investigation, Nature, Religion.",
    wisdom: "Wisdom measures awareness and intuition. It powers perception and insight, Wisdom saving throws (often versus control/fear/charm effects), and spellcasting for classes like Cleric and Druid. Main skills: Animal Handling, Insight, Medicine, Perception, Survival.",
    charisma: "Charisma measures force of personality and social presence. It drives social interaction checks, Charisma saving throws (such as banishment-style effects), and spellcasting for classes like Bard, Sorcerer, and Warlock. Main skills: Deception, Intimidation, Performance, Persuasion.",
    savingThrows: "Saving throws resist harmful effects like spells, traps, poison, or fear.",
    skills: "Skills represent trained capabilities. Proficient skills add your proficiency bonus.",
    languages: "Languages are what your character can speak/read based on race, background, and class choices.",
    toolProficiencies: "Tool proficiencies let you add proficiency bonus when using specific tools.",
    weaponMasteries: "Weapon masteries grant special weapon properties and tactical effects when using mastered weapons.",
    damageResistances: "Resistance halves incoming damage of the listed type.",
    damageImmunities: "Immunity reduces listed damage types to 0.",
    conditionImmunities: "Condition immunities mean those conditions cannot affect you.",
  };

    // Auto-open the level-up modal when levels are queued (e.g. character created above level 1)
    useEffect(() => {
      if (settings.autoOpenLevelUpModal && pendingLevelUps > 0) {
        setLevelUpVisible(true);
      }
    }, [pendingLevelUps, settings.autoOpenLevelUpModal]);

  useEffect(() => {
    let mounted = true;
    async function loadCoachmarkState() {
      if (!settings.enableLongPressHelpPopups) {
        if (mounted) setShowHelpCoachmark(false);
        return;
      }
      try {
        const dismissed = await AsyncStorage.getItem(SHEET_HELP_COACHMARK_DISMISSED_KEY);
        if (mounted) setShowHelpCoachmark(dismissed !== "1");
      } catch {
        if (mounted) setShowHelpCoachmark(true);
      }
    }
    loadCoachmarkState();
    return () => {
      mounted = false;
    };
  }, [settings.enableLongPressHelpPopups]);

  useEffect(() => {
    setDetailAlignment(character.alignment ?? "");
    setDetailLanguages((character.languages ?? []).join(", "));
    setDetailToolProficiencies((character.toolProficiencies ?? []).join(", "));
    setDetailWeaponMasteries((character.weaponMasteries ?? []).join(", "));
    setDetailTrait(character.personalityTrait ?? "");
    setDetailIdeal(character.ideal ?? "");
    setDetailBond(character.bond ?? "");
    setDetailFlaw(character.flaw ?? "");
    setDetailNotes(character.notes ?? "");
  }, [character]);

  async function dismissHelpCoachmark() {
    setShowHelpCoachmark(false);
    try {
      await AsyncStorage.setItem(SHEET_HELP_COACHMARK_DISMISSED_KEY, "1");
    } catch {
      // no-op: coachmark dismissal persistence failure is non-critical
    }
  }

  const feats: Feat[] = character.feats ?? [];
  const sortedPassiveFeatures = [...passiveFeatures].sort((a, b) => {
    const aRecent = a.levelGained === character.level ? 1 : 0;
    const bRecent = b.levelGained === character.level ? 1 : 0;
    if (aRecent !== bRecent) return bRecent - aRecent;
    return (b.levelGained ?? 0) - (a.levelGained ?? 0);
  });
  const recentPassiveUnlocks = sortedPassiveFeatures.filter((feat) => feat.levelGained === character.level);
  const sortedActionFeatures = [...classFeatures]
    .filter((feature) => feature.actionType)
    .sort((a, b) => {
      const aRecent = a.levelGained === character.level ? 1 : 0;
      const bRecent = b.levelGained === character.level ? 1 : 0;
      if (aRecent !== bRecent) return bRecent - aRecent;
      return (b.levelGained ?? 0) - (a.levelGained ?? 0);
    });
  const recentActionUnlocks = sortedActionFeatures.filter((feature) => feature.levelGained === character.level);
  const levelProgressionAudit = useMemo(() => {
    if (character.level <= 1) return null;
    const result = auditLevelUp({
      currentLevel: character.level - 1,
      charClass: character.class,
      subclass: character.subclass,
      race: character.race,
    });
    return result.supported && result.newLevel === character.level ? result : null;
  }, [character.class, character.level, character.race, character.subclass]);
  const recentResourceUnlocks = useMemo(() => {
    if (!levelProgressionAudit) return [];
    return levelProgressionAudit.automaticGains
      .filter((gain) => gain.kind === "resource")
      .map((gain) => {
        const liveResource = resources.find((resource) => resource.name.toLowerCase() === gain.name.toLowerCase());
        return {
          name: gain.name,
          newMax: liveResource?.max ?? gain.newMax,
          resetOn: liveResource?.resetOn ?? gain.resetsOn,
          description: gain.description,
        };
      });
  }, [levelProgressionAudit, resources]);
  const recentSpellSlotGains = levelProgressionAudit?.spellcasting?.spellSlotsGained ?? [];

  function openAddFeat() {
    setEditingFeat(null);
    setFeatName("");
    setFeatDesc("");
    setFeatSource("");
    setFeatModalVisible(true);
  }

  function openEditFeat(feat: Feat) {
    setEditingFeat(feat);
    setFeatName(feat.name);
    setFeatDesc(feat.description ?? "");
    setFeatSource(feat.source ?? "");
    setFeatModalVisible(true);
  }

  function saveFeat() {
    if (!featName.trim()) return;
    const id = editingFeat?.id ?? (Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
    const updated = editingFeat
      ? feats.map((f) => f.id === editingFeat.id ? { ...f, name: featName.trim(), description: featDesc.trim() || undefined, source: featSource.trim() || undefined } : f)
      : [...feats, { id, name: featName.trim(), description: featDesc.trim() || undefined, source: featSource.trim() || undefined }];
    updateCharacter({ feats: updated });
    setFeatModalVisible(false);
  }

  function deleteFeat(id: string) {
    Alert.alert("Remove Feat", "Remove this feat from your character?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => {
        updateCharacter({ feats: feats.filter((f) => f.id !== id) });
      }},
    ]);
  }

  function openCurrencyEditor(key: keyof typeof character.currency) {
    setEditingCurrencyKey(key);
    setCurrencyEditorValue(String(character.currency[key]));
  }

  function closeCurrencyEditor() {
    setEditingCurrencyKey(null);
    setCurrencyEditorValue("");
  }

  function saveCurrencyEditor() {
    if (!editingCurrencyKey) return;
    const currentValue = character.currency[editingCurrencyKey] ?? 0;
    const parsedValue = Number.parseInt(currencyEditorValue.trim() || "0", 10);
    const nextValue = Number.isNaN(parsedValue) ? currentValue : Math.max(0, parsedValue);
    const delta = nextValue - currentValue;
    if (delta !== 0) {
      updateCurrency({ [editingCurrencyKey]: delta });
    }
    closeCurrencyEditor();
  }

  async function pickCharacterPortrait() {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Allow photo library access to set a character portrait.");
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    try {
      if (FileSystem.documentDirectory) {
        const dir = FileSystem.documentDirectory + "character_portraits/";
        const info = await FileSystem.getInfoAsync(dir);
        if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const ext = (asset.uri.split(".").pop() ?? "jpg").split("?")[0];
        const dest = dir + `portrait_${character.id}_${Date.now()}.${ext}`;
        await FileSystem.copyAsync({ from: asset.uri, to: dest });
        updateCharacter({ profileImageUri: dest });
      } else {
        updateCharacter({ profileImageUri: asset.uri });
      }
    } catch {
      updateCharacter({ profileImageUri: asset.uri });
    }
  }

  function removeCharacterPortrait() {
    updateCharacter({ profileImageUri: undefined });
  }

  const hpPct = eff.maxHp > 0 ? character.currentHp / eff.maxHp : 0;
  const hpColor = hpPct > 0.5 ? "#10B981" : hpPct > 0.25 ? "#F59E0B" : "#EF4444";

  const abilityEntries = [
    { key: "strength", label: "STR" },
    { key: "dexterity", label: "DEX" },
    { key: "constitution", label: "CON" },
    { key: "intelligence", label: "INT" },
    { key: "wisdom", label: "WIS" },
    { key: "charisma", label: "CHA" },
  ] as const;

  const displayedSkills = showAllSkills
    ? character.skills
    : character.skills.filter((s) => s.proficient);

  const activeConditionNames = new Set(conditions.map((c) => c.name));
  const filteredConditions = ALL_CONDITIONS.filter(
    (name) =>
      !activeConditionNames.has(name) &&
      name.toLowerCase().includes(conditionSearch.toLowerCase())
  );

  function handleAddCondition(name: string) {
    const info = getConditionInfo(name);
    addCondition({
      name,
      removeOn: info.defaultRemoveOn,
    });
    setConditionModalVisible(false);
    setConditionSearch("");
  }

  return (
    <>
      <ScrollHintScrollView
        style={[styles.container, { backgroundColor: c.background }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: Platform.OS === "web" ? 72 : 86,
            paddingTop: settings.compactMode ? c.densitySpace(6) : c.densitySpace(12),
            paddingHorizontal: c.densitySpace(16),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {canReturnToAdventure ? (
          <View style={[styles.returnBanner, { backgroundColor: c.card, borderColor: c.border }]}> 
            <View style={styles.returnBannerCopy}>
              <Text style={[styles.returnBannerLabel, { color: c.mutedForeground }]}>Adventure session</Text>
              <Text style={[styles.returnBannerTitle, { color: c.foreground }]} numberOfLines={1}>
                {typeof params.aiDmReturnTitle === "string" && params.aiDmReturnTitle ? params.aiDmReturnTitle : "Return to current session"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleReturnToAdventure}
              activeOpacity={0.8}
              style={[styles.returnBannerButton, { backgroundColor: c.primary }]}
            >
              <Text style={[styles.returnBannerButtonText, { color: c.primaryForeground }]}>Return to Session</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!canReturnToAdventure ? (
          <AiDmSessionAwarenessPlaceholderStrip
            placeholder={awarenessPlaceholder}
            onEndSession={handleEndAdventureSession}
          />
        ) : null}

        {/* Hero card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIdentityRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={pickCharacterPortrait}
                style={[styles.heroAvatar, { backgroundColor: c.primary + "1F", borderColor: c.primary + "55" }]}
              >
                {character.profileImageUri ? (
                  <Image source={{ uri: character.profileImageUri }} style={styles.heroAvatarImage} resizeMode="cover" />
                ) : (
                  <Feather name="user" size={28} color={c.primary} />
                )}
              </TouchableOpacity>
              <View style={styles.heroTextWrap}>
              <Text style={[styles.charName, { color: c.foreground, fontSize: c.scaleFont(22), lineHeight: c.scaleLineHeight(28) }]}>
                {character.name}
              </Text>
              <Text style={[styles.charSub, { color: c.mutedForeground, fontSize: c.scaleFont(14), lineHeight: c.scaleLineHeight(18) }]}>
                {character.race} {character.class}{character.subclass ? ` · ${character.subclass}` : ""}
              </Text>
              <Text style={[styles.charMeta, { color: c.mutedForeground, fontSize: c.scaleFont(12) }]}> 
                Level {character.level} · {character.background}
              </Text>
                <View style={styles.heroPortraitActions}>
                  <TouchableOpacity onPress={pickCharacterPortrait} style={[styles.heroPortraitBtn, { borderColor: c.border, backgroundColor: c.secondary }]}> 
                    <Feather name="image" size={12} color={c.foreground} />
                    <Text style={[styles.heroPortraitBtnText, { color: c.foreground }]}>Portrait</Text>
                  </TouchableOpacity>
                  {character.profileImageUri ? (
                    <TouchableOpacity onPress={removeCharacterPortrait} style={[styles.heroPortraitBtn, { borderColor: c.border, backgroundColor: c.secondary }]}> 
                      <Feather name="x" size={12} color={c.destructive} />
                      <Text style={[styles.heroPortraitBtnText, { color: c.destructive }]}>Remove</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setLevelUpVisible(true)}
              activeOpacity={0.8}
              style={styles.levelBadgeWrap}
            >
              <View style={[styles.levelBadge, { backgroundColor: c.primary }]}>
                <Text style={[styles.levelText, { color: c.primaryForeground, fontSize: c.scaleFont(18) }]}>
                  {character.level}
                </Text>
              </View>
              <Text style={[styles.levelUpHint, { color: c.primary, fontSize: c.scaleFont(9) }]}>Level Up</Text>
            </TouchableOpacity>
          </View>

          {/* HP */}
          <View
            style={styles.hpSection}
            onTouchEnd={() => {}}
          >
            <View style={styles.hpRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                onLongPress={() => showHelp("Hit Points", HELP_TEXT.hp)}
                onPressIn={Platform.OS === "web" ? () => startWebHold(() => showHelp("Hit Points", HELP_TEXT.hp)) : undefined}
                onPressOut={Platform.OS === "web" ? endWebHold : undefined}
                onPress={Platform.OS === "web" ? () => undefined : undefined}
                delayLongPress={320}
              >
                <Text style={[styles.hpLabel, { color: c.mutedForeground, fontSize: c.scaleFont(12) }]}>Hit Points</Text>
              </TouchableOpacity>
              <View style={styles.hpControls}>
                <TouchableOpacity
                  onPress={() => updateHp(-1)}
                  style={[styles.hpBtn, { backgroundColor: c.secondary, borderRadius: c.radius }]}
                  activeOpacity={0.7}
                >
                  <Feather name="minus" size={14} color={c.foreground} />
                </TouchableOpacity>
                <Text style={[styles.hpValue, { color: hpColor, fontSize: c.scaleFont(28), lineHeight: c.scaleLineHeight(32) }]}> 
                  {character.currentHp}
                </Text>
                <Text style={[styles.hpMax, { color: c.mutedForeground, fontSize: c.scaleFont(16) }]}> 
                  / {eff.maxHp}{eff.bonuses.maxHp ? ` (+${eff.bonuses.maxHp})` : ""}
                </Text>
                <TouchableOpacity
                  onPress={() => updateHp(1)}
                  style={[styles.hpBtn, { backgroundColor: c.secondary, borderRadius: c.radius }]}
                  activeOpacity={0.7}
                >
                  <Feather name="plus" size={14} color={c.foreground} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.hpBar, { backgroundColor: c.secondary, borderRadius: 4 }]}>
              <View
                style={[
                  styles.hpFill,
                  { backgroundColor: hpColor, width: `${Math.round(hpPct * 100)}%` as any, borderRadius: 4 },
                ]}
              />
            </View>
            {character.tempHp > 0 && (
              <Text style={[styles.tempHp, { color: "#60A5FA", fontSize: c.scaleFont(12) }]}> 
                +{character.tempHp} temporary HP
              </Text>
            )}
          </View>
        </Card>

        <View style={[styles.sheetTabBar, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius * 1.5 }]}> 
          {([
            { id: "overview" as SheetTab, label: "Overview", icon: "activity" },
            { id: "details" as SheetTab, label: "Details", icon: "book-open" },
            { id: "companions" as SheetTab, label: "Companions", icon: "users" },
            { id: "reference" as SheetTab, label: "References", icon: "layers" },
          ] as const).map((tab) => {
            const active = sheetTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setSheetTab(tab.id)}
                activeOpacity={0.8}
                style={[styles.sheetTabBtn, { borderBottomColor: active ? c.primary : "transparent" }]}
              >
                <Feather name={tab.icon} size={14} color={active ? c.primary : c.mutedForeground} />
                <Text style={[styles.sheetTabLabel, { color: active ? c.primary : c.mutedForeground }]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {settings.enableLongPressHelpPopups && settings.showHoldToInfoHints && showHelpCoachmark && (
          <View style={[styles.holdCoachmark, { backgroundColor: c.primary + "14", borderColor: c.primary + "44" }]}>
            <View style={styles.holdCoachmarkContent}>
              <Feather name="help-circle" size={14} color={c.primary} />
              <Text style={[styles.holdCoachmarkText, { color: c.foreground, fontSize: c.scaleFont(12) }]}>
                {Platform.OS === "web" ? "Click and hold stats to open quick explanations." : "Press and hold stats to open quick explanations."}
              </Text>
            </View>
            <TouchableOpacity onPress={dismissHelpCoachmark} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.holdCoachmarkDismiss, { color: c.primary, fontSize: c.scaleFont(11) }]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {sheetTab === "overview" && (
          <>

        {/* Incapacitated banner */}
        {character.currentHp <= 0 && (
          <View style={[styles.incapBanner, { backgroundColor: "#EF444412", borderColor: "#EF444430" }]}>
            <View style={[styles.incapAccent, { backgroundColor: "#EF4444" }]} />
            <View style={styles.incapBody}>
              <View style={styles.incapContent}>
                <Feather name="alert-triangle" size={18} color="#EF4444" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.incapTitle, { fontSize: c.scaleFont(13) }]}>
                    {zeroHpState === "dead" ? "DEAD" : zeroHpState === "stable" ? "STABLE AT 0 HP" : "DYING"}
                  </Text>
                  <Text style={[styles.incapSub, { color: c.mutedForeground, fontSize: c.scaleFont(12), lineHeight: c.scaleLineHeight(16) }]}> 
                    {zeroHpState === "stable"
                      ? "Character is stable at 0 HP and remains unconscious until healed."
                      : zeroHpState === "dead"
                        ? "Three failed death saves mark the character as dead. Death-save and stabilize actions are locked in this workflow."
                        : "Character is at 0 HP. Record death-save outcomes manually or stabilize until healing arrives."}
                  </Text>
                </View>
              </View>
              <View style={styles.deathSaveTrackRow}>
                <View style={[styles.deathSaveTrackCard, { borderColor: "#10B98144", backgroundColor: "#10B98114" }]}> 
                  <Text style={[styles.deathSaveTrackLabel, { color: "#10B981" }]}>Successes</Text>
                  <Text style={[styles.deathSaveTrackValue, { color: "#10B981" }]}>{deathSaves.successes}/3</Text>
                </View>
                <View style={[styles.deathSaveTrackCard, { borderColor: "#EF444444", backgroundColor: "#EF444414" }]}> 
                  <Text style={[styles.deathSaveTrackLabel, { color: "#EF4444" }]}>Failures</Text>
                  <Text style={[styles.deathSaveTrackValue, { color: "#EF4444" }]}>{deathSaves.failures}/3</Text>
                </View>
                <View style={[styles.deathSaveTrackCard, { borderColor: c.border, backgroundColor: c.card }]}> 
                  <Text style={[styles.deathSaveTrackLabel, { color: c.mutedForeground }]}>Status</Text>
                  <Text
                    style={[
                      styles.deathSaveTrackValue,
                      {
                        color:
                          zeroHpState === "dead"
                            ? "#EF4444"
                            : zeroHpState === "stable"
                              ? c.primary
                              : c.foreground,
                      },
                    ]}
                  > 
                    {zeroHpState === "dead" ? "Dead" : zeroHpState === "stable" ? "Stable" : "Dying"}
                  </Text>
                </View>
              </View>
              <View style={styles.deathSaveActions}>
                {zeroHpState === "dying" && (
                  <>
                    <TouchableOpacity
                      onPress={recordDeathSaveSuccess}
                      activeOpacity={0.8}
                      style={[styles.deathSaveBtn, { borderColor: "#10B98166", backgroundColor: "#10B98114" }]}
                    >
                      <Text style={[styles.deathSaveBtnText, { color: "#10B981" }]}>Record Success</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={recordDeathSaveFailure}
                      activeOpacity={0.8}
                      style={[styles.deathSaveBtn, { borderColor: "#EF444466", backgroundColor: "#EF444414" }]}
                    >
                      <Text style={[styles.deathSaveBtnText, { color: "#EF4444" }]}>Record Failure</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={stabilizeAtZeroHp}
                      activeOpacity={0.8}
                      style={[styles.deathSaveBtn, { borderColor: c.primary + "66", backgroundColor: c.primary + "14" }]}
                    >
                      <Text style={[styles.deathSaveBtnText, { color: c.primary }]}>Stabilize</Text>
                    </TouchableOpacity>
                  </>
                )}
                {hasDeathSaveTracking && zeroHpState !== "dead" && (
                  <TouchableOpacity
                    onPress={resetDeathSaveTracking}
                    activeOpacity={0.8}
                    style={[styles.deathSaveBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                  >
                    <Text style={[styles.deathSaveBtnText, { color: c.mutedForeground }]}>Reset Track</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.deathSaveHint, { color: c.mutedForeground, fontSize: c.scaleFont(11) }]}> 
                Manual-only tracking: nat 1 and nat 20 automation are intentionally not inferred in this slice.
              </Text>
            </View>
          </View>
        )}

        <SectionHeader title="Core Combat Stats" />
        {/* Core stats */}
        <Card>
          {settings.enableLongPressHelpPopups && settings.showHoldToInfoHints && (
            <View style={[styles.inlineHoldHint, { backgroundColor: c.secondary }]}> 
              <Feather name="help-circle" size={12} color={c.mutedForeground} />
              <Text style={[styles.inlineHoldHintText, { color: c.mutedForeground, fontSize: c.scaleFont(11) }]}>
                {Platform.OS === "web" ? "Click and hold each tile for details" : "Press and hold each tile for details"}
              </Text>
            </View>
          )}
          <View style={styles.coreStatsGrid}>
            {[
              { label: "AC", value: eff.ac, bonus: eff.bonuses.armorClass },
              { label: "Initiative", value: fmtMod(eff.initiative), bonus: eff.bonuses.initiative },
              { label: "Speed", value: `${eff.speed}ft`, bonus: eff.bonuses.speed },
              { label: "Prof Bonus", value: `+${eff.proficiencyBonus}`, bonus: eff.bonuses.proficiencyBonus },
              { label: "Passive Perc", value: eff.passivePerception, bonus: eff.bonuses.passivePerception },
            ].filter((row) => settings.showPassivePerception || row.label !== "Passive Perc").map(({ label, value, bonus }) => {
              const hasBonus = bonus != null && bonus !== 0;
              return (
                <TouchableOpacity
                  key={label}
                  activeOpacity={0.9}
                  delayLongPress={320}
                  onLongPress={() => {
                    if (label === "AC") showHelp("Armor Class", HELP_TEXT.ac);
                    if (label === "Initiative") showHelp("Initiative", HELP_TEXT.initiative);
                    if (label === "Speed") showHelp("Speed", HELP_TEXT.speed);
                    if (label === "Prof Bonus") showHelp("Proficiency Bonus", HELP_TEXT.proficiencyBonus);
                    if (label === "Passive Perc") showHelp("Passive Perception", HELP_TEXT.passivePerception);
                  }}
                  onPressIn={Platform.OS === "web" ? () => startWebHold(() => {
                    if (label === "AC") showHelp("Armor Class", HELP_TEXT.ac);
                    if (label === "Initiative") showHelp("Initiative", HELP_TEXT.initiative);
                    if (label === "Speed") showHelp("Speed", HELP_TEXT.speed);
                    if (label === "Prof Bonus") showHelp("Proficiency Bonus", HELP_TEXT.proficiencyBonus);
                    if (label === "Passive Perc") showHelp("Passive Perception", HELP_TEXT.passivePerception);
                  }) : undefined}
                  onPressOut={Platform.OS === "web" ? endWebHold : undefined}
                  onPress={Platform.OS === "web" ? () => undefined : undefined}
                  style={styles.coreStat}
                >
                  <Text style={[styles.coreValue, { color: hasBonus ? "#10B981" : c.primary, fontSize: c.scaleFont(18) }]}>{value}</Text>
                  <Text style={[styles.coreLabel, { color: c.mutedForeground, fontSize: c.scaleFont(9) }]}>{label}</Text>
                  {hasBonus && (
                    <Text style={[styles.coreBonus, { fontSize: c.scaleFont(9) }]}>{bonus! > 0 ? `+${bonus}` : bonus}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Ability scores */}
        <SectionHeader
          title="Ability Scores"
          subtitle={settings.enableLongPressHelpPopups && settings.showHoldToInfoHints ? (Platform.OS === "web" ? "Click and hold any ability for details" : "Press and hold any ability for details") : undefined}
        />
        <View style={styles.abilitiesRow}>
          {abilityEntries.map(({ key, label }) => (
            <AbilityBlock
              key={key}
              name={label}
              score={eff.abilityScores[key as keyof typeof eff.abilityScores]}
              modifier={getAbilityMod(eff.abilityScores[key as keyof typeof eff.abilityScores])}
              bonus={eff.bonuses[key as keyof typeof eff.bonuses]}
              onLongPress={settings.enableLongPressHelpPopups ? () => {
                if (label === "STR") showHelp("Strength", HELP_TEXT.strength);
                if (label === "DEX") showHelp("Dexterity", HELP_TEXT.dexterity);
                if (label === "CON") showHelp("Constitution", HELP_TEXT.constitution);
                if (label === "INT") showHelp("Intelligence", HELP_TEXT.intelligence);
                if (label === "WIS") showHelp("Wisdom", HELP_TEXT.wisdom);
                if (label === "CHA") showHelp("Charisma", HELP_TEXT.charisma);
              } : undefined}
            />
          ))}
        </View>

        {/* Proficiencies and defenses */}
        {settings.showLanguagesDefensesSection && <SectionHeader title="Proficiencies & Defenses" subtitle="Training and resistance/immunity traits" />}
        {settings.showLanguagesDefensesSection && <Card padding={12}>
          {!!character.toolProficiencies?.length && (
            <StatRow
              label="Tool Proficiencies"
              value={character.toolProficiencies.join(", ")}
              compact
              onLongPress={settings.enableLongPressHelpPopups ? () => showHelp("Tool Proficiencies", HELP_TEXT.toolProficiencies) : undefined}
            />
          )}
          {!!character.weaponMasteries?.length && (
            <StatRow
              label="Weapon Masteries"
              value={character.weaponMasteries.join(", ")}
              compact
              onLongPress={settings.enableLongPressHelpPopups ? () => showHelp("Weapon Masteries", HELP_TEXT.weaponMasteries) : undefined}
            />
          )}
          {!!character.damageResistances?.length && (
            <StatRow
              label="Damage Resistances"
              value={character.damageResistances.join(", ")}
              compact
              onLongPress={settings.enableLongPressHelpPopups ? () => showHelp("Damage Resistances", HELP_TEXT.damageResistances) : undefined}
            />
          )}
          {!!character.damageImmunities?.length && (
            <StatRow
              label="Damage Immunities"
              value={character.damageImmunities.join(", ")}
              compact
              onLongPress={settings.enableLongPressHelpPopups ? () => showHelp("Damage Immunities", HELP_TEXT.damageImmunities) : undefined}
            />
          )}
          {!!character.conditionImmunities?.length && (
            <StatRow
              label="Condition Immunities"
              value={character.conditionImmunities.join(", ")}
              compact
              onLongPress={settings.enableLongPressHelpPopups ? () => showHelp("Condition Immunities", HELP_TEXT.conditionImmunities) : undefined}
            />
          )}
        </Card>}

        {settings.showBackgroundRoleplaySection && (character.personalityTrait || character.ideal || character.bond || character.flaw) && (
          <>
            <SectionHeader title="Background Roleplay" />
            <Card padding={12}>
              {character.personalityTrait ? <StatRow label="Trait" value={character.personalityTrait} compact /> : null}
              {character.ideal ? <StatRow label="Ideal" value={character.ideal} compact /> : null}
              {character.bond ? <StatRow label="Bond" value={character.bond} compact /> : null}
              {character.flaw ? <StatRow label="Flaw" value={character.flaw} compact /> : null}
            </Card>
          </>
        )}

        {/* Active Conditions */}
        {settings.showConditionsSection && (
          <View style={[styles.conditionSectionHeader, { borderBottomColor: c.border }]}>
            <SectionHeader title="Conditions" />
            <TouchableOpacity
              onPress={() => setConditionModalVisible(true)}
              activeOpacity={0.75}
              style={[styles.addConditionBtn, { backgroundColor: "#EF444420", borderColor: "#EF4444", borderRadius: c.radius }]}
            >
              <Feather name="plus" size={13} color="#EF4444" />
              <Text style={[styles.addConditionText, { color: "#EF4444" }]}>Add</Text>
            </TouchableOpacity>
          </View>
        )}

        {settings.showConditionsSection && conditions.length === 0 && (
          <Card style={styles.conditionEmpty}>
              <Text style={[styles.conditionEmptyText, { color: c.mutedForeground, fontSize: c.scaleFont(13) }]}> 
              No active conditions
            </Text>
          </Card>
        )}

        {settings.showConditionsSection && conditions.map((cond) => {
          const info = getConditionInfo(cond.name);
          const isRoundBased = cond.durationType === "rounds" && cond.remainingDuration !== undefined;
          const isUrgent = isRoundBased && cond.remainingDuration! <= 1;
          const durationLabel =
            cond.durationType === "concentration" ? "conc" :
            cond.durationType === "encounter" ? "enc" :
            cond.durationType === "permanent" ? "perm" :
            cond.durationType === "untilLongRest" ? "long rest" :
            cond.durationType === "untilShortRest" ? "short rest" :
            isRoundBased ? `${cond.remainingDuration}r` : null;
          const editingDuration = durationEditId === cond.id;

          return (
            <Card key={cond.id} style={[styles.conditionCard, isUrgent && { borderLeftWidth: 3, borderLeftColor: "#F59E0B" }]}>
              <View style={styles.conditionHeader}>
                <View style={[styles.conditionDot, { backgroundColor: info.color }]} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={[styles.conditionName, { color: c.foreground, fontSize: c.scaleFont(15) }]}>{cond.name}</Text>
                    {durationLabel && (
                      <View style={[styles.durationBadge, { backgroundColor: isUrgent ? "#F59E0B20" : info.color + "20", borderColor: isUrgent ? "#F59E0B" : info.color }]}>
                        <Text style={[styles.durationBadgeText, { color: isUrgent ? "#F59E0B" : info.color, fontSize: c.scaleFont(11) }]}>{durationLabel}</Text>
                      </View>
                    )}
                  </View>
                  {cond.source && (
                    <Text style={[styles.conditionSource, { color: c.mutedForeground, fontSize: c.scaleFont(12) }]}> 
                      from {cond.source}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                  {isRoundBased && (
                    <TouchableOpacity
                      onPress={() => decrementCondition(cond.id)}
                      activeOpacity={0.7}
                      style={[styles.conditionRemoveBtn, { backgroundColor: "#F59E0B20", borderRadius: c.radius }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="minus" size={13} color="#F59E0B" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      if (editingDuration) {
                        setDurationEditId(null);
                      } else {
                        setDurationEditId(cond.id);
                        setDurationPickerType((cond.durationType as any) || "manual");
                        setDurationPickerValue(String(cond.durationValue ?? 3));
                      }
                    }}
                    activeOpacity={0.7}
                    style={[styles.conditionRemoveBtn, { backgroundColor: c.secondary, borderRadius: c.radius }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="clock" size={13} color={editingDuration ? c.primary : c.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeCondition(cond.id)}
                    activeOpacity={0.7}
                    style={[styles.conditionRemoveBtn, { backgroundColor: c.secondary, borderRadius: c.radius }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="x" size={14} color={c.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>

              {editingDuration && (
                <View style={[styles.durationEditor, { backgroundColor: c.secondary, borderColor: c.border }]}>
                  <Text style={[{ color: c.mutedForeground, fontSize: c.scaleFont(11), marginBottom: 8 }]}>Set duration</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {(["rounds", "concentration", "encounter", "untilLongRest", "manual"] as const).map((dt) => {
                      const label = dt === "rounds" ? "Rounds" : dt === "concentration" ? "Concentration" : dt === "encounter" ? "Encounter" : dt === "untilLongRest" ? "Long Rest" : "Manual";
                      const active = durationPickerType === dt;
                      return (
                        <TouchableOpacity
                          key={dt}
                          onPress={() => setDurationPickerType(dt)}
                          style={[styles.durationTypeBtn, { backgroundColor: active ? c.primary + "20" : c.card, borderColor: active ? c.primary : c.border }]}
                        >
                          <Text style={[{ color: active ? c.primary : c.mutedForeground, fontSize: c.scaleFont(11) }]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {durationPickerType === "rounds" && (
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginBottom: 8 }}>
                      {["1", "2", "3", "5", "10"].map((v) => (
                        <TouchableOpacity
                          key={v}
                          onPress={() => setDurationPickerValue(v)}
                          style={[styles.durationTypeBtn, { backgroundColor: durationPickerValue === v ? c.primary + "20" : c.card, borderColor: durationPickerValue === v ? c.primary : c.border, paddingHorizontal: 10 }]}
                        >
                          <Text style={[{ color: durationPickerValue === v ? c.primary : c.mutedForeground, fontSize: c.scaleFont(12) }]}>{v}</Text>
                        </TouchableOpacity>
                      ))}
                      <TextInput
                        value={durationPickerValue}
                        onChangeText={(t) => setDurationPickerValue(t.replace(/[^0-9]/g, ""))}
                        keyboardType="number-pad"
                        style={[styles.durationInput, { color: c.foreground, borderColor: c.border, backgroundColor: c.card }]}
                      />
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      const v = durationPickerType === "rounds" ? parseInt(durationPickerValue, 10) || 3 : undefined;
                      setConditionDuration(cond.id, durationPickerType, v);
                      setDurationEditId(null);
                    }}
                    style={[styles.durationSaveBtn, { backgroundColor: c.primary }]}
                    activeOpacity={0.8}
                  >
                    <Text style={[{ color: c.primaryForeground, fontSize: c.scaleFont(12), fontWeight: "600" }]}>Save</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={[styles.conditionDesc, { color: c.mutedForeground, fontSize: c.scaleFont(13), lineHeight: c.scaleLineHeight(18) }]}> 
                {info.description}
              </Text>

              {cond.notes && (
                <Text style={[styles.conditionNotes, { color: c.mutedForeground, fontSize: c.scaleFont(12), lineHeight: c.scaleLineHeight(17) }]}> 
                  {cond.notes}
                </Text>
              )}

              {cond.durationType !== "rounds" && cond.durationType !== "concentration" && cond.durationType !== "encounter" && cond.durationType !== "permanent" && (
                <View style={styles.conditionRemovalRow}>
                  <Text style={[styles.conditionRemovalLabel, { color: c.mutedForeground, fontSize: c.scaleFont(11) }]}> 
                    Ends on:
                  </Text>
                  {cond.removeOn.map((r) => (
                    <View
                      key={r}
                      style={[styles.removalBadge, { backgroundColor: info.color + "20" }]}
                    >
                      <Text style={[styles.removalBadgeText, { color: info.color, fontSize: c.scaleFont(11) }]}> 
                        {REMOVAL_LABEL[r]}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          );
        })}

        {/* Saving throws */}
        <SectionHeader
          title="Saving Throws"
          subtitle={settings.enableLongPressHelpPopups && settings.showHoldToInfoHints ? (Platform.OS === "web" ? "Click and hold a row for help" : "Press and hold a row for help") : undefined}
        />
        <Card padding={12}>
          {character.savingThrows.map((st) => (
            <StatRow
              key={st.ability}
              label={`${st.ability.charAt(0).toUpperCase() + st.ability.slice(1, 3).toUpperCase()} ${st.proficient ? "★" : "·"}`}
              value={fmtMod(st.modifier)}
              valueColor={st.proficient ? c.primary : undefined}
              compact
              onLongPress={settings.enableLongPressHelpPopups ? () => showHelp("Saving Throws", HELP_TEXT.savingThrows) : undefined}
            />
          ))}
        </Card>

        {/* Equipped item buffs */}
        {buffEffects.length > 0 && (
          <View style={{ marginBottom: 4 }}>
            <View style={styles.buffSectionLabel}>
              <Feather name="shield" size={11} color="#0EA5E9" />
              <Text style={[styles.buffSectionText, { color: "#0EA5E9", fontSize: c.scaleFont(10) }]}> 
                ITEM BENEFITS ACTIVE
              </Text>
            </View>
            {buffEffects.map((buff) => (
              <View
                key={buff.effectId}
                style={[
                  styles.buffCard,
                  { backgroundColor: "#0EA5E915", borderLeftColor: "#0EA5E9" },
                ]}
              >
                <View style={styles.buffHeader}>
                  <Text style={[styles.buffLabel, { color: c.foreground, fontSize: c.scaleFont(13) }]}>{buff.label}</Text>
                  <Text style={[styles.buffItem, { color: "#0EA5E9", fontSize: c.scaleFont(10) }]}>{buff.itemName}</Text>
                </View>
                {buff.description ? (
                  <Text style={[styles.buffDesc, { color: c.mutedForeground, fontSize: c.scaleFont(12), lineHeight: c.scaleLineHeight(17) }]}>{buff.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* Skills */}
        <SectionHeader
          title="Skills"
          subtitle={settings.enableLongPressHelpPopups && settings.showHoldToInfoHints
            ? ((showAllSkills ? "Showing all" : "Showing proficiencies") + (Platform.OS === "web" ? " · Click and hold a skill for help" : " · Press and hold a skill for help"))
            : (showAllSkills ? "Showing all" : "Showing proficiencies")}
        />
        <Card padding={12}>
          {displayedSkills.map((skill) => (
            <StatRow
              key={skill.name}
              label={`${skill.proficient ? "★" : "·"} ${skill.name}`}
              value={fmtMod(skill.modifier)}
              valueColor={skill.proficient ? c.primary : undefined}
              compact
              onLongPress={settings.enableLongPressHelpPopups ? () => showHelp("Skills", HELP_TEXT.skills) : undefined}
            />
          ))}
          <TouchableOpacity
            onPress={() => setShowAllSkills(!showAllSkills)}
            style={styles.showMoreBtn}
            activeOpacity={0.7}
          >
            <Text style={[styles.showMoreText, { color: c.primary, fontSize: c.scaleFont(13) }]}> 
              {showAllSkills ? "Show proficiencies only" : "Show all skills"}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Currency */}
        {settings.showCurrency && <SectionHeader title="Currency" />}
        {settings.showCurrency && <Card padding={12}>
          {Object.entries(character.currency).map(([coin, amount]) => {
            const key = coin as keyof typeof character.currency;
            const meta = CURRENCY_META[key];
            const isEditing = editingCurrencyKey === key;
            return (
              <View key={coin} style={[styles.currencyRow, { borderColor: c.border }]}> 
                <View style={styles.currencyInfo}>
                  <View style={[styles.currencyBadge, { backgroundColor: meta.tint }]}> 
                    <Text style={[styles.currencyBadgeText, { color: meta.color, fontSize: c.scaleFont(12) }]}>{meta.label}</Text>
                  </View>
                  {isEditing ? (
                    <View style={styles.currencyEditWrap}>
                      <TextInput
                        value={currencyEditorValue}
                        onChangeText={setCurrencyEditorValue}
                        keyboardType="number-pad"
                        style={[styles.currencyInput, { borderColor: c.border, backgroundColor: c.secondary, color: c.foreground, fontSize: c.scaleFont(18), paddingHorizontal: c.densitySpace(12), paddingVertical: c.densitySpace(7) }]}
                        autoFocus
                      />
                      <TouchableOpacity
                        onPress={saveCurrencyEditor}
                        activeOpacity={0.7}
                        style={[styles.currencySaveBtn, { backgroundColor: meta.tint, borderColor: meta.color + "55" }]}
                      >
                        <Feather name="check" size={14} color={meta.color} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => openCurrencyEditor(key)}
                      activeOpacity={0.7}
                      style={[styles.currencyAmountBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                    >
                      <Text style={[styles.currencyAmount, { color: c.foreground, fontSize: c.scaleFont(18) }]}>{amount}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.currencyControls}>
                  <TouchableOpacity
                    onPress={() => updateCurrency({ [key]: -1 })}
                    style={[styles.currencyBtn, { backgroundColor: c.secondary, borderColor: c.border }]}
                    activeOpacity={0.7}
                  >
                    <Feather name="minus" size={14} color={c.foreground} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateCurrency({ [key]: 1 })}
                    style={[styles.currencyBtn, { backgroundColor: meta.tint, borderColor: meta.color + "55" }]}
                    activeOpacity={0.7}
                  >
                    <Feather name="plus" size={14} color={meta.color} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </Card>}

        {/* Feats */}
        {settings.showFeatsSection && <View style={styles.featSectionHeader}>
          <SectionHeader title="Feats" />
          <TouchableOpacity
            onPress={openAddFeat}
            activeOpacity={0.75}
            style={[styles.addFeatBtn, { backgroundColor: c.primary + "22", borderColor: c.primary + "55", borderRadius: 8 }]}
          >
            <Feather name="plus" size={14} color={c.primary} />
            <Text style={[styles.addFeatText, { color: c.primary }]}>Add Feat</Text>
          </TouchableOpacity>
        </View>}
        {settings.showFeatsSection && (feats.length === 0 ? (
          <Card padding={14}>
            <Text style={[styles.featEmpty, { color: c.mutedForeground, fontSize: c.scaleFont(13), lineHeight: c.scaleLineHeight(18) }]}> 
              No feats yet — tap Add Feat to add one.
            </Text>
          </Card>
        ) : (
          feats.map((feat) => (
            <Card key={feat.id} padding={14} style={styles.featCard}>
              <View style={styles.featRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.featName, { color: c.foreground, fontSize: c.scaleFont(15) }]}>{feat.name}</Text>
                  {feat.source && (
                    <Text style={[styles.featSource, { color: c.primary, fontSize: c.scaleFont(11) }]}>{feat.source}</Text>
                  )}
                  {feat.description && (
                    <Text style={[styles.featDesc, { color: c.mutedForeground, fontSize: c.scaleFont(13), lineHeight: c.scaleLineHeight(18) }]}>{feat.description}</Text>
                  )}
                </View>
                <View style={styles.featActions}>
                  <TouchableOpacity
                    onPress={() => openEditFeat(feat)}
                    style={[styles.featActionBtn, { backgroundColor: c.secondary }]}
                    activeOpacity={0.7}
                  >
                    <Feather name="edit-2" size={14} color={c.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteFeat(feat.id)}
                    style={[styles.featActionBtn, { backgroundColor: c.secondary }]}
                    activeOpacity={0.7}
                  >
                    <Feather name="trash-2" size={14} color={c.destructive} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))
        ))}

        {/* Class Features (passive) */}
        {settings.showClassFeaturesSection && (passiveFeatures.length > 0 || recentActionUnlocks.length > 0 || recentResourceUnlocks.length > 0 || recentSpellSlotGains.length > 0) && (
          <>
            <SectionHeader title="Class Features" />
            {(recentPassiveUnlocks.length > 0 || recentActionUnlocks.length > 0 || recentResourceUnlocks.length > 0 || recentSpellSlotGains.length > 0) && (
              <Card padding={14} style={{ marginBottom: 8 }}>
                <Text style={[styles.progressionSummaryTitle, { color: c.foreground }]}>Recent unlocks at level {character.level}</Text>
                {recentPassiveUnlocks.length > 0 && (
                  <Text style={[styles.progressionSummaryText, { color: c.mutedForeground }]}>Passive features: {recentPassiveUnlocks.map((feat) => feat.name).join(", ")}</Text>
                )}
                {recentActionUnlocks.length > 0 && (
                  <Text style={[styles.progressionSummaryText, { color: c.mutedForeground }]}>Active abilities: {recentActionUnlocks.map((feature) => feature.name).join(", ")}</Text>
                )}
                {recentResourceUnlocks.length > 0 && (
                  <Text style={[styles.progressionSummaryText, { color: c.mutedForeground }]}>Resources: {recentResourceUnlocks.map((resource) => `${resource.name} max ${resource.newMax}`).join(", ")}</Text>
                )}
                {recentSpellSlotGains.length > 0 && (
                  <Text style={[styles.progressionSummaryText, { color: c.mutedForeground }]}>Spell slots: {recentSpellSlotGains.map((slot) => `${slot.gained > 1 ? `+${slot.gained} ` : "+1 "}${slot.level}${slot.level === 1 ? "st" : slot.level === 2 ? "nd" : slot.level === 3 ? "rd" : "th"}-level`).join(", ")}</Text>
                )}
              </Card>
            )}
            {sortedPassiveFeatures.map((feat) => (
              <Card key={feat.id} padding={14} style={{ marginBottom: 8 }}>
                <View style={styles.progressionFeatureHeader}>
                  <Text style={[styles.featName, { color: c.foreground, fontSize: c.scaleFont(15), flex: 1 }]}>{feat.name}</Text>
                  {feat.levelGained ? (
                    <View style={[styles.progressionBadge, { backgroundColor: feat.levelGained === character.level ? c.primary + "18" : c.secondary, borderColor: feat.levelGained === character.level ? c.primary + "40" : c.border }]}> 
                      <Text style={[styles.progressionBadgeText, { color: feat.levelGained === character.level ? c.primary : c.mutedForeground }]}>LV {feat.levelGained}</Text>
                    </View>
                  ) : null}
                  {feat.originKind ? (
                    <View style={[styles.progressionBadge, { backgroundColor: c.secondary, borderColor: c.border }]}> 
                      <Text style={[styles.progressionBadgeText, { color: c.mutedForeground }]}>{feat.originKind.replace(/_/g, " ")}</Text>
                    </View>
                  ) : null}
                </View>
                {(feat.source && feat.source !== "class") || feat.levelGained ? (
                  <Text style={[styles.featSource, { color: c.primary, fontSize: c.scaleFont(11) }]}>
                    {[feat.source && feat.source !== "class" ? feat.source : null, feat.levelGained ? `Unlocked at level ${feat.levelGained}` : null].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
                {feat.description ? (
                  <Text style={[styles.featDesc, { color: c.mutedForeground, marginTop: c.densitySpace(4), fontSize: c.scaleFont(13), lineHeight: c.scaleLineHeight(18) }]}>{feat.description}</Text>
                ) : null}
                {feat.explanation ? (
                  <Text style={[styles.progressionExplain, { color: c.mutedForeground }]}>
                    Why this changed: {feat.explanation}
                  </Text>
                ) : null}
              </Card>
            ))}

            {recentActionUnlocks.length > 0 && (
              <>
                <Text style={[styles.progressionSubsectionLabel, { color: c.mutedForeground }]}>ACTIVE UNLOCKS</Text>
                {sortedActionFeatures.map((feature) => (
                  <Card key={feature.id} padding={14} style={{ marginBottom: 8 }}>
                    <View style={styles.progressionFeatureHeader}>
                      <Text style={[styles.featName, { color: c.foreground, fontSize: c.scaleFont(15), flex: 1 }]}>{feature.name}</Text>
                      {feature.actionType ? (
                        <View style={[styles.progressionBadge, { backgroundColor: c.primary + "18", borderColor: c.primary + "40" }]}> 
                          <Text style={[styles.progressionBadgeText, { color: c.primary }]}>{formatSheetActionTypeLabel(feature.actionType)}</Text>
                        </View>
                      ) : null}
                      {feature.levelGained ? (
                        <View style={[styles.progressionBadge, { backgroundColor: feature.levelGained === character.level ? c.primary + "18" : c.secondary, borderColor: feature.levelGained === character.level ? c.primary + "40" : c.border }]}> 
                          <Text style={[styles.progressionBadgeText, { color: feature.levelGained === character.level ? c.primary : c.mutedForeground }]}>LV {feature.levelGained}</Text>
                        </View>
                      ) : null}
                    </View>
                    {(feature.source && feature.source !== "class") || feature.levelGained ? (
                      <Text style={[styles.featSource, { color: c.primary, fontSize: c.scaleFont(11) }]}> 
                        {[feature.source && feature.source !== "class" ? feature.source : null, feature.levelGained ? `Unlocked at level ${feature.levelGained}` : null].filter(Boolean).join(" · ")}
                      </Text>
                    ) : null}
                    {feature.description ? (
                      <Text style={[styles.featDesc, { color: c.mutedForeground, marginTop: c.densitySpace(4), fontSize: c.scaleFont(13), lineHeight: c.scaleLineHeight(18) }]}>{feature.description}</Text>
                    ) : null}
                    {feature.explanation ? (
                      <Text style={[styles.progressionExplain, { color: c.mutedForeground }]}>Why this changed: {feature.explanation}</Text>
                    ) : null}
                  </Card>
                ))}
              </>
            )}

            {(recentResourceUnlocks.length > 0 || recentSpellSlotGains.length > 0) && (
              <Card padding={14} style={{ marginBottom: 8 }}>
                <Text style={[styles.progressionSubsectionLabel, { color: c.mutedForeground, marginBottom: 8 }]}>RESOURCE UPDATES</Text>
                {recentResourceUnlocks.map((resource) => (
                  <View key={resource.name} style={[styles.progressionResourceRow, { borderBottomColor: c.border }]}> 
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.featName, { color: c.foreground, fontSize: c.scaleFont(14) }]}>{resource.name}</Text>
                      <Text style={[styles.progressionResourceText, { color: c.mutedForeground }]}>Max {resource.newMax} · resets on {resource.resetOn.replace(/_/g, " ")}</Text>
                      {resource.description ? <Text style={[styles.progressionExplain, { color: c.mutedForeground }]}>{resource.description}</Text> : null}
                    </View>
                  </View>
                ))}
                {recentSpellSlotGains.map((slot) => (
                  <View key={`slot-${slot.level}`} style={[styles.progressionResourceRow, { borderBottomColor: c.border }]}> 
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.featName, { color: c.foreground, fontSize: c.scaleFont(14) }]}>{slot.level}{slot.level === 1 ? "st" : slot.level === 2 ? "nd" : slot.level === 3 ? "rd" : "th"}-level spell slots</Text>
                      <Text style={[styles.progressionResourceText, { color: c.mutedForeground }]}>+{slot.gained} total slot{slot.gained === 1 ? "" : "s"} gained at this level</Text>
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}

        {/* Tracked Quest */}
        {settings.showTrackedQuest && (() => {
          const tracked = quests.find(q => q.pinned);
          return (
            <>
              <SectionHeader title="Tracked Quest" />
              <Card>
                {tracked ? (
                  <>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <Feather name="bookmark" size={14} color={c.primary} />
                      <Text style={{ fontSize: c.scaleFont(15), lineHeight: c.scaleLineHeight(20), fontWeight: "700", color: c.foreground, flex: 1 }} numberOfLines={2}>
                        {tracked.name}
                      </Text>
                      <View style={{ backgroundColor: c.primary + "20", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontSize: c.scaleFont(11), color: c.primary, fontWeight: "600", textTransform: "capitalize" }}> 
                          {tracked.type}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: tracked.description ? 8 : 4 }}>
                      <View style={{
                        width: 8, height: 8, borderRadius: 4,
                        backgroundColor: tracked.status === "active" ? "#22c55e" : tracked.status === "completed" ? c.primary : "#ef4444",
                      }} />
                      <Text style={{ fontSize: c.scaleFont(12), color: c.mutedForeground, textTransform: "capitalize" }}>{tracked.status}</Text>
                    </View>
                    {!!tracked.description && (
                      <Text style={{ fontSize: c.scaleFont(13), color: c.foreground, lineHeight: c.scaleLineHeight(19), marginBottom: c.densitySpace(10) }} numberOfLines={4}>
                        {tracked.description}
                      </Text>
                    )}
                    <TouchableOpacity
                      onPress={() => pinQuest(tracked.id, false)}
                      activeOpacity={0.7}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.secondary }}
                    >
                      <Feather name="bookmark" size={12} color={c.mutedForeground} />
                      <Text style={{ fontSize: c.scaleFont(12), color: c.mutedForeground }}>Untrack</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ alignItems: "center", paddingVertical: 14, gap: 6 }}>
                    <Feather name="bookmark" size={22} color={c.mutedForeground} />
                    <Text style={{ fontSize: c.scaleFont(13), lineHeight: c.scaleLineHeight(18), color: c.mutedForeground, textAlign: "center" }}> 
                      No quest tracked.{"\n"}Long-press an active quest in the Quests tab to track it here.
                    </Text>
                  </View>
                )}
              </Card>
            </>
          );
        })()}

          </>
        )}

        {sheetTab === "details" && (
          <>
            <SectionHeader title="Identity & Background" subtitle="Editable character information that stays off the overview tab" />
            <Card padding={12}>
              <DetailField label="Background" hint="Set during character creation">
                <View style={[styles.detailReadonly, { backgroundColor: c.secondary, borderColor: c.border }]}> 
                  <Text style={[styles.detailReadonlyText, { color: c.foreground }]}>
                    {character.background?.trim() ? character.background : "No background selected"}
                  </Text>
                </View>
              </DetailField>
              <DetailField label="Alignment">
                <TextInput
                  value={detailAlignment}
                  onChangeText={setDetailAlignment}
                  placeholder="Chaotic Good, Lawful Neutral..."
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.detailInput, { backgroundColor: c.secondary, color: c.foreground, borderColor: c.border }]}
                />
              </DetailField>
            </Card>

            <SectionHeader title="Languages & Training" />
            <Card padding={12}>
              <DetailField label="Languages" hint="Comma-separated">
                <TextInput
                  value={detailLanguages}
                  onChangeText={setDetailLanguages}
                  placeholder="Common, Elvish, Draconic"
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.detailInput, { backgroundColor: c.secondary, color: c.foreground, borderColor: c.border }]}
                />
              </DetailField>
              <DetailField label="Tool Proficiencies" hint="Comma-separated">
                <TextInput
                  value={detailToolProficiencies}
                  onChangeText={setDetailToolProficiencies}
                  placeholder="Thieves' Tools, Herbalism Kit"
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.detailInput, { backgroundColor: c.secondary, color: c.foreground, borderColor: c.border }]}
                />
              </DetailField>
              <DetailField label="Weapon Masteries" hint="Comma-separated">
                <TextInput
                  value={detailWeaponMasteries}
                  onChangeText={setDetailWeaponMasteries}
                  placeholder="Nick, Push, Topple"
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.detailInput, { backgroundColor: c.secondary, color: c.foreground, borderColor: c.border }]}
                />
              </DetailField>
            </Card>

            <SectionHeader title="Roleplay & Lore" />
            <Card padding={12}>
              <DetailField label="Personality Trait">
                <TextInput
                  value={detailTrait}
                  onChangeText={setDetailTrait}
                  placeholder="What stands out about them?"
                  placeholderTextColor={c.mutedForeground}
                  multiline
                  style={[styles.detailInput, styles.detailTextarea, { backgroundColor: c.secondary, color: c.foreground, borderColor: c.border }]}
                />
              </DetailField>
              <DetailField label="Ideal">
                <TextInput
                  value={detailIdeal}
                  onChangeText={setDetailIdeal}
                  placeholder="What principle drives them?"
                  placeholderTextColor={c.mutedForeground}
                  multiline
                  style={[styles.detailInput, styles.detailTextarea, { backgroundColor: c.secondary, color: c.foreground, borderColor: c.border }]}
                />
              </DetailField>
              <DetailField label="Bond">
                <TextInput
                  value={detailBond}
                  onChangeText={setDetailBond}
                  placeholder="What connection matters most?"
                  placeholderTextColor={c.mutedForeground}
                  multiline
                  style={[styles.detailInput, styles.detailTextarea, { backgroundColor: c.secondary, color: c.foreground, borderColor: c.border }]}
                />
              </DetailField>
              <DetailField label="Flaw">
                <TextInput
                  value={detailFlaw}
                  onChangeText={setDetailFlaw}
                  placeholder="What weakness gets them in trouble?"
                  placeholderTextColor={c.mutedForeground}
                  multiline
                  style={[styles.detailInput, styles.detailTextarea, { backgroundColor: c.secondary, color: c.foreground, borderColor: c.border }]}
                />
              </DetailField>
              <DetailField label="Lore & Notes">
                <TextInput
                  value={detailNotes}
                  onChangeText={setDetailNotes}
                  placeholder="Campaign lore, secrets, backstory, reminders..."
                  placeholderTextColor={c.mutedForeground}
                  multiline
                  style={[styles.detailInput, styles.detailNotesArea, { backgroundColor: c.secondary, color: c.foreground, borderColor: c.border }]}
                />
              </DetailField>
              <TouchableOpacity
                onPress={saveDetailFields}
                activeOpacity={0.85}
                style={[styles.detailSaveBtn, { backgroundColor: c.primary }]}
              >
                <Feather name="save" size={14} color={c.primaryForeground} />
                <Text style={[styles.detailSaveText, { color: c.primaryForeground }]}>Save Details</Text>
              </TouchableOpacity>
            </Card>
          </>
        )}

        {sheetTab === "companions" && (
          <>
            <SectionHeader title="Companions" subtitle="Allies and summoned creatures" />
            <TouchableOpacity
              onPress={() => setEditingCompanion({} as any)}
              activeOpacity={0.7}
              style={[
                styles.addConditionBtn,
                { backgroundColor: c.primary + "20", borderColor: c.primary, borderRadius: c.radius, marginBottom: 8 },
              ]}
            >
              <Feather name="plus" size={13} color={c.primary} />
              <Text style={[styles.addConditionText, { color: c.primary }]}>Create Companion</Text>
            </TouchableOpacity>
            {companions.length === 0 ? (
              <Card style={styles.conditionEmpty}>
                <Text style={[styles.conditionEmptyText, { color: c.mutedForeground, fontSize: c.scaleFont(13) }]}> 
                  No companions yet
                </Text>
              </Card>
            ) : (
              <View style={{ gap: 8 }}>
                {companions.map((companion) => (
                  <Card key={companion.id} style={{ padding: 12 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.conditionName, { color: c.foreground, fontSize: c.scaleFont(14) }]}> 
                          {companion.name}
                        </Text>
                        <Text style={[styles.conditionSource, { color: c.mutedForeground, fontSize: c.scaleFont(12) }]}> 
                          {companion.type} · CR {companion.challenge_rating}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        <TouchableOpacity
                          onPress={() => {
                            void handleAddCompanionToCombat(companion);
                          }}
                          disabled={!partyCode || !memberId || projectingCompanionId === companion.id}
                          activeOpacity={0.7}
                          style={[
                            styles.conditionRemoveBtn,
                            {
                              backgroundColor: c.secondary,
                              borderRadius: c.radius,
                              opacity: !partyCode || !memberId || projectingCompanionId === companion.id ? 0.5 : 1,
                            },
                          ]}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Feather name="crosshair" size={13} color={c.mutedForeground} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingCompanion(companion)} activeOpacity={0.7} style={[styles.conditionRemoveBtn, { backgroundColor: c.secondary, borderRadius: c.radius }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Feather name="edit-2" size={13} color={c.mutedForeground} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteCompanion(companion.id)} activeOpacity={0.7} style={[styles.conditionRemoveBtn, { backgroundColor: c.secondary, borderRadius: c.radius }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Feather name="x" size={14} color={c.mutedForeground} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.companionStats}>
                      <View style={styles.companionStatItem}>
                        <Text style={[styles.companionStatLabel, { color: c.mutedForeground, fontSize: c.scaleFont(10) }]}>HP</Text>
                        <Text style={[styles.companionStatValue, { color: c.foreground, fontSize: c.scaleFont(12) }]}> 
                          {companion.hit_points}/{companion.max_hit_points}
                        </Text>
                      </View>
                      <View style={styles.companionStatItem}>
                        <Text style={[styles.companionStatLabel, { color: c.mutedForeground, fontSize: c.scaleFont(10) }]}>AC</Text>
                        <Text style={[styles.companionStatValue, { color: c.foreground, fontSize: c.scaleFont(12) }]}> 
                          {companion.armor_class}
                        </Text>
                      </View>
                      <View style={styles.companionStatItem}>
                        <Text style={[styles.companionStatLabel, { color: c.mutedForeground, fontSize: c.scaleFont(10) }]}>Size</Text>
                        <Text style={[styles.companionStatValue, { color: c.foreground, fontSize: c.scaleFont(11), textTransform: "capitalize" }]}> 
                          {companion.size?.toLowerCase() || "Medium"}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{
                        color: c.mutedForeground,
                        fontSize: c.scaleFont(11),
                        marginTop: 8,
                      }}
                    >
                      Speed: {companion.speed || "30 ft."} · Hit Dice: {companion.hit_dice || "1d8"}
                    </Text>
                    <Text
                      style={{
                        color: c.mutedForeground,
                        fontSize: c.scaleFont(11),
                        marginTop: 4,
                      }}
                    >
                      STR {companion.strength} · DEX {companion.dexterity} · CON {companion.constitution} · INT {companion.intelligence} · WIS {companion.wisdom} · CHA {companion.charisma}
                    </Text>
                    {((companion.actions?.length ?? 0) > 0 ||
                      (companion.special_abilities?.length ?? 0) > 0) && (
                      <Text
                        style={{
                          color: c.mutedForeground,
                          fontSize: c.scaleFont(11),
                          marginTop: 4,
                        }}
                      >
                        Actions: {companion.actions?.length ?? 0} · Special: {companion.special_abilities?.length ?? 0}
                      </Text>
                    )}
                    {companion.notes && (
                      <Text style={[styles.conditionNotes, { color: c.mutedForeground, fontSize: c.scaleFont(12), lineHeight: c.scaleLineHeight(17), marginTop: 8 }]}> 
                        {companion.notes}
                      </Text>
                    )}
                  </Card>
                ))}
              </View>
            )}
          </>
        )}

        {sheetTab === "reference" && (
          <>
            <SectionHeader title="Reference Compendium" />
            <ReferenceCompendium />
          </>
        )}
      </ScrollHintScrollView>

      {/* What's This Modal */}
      <Modal
        visible={helpVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setHelpVisible(false)}
      >
        <View style={[styles.helpOverlay, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
          <View style={[styles.helpSheet, { backgroundColor: c.card, borderColor: c.border }]}> 
            <View style={[styles.helpHeader, { borderBottomColor: c.border }]}> 
              <Text style={[styles.helpTitle, { color: c.foreground, fontSize: c.scaleFont(16) }]}>{helpTitle}</Text>
              <TouchableOpacity onPress={() => setHelpVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={18} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>
            <ScrollHintScrollView style={styles.helpBodyWrap} contentContainerStyle={styles.helpBodyContent}>
              <Text style={[styles.helpBody, { color: c.foreground, fontSize: c.scaleFont(14), lineHeight: c.scaleLineHeight(21) }]}>{helpBody}</Text>
            </ScrollHintScrollView>
            <TouchableOpacity
              onPress={() => setHelpVisible(false)}
              activeOpacity={0.85}
              style={[styles.helpCloseBtn, { backgroundColor: c.primary }]}
            >
              <Text style={[styles.helpCloseText, { color: c.primaryForeground, fontSize: c.scaleFont(14) }]}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Level Up Modal */}
      <LevelUpModal visible={levelUpVisible} onClose={() => setLevelUpVisible(false)} />

      {/* Companion Form Modal */}
      <CompanionForm
        visible={editingCompanion !== null}
        onClose={() => setEditingCompanion(null)}
        onSave={(data) => {
          if (editingCompanion && editingCompanion.id) {
            updateCompanion(editingCompanion.id, data);
          } else {
            addCompanion(data);
          }
          setEditingCompanion(null);
        }}
        initialData={(editingCompanion && editingCompanion.id) ? editingCompanion : undefined}
        characterId={character.id}
      />

      {/* Add/Edit Feat Modal */}
      <Modal
        visible={featModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFeatModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: c.foreground, fontSize: c.scaleFont(17) }]}> 
                {editingFeat ? "Edit Feat" : "Add Feat"}
              </Text>
              <TouchableOpacity onPress={() => setFeatModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={20} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: c.densitySpace(16), gap: c.densitySpace(12), paddingBottom: c.densitySpace(24) }}>
              <View>
                <Text style={[styles.featFieldLabel, { color: c.mutedForeground, fontSize: c.scaleFont(10) }]}>FEAT NAME *</Text>
                <TextInput
                  value={featName}
                  onChangeText={setFeatName}
                  placeholder="e.g. War Caster, Lucky, Sentinel"
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.featInput, { backgroundColor: c.secondary, color: c.foreground, borderColor: c.border, fontSize: c.scaleFont(14), paddingHorizontal: c.densitySpace(12), paddingVertical: c.densitySpace(10) }]}
                  autoFocus
                />
              </View>
              <View>
                <Text style={[styles.featFieldLabel, { color: c.mutedForeground, fontSize: c.scaleFont(10) }]}>SOURCE (optional)</Text>
                <TextInput
                  value={featSource}
                  onChangeText={setFeatSource}
                  placeholder="e.g. ASI at level 4, Half-Elf"
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.featInput, { backgroundColor: c.secondary, color: c.foreground, borderColor: c.border, fontSize: c.scaleFont(14), paddingHorizontal: c.densitySpace(12), paddingVertical: c.densitySpace(10) }]}
                />
              </View>
              <View>
                <Text style={[styles.featFieldLabel, { color: c.mutedForeground, fontSize: c.scaleFont(10) }]}>DESCRIPTION (optional)</Text>
                <TextInput
                  value={featDesc}
                  onChangeText={setFeatDesc}
                  placeholder="What does this feat do?"
                  placeholderTextColor={c.mutedForeground}
                  multiline
                  style={[styles.featInput, styles.featDescInput, { backgroundColor: c.secondary, color: c.foreground, borderColor: c.border, fontSize: c.scaleFont(14), lineHeight: c.scaleLineHeight(20), paddingHorizontal: c.densitySpace(12), paddingVertical: c.densitySpace(10) }]}
                />
              </View>
              <TouchableOpacity
                onPress={saveFeat}
                activeOpacity={0.85}
                style={[styles.featSaveBtn, { backgroundColor: featName.trim() ? c.primary : c.muted }]}
              >
                <Text style={[styles.featSaveBtnText, { color: featName.trim() ? c.primaryForeground : c.mutedForeground, fontSize: c.scaleFont(15) }]}> 
                  {editingFeat ? "Save Changes" : "Add Feat"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Condition Modal */}
      <Modal
        visible={conditionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setConditionModalVisible(false);
          setConditionSearch("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: c.foreground }]}>Add Condition</Text>
              <TouchableOpacity
                onPress={() => {
                  setConditionModalVisible(false);
                  setConditionSearch("");
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={20} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBox, { backgroundColor: c.secondary, borderColor: c.border }]}>
              <Feather name="search" size={14} color={c.mutedForeground} />
              <TextInput
                value={conditionSearch}
                onChangeText={setConditionSearch}
                placeholder="Search conditions…"
                placeholderTextColor={c.mutedForeground}
                style={[styles.searchInput, { color: c.foreground, fontSize: c.scaleFont(14) }]}
                autoFocus
              />
            </View>

            <FlatList
              data={filteredConditions}
              keyExtractor={(item) => item}
              style={styles.conditionList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: name }) => {
                const info = getConditionInfo(name);
                return (
                  <TouchableOpacity
                    onPress={() => handleAddCondition(name)}
                    activeOpacity={0.75}
                    style={[styles.conditionOption, { borderBottomColor: c.border }]}
                  >
                    <View style={[styles.conditionOptionDot, { backgroundColor: info.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.conditionOptionName, { color: c.foreground, fontSize: c.scaleFont(15) }]}>{name}</Text>
                      <Text style={[styles.conditionOptionDesc, { color: c.mutedForeground, fontSize: c.scaleFont(12), lineHeight: c.scaleLineHeight(16) }]} numberOfLines={2}>
                        {info.description}
                      </Text>
                    </View>
                    <Feather name="plus" size={16} color={info.color} />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Text style={[styles.emptyListText, { color: c.mutedForeground, fontSize: c.scaleFont(14), lineHeight: c.scaleLineHeight(19) }]}> 
                    {conditionSearch ? "No matching conditions" : "All conditions are already active"}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

function DetailField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const c = useColors();

  return (
    <View style={styles.detailFieldWrap}>
      <View style={styles.detailFieldHeader}>
        <Text style={[styles.detailFieldLabel, { color: c.mutedForeground }]}>{label}</Text>
        {hint ? <Text style={[styles.detailFieldHint, { color: c.mutedForeground }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  heroCard: { marginBottom: 12 },
  sheetTabBar: {
    flexDirection: "row",
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  sheetTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
  },
  sheetTabLabel: { fontSize: 12, fontWeight: "700" },
  detailBody: { fontSize: 13, lineHeight: 20 },
  detailFieldWrap: { gap: 6, marginBottom: 12 },
  detailFieldHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  detailFieldLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  detailFieldHint: { fontSize: 10 },
  detailInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  detailReadonly: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 42,
    justifyContent: "center",
  },
  detailReadonlyText: { fontSize: 14, fontWeight: "600" },
  detailTextarea: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  detailNotesArea: {
    minHeight: 132,
    textAlignVertical: "top",
  },
  detailSaveBtn: {
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  detailSaveText: { fontSize: 14, fontWeight: "800" },
  returnBanner: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  returnBannerCopy: {
    flex: 1,
    gap: 2,
  },
  returnBannerLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  returnBannerTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  returnBannerButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  returnBannerButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },
  heroIdentityRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  heroTextWrap: { flex: 1 },
  heroAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroAvatarImage: { width: "100%", height: "100%" },
  heroPortraitActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  heroPortraitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  heroPortraitBtnText: { fontSize: 11, fontWeight: "600" },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  charName: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  charSub: { fontSize: 14, marginBottom: 2 },
  charMeta: { fontSize: 12 },
  levelBadgeWrap: { alignItems: "center", gap: 3 },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  levelText: { fontSize: 18, fontWeight: "800" },
  levelUpHint: { fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
  hpSection: {},
  hpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  hpLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  hpControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  hpBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  hpValue: { fontSize: 28, fontWeight: "800", lineHeight: 32 },
  hpMax: { fontSize: 16, fontWeight: "500" },
  hpBar: { height: 6, marginBottom: 4, overflow: "hidden" },
  hpFill: { height: 6 },
  tempHp: { fontSize: 12, fontWeight: "600", textAlign: "right" },
  deathSaveTrackRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  deathSaveTrackCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  deathSaveTrackLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  deathSaveTrackValue: { fontSize: 14, fontWeight: "800" },
  deathSaveActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  deathSaveBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deathSaveBtnText: { fontSize: 12, fontWeight: "800" },
  deathSaveHint: {
    marginTop: 10,
    fontWeight: "500",
    lineHeight: 16,
  },

  // Conditions section
  conditionSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingBottom: 6,
    marginBottom: 8,
  },
  addConditionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  addConditionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  conditionEmpty: {
    marginBottom: 8,
    alignItems: "center",
  },
  conditionEmptyText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  conditionCard: { marginBottom: 8 },
  conditionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  conditionDot: { width: 10, height: 10, borderRadius: 5 },
  conditionName: { fontSize: 15, fontWeight: "700" },
  conditionSource: { fontSize: 12, marginTop: 1 },
  conditionRemoveBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  conditionDesc: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  conditionNotes: { fontSize: 12, fontStyle: "italic", marginBottom: 8 },
  conditionRemovalRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  conditionRemovalLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  removalBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  removalBadgeText: { fontSize: 11, fontWeight: "700" },
  durationBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  durationBadgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  durationEditor: { borderRadius: 8, borderWidth: 1, padding: 12, marginBottom: 10, marginTop: 2 },
  durationTypeBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  durationInput: { width: 44, height: 30, borderRadius: 6, borderWidth: 1, textAlign: "center", fontSize: 13 },
  durationSaveBtn: { alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 7, borderRadius: 7 },

  companionStats: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  companionStatItem: {
    alignItems: "center",
    gap: 2,
  },
  companionStatLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  companionStatValue: {
    fontSize: 12,
    fontWeight: "700",
  },

  coreStatsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  coreStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
  },
  coreValue: { fontSize: 18, fontWeight: "700", marginBottom: 2 },
  coreLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center" },
  coreBonus: { fontSize: 9, fontWeight: "800", color: "#10B981", marginTop: 2 },
  abilitiesRow: { flexDirection: "row", marginBottom: 4 },
  showMoreBtn: { paddingTop: 10, alignItems: "center" },
  showMoreText: { fontSize: 13, fontWeight: "600" },
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  currencyInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  currencyBadge: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
  },
  currencyBadgeText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  currencyAmount: { fontSize: 18, fontWeight: "700" },
  currencyAmountBtn: {
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  currencyEditWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currencyInput: {
    minWidth: 84,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  currencySaveBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  currencyControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currencyBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  notesInput: {
    minHeight: 100,
    padding: 10,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  saveNotesBtn: {
    padding: 12,
    alignItems: "center",
  },
  saveNotesBtnText: { fontSize: 14, fontWeight: "700" },
  notesText: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  notesHint: { fontSize: 11, textAlign: "right" },

  // Equipped item buffs
  buffSectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    marginBottom: 6,
  },
  buffSectionText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  buffCard: {
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  buffHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  buffLabel: { fontSize: 13, fontWeight: "700" },
  buffItem: { fontSize: 10, fontWeight: "600" },
  buffDesc: { fontSize: 12, lineHeight: 17 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: "75%",
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  conditionList: {
    flex: 1,
  },
  conditionOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  conditionOptionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  conditionOptionName: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  conditionOptionDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyList: {
    padding: 24,
    alignItems: "center",
  },
  emptyListText: {
    fontSize: 14,
    fontStyle: "italic",
  },
  incapBanner: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 12,
  },
  incapAccent: {
    width: 4,
  },
  incapBody: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  incapContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  incapTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#EF4444",
    letterSpacing: 1.4,
  },
  incapSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },

  featSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  addFeatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  addFeatText: { fontSize: 13, fontWeight: "700" },
  featEmpty: { fontSize: 13, fontStyle: "italic" },
  featCard: { marginBottom: 8 },
  progressionSummaryTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  progressionSummaryText: { fontSize: 13, lineHeight: 18 },
  progressionSubsectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 },
  progressionFeatureHeader: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  progressionBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  progressionBadgeText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  progressionExplain: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  progressionResourceRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  progressionResourceText: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  featRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  featName: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  featSource: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
  featDesc: { fontSize: 13, lineHeight: 18 },
  featActions: { flexDirection: "row", gap: 6 },
  featActionBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  featFieldLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginBottom: 6 },
  featInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    fontSize: 14,
  },
  featDescInput: { minHeight: 80, textAlignVertical: "top" },
  featSaveBtn: {
    paddingVertical: 14,
    borderRadius: 11,
    alignItems: "center",
    marginTop: 4,
  },
  featSaveBtnText: { fontSize: 15, fontWeight: "700" },

  helpOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  helpSheet: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
    maxHeight: "70%",
  },
  helpHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  helpTitle: {
    flex: 1,
    fontWeight: "700",
  },
  helpBodyWrap: {
    maxHeight: 280,
  },
  helpBodyContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  helpBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  helpCloseBtn: {
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  helpCloseText: {
    fontSize: 14,
    fontWeight: "700",
  },

  holdCoachmark: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  holdCoachmarkContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  holdCoachmarkText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    flex: 1,
  },
  holdCoachmarkDismiss: {
    fontSize: 11,
    fontWeight: "700",
  },
  inlineHoldHint: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
  },
  inlineHoldHintText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
