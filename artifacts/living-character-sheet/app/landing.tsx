import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { AiDmSessionAwarenessPlaceholderStrip } from "@/components/adventure/AiDmSessionAwarenessPlaceholderStrip";
import { useAdventureSessionAwareness } from "@/context/AdventureSessionContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { AI_DM_ROUTES } from "@/utils/aiDmRouteDefs";
import { createShadowStyle } from "../utils/shadow";
import { useCharacter } from "@/context/CharacterContext";
import { useParty } from "@/context/PartyContext";
import { getAllCharacters, getLastActiveId } from "@/utils/characterStorage";
import type { SavedCharacter } from "@/utils/characterStorage";
import { getSavedDmNpcs, deleteSavedDmNpc, queueDmNpcForEditing } from "@/app/dm-npc";
import type { SavedDmNpc } from "@/app/dm-npc";
import {
  addCombatNpc,
  createParty,
  startPartyInitiative,
  submitInitiativeRoll,
  syncPartyMember,
  registerPartyMember,
  type SyncPayload,
} from "@/utils/partyApi";
import type { CharacterSnapshot } from "@/types";
import {
  demoCharacterProfiles,
  mockLyraSnapshot,
} from "@/data/mockCharacter";
import {
  CURRENCY_TABLE, LIFESTYLE_EXPENSES, WEAPON_PRICES, ARMOR_PRICES, ADVENTURING_GEAR,
  POTION_PRICES, MAGIC_ITEM_PRICE_GUIDE, CONDITIONS, XP_THRESHOLDS, CR_XP_TABLE,
  MONSTER_MULTIPLIERS, REST_REFERENCE, GEMSTONE_VALUES, SERVICES_COSTS, LORE_ENTRIES, DM_TIPS,
} from "@/data/dnd5eReference";

type Tab = "player" | "party" | "dm" | "options" | "resources";

const DEMO_PARTY_PROFILE_KEYS = ["lyra", "darius", "selene"];

function buildDemoSnapshot() {
  return mockLyraSnapshot;
}

function buildDemoPartyProfiles(): CharacterSnapshot[] {
  const profileByKey = new Map(demoCharacterProfiles.map((profile) => [profile.key, profile.snapshot]));
  const orderedProfiles = DEMO_PARTY_PROFILE_KEYS
    .map((key) => profileByKey.get(key))
    .filter((snapshot): snapshot is CharacterSnapshot => Boolean(snapshot));

  if (orderedProfiles.length > 0) {
    return orderedProfiles;
  }
  return [buildDemoSnapshot()];
}

function buildDemoSeedSnapshot(partyCode: string, memberId: string, snapshot: CharacterSnapshot, snapshotUpdatedAt: number): SyncPayload {
  const { character, conditions } = snapshot;
  return {
    memberId,
    partyCode,
    characterName: character.name,
    characterClass: character.class + (character.level ? ` ${character.level}` : ""),
    currentHp: character.currentHp,
    maxHp: character.maxHp,
    tempHp: character.tempHp ?? 0,
    armorClass: character.armorClass,
    damageResistances: character.damageResistances ?? [],
    damageImmunities: character.damageImmunities ?? [],
    conditionImmunities: character.conditionImmunities ?? [],
    snapshotUpdatedAt,
    coreStats: {
      speed: character.speed,
      initiativeBonus: character.initiative,
      strength: character.abilityScores.strength,
      dexterity: character.abilityScores.dexterity,
      constitution: character.abilityScores.constitution,
      intelligence: character.abilityScores.intelligence,
      wisdom: character.abilityScores.wisdom,
      charisma: character.abilityScores.charisma,
    },
    conditions: conditions.map((cond) => ({ id: cond.id, name: cond.name })),
  };
}

