import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useColors } from "@/hooks/useColors";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import colors from "@/constants/colors";
import { useCharacter } from "@/context/CharacterContext";
import type { Character, CharacterSnapshot } from "@/types";
import { API_BASE_URL } from "@/utils/apiUrl";
import {
  assemblePortableCharacterSnapshot,
  normalizeCharacterSnapshotMechanics,
} from "@/utils/mechanics/characterSnapshotMechanicsAdapters";

const ABILITY_KEYS: (keyof Character["abilityScores"])[] = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];

const ABILITY_SHORT: Record<keyof Character["abilityScores"], string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

function calcMod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function parseCommaSeparatedList(value: string): string[] {
  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
}

function FieldLabel({ label, color }: { label: string; color: string }) {
  return <Text style={[styles.fieldLabel, { color }]}>{label}</Text>;
}

function FieldInput({
  value,
  onChange,
  numeric,
  placeholder,
  colors: c,
}: {
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  placeholder?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      keyboardType={numeric ? "number-pad" : "default"}
      placeholder={placeholder}
      placeholderTextColor={c.mutedForeground}
      style={[
        styles.input,
        { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius },
      ]}
    />
  );
}

export default function EditCharacterScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const {
    character, attacks, resources, inventory, conditions,
    notes: characterNotes, importAll, updateCharacter, applyQuestUpdate,
    spellSlots, classFeatures, passiveFeatures, preparedSpells,
    setClassFeatures, setPassiveFeatures,
    people, quests, locations, realms, wishlist, journalArcs, combatLogEntries, combatLogSessions,
    companions, rulesState, getReviewBatches,
  } = useCharacter();

  // Parse character notes/backstory for people, locations, and planes via AI (fire-and-forget)
  function parseBackstory(notesText: string) {
    if (!notesText.trim()) return;
    fetch(`${API_BASE_URL}/api/ai/parse-quest-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: notesText }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((result) => { if (result) applyQuestUpdate(result); })
      .catch(() => {});
  }

  // Draft state
  const [name, setName] = useState(character.name);
  const [charClass, setCharClass] = useState(character.class);
  const [subclass, setSubclass] = useState(character.subclass ?? "");
  const [level, setLevel] = useState(String(character.level));
  const [race, setRace] = useState(character.race);
  const [background, setBackground] = useState(character.background);
  const [profBonus, setProfBonus] = useState(String(character.proficiencyBonus));
  const [ac, setAc] = useState(String(character.armorClass));
  const [maxHp, setMaxHp] = useState(String(character.maxHp));
  const [speed, setSpeed] = useState(String(character.speed));
  const [initiative, setInitiative] = useState(String(character.initiative));
  const [passivePerc, setPassivePerc] = useState(String(character.passivePerception));
  const [scores, setScores] = useState<Record<keyof Character["abilityScores"], string>>({
    strength: String(character.abilityScores.strength),
    dexterity: String(character.abilityScores.dexterity),
    constitution: String(character.abilityScores.constitution),
    intelligence: String(character.abilityScores.intelligence),
    wisdom: String(character.abilityScores.wisdom),
    charisma: String(character.abilityScores.charisma),
  });
  const [notes, setNotes] = useState(character.notes);
  const [damageResistances, setDamageResistances] = useState((character.damageResistances ?? []).join(", "));
  const [damageImmunities, setDamageImmunities] = useState((character.damageImmunities ?? []).join(", "));
  const [conditionImmunities, setConditionImmunities] = useState((character.conditionImmunities ?? []).join(", "));

  // Import/Export state
  const [panel, setPanel] = useState<"none" | "import" | "export">("none");
  const [pasteJson, setPasteJson] = useState("");
  const [exportJson, setExportJson] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [fixBusy, setFixBusy] = useState(false);
  const draftLevel = parseInt(level) || character.level;
  const loweringLevel = draftLevel < character.level;
  const raisingLevel = draftLevel > character.level;
  const generatedFeaturePruneCount = loweringLevel
    ? classFeatures.filter((feature) => !feature.levelGained || feature.levelGained > draftLevel).length
      + passiveFeatures.filter((feature) => !feature.levelGained || feature.levelGained > draftLevel).length
    : 0;
  const removedAsiCount = loweringLevel
    ? (character.asiHistory ?? []).filter((entry) => entry.level > draftLevel).length
    : 0;

  const handleSave = () => {
    const lvl = parseInt(level) || character.level;
    let newScores = {
      strength: parseInt(scores.strength) || character.abilityScores.strength,
      dexterity: parseInt(scores.dexterity) || character.abilityScores.dexterity,
      constitution: parseInt(scores.constitution) || character.abilityScores.constitution,
      intelligence: parseInt(scores.intelligence) || character.abilityScores.intelligence,
      wisdom: parseInt(scores.wisdom) || character.abilityScores.wisdom,
      charisma: parseInt(scores.charisma) || character.abilityScores.charisma,
    };
    const wisMod = Math.floor((newScores.wisdom - 10) / 2);
    const pb = parseInt(profBonus) || character.proficiencyBonus;
    let nextFeats = character.feats;
    let nextAsiHistory = character.asiHistory;

    if (lvl < character.level) {
      const rolledBackScores = { ...character.abilityScores };
      const removedAsi = (character.asiHistory ?? []).filter((entry) => entry.level > lvl);
      for (const entry of removedAsi) {
        for (const [ability, delta] of Object.entries(entry.changes) as Array<[keyof Character["abilityScores"], number | undefined]>) {
          if (!delta) continue;
          rolledBackScores[ability] -= delta;
        }
      }
      newScores = rolledBackScores;
      nextAsiHistory = (character.asiHistory ?? []).filter((entry) => entry.level <= lvl);
      nextFeats = (character.feats ?? []).filter((feat) => {
        const match = feat.source?.match(/level\s+(\d+)/i);
        if (!match) return true;
        return Number(match[1]) <= lvl;
      });
      setClassFeatures(classFeatures.filter((feature) => !feature.levelGained || feature.levelGained <= lvl));
      setPassiveFeatures(passiveFeatures.filter((feature) => !feature.levelGained || feature.levelGained <= lvl));
    }

    const finalWisMod = Math.floor((newScores.wisdom - 10) / 2);

    updateCharacter({
      name: name.trim() || character.name,
      class: charClass.trim() || character.class,
      subclass: subclass.trim() || undefined,
      level: lvl,
      race: race.trim() || character.race,
      background: background.trim() || character.background,
      proficiencyBonus: pb,
      armorClass: parseInt(ac) || character.armorClass,
      maxHp: parseInt(maxHp) || character.maxHp,
      speed: parseInt(speed) || character.speed,
      initiative: parseInt(initiative) || character.initiative,
      passivePerception: parseInt(passivePerc) || 10 + finalWisMod + pb,
      abilityScores: newScores,
      feats: nextFeats,
      asiHistory: nextAsiHistory,
      notes: notes,
      damageResistances: parseCommaSeparatedList(damageResistances),
      damageImmunities: parseCommaSeparatedList(damageImmunities),
      conditionImmunities: parseCommaSeparatedList(conditionImmunities),
    });
    router.back();
  };

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleOpenExport = () => {
    const snapshot = assemblePortableCharacterSnapshot({
      _version: 1,
      character,
      attacks,
      resources,
      inventory,
      conditions,
      notes: characterNotes,
      wishlist,
      journalArcs,
      spellSlots,
      classFeatures,
      passiveFeatures,
      preparedSpells,
      people,
      quests,
      locations,
      realms,
      companions,
      rulesState,
      combatLog: {
        entries: combatLogEntries,
        sessions: combatLogSessions,
      },
      questGraphReviewQueue: getReviewBatches(),
      mechanics: character.mechanics,
    });
    setExportJson(JSON.stringify(snapshot, null, 2));
    setPanel("export");
  };

  const handleShareExport = async () => {
    setExportBusy(true);
    try {
      const filename = `${character.name.replace(/\s+/g, "_")}_character.json`;
      const uri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(uri, exportJson, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "Save character JSON" });
      } else {
        Alert.alert("Sharing not available", "Copy the JSON from the box above and paste it somewhere safe.");
      }
    } catch (e) {
      Alert.alert("Export failed", String(e));
    } finally {
      setExportBusy(false);
    }
  };

  // ── Import ───────────────────────────────────────────────────────────────────
  const handlePickFile = async () => {
    setImportBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain", "text/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      const text = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      setPasteJson(text);
    } catch (e) {
      Alert.alert("Could not read file", String(e));
    } finally {
      setImportBusy(false);
    }
  };

  const handleImportPaste = () => {
    setImportError(null);
    let raw: unknown;
    try {
      raw = JSON.parse(pasteJson.trim());
    } catch {
      setImportError("Could not parse this text as JSON. Make sure it's valid.");
      return;
    }

    // Accept either the full snapshot format or a bare Character object
    let snapshot: CharacterSnapshot;
    if (raw && typeof raw === "object" && "character" in raw) {
      // Full snapshot — new format
      const s = raw as CharacterSnapshot;
      if (!s.character?.name || !s.character?.class) {
        setImportError("Snapshot is missing character name or class.");
        return;
      }
      snapshot = normalizeCharacterSnapshotMechanics({
        _version: s._version ?? 1,
        character: s.character,
        attacks: s.attacks ?? [],
        resources: s.resources ?? [],
        inventory: s.inventory ?? [],
        conditions: s.conditions ?? [],
        notes: s.notes ?? [],
        wishlist: s.wishlist ?? [],
        journalArcs: s.journalArcs ?? [],
        spellSlots: s.spellSlots,
        classFeatures: s.classFeatures,
        passiveFeatures: s.passiveFeatures,
        preparedSpells: s.preparedSpells,
        people: s.people,
        quests: s.quests,
        locations: s.locations,
        realms: s.realms,
        companions: s.companions,
        rulesState: s.rulesState,
        combatLog: s.combatLog,
        questGraphReviewQueue: s.questGraphReviewQueue,
        mechanics: s.mechanics,
      });
    } else {
      // Bare character object — old format, inventory/attacks stay as-is
      const ch = raw as Partial<Character>;
      if (!ch.name || !ch.class) {
        setImportError("This doesn't look like a character sheet — missing name or class field.");
        return;
      }
      const mergedCharacter: Character = { ...character, ...ch };
      snapshot = normalizeCharacterSnapshotMechanics({
        _version: 0,
        character: mergedCharacter,
        attacks,
        resources,
        inventory,
        conditions,
        notes: characterNotes,
        wishlist,
        journalArcs,
        spellSlots,
        classFeatures,
        passiveFeatures,
        preparedSpells,
        people,
        quests,
        locations,
        realms,
        companions,
        rulesState,
        combatLog: {
          entries: combatLogEntries,
          sessions: combatLogSessions,
        },
        questGraphReviewQueue: getReviewBatches(),
        mechanics: mergedCharacter.mechanics,
      });
    }

    importAll(snapshot);
    // If the imported snapshot has no lore data, parse the character notes for people/locations/planes
    const hasLore = (snapshot.people?.length ?? 0) > 0 || (snapshot.locations?.length ?? 0) > 0 || (snapshot.realms?.length ?? 0) > 0;
    if (!hasLore) parseBackstory(snapshot.character.notes ?? "");
    setPanel("none");
    setPasteJson("");
    router.back();
  };

  const handleFixWithAI = async () => {
    setFixBusy(true);
    setImportError(null);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/ai/repair-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: pasteJson }),
      });
      const data = (await resp.json()) as CharacterSnapshot & { error?: string };
      if (!resp.ok || data.error) {
        setImportError(`AI couldn't repair the data: ${data.error ?? "Unknown error"}`);
        return;
      }
      if (!data.character?.name || !data.character?.class) {
        setImportError("AI repaired the data but couldn't find a character name or class.");
        return;
      }
      const importedSnapshot = normalizeCharacterSnapshotMechanics({
        _version: data._version ?? 1,
        character: data.character,
        attacks: data.attacks ?? [],
        resources: data.resources ?? [],
        inventory: data.inventory ?? [],
        conditions: data.conditions ?? [],
        notes: data.notes ?? [],
        wishlist: data.wishlist ?? [],
        journalArcs: data.journalArcs ?? [],
        spellSlots: data.spellSlots,
        classFeatures: data.classFeatures,
        passiveFeatures: data.passiveFeatures,
        preparedSpells: data.preparedSpells,
        people: data.people,
        quests: data.quests,
        locations: data.locations,
        realms: data.realms,
        companions: data.companions,
        rulesState: data.rulesState,
        combatLog: data.combatLog,
        questGraphReviewQueue: data.questGraphReviewQueue,
        mechanics: data.mechanics,
      });
      importAll(importedSnapshot);
      // If AI-repaired snapshot has no lore data, parse character notes
      const hasLore = (importedSnapshot.people?.length ?? 0) > 0 || (importedSnapshot.locations?.length ?? 0) > 0 || (importedSnapshot.realms?.length ?? 0) > 0;
      if (!hasLore) parseBackstory(importedSnapshot.character.notes ?? "");
      setPanel("none");
      setPasteJson("");
      router.back();
    } catch (e) {
      setImportError(`Fix with AI failed: ${String(e)}`);
    } finally {
      setFixBusy(false);
    }
  };

  return (
    <ScrollHintScrollView
      style={[styles.container, { backgroundColor: c.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: insets.bottom + 40,
          paddingTop: Platform.OS === "web" ? 20 : 0,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Import / Export toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={() => { setPasteJson(""); setPanel(panel === "import" ? "none" : "import"); }}
          activeOpacity={0.8}
          style={[
            styles.toolbarBtn,
            { backgroundColor: panel === "import" ? c.primary : c.secondary, borderRadius: colors.radius },
          ]}
        >
          <Feather name="upload" size={14} color={panel === "import" ? c.primaryForeground : c.primary} />
          <Text style={[styles.toolbarBtnText, { color: panel === "import" ? c.primaryForeground : c.primary }]}>
            Import JSON
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { if (panel === "export") { setPanel("none"); } else { handleOpenExport(); } }}
          activeOpacity={0.8}
          style={[
            styles.toolbarBtn,
            { backgroundColor: panel === "export" ? c.primary : c.secondary, borderRadius: colors.radius },
          ]}
        >
          <Feather name="download" size={14} color={panel === "export" ? c.primaryForeground : c.mutedForeground} />
          <Text style={[styles.toolbarBtnText, { color: panel === "export" ? c.primaryForeground : c.mutedForeground }]}>
            Export JSON
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Import panel ─────────────────────────────────────────────────────── */}
      {panel === "import" && (
        <View style={[styles.panelBox, { backgroundColor: c.card, borderColor: c.border, borderRadius: colors.radius * 1.5 }]}>
          <Text style={[styles.panelTitle, { color: c.foreground }]}>Import Character</Text>
          <Text style={[styles.panelSub, { color: c.mutedForeground }]}>
            Pick a saved .json file, or paste the JSON directly below.
          </Text>

          {/* File picker */}
          <TouchableOpacity
            onPress={handlePickFile}
            disabled={importBusy}
            activeOpacity={0.8}
            style={[styles.filePickBtn, { backgroundColor: c.secondary, borderColor: c.border, borderRadius: colors.radius }]}
          >
            <Feather name="folder" size={16} color={c.primary} />
            <Text style={[styles.filePickText, { color: c.primary }]}>
              {importBusy ? "Reading file…" : "Pick JSON File"}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.orDivider, { color: c.mutedForeground }]}>— or paste JSON —</Text>

          <TextInput
            value={pasteJson}
            onChangeText={(t) => { setPasteJson(t); setImportError(null); }}
            multiline
            placeholder='{"name": "Lyra", "class": "Monk", ...}'
            placeholderTextColor={c.mutedForeground}
            style={[
              styles.jsonInput,
              { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius },
            ]}
          />

          {importError && (
            <View style={{ marginTop: 6, gap: 8 }}>
              <View style={[styles.importErrorBox, { backgroundColor: "#EF444420", borderRadius: colors.radius }]}>
                <Feather name="alert-circle" size={13} color="#EF4444" />
                <Text style={{ fontSize: 12, color: "#EF4444", flex: 1 }}>{importError}</Text>
              </View>
              <TouchableOpacity
                onPress={handleFixWithAI}
                disabled={fixBusy || !pasteJson.trim()}
                style={[
                  styles.panelBtn,
                  { backgroundColor: "#7C3AED22", borderRadius: colors.radius, borderWidth: 1, borderColor: "#7C3AED55" },
                ]}
                activeOpacity={0.7}
              >
                <Feather name="zap" size={13} color={fixBusy ? c.mutedForeground : "#A78BFA"} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: fixBusy ? c.mutedForeground : "#A78BFA" }}>
                  {fixBusy ? "Asking AI…" : "Fix with AI"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              onPress={() => { setPanel("none"); setPasteJson(""); setImportError(null); }}
              style={[styles.panelBtn, { backgroundColor: c.secondary, borderRadius: colors.radius }]}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: c.mutedForeground }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleImportPaste}
              disabled={!pasteJson.trim()}
              style={[styles.panelBtn, { backgroundColor: pasteJson.trim() ? c.primary : c.secondary, borderRadius: colors.radius }]}
              activeOpacity={0.7}
            >
              <Feather name="check" size={14} color={pasteJson.trim() ? c.primaryForeground : c.mutedForeground} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: pasteJson.trim() ? c.primaryForeground : c.mutedForeground }}>
                Import
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Export panel ─────────────────────────────────────────────────────── */}
      {panel === "export" && (
        <View style={[styles.panelBox, { backgroundColor: c.card, borderColor: c.border, borderRadius: colors.radius * 1.5 }]}>
          <Text style={[styles.panelTitle, { color: c.foreground }]}>Export Character</Text>
          <Text style={[styles.panelSub, { color: c.mutedForeground }]}>
            Save your character as a JSON file to back up or transfer to another device.
          </Text>

          <TextInput
            value={exportJson}
            editable={false}
            multiline
            style={[
              styles.jsonInput,
              { backgroundColor: c.secondary, color: c.mutedForeground, borderRadius: colors.radius },
            ]}
          />

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              onPress={() => setPanel("none")}
              style={[styles.panelBtn, { backgroundColor: c.secondary, borderRadius: colors.radius }]}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: c.mutedForeground }}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShareExport}
              disabled={exportBusy}
              style={[styles.panelBtn, { backgroundColor: c.primary, borderRadius: colors.radius }]}
              activeOpacity={0.7}
            >
              <Feather name="share-2" size={14} color={c.primaryForeground} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: c.primaryForeground }}>
                {exportBusy ? "Saving…" : "Save / Share File"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Basic info */}
      <SectionTitle title="Basic Info" color={c.mutedForeground} />

      <FieldLabel label="Name" color={c.mutedForeground} />
      <FieldInput value={name} onChange={setName} colors={c} placeholder="Character name" />

      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Class" color={c.mutedForeground} />
          <FieldInput value={charClass} onChange={setCharClass} colors={c} placeholder="Class" />
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Subclass" color={c.mutedForeground} />
          <FieldInput value={subclass} onChange={setSubclass} colors={c} placeholder="Optional" />
        </View>
      </View>

      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Race" color={c.mutedForeground} />
          <FieldInput value={race} onChange={setRace} colors={c} placeholder="Race" />
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Background" color={c.mutedForeground} />
          <FieldInput value={background} onChange={setBackground} colors={c} placeholder="Background" />
        </View>
      </View>

      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Level" color={c.mutedForeground} />
          <FieldInput value={level} onChange={setLevel} numeric colors={c} />
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Proficiency Bonus" color={c.mutedForeground} />
          <FieldInput value={profBonus} onChange={setProfBonus} numeric colors={c} />
        </View>
      </View>

      {(raisingLevel || loweringLevel) && (
        <View style={[styles.progressionNotice, { backgroundColor: c.card, borderColor: c.border, borderRadius: colors.radius }]}> 
          <Feather name={loweringLevel ? "alert-triangle" : "info"} size={14} color={loweringLevel ? c.destructive : c.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.progressionNoticeTitle, { color: c.foreground }]}>
              {loweringLevel ? "Manual level rollback" : "Manual level increase"}
            </Text>
            <Text style={[styles.progressionNoticeText, { color: c.mutedForeground }]}>
              {loweringLevel
                ? `Saving will roll back ASI history and prune progression-linked features above level ${draftLevel}. Estimated removals: ${generatedFeaturePruneCount} feature records, ${removedAsiCount} ASI entries.`
                : "Changing the level number here does not run the guided level-up flow. Use Level Up from the sheet when you want HP, subclass, ASI/feat, features, resources, and spell picks applied safely."}
            </Text>
          </View>
        </View>
      )}

      {/* Combat stats */}
      <SectionTitle title="Combat Stats" color={c.mutedForeground} />

      <View style={styles.threeCol}>
        <View style={{ flex: 1 }}>
          <FieldLabel label="AC" color={c.mutedForeground} />
          <FieldInput value={ac} onChange={setAc} numeric colors={c} />
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Max HP" color={c.mutedForeground} />
          <FieldInput value={maxHp} onChange={setMaxHp} numeric colors={c} />
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Speed (ft)" color={c.mutedForeground} />
          <FieldInput value={speed} onChange={setSpeed} numeric colors={c} />
        </View>
      </View>

      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Initiative" color={c.mutedForeground} />
          <FieldInput value={initiative} onChange={setInitiative} numeric colors={c} />
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Passive Perception" color={c.mutedForeground} />
          <FieldInput value={passivePerc} onChange={setPassivePerc} numeric colors={c} />
        </View>
      </View>

      {/* Ability Scores */}
      <SectionTitle title="Ability Scores" color={c.mutedForeground} />
      <View style={styles.abilitiesGrid}>
        {ABILITY_KEYS.map((key) => (
          <View key={key} style={[styles.abilityCell, { backgroundColor: c.card, borderColor: c.border, borderRadius: colors.radius }]}>
            <Text style={[styles.abilityLabel, { color: c.mutedForeground }]}>{ABILITY_SHORT[key]}</Text>
            <TextInput
              value={scores[key]}
              onChangeText={(v) => setScores((prev) => ({ ...prev, [key]: v }))}
              keyboardType="number-pad"
              style={[styles.abilityInput, { color: c.primary }]}
              maxLength={2}
              textAlign="center"
            />
            <Text style={[styles.abilityMod, { color: c.mutedForeground }]}>
              {calcMod(parseInt(scores[key]) || 10)}
            </Text>
          </View>
        ))}
      </View>

      {/* Notes */}
      <SectionTitle title="Notes" color={c.mutedForeground} />
      <TextInput
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Session notes, contacts, reminders..."
        placeholderTextColor={c.mutedForeground}
        style={[
          styles.notesInput,
          { backgroundColor: c.secondary, color: c.foreground, borderRadius: colors.radius },
        ]}
      />

      <SectionTitle title="Defenses & Immunities" color={c.mutedForeground} />
      <FieldLabel label="Damage Resistances (comma-separated)" color={c.mutedForeground} />
      <FieldInput
        value={damageResistances}
        onChange={setDamageResistances}
        colors={c}
        placeholder="fire, cold"
      />

      <FieldLabel label="Damage Immunities (comma-separated)" color={c.mutedForeground} />
      <FieldInput
        value={damageImmunities}
        onChange={setDamageImmunities}
        colors={c}
        placeholder="poison"
      />

      <FieldLabel label="Condition Immunities (comma-separated)" color={c.mutedForeground} />
      <FieldInput
        value={conditionImmunities}
        onChange={setConditionImmunities}
        colors={c}
        placeholder="poisoned, charmed"
      />

      {/* Save */}
      <TouchableOpacity
        onPress={handleSave}
        activeOpacity={0.8}
        style={[styles.saveBtn, { backgroundColor: c.primary, borderRadius: colors.radius }]}
      >
        <Feather name="check" size={18} color={c.primaryForeground} />
        <Text style={[styles.saveBtnText, { color: c.primaryForeground }]}>Save Character</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        activeOpacity={0.7}
        style={[styles.cancelBtn, { borderRadius: colors.radius }]}
      >
        <Text style={[styles.cancelBtnText, { color: c.mutedForeground }]}>Cancel</Text>
      </TouchableOpacity>
    </ScrollHintScrollView>
  );
}

