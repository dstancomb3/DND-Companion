import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, StyleSheet, View, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { AdventureHeaderBackButton } from "@/components/adventure/AdventureHeaderBackButton";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import { getAllCharacters } from "@/utils/characterStorage";
import type { SavedCharacter } from "@/utils/characterStorage";
import type { CharacterSnapshot } from "@/types";
import { createAiDmCampaignSessionBootstrap } from "@/utils/adventure/aiDmCampaignSessionBootstrap";
import { AI_DM_ROUTES, buildAiDmSessionPath, buildAiDmSessionRouteParams } from "@/utils/aiDmRouteDefs";
import type { AiDmDifficultyProfile, AiDmStylePreset } from "@/types";
import { ONE_OFF_SEEDS, resolveOneOffSeeds, buildSeedGuidance, type OneOffSeedKind } from "@/utils/adventure/oneOffAdventureSeeds";
import { DEV_ONE_OFF_TITLE, DEV_ONE_OFF_GUIDANCE } from "@/utils/adventure/devOneOffScenario";

function buildInventoryBrief(snapshot: CharacterSnapshot): string {
  const liveItems = (snapshot.inventory ?? []).filter((item) => item.quantity > 0);
  if (liveItems.length === 0) {
    return "Inventory: empty. Do not describe the character carrying, wearing, or using any weapon, armor, pack, potion, or gear unless it is later acquired in play.";
  }

  const listedItems = liveItems
    .slice(0, 12)
    .map((item) => `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}`)
    .join(", ");

  return `Inventory: ${listedItems}. Only describe gear, weapons, armor, or carried items from this list.`;
}

function buildCharacterBrief(snapshot: CharacterSnapshot): string {
  const ch = snapshot.character;
  const sc = ch.abilityScores;
  const parts: string[] = [
    `${ch.name}, ${ch.race} ${ch.class}${ch.subclass ? ` (${ch.subclass})` : ""}, Level ${ch.level}`,
    ch.background ? `Background: ${ch.background}` : null,
    `HP: ${ch.currentHp}/${ch.maxHp}, AC: ${ch.armorClass}, Speed: ${ch.speed}ft, Proficiency: +${ch.proficiencyBonus}`,
    sc
      ? `STR ${sc.strength} DEX ${sc.dexterity} CON ${sc.constitution} INT ${sc.intelligence} WIS ${sc.wisdom} CHA ${sc.charisma}`
      : null,
    buildInventoryBrief(snapshot),
    ch.notes?.trim() ? `Character notes: ${ch.notes.trim().slice(0, 250)}` : null,
  ].filter((p): p is string => !!p);
  return parts.join(". ");
}

function buildOneOffGuidance(snapshot: CharacterSnapshot | null, intentLine: string): string {
  const parts: string[] = [];
  if (snapshot) {
    const ch = snapshot.character;
    const roleSummary = `${ch.name}, ${ch.race} ${ch.class}${ch.subclass ? ` (${ch.subclass})` : ""}, level ${ch.level}`;
    parts.push(`Character context (do not quote verbatim): ${roleSummary}${ch.background ? `. Background: ${ch.background}` : ""}.`);
    if (ch.notes?.trim()) {
      parts.push(`Character notes: ${ch.notes.trim().slice(0, 220)}.`);
    }
  }
  parts.push(`Session intent: ${intentLine || "Begin an original D&D session."}`);
  return parts.join(" ");
}

const DIFFICULTY_OPTIONS: Array<{ label: string; value: AiDmDifficultyProfile }> = [
  { label: "Story", value: "story" },
  { label: "Balanced", value: "balanced" },
  { label: "Tactical", value: "tactical" },
  { label: "Deadly", value: "deadly" },
];

const STYLE_OPTIONS: Array<{ label: string; value: AiDmStylePreset }> = [
  { label: "Cinematic", value: "cinematic" },
  { label: "Grounded", value: "grounded" },
  { label: "Heroic", value: "heroic" },
  { label: "Grim", value: "grim" },
  { label: "Mystery", value: "mystery" },
];