export default function HomeScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { settings } = useAppSettings();
  const { awarenessPlaceholder, clearActiveSession } = useAdventureSessionAwareness();
  const { hasCharacter, character, loadCharacter } = useCharacter();
  const { isInParty, leaveCurrentParty, joinExistingParty } = useParty();

  const [lastPlayed, setLastPlayed] = useState<SavedCharacter | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>("player");
  const [resourceSection, setResourceSection] = useState<string>("currency");
  const [savedNpcs, setSavedNpcs] = useState<SavedDmNpc[]>([]);
  const [savedNpcsOpen, setSavedNpcsOpen] = useState(false);
  const [expandedNpcId, setExpandedNpcId] = useState<string | null>(null);
  const [isBootstrappingDemoParty, setIsBootstrappingDemoParty] = useState(false);

  const loadSavedNpcs = useCallback(async () => {
    try {
      setSavedNpcs(await getSavedDmNpcs());
    } catch {
      setSavedNpcs([]);
    }
  }, []);

  useEffect(() => {
    if (tab === "dm") loadSavedNpcs();
  }, [tab, loadSavedNpcs]);

  useFocusEffect(
    useCallback(() => {
      if (tab === "dm") loadSavedNpcs();
    }, [tab, loadSavedNpcs]),
  );

  const handleDeleteSavedNpc = useCallback((npc: SavedDmNpc) => {
    const removeNpc = async () => {
      try {
        await deleteSavedDmNpc(npc.id);
        setSavedNpcs((prev) => prev.filter((item) => item.id !== npc.id));
        if (expandedNpcId === npc.id) setExpandedNpcId(null);
      } catch {
        Alert.alert("Error", "Could not delete NPC.");
      }
    };

    if (Platform.OS === "web") {
      removeNpc();
      return;
    }

    Alert.alert("Delete NPC", `Remove ${npc.name || "this NPC"}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: removeNpc },
    ]);
  }, [expandedNpcId]);

  const handleExportSavedNpc = useCallback((npc: SavedDmNpc) => {
    const text = [
      `NPC: ${npc.name || "Unnamed NPC"}`,
      [npc.gender, npc.race, npc.age].filter(Boolean).join(" · "),
      npc.alignment ? `Alignment: ${npc.alignment}` : "",
      npc.occupation ? `Occupation: ${npc.occupation}` : "",
      npc.background ? `Background: ${npc.background}` : "",
      npc.charClass ? `Class: ${npc.charClass} (Level ${npc.level})` : "",
      "",
      "Traits:",
      npc.personalityTrait1 ? `- ${npc.personalityTrait1}` : "",
      npc.personalityTrait2 ? `- ${npc.personalityTrait2}` : "",
      npc.ideal ? `Ideal: ${npc.ideal}` : "",
      npc.bond ? `Bond: ${npc.bond}` : "",
      npc.flaw ? `Flaw: ${npc.flaw}` : "",
      npc.questTags?.length ? `Linked to ${npc.questTags.length} quest(s)` : "",
      "",
      npc.appearance ? `Appearance: ${npc.appearance}` : "",
      npc.secret ? `Secret: ${npc.secret}` : "",
      npc.notes ? `Notes: ${npc.notes}` : "",
    ].filter(Boolean).join("\n");
    Share.share({ message: text });
  }, []);

  const handleEditSavedNpc = useCallback(async (npc: SavedDmNpc) => {
    try {
      await queueDmNpcForEditing(npc);
      router.push("/dm-npc");
    } catch {
      Alert.alert("Error", "Could not open NPC for editing.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const lastId = await getLastActiveId();
        if (lastId) {
          const all = await getAllCharacters();
          const found = all.find((c) => c.id === lastId) ?? null;
          if (found) setLastPlayed(found);
        }
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const handleContinueLoaded = () => router.replace("/(tabs)");
  const handleContinueLast = () => {
    if (!lastPlayed) return;
    loadCharacter(lastPlayed.snapshot);
    router.replace("/(tabs)");
  };
  const handleDemo = (profileKey = "lyra") => {
    const profile = demoCharacterProfiles.find((entry) => entry.key === profileKey);
    loadCharacter(profile?.snapshot ?? buildDemoSnapshot());
    router.replace("/(tabs)");
  };

  const handleEndAdventureSession = useCallback(() => {
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
  }, [clearActiveSession]);

  const handleDemoPartyBootstrap = useCallback(async () => {
    if (isBootstrappingDemoParty) return;

    setIsBootstrappingDemoParty(true);
    try {
      if (isInParty) {
        await leaveCurrentParty();
      }

      const { code } = await createParty();
      const seedBase = Date.now();
      const demoPartyProfiles = buildDemoPartyProfiles();
      for (let index = 0; index < demoPartyProfiles.length; index += 1) {
        const profileSnapshot = demoPartyProfiles[index];
        const { memberId } = await registerPartyMember(code, profileSnapshot.character.id);
        await syncPartyMember(buildDemoSeedSnapshot(code, memberId, profileSnapshot, seedBase + index + 1));
      }

      const localDemoSnapshot = demoPartyProfiles[0] ?? buildDemoSnapshot();
      const { memberId: demoMemberId } = await registerPartyMember(code, localDemoSnapshot.character.id);
      loadCharacter(localDemoSnapshot);
      await joinExistingParty(code, {
        characterId: localDemoSnapshot.character.id,
        snapshot: buildDemoSeedSnapshot(code, demoMemberId, localDemoSnapshot, Date.now()),
      });

      const beast = await addCombatNpc(code, {
        name: "Dire Wolf",
        sourceType: "monster",
        sourceId: "demo:dire-wolf",
        disposition: "hostile",
        initiativeTotal: 8,
        coreStats: {
          speed: 50,
          initiativeBonus: 2,
          strength: 17,
          dexterity: 15,
          constitution: 15,
          intelligence: 3,
          wisdom: 12,
          charisma: 7,
        },
        dummyState: {
          maxHp: 37,
          currentHp: 37,
          armorClass: 14,
          actionUsed: false,
          bonusActionUsed: false,
          reactionUsed: false,
          movementUsed: 0,
        },
        visibleStatKeys: ["speed", "initiativeBonus", "strength", "dexterity", "constitution"],
        conditions: [{ id: "keen-smell", name: "Keen Smell" }],
      });

      await startPartyInitiative(code, true, undefined, [beast.npc.id]);
      await submitInitiativeRoll(code, {
        memberId: demoMemberId,
        initiativeRoll: 20,
        initiativeBonus: 9,
      });
      router.replace("/(tabs)/attacks");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to bootstrap demo party.";
      Alert.alert("Could not start demo party", message);
    } finally {
      setIsBootstrappingDemoParty(false);
    }
  }, [isBootstrappingDemoParty, isInParty, joinExistingParty, leaveCurrentParty, loadCharacter]);

  // Match NPC creator top spacing (effective: web 28, native insets.top + 12)
  const topPad = Platform.OS === "web" ? 28 : insets.top + 12;

  const RESOURCE_SECTIONS = [
    { id: "currency", label: "Currency" },
    { id: "lifestyle", label: "Lifestyle" },
    { id: "weapons", label: "Weapons" },
    { id: "armor", label: "Armor" },
    { id: "gear", label: "Gear" },
    { id: "potions", label: "Potions" },
    { id: "conditions", label: "Conditions" },
    { id: "xp", label: "XP / CR" },
    { id: "rest", label: "Rest" },
    { id: "gems", label: "Gems" },
    { id: "services", label: "Services" },
    { id: "lore", label: "Lore" },
  ];

  return (
    <View style={[styles.outerContainer, { backgroundColor: c.background }]}>
      {/* ── Top Header / Hero ── */}
      <View style={[styles.hero, { paddingTop: topPad, backgroundColor: c.card, borderBottomColor: c.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={[styles.iconRing, { borderColor: c.primary + "60", backgroundColor: c.primary + "15" }]}>
            <Text style={styles.iconEmoji}>⚔️</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: c.foreground }]}>D&D Companion</Text>
            <Text style={[styles.subtitle, { color: c.mutedForeground }]}>D&D 5e Companion</Text>
          </View>
        </View>
      </View>

      {/* ── Tab Bar ── */}
      <View style={[styles.tabBar, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {([
          { id: "player" as Tab, label: "Player", icon: "user" },
          { id: "party" as Tab, label: "Party", icon: "users" },
          { id: "dm" as Tab, label: "DM Tools", icon: "shield" },
          { id: "options" as Tab, label: "Options", icon: "settings" },
        ] as const).map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => {
              if (t.id === "options") {
                router.push("/options" as never);
                return;
              }
              if (t.id === "party") {
                router.push("/party");
                return;
              }
              setTab(t.id);
            }}
            style={[styles.tabBtn, { borderBottomColor: tab === t.id ? c.primary : "transparent" }]}
          >
            <Feather name={t.icon} size={15} color={tab === t.id ? c.primary : c.mutedForeground} />
            <Text
              numberOfLines={1}
              style={[styles.tabLabel, { color: tab === t.id ? c.primary : c.mutedForeground }]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab Content ── */}
      <ScrollHintScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══════════════ PLAYER TAB ═══════════════ */}
        {tab === "player" && (
          <View style={styles.tabContent}>
            {/* Continue currently-loaded character */}
            {hasCharacter && (
              <TouchableOpacity
                onPress={handleContinueLoaded}
                activeOpacity={0.85}
                style={[styles.continueCard, { backgroundColor: c.primary, borderRadius: c.radius * 1.5 }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.continueLabel}>CONTINUE AS</Text>
                  <Text style={styles.continueName}>{character.name}</Text>
                  <Text style={styles.continueSub}>
                    {character.race} {character.class} · Level {character.level}
                  </Text>
                </View>
                <Feather name="chevron-right" size={24} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            )}

            {!hasCharacter && !checking && lastPlayed && (
              <TouchableOpacity
                onPress={handleContinueLast}
                activeOpacity={0.85}
                style={[styles.continueCard, { backgroundColor: c.primary, borderRadius: c.radius * 1.5 }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.continueLabel}>CONTINUE AS</Text>
                  <Text style={styles.continueName}>{lastPlayed.name}</Text>
                  <Text style={styles.continueSub}>
                    {lastPlayed.race} {lastPlayed.characterClass} · Level {lastPlayed.level}
                  </Text>
                </View>
                <Feather name="chevron-right" size={24} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            )}

            {!hasCharacter && checking && (
              <ActivityIndicator color={c.primary} style={{ marginVertical: 16 }} />
            )}

            <AiDmSessionAwarenessPlaceholderStrip
              placeholder={awarenessPlaceholder}
              onEndSession={handleEndAdventureSession}
            />

            <Text style={[styles.sectionHeader, { color: c.mutedForeground }]}>ADVENTURE</Text>
            <View style={styles.cardGroup}>
              <OptionCard
                icon="compass"
                title="Adventure"
                subtitle="AI DM adventure area (Phase 0 scaffold)"
                color="#8B5CF6"
                onPress={() => router.push(AI_DM_ROUTES.adventure.home as any)}
              />
            </View>

            <View style={styles.cardGroup}>
              <OptionCard icon="user-plus" title="New Character" subtitle="Create from scratch, step by step" color="#10B981" onPress={() => router.push("/create-character")} />
              <OptionCard icon="users" title="My Characters" subtitle="Load a previously saved character" color="#3B82F6" onPress={() => router.push("/characters")} />
            </View>

            {settings.showDevLandingDemoContent ? (
              <>
                <View style={styles.demoPicker}>
                  {demoCharacterProfiles.map((profile) => (
                    <TouchableOpacity
                      key={profile.key}
                      onPress={() => handleDemo(profile.key)}
                      activeOpacity={0.78}
                      style={[styles.demoChoiceBtn, { borderColor: c.border, backgroundColor: c.secondary, borderRadius: c.radius * 1.2 }]}
                    >
                        <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.demoChoiceTitle, { color: c.foreground }]}>Try demo character ({profile.label})</Text>
                        <Text style={[styles.demoChoiceSub, { color: c.mutedForeground }]}>{profile.subtitle}</Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={c.mutedForeground} />
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  onPress={() => void handleDemoPartyBootstrap()}
                  activeOpacity={0.85}
                  disabled={isBootstrappingDemoParty}
                  style={[
                    styles.demoPartyBtn,
                    {
                      backgroundColor: isBootstrappingDemoParty ? c.primary + "55" : c.primary + "18",
                      borderColor: c.primary + "66",
                      borderRadius: c.radius * 1.4,
                    },
                  ]}
                >
                  <View style={[styles.optionIcon, { width: 36, height: 36, backgroundColor: c.primary + "20", borderRadius: c.radius }]}> 
                    <Feather name="users" size={16} color={c.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.demoPartyTitle, { color: c.foreground }]}>Demo Party Bootstrap</Text>
                    <Text style={[styles.demoPartySub, { color: c.mutedForeground }]}> 
                      One click: seed party members, spawn a hostile beast, and start initiative.
                    </Text>
                  </View>
                  {isBootstrappingDemoParty ? (
                    <ActivityIndicator color={c.primary} />
                  ) : (
                    <Feather name="chevron-right" size={18} color={c.mutedForeground} />
                  )}
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        )}

        {/* ═══════════════ PARTY TAB ═══════════════ */}
        {tab === "party" && (
          <View style={styles.tabContent}>
            <Text style={[styles.sectionHeader, { color: c.mutedForeground }]}>PARTY TOOLS</Text>
            <View style={styles.cardGroup}>
              <OptionCard
                icon="users"
                title="Party"
                subtitle="Join or manage your current party"
                color="#3B82F6"
                onPress={() => router.push("/party")}
              />
            </View>
          </View>
        )}

        {/* ═══════════════ DM TAB ═══════════════ */}
        {tab === "dm" && (
          <View style={styles.tabContent}>
            <Text style={[styles.sectionHeader, { color: c.mutedForeground }]}>PARTY</Text>
            <View style={styles.cardGroup}>
              <OptionCard
                icon="eye"
                title="Party Observer"
                subtitle="Watch your party's HP, AC & conditions live — no character sheet needed"
                color="#3B82F6"
                onPress={() => router.push("/dm-party")}
              />
              <OptionCard
                icon="book-open"
                title="DM Notes"
                subtitle="Build quests, people, and locations to send to players"
                color="#14B8A6"
                onPress={() => router.push("/dm-notes")}
              />
            </View>

            <Text style={[styles.sectionHeader, { color: c.mutedForeground }]}>CHARACTERS</Text>
            <View style={styles.cardGroup}>
              <OptionCard
                icon="user-plus"
                title="Character Creator"
                subtitle="Full step-by-step guided creator for PCs or NPCs"
                color="#10B981"
                onPress={() => router.push({ pathname: "/create-character", params: { dmMode: "1" } })}
              />
              <OptionCard
                icon="users"
                title="NPC Creator"
                subtitle="Build or roll a fully detailed NPC with personality & secrets"
                color="#F59E0B"
                onPress={() => router.push("/dm-npc")}
              />
            </View>

            <Text style={[styles.sectionHeader, { color: c.mutedForeground }]}>ITEMS & LOOT</Text>
            <View style={styles.cardGroup}>
              <OptionCard
                icon="package"
                title="Item Creator"
                subtitle="Custom items — rings, weapons, or a severed foot that grants 3 bonus actions"
                color="#EF4444"
                onPress={() => router.push("/dm-item")}
              />
              <OptionCard
                icon="gift"
                title="Loot Generator"
                subtitle="Photo/text parse, detailed builder filters, and tailor-to-player suggestions"
                color="#8B5CF6"
                onPress={() => router.push("/loot-generator")}
              />
              <OptionCard
                icon="book"
                title="Monster Compendium"
                subtitle="Official & custom monsters for battles with quick add to party"
                color="#F97316"
                onPress={() => router.push("/dm-monsters")}
              />
            </View>

            <Text style={[styles.sectionHeader, { color: c.mutedForeground }]}>NPC LIBRARY</Text>
            <TouchableOpacity
              onPress={async () => {
                const nextOpen = !savedNpcsOpen;
                setSavedNpcsOpen(nextOpen);
                if (nextOpen) await loadSavedNpcs();
              }}
              activeOpacity={0.8}
              style={[styles.savedNpcToggle, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius * 1.5 }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                <View style={[styles.optionIcon, { backgroundColor: "#14B8A620", borderRadius: c.radius }]}>
                  <Feather name="archive" size={20} color="#14B8A6" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.optionTitle, { color: c.foreground }]}>Saved NPCs</Text>
                  <Text style={[styles.optionSub, { color: c.mutedForeground }]}>
                    {savedNpcs.length} saved · expand for details, export, and delete
                  </Text>
                </View>
              </View>
              <Feather name={savedNpcsOpen ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />
            </TouchableOpacity>

            {savedNpcsOpen ? (
              savedNpcs.length === 0 ? (
                <View style={[styles.emptyNpcs, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius }]}>
                  <Text style={{ fontSize: 13, color: c.mutedForeground, textAlign: "center" }}>
                    No saved NPCs yet.{"\n"}Use NPC Creator and tap Save.
                  </Text>
                </View>
              ) : (
                <View style={styles.cardGroup}>
                  {savedNpcs.map((n) => {
                    const expanded = expandedNpcId === n.id;
                    return (
                      <View key={n.id} style={[styles.npcCard, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius * 1.5 }]}>
                        <View style={styles.npcHeaderRow}>
                          <TouchableOpacity
                            onPress={() => setExpandedNpcId(expanded ? null : n.id)}
                            style={styles.npcHeaderBtn}
                            activeOpacity={0.8}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={{ fontSize: 14, fontWeight: "700", color: c.foreground }}>{n.name || "Unnamed NPC"}</Text>
                              <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
                                {[n.gender, n.race, n.age].filter(Boolean).join(" · ") || "No identity details"}
                              </Text>
                            </View>
                            <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={c.mutedForeground} />
                          </TouchableOpacity>

                          <View style={styles.npcCollapsedActions}>
                            <TouchableOpacity
                              onPress={() => handleEditSavedNpc(n)}
                              style={[styles.npcMiniActionBtn, { borderColor: c.border, backgroundColor: c.background, borderRadius: c.radius * 0.8 }]}
                            >
                              <Feather name="edit-2" size={13} color={c.foreground} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteSavedNpc(n)}
                              style={[styles.npcMiniActionBtn, { borderColor: "#EF444455", backgroundColor: "#EF444411", borderRadius: c.radius * 0.8 }]}
                            >
                              <Feather name="trash-2" size={13} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {expanded ? (
                          <View style={[styles.npcExpanded, { borderTopColor: c.border }]}> 
                            {n.occupation ? <Text style={[styles.npcExpandedText, { color: c.mutedForeground }]}>Occupation: {n.occupation}</Text> : null}
                            {n.background ? <Text style={[styles.npcExpandedText, { color: c.mutedForeground }]}>Background: {n.background}</Text> : null}
                            {n.charClass ? <Text style={[styles.npcExpandedText, { color: c.mutedForeground }]}>Class: {n.charClass} Lv{n.level}</Text> : null}
                            {n.personalityTrait1 ? <Text style={[styles.npcExpandedText, { color: c.mutedForeground }]}>Trait: {n.personalityTrait1}</Text> : null}
                            {n.ideal ? <Text style={[styles.npcExpandedText, { color: c.mutedForeground }]}>Ideal: {n.ideal}</Text> : null}
                            {n.bond ? <Text style={[styles.npcExpandedText, { color: c.mutedForeground }]}>Bond: {n.bond}</Text> : null}
                            {n.flaw ? <Text style={[styles.npcExpandedText, { color: c.mutedForeground }]}>Flaw: {n.flaw}</Text> : null}
                            {n.questTags?.length ? <Text style={[styles.npcExpandedText, { color: c.mutedForeground }]}>Linked to {n.questTags.length} quest(s)</Text> : null}
                            {n.secret ? <Text style={[styles.npcExpandedText, { color: c.mutedForeground }]}>Secret: {n.secret}</Text> : null}
                            {n.notes ? <Text style={[styles.npcExpandedText, { color: c.mutedForeground }]}>Notes: {n.notes}</Text> : null}

                            <View style={styles.npcActionsRow}>
                              <TouchableOpacity
                                onPress={() => handleExportSavedNpc(n)}
                                style={[styles.npcActionBtn, { borderColor: c.border, backgroundColor: c.background, borderRadius: c.radius }]}
                              >
                                <Feather name="share-2" size={14} color={c.foreground} />
                                <Text style={[styles.npcActionText, { color: c.foreground }]}>Export</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )
            ) : null}

            <Text style={[styles.sectionHeader, { color: c.mutedForeground }]}>DM TIPS</Text>
            <DmTipCard />
          </View>
        )}

        {/* ═══════════════ RESOURCES TAB ═══════════════ */}
        {tab === "resources" && (
          <View style={styles.tabContent}>
            {/* Sub-section picker */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.resourceTabRow}
            >
              {RESOURCE_SECTIONS.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setResourceSection(s.id)}
                  style={[
                    styles.resourceTab,
                    {
                      backgroundColor: resourceSection === s.id ? c.primary : c.card,
                      borderColor: resourceSection === s.id ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.resourceTabText, { color: resourceSection === s.id ? "#fff" : c.mutedForeground }]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {resourceSection === "currency" && (
              <View style={styles.refSection}>
                <RefTitle title="Currency Conversions" />
                <DataTable
                  headers={["Coin", "Symbol", "In Gold", "In Silver"]}
                  rows={CURRENCY_TABLE.map((r) => [r.coin, r.abbr, r.inGold, r.inSilver])}
                />
                <InfoBox>50 coins = 1 lb — all coin types weigh the same.</InfoBox>
                <RefTitle title="Magic Item Price Guide" />
                <DataTable
                  headers={["Rarity", "Typical Cost", "Attunement"]}
                  rows={MAGIC_ITEM_PRICE_GUIDE.map((r) => [r.rarity, r.avgCost, r.attunement])}
                />
              </View>
            )}

            {resourceSection === "lifestyle" && (
              <View style={styles.refSection}>
                <RefTitle title="Lifestyle Expenses (per day)" />
                <DataTable
                  headers={["Lifestyle", "Cost", "Notes"]}
                  rows={LIFESTYLE_EXPENSES.map((r) => [r.lifestyle, r.cost, r.notes])}
                />
                <RefTitle title="Common Services" />
                <DataTable
                  headers={["Service", "Cost"]}
                  rows={SERVICES_COSTS.map((r) => [r.service, r.cost])}
                />
              </View>
            )}

            {resourceSection === "weapons" && (
              <View style={styles.refSection}>
                <RefTitle title="Weapon Prices" />
                <DataTable
                  headers={["Weapon", "Cost", "Damage", "Properties"]}
                  rows={WEAPON_PRICES.map((r) => [r.item, r.cost, r.damage, r.properties])}
                />
              </View>
            )}

            {resourceSection === "armor" && (
              <View style={styles.refSection}>
                <RefTitle title="Armor & Shields" />
                <DataTable
                  headers={["Armor", "Cost", "AC", "Stealth", "Weight"]}
                  rows={ARMOR_PRICES.map((r) => [r.item, r.cost, r.ac, r.stealth, r.weight])}
                />
              </View>
            )}

            {resourceSection === "gear" && (
              <View style={styles.refSection}>
                <RefTitle title="Adventuring Gear" />
                <DataTable
                  headers={["Item", "Cost", "Notes"]}
                  rows={ADVENTURING_GEAR.map((r) => [r.item, r.cost, r.notes])}
                />
              </View>
            )}

            {resourceSection === "potions" && (
              <View style={styles.refSection}>
                <RefTitle title="Common Potions" />
                <DataTable
                  headers={["Item", "Rarity", "Effect", "Cost"]}
                  rows={POTION_PRICES.map((r) => [r.item, r.rarity, r.heal, r.cost])}
                />
                <RefTitle title="Gemstone Values" />
                <DataTable
                  headers={["Value", "Examples"]}
                  rows={GEMSTONE_VALUES.map((r) => [r.value, r.examples])}
                />
              </View>
            )}

            {resourceSection === "conditions" && (
              <View style={styles.refSection}>
                <RefTitle title="Conditions Reference" />
                {CONDITIONS.map((cond) => (
                  <View key={cond.name} style={[styles.condCard, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius * 1.2 }]}>
                    <Text style={[styles.condName, { color: c.foreground }]}>{cond.name}</Text>
                    {cond.effects.map((e, i) => (
                      <View key={i} style={styles.condRow}>
                        <Text style={[styles.condBullet, { color: c.primary }]}>•</Text>
                        <Text style={[styles.condEffect, { color: c.mutedForeground }]}>{e}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}

            {resourceSection === "xp" && (
              <View style={styles.refSection}>
                <RefTitle title="XP Thresholds by Level" />
                <DataTable
                  headers={["Lvl", "Easy", "Med", "Hard", "Deadly"]}
                  rows={XP_THRESHOLDS.map((r) => [String(r.level), String(r.easy), String(r.medium), String(r.hard), String(r.deadly)])}
                />
                <RefTitle title="Monster Count Multipliers" />
                <DataTable
                  headers={["# Monsters", "XP ×"]}
                  rows={MONSTER_MULTIPLIERS.map((r) => [r.monsters, r.multiplier])}
                />
                <RefTitle title="CR → XP Table" />
                <DataTable
                  headers={["CR", "XP", "Prof Bonus"]}
                  rows={CR_XP_TABLE.map((r) => [r.cr, r.xp.toLocaleString(), r.profBonus])}
                />
              </View>
            )}

            {resourceSection === "rest" && (
              <View style={styles.refSection}>
                <RefTitle title="Rest & Recovery" />
                {REST_REFERENCE.map((r) => (
                  <View key={r.type} style={[styles.condCard, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius * 1.2 }]}>
                    <Text style={[styles.condName, { color: c.foreground }]}>{r.type}</Text>
                    <Text style={[styles.condEffect, { color: c.mutedForeground, marginBottom: 4 }]}>Duration: {r.duration}</Text>
                    {r.benefits.map((b, i) => (
                      <View key={i} style={styles.condRow}>
                        <Text style={[styles.condBullet, { color: c.primary }]}>•</Text>
                        <Text style={[styles.condEffect, { color: c.mutedForeground }]}>{b}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}

            {resourceSection === "gems" && (
              <View style={styles.refSection}>
                <RefTitle title="Gemstone Values" />
                <DataTable
                  headers={["Value", "Examples"]}
                  rows={GEMSTONE_VALUES.map((r) => [r.value, r.examples])}
                />
              </View>
            )}

            {resourceSection === "services" && (
              <View style={styles.refSection}>
                <RefTitle title="Services & Spellcasting Costs" />
                <DataTable
                  headers={["Service", "Cost"]}
                  rows={SERVICES_COSTS.map((r) => [r.service, r.cost])}
                />
              </View>
            )}

            {resourceSection === "lore" && (
              <View style={styles.refSection}>
                {LORE_ENTRIES.map((group) => (
                  <View key={group.category}>
                    <RefTitle title={group.category} />
                    {group.entries.map((entry, i) => (
                      <View key={i} style={[styles.loreRow, { borderBottomColor: c.border }]}>
                        <Text style={[styles.loreText, { color: c.foreground }]}>{entry}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}

          </View>
        )}
      </ScrollHintScrollView>
    </View>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function DmTipCard() {
  const c = useColors();
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * DM_TIPS.length));
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[styles.tipCard, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius * 1.5 }]}>
      <Text style={[styles.tipCardText, { color: c.foreground }]}>💡 {DM_TIPS[tipIndex]}</Text>
      <View style={styles.tipCardActions}>
        <TouchableOpacity
          onPress={() => setTipIndex(Math.floor(Math.random() * DM_TIPS.length))}
          style={[styles.tipCardBtn, { borderColor: c.border }]}
        >
          <Feather name="refresh-cw" size={13} color={c.mutedForeground} />
          <Text style={[styles.tipCardBtnText, { color: c.mutedForeground }]}>New tip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setExpanded((prev) => !prev)}
          activeOpacity={0.8}
          style={[styles.tipCardBtn, { borderColor: c.border }]}
        >
          <Text style={[styles.tipCardBtnText, { color: c.mutedForeground }]}>
            {expanded ? "Hide tips" : "Show all tips"}
          </Text>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={13} color={c.mutedForeground} />
        </TouchableOpacity>
      </View>
      {expanded && (
        <View style={[styles.tipCardList, { borderTopColor: c.border }]}>
          {DM_TIPS.map((tip, index) => (
            <View key={index} style={[styles.tipListRow, { borderTopColor: index === 0 ? "transparent" : c.border }]}>
              <Text style={[styles.tipListNum, { color: c.primary }]}>{index + 1}</Text>
              <Text style={[styles.tipListText, { color: c.foreground }]}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function OptionCard({
  icon, title, subtitle, color, onPress,
}: { icon: string; title: string; subtitle: string; color: string; onPress: () => void }) {
  const c = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.optionCard, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius * 1.5 }]}
    >
      <View style={[styles.optionIcon, { backgroundColor: color + "20", borderRadius: c.radius }]}>
        <Feather name={icon as any} size={22} color={color} />
      </View>
      <View style={styles.optionText}>
        <Text style={[styles.optionTitle, { color: c.foreground }]}>{title}</Text>
        <Text style={[styles.optionSub, { color: c.mutedForeground }]}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={c.mutedForeground} />
    </TouchableOpacity>
  );
}

function RefTitle({ title }: { title: string }) {
  const c = useColors();
  return <Text style={[styles.refTitle, { color: c.foreground }]}>{title}</Text>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const c = useColors();
  return (
    <View style={[styles.table, { borderColor: c.border, borderRadius: c.radius }]}>
      <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: c.primary + "15" }]}>
        {headers.map((h) => (
          <Text key={h} style={[styles.tableHeaderCell, { color: c.primary, flex: 1 }]}>{h}</Text>
        ))}
      </View>
      {rows.map((row, i) => (
        <View
          key={i}
          style={[
            styles.tableRow,
            { borderTopColor: c.border, backgroundColor: i % 2 === 0 ? "transparent" : c.card + "80" },
          ]}
        >
          {row.map((cell, j) => (
            <Text key={j} style={[styles.tableCell, { color: j === 0 ? c.foreground : c.mutedForeground, flex: 1 }]}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.infoBox, { backgroundColor: c.primary + "10", borderColor: c.primary + "30", borderRadius: c.radius * 0.8 }]}>
      <Text style={[styles.infoBoxText, { color: c.mutedForeground }]}>{children}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },

  hero: {
    width: "100%",
    maxWidth: "100%",
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  iconRing: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
  },
  iconEmoji: { fontSize: 22 },
  title: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 12, fontWeight: "500", marginTop: 1 },

  tabBar: {
    flexDirection: "row",
    width: "100%",
    maxWidth: "100%",
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    minWidth: 0,
    gap: 5, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 2,
  },
  tabLabel: { fontSize: 12, fontWeight: "600", flexShrink: 1 },

  content: {
    width: "100%",
    maxWidth: "100%",
    alignSelf: "stretch",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  tabContent: {
    width: "100%",
    maxWidth: "100%",
    gap: 14,
  },

  sectionHeader: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },

  continueCard: {
    flexDirection: "row", alignItems: "center", padding: 18, gap: 12,
    width: "100%",
    maxWidth: "100%",
    ...createShadowStyle({ y: 4, blur: 8, opacity: 0.25, elevation: 4 }),
  },
  continueLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: "rgba(255,255,255,0.65)", marginBottom: 2 },
  continueName: { fontSize: 20, fontWeight: "800", color: "#FFFFFF", marginBottom: 2, flexShrink: 1 },
  continueSub: { fontSize: 12, color: "rgba(255,255,255,0.65)", flexShrink: 1 },

  cardGroup: {
    width: "100%",
    maxWidth: "100%",
    gap: 8,
  },
  savedNpcToggle: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderWidth: 1, borderRadius: 10 * 1.5,
    width: "100%",
    maxWidth: "100%",
  },
  npcCard: {
    padding: 14, borderWidth: 1, borderRadius: 10 * 1.5, gap: 10,
    width: "100%",
    maxWidth: "100%",
  },
  npcHeaderRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    minWidth: 0,
  },
  npcHeaderBtn: {
    flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0,
  },
  npcCollapsedActions: {
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  npcMiniActionBtn: {
    width: 30, height: 30, borderRadius: 8, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  npcExpanded: {
    borderTopWidth: 1, paddingTop: 10, gap: 4,
  },
  npcExpandedText: {
    fontSize: 12, lineHeight: 18,
  },
  npcActionsRow: {
    flexDirection: "row", gap: 8, marginTop: 8,
  },
  npcActionBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
  },
  npcActionText: {
    fontSize: 12, fontWeight: "600",
  },
  emptyNpcs: {
    padding: 20, borderWidth: 1, borderRadius: 10, alignItems: "center",
  },
  optionCard: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderWidth: 1, borderRadius: 10 * 1.5,
    width: "100%",
    maxWidth: "100%",
  },
  optionIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  optionText: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2, flexShrink: 1 },
  optionSub: { fontSize: 12, flexShrink: 1 },

  demoPicker: {
    gap: 8,
    marginBottom: 6,
    width: "100%",
    maxWidth: "100%",
  },
  demoChoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10 * 1.2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "100%",
    maxWidth: "100%",
  },
  demoChoiceTitle: { fontSize: 13, fontWeight: "700", flexShrink: 1 },
  demoChoiceSub: { fontSize: 11, marginTop: 2, flexShrink: 1 },
  demoPartyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 10 * 1.4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "100%",
    maxWidth: "100%",
  },
  demoPartyTitle: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
  demoPartySub: { fontSize: 12, marginTop: 2, flexShrink: 1 },

  tipCard: {
    borderWidth: 1, borderRadius: 10 * 1.5, padding: 16, gap: 10,
    width: "100%",
    maxWidth: "100%",
  },
  tipCardText: { fontSize: 13, lineHeight: 20 },
  tipCardActions: { flexDirection: "row", gap: 8 },
  tipCardBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderRadius: 999,
  },
  tipCardBtnText: { fontSize: 11 },
  tipCardList: { borderTopWidth: 1, marginTop: 6 },
  tipListRow: { flexDirection: "row", gap: 10, paddingVertical: 10, borderTopWidth: 1 },
  tipListNum: { width: 18, fontSize: 12, fontWeight: "800", marginTop: 1 },
  tipListText: { flex: 1, fontSize: 13, lineHeight: 19 },

  // Resources
  resourceTabRow: { gap: 6, paddingBottom: 4, paddingHorizontal: 2 },
  resourceTab: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, flexShrink: 0,
  },
  resourceTabText: { fontSize: 12, fontWeight: "600" },

  refSection: { gap: 12, marginTop: 8 },
  refTitle: { fontSize: 14, fontWeight: "700", marginBottom: -4 },

  table: {
    borderWidth: 1, borderRadius: 10, overflow: "hidden",
  },
  tableRow: { flexDirection: "row", padding: 8, borderTopWidth: 1 },
  tableHeader: { borderTopWidth: 0 },
  tableHeaderCell: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  tableCell: { fontSize: 11, lineHeight: 17 },

  infoBox: {
    borderWidth: 1, borderRadius: 8, padding: 10,
  },
  infoBoxText: { fontSize: 12 },

  condCard: {
    borderWidth: 1, borderRadius: 10 * 1.2, padding: 12, gap: 4,
  },
  condName: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  condRow: { flexDirection: "row", gap: 6 },
  condBullet: { fontSize: 13, fontWeight: "700", marginTop: 1 },
  condEffect: { flex: 1, fontSize: 12, lineHeight: 18 },

  loreRow: { paddingVertical: 6, borderBottomWidth: 1 },
  loreText: { fontSize: 12, lineHeight: 19 },

  tipRow: {
    flexDirection: "row", gap: 10, padding: 12,
    borderWidth: 1, borderRadius: 10 * 1.2, alignItems: "flex-start",
  },
  tipNum: { fontSize: 15, fontWeight: "800", width: 22, textAlign: "right", flexShrink: 0 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 20 },
});