function SectionTitle({ title, color }: { title: string; color: string }) {
  return (
    <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  toolbar: { flexDirection: "row", gap: 10, marginBottom: 16 },
  toolbarBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  toolbarBtnText: { fontSize: 13, fontWeight: "600" },
  panelBox: { padding: 14, marginBottom: 16, borderWidth: 1 },
  progressionNotice: { flexDirection: "row", gap: 10, borderWidth: 1, padding: 12, marginTop: 10, marginBottom: 6 },
  progressionNoticeTitle: { fontSize: 13, fontWeight: "700" },
  progressionNoticeText: { fontSize: 12, lineHeight: 17 },
  panelTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  panelSub: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  filePickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  filePickText: { fontSize: 14, fontWeight: "600" },
  orDivider: { fontSize: 11, textAlign: "center", marginBottom: 10 },
  jsonInput: {
    padding: 10,
    fontSize: 12,
    minHeight: 120,
    textAlignVertical: "top",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  panelBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12 },
  importErrorBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, marginTop: 6 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 12,
  },
  twoCol: { flexDirection: "row", gap: 10 },
  threeCol: { flexDirection: "row", gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: { padding: 12, fontSize: 15, marginBottom: 10 },
  abilitiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  abilityCell: {
    width: "30%",
    alignItems: "center",
    padding: 10,
    borderWidth: 1,
  },
  abilityLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  abilityInput: { fontSize: 22, fontWeight: "800", width: "100%", padding: 0 },
  abilityMod: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  notesInput: {
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    marginTop: 20,
  },
  saveBtnText: { fontSize: 16, fontWeight: "700" },
  cancelBtn: { padding: 14, alignItems: "center", marginTop: 8 },
  cancelBtnText: { fontSize: 14, fontWeight: "600" },
});