export default function AdventureNewScreen() {
  const c = useColors();
  const { currentCharacterId, character: activeCharacter } = useCharacter();

  const [sessionLabel, setSessionLabel] = React.useState("");
  const [intent, setIntent] = React.useState("");
  const [seedChoices, setSeedChoices] = React.useState<Partial<Record<OneOffSeedKind, string>>>({});
  const [seedSearch, setSeedSearch] = React.useState("");
  const [openSeed, setOpenSeed] = React.useState<OneOffSeedKind | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [difficulty, setDifficulty] = React.useState<AiDmDifficultyProfile>("balanced");
  const [stylePreset, setStylePreset] = React.useState<AiDmStylePreset>("cinematic");

  const [sessionType, setSessionType] = React.useState<"campaign_scaffold" | "one_off">("campaign_scaffold");
  const [startInCombat, setStartInCombat] = React.useState(false);
  const [devOneOff, setDevOneOff] = React.useState(false);

  const [savedChars, setSavedChars] = React.useState<SavedCharacter[]>([]);
  const [selectedCharId, setSelectedCharId] = React.useState<string | null>(null);
  const [showCharPicker, setShowCharPicker] = React.useState(false);

  React.useEffect(() => {
    getAllCharacters().then((all) => {
      setSavedChars(all.sort((a, b) => b.savedAt - a.savedAt));
      // Auto-select currently active character
      if (currentCharacterId && all.some((ch) => ch.id === currentCharacterId)) {
        setSelectedCharId(currentCharacterId);
      } else if (all.length > 0) {
        setSelectedCharId(all[0].id);
      }
    });
  }, [currentCharacterId]);

  const selectedChar = savedChars.find((ch) => ch.id === selectedCharId) ?? null;

  function handleStart() {
    const intentLine = intent.trim();
    const characterBrief = selectedChar ? buildCharacterBrief(selectedChar.snapshot) : "";
    const resolvedSeeds = sessionType === "one_off" && !devOneOff ? resolveOneOffSeeds(seedChoices) : null;
    const seededIntent = devOneOff && sessionType === "one_off" ? DEV_ONE_OFF_GUIDANCE : resolvedSeeds ? [buildSeedGuidance(resolvedSeeds), intentLine].filter(Boolean).join(" ") : intentLine;
    const guidanceText = sessionType === "one_off"
      ? buildOneOffGuidance(selectedChar?.snapshot ?? null, seededIntent)
      : [
          characterBrief ? `Character: ${characterBrief}` : null,
          intentLine || "Begin an original D&D session.",
        ].filter(Boolean).join(". ");

    if (sessionType === "one_off") {
      const sessionId = `oneoff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      router.push({
        pathname: buildAiDmSessionPath(sessionId),
        params: buildAiDmSessionRouteParams({
          source: "new-oneoff",
          mode: "one_off",
          title: devOneOff ? DEV_ONE_OFF_TITLE : sessionLabel.trim() || "One-Off Encounter",
          difficulty,
          stylePreset,
          startInCombat,
          guidanceText,
        }),
      } as any);
      return;
    }

    const boot = createAiDmCampaignSessionBootstrap({
      campaignName: sessionLabel.trim() || "Adventure",
      chapterTitle: "Session 1",
      difficultyProfile: difficulty,
      stylePreset,
      guidanceText,
    });

    router.push({
      pathname: buildAiDmSessionPath(boot.sessionId),
      params: buildAiDmSessionRouteParams({
        source: "new-simple",
        mode: "campaign_scaffold",
        title: boot.sessionLabel,
        difficulty: boot.setup.difficultyProfile,
        stylePreset: boot.setup.stylePreset,
        startInCombat: false,
        guidanceText: boot.setup.guidanceText,
        campaignId: boot.sessionId,
        campaignLabel: boot.setup.campaignName,
        chapterLabel: boot.setup.chapterTitle,
      }),
    } as any);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AdventureHeaderBackButton destination={AI_DM_ROUTES.adventure.home} />

          <Text style={[styles.title, { color: c.foreground }]}>New Session</Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>SESSION TYPE</Text>
            <View style={styles.chipRow}>
              {(["campaign_scaffold", "one_off"] as const).map((type) => {
                const active = sessionType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setSessionType(type)}
                    style={[
                      styles.chip,
                      { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary + "1A" : c.background },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, { color: active ? c.primary : c.foreground }]}>
                      {type === "campaign_scaffold" ? "Campaign Session" : "One-Off Encounter"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {sessionType === "one_off" ? (
              <TouchableOpacity
                onPress={() => setStartInCombat((v) => !v)}
                style={[styles.toggleRow, { borderColor: c.border, backgroundColor: c.card }]}
                activeOpacity={0.8}
              >
                <View style={styles.toggleInfo}>
                  <Feather name="zap" size={14} color={startInCombat ? c.primary : c.mutedForeground} />
                  <Text style={[styles.toggleLabel, { color: c.foreground }]}>Start in Combat</Text>
                </View>
                <View style={[styles.togglePill, { backgroundColor: startInCombat ? c.primary : c.border }]}>
                  <View style={[styles.toggleThumb, { marginLeft: startInCombat ? 14 : 2 }]} />
                </View>
              </TouchableOpacity>
            ) : null}
          </View>

          {sessionType === "one_off" ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Use development test one-off"
              onPress={() => {
                setDevOneOff(value => !value);
                setStartInCombat(false);
                setDifficulty("balanced");
                setStylePreset("grounded");
              }}
              style={[styles.toggleRow, { borderColor: devOneOff ? c.primary : c.border, backgroundColor: c.card }]}
              activeOpacity={0.8}
            >
              <View style={styles.toggleInfo}>
                <Feather name="tool" size={15} color={devOneOff ? c.primary : c.mutedForeground} />
                <View style={{ flexShrink: 1 }}>
                  <Text style={[styles.toggleLabel, { color: c.foreground }]}>Dev Test One-Off: The Lantern Watch</Text>
                  <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
                    Repeatable story path for combat, healing, loot and rest testing
                  </Text>
                </View>
              </View>
              <View style={[styles.togglePill, { backgroundColor: devOneOff ? c.primary : c.border }]}>
                <View style={[styles.toggleThumb, { marginLeft: devOneOff ? 14 : 2 }]} />
              </View>
            </TouchableOpacity>
          ) : null}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>SESSION TITLE</Text>
            <TextInput
              value={sessionLabel}
              onChangeText={setSessionLabel}
              placeholder="e.g. Bandit Ambush, The Haunted Keep..."
              placeholderTextColor={c.mutedForeground}
              style={[styles.input, { color: c.foreground, borderColor: c.border, backgroundColor: c.card }]}
              maxLength={72}
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>YOUR CHARACTER</Text>

            <TouchableOpacity
              onPress={() => router.push("/(tabs)" as any)}
              style={[styles.sheetLinkBtn, { borderColor: c.border, backgroundColor: c.card }]}
              activeOpacity={0.8}
            >
              <Feather name="book-open" size={14} color={c.foreground} />
              <Text style={[styles.sheetLinkText, { color: c.foreground }]}>Open Character Sheet</Text>
            </TouchableOpacity>

            <View style={[styles.charContainer, { backgroundColor: c.card, borderColor: selectedChar ? c.primary : c.border }]}>
              {/* Selected character header / picker trigger */}
              <TouchableOpacity
                onPress={() => setShowCharPicker((v) => !v)}
                style={styles.charCard}
                activeOpacity={0.8}
              >
                {selectedChar ? (
                  <View style={styles.charCardInner}>
                    <View style={[styles.charAvatar, { backgroundColor: c.primary + "20" }]}>
                      <Feather name="user" size={18} color={c.primary} />
                    </View>
                    <View style={styles.charCardInfo}>
                      <Text style={[styles.charCardName, { color: c.foreground }]}>{selectedChar.name}</Text>
                      <Text style={[styles.charCardMeta, { color: c.mutedForeground }]}>
                        {selectedChar.characterClass} · Level {selectedChar.level} · {selectedChar.race}
                      </Text>
                    </View>
                    <Feather name={showCharPicker ? "chevron-up" : "chevron-down"} size={16} color={c.mutedForeground} />
                  </View>
                ) : (
                  <View style={styles.charCardInner}>
                    <View style={[styles.charAvatar, { backgroundColor: c.border }]}>
                      <Feather name="user" size={18} color={c.mutedForeground} />
                    </View>
                    <Text style={[styles.charCardPlaceholder, { color: c.mutedForeground }]}>No character selected</Text>
                    <Feather name={showCharPicker ? "chevron-up" : "chevron-down"} size={16} color={c.mutedForeground} />
                  </View>
                )}
              </TouchableOpacity>

              {/* Inline character list — connected below header, excludes already-selected */}
              {showCharPicker ? (
                <View style={[styles.charPickerList, { borderTopColor: c.border }]}>
                  {savedChars.filter((ch) => ch.id !== selectedCharId).length === 0 ? (
                    <View style={styles.charPickerEmpty}>
                      <Text style={[styles.charPickerEmptyText, { color: c.mutedForeground }]}>
                        {savedChars.length <= 1 ? "No other characters. Create one in the Characters tab." : "No other characters."}
                      </Text>
                    </View>
                  ) : (
                    savedChars.filter((ch) => ch.id !== selectedCharId).map((ch, idx, arr) => (
                      <TouchableOpacity
                        key={ch.id}
                        onPress={() => { setSelectedCharId(ch.id); setShowCharPicker(false); }}
                        style={[
                          styles.charPickerRow,
                          idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
                        ]}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.charAvatar, { backgroundColor: c.background }]}>
                          <Feather name="user" size={15} color={c.mutedForeground} />
                        </View>
                        <View style={styles.charPickerInfo}>
                          <Text style={[styles.charPickerName, { color: c.foreground }]}>{ch.name}</Text>
                          <Text style={[styles.charPickerMeta, { color: c.mutedForeground }]}>
                            {ch.characterClass} · Lv {ch.level} · {ch.race}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              ) : null}
            </View>
          </View>

          {sessionType === "one_off" ? (
            <View style={[styles.fieldGroup, { gap: 10 }]}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>ADVENTURE SEEDS</Text>
              <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Choose any combination. Blank choices are randomized when you start. Each category has 100 possibilities.</Text>
              {(["scenario", "location", "flavor"] as OneOffSeedKind[]).map(kind => (
                <View key={kind} style={{ gap: 6 }}>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Choose ${kind}`}
                    onPress={() => { setOpenSeed(old => old === kind ? null : kind); setSeedSearch(""); }}
                    style={[styles.input, { borderColor: c.border, backgroundColor: c.card, justifyContent: "center" }]}>
                    <Text style={{ color: c.foreground }}>{kind[0].toUpperCase() + kind.slice(1)}: {seedChoices[kind] || "Surprise me"}</Text>
                  </TouchableOpacity>
                  {openSeed === kind ? <View style={{ gap: 5 }}>
                    <TextInput value={seedSearch} onChangeText={setSeedSearch} accessibilityLabel={`Search ${kind} seeds`}
                      placeholder={`Search 100 ${kind} options...`} placeholderTextColor={c.mutedForeground}
                      style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Randomize ${kind}`}
                      onPress={() => { setSeedChoices(old => ({ ...old, [kind]: undefined })); setOpenSeed(null); }}>
                      <Text style={{ color: c.primary, padding: 8 }}>Surprise me (random)</Text>
                    </TouchableOpacity>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} keyboardShouldPersistTaps="always">
                      {ONE_OFF_SEEDS[kind].filter(option => option.toLowerCase().includes(seedSearch.toLowerCase())).map(option => (
                        <TouchableOpacity key={option} onPress={() => { setSeedChoices(old => ({ ...old, [kind]: option })); setOpenSeed(null); }}
                          style={{ padding: 10, borderBottomWidth: 1, borderColor: c.border }}>
                          <Text style={{ color: c.foreground }}>{option}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View> : null}
                </View>
              ))}
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Surprise me with everything"
                onPress={() => { setSeedChoices({}); setOpenSeed(null); }}>
                <Text style={{ color: c.primary, paddingVertical: 8 }}>Surprise me with everything</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>TELL THE DM WHAT YOU WANT</Text>
            <TextInput
              value={intent}
              onChangeText={setIntent}
              placeholder={"e.g. A tense ambush on the road, social intrigue at court, dungeon crawl with a twist..."}
              placeholderTextColor={c.mutedForeground}
              multiline
              autoFocus
              textAlignVertical="top"
              style={[styles.intentInput, { color: c.foreground, borderColor: c.border, backgroundColor: c.card }]}
              maxLength={400}
            />
          </View>

          <TouchableOpacity
            onPress={() => setShowAdvanced((v) => !v)}
            style={styles.advancedToggle}
            activeOpacity={0.7}
          >
            <Text style={[styles.advancedToggleText, { color: c.mutedForeground }]}>
              {showAdvanced ? "▲ Hide advanced options" : "▼ Advanced options"}
            </Text>
          </TouchableOpacity>

          {showAdvanced ? (
            <View style={[styles.advancedCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>DIFFICULTY</Text>
              <View style={styles.chipRow}>
                {DIFFICULTY_OPTIONS.map((opt) => {
                  const active = difficulty === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setDifficulty(opt.value)}
                      style={[
                        styles.chip,
                        { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary + "1A" : c.background },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, { color: active ? c.primary : c.foreground }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { color: c.mutedForeground, marginTop: 12 }]}>NARRATIVE STYLE</Text>
              <View style={styles.chipRow}>
                {STYLE_OPTIONS.map((opt) => {
                  const active = stylePreset === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setStylePreset(opt.value)}
                      style={[
                        styles.chip,
                        { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary + "1A" : c.background },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, { color: active ? c.primary : c.foreground }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleStart}
            style={[styles.startBtn, { backgroundColor: c.primary }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.startBtnText, { color: c.primaryForeground }]}>Start Adventure</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: "800" },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  sheetLinkBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  sheetLinkText: {
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  intentInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 120,
  },
  // Character picker
  charContainer: {
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: "hidden",
  },
  charCard: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  charCardInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  charAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  charCardInfo: { flex: 1 },
  charCardName: { fontSize: 15, fontWeight: "700" },
  charCardMeta: { fontSize: 12, marginTop: 1 },
  charCardPlaceholder: { flex: 1, fontSize: 14 },
  charPickerList: {
    borderTopWidth: 1,
  },
  charPickerEmpty: { padding: 16 },
  charPickerEmptyText: { fontSize: 13, textAlign: "center" },
  charPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  charPickerInfo: { flex: 1 },
  charPickerName: { fontSize: 14, fontWeight: "600" },
  charPickerMeta: { fontSize: 12, marginTop: 1 },
  // Advanced
  advancedToggle: { alignSelf: "flex-start", paddingVertical: 4 },
  advancedToggleText: { fontSize: 13, fontWeight: "600" },
  advancedCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: "600" },
  startBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  startBtnText: { fontSize: 17, fontWeight: "800" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  toggleInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleLabel: { fontSize: 14, fontWeight: "600" },
  togglePill: { width: 36, height: 20, borderRadius: 10, justifyContent: "center" },
  toggleThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff" },
});
