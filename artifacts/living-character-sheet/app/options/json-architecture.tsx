import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import colors from "@/constants/colors";

const CHARACTER_SNAPSHOT_JSON_EXAMPLE = `{
  "_version": 1,
  "character": {
    "id": "char_123",
    "name": "Nyx",
    "class": "Rogue",
    "level": 5,
    "race": "Half-Elf",
    "abilityScores": {
      "strength": 8,
      "dexterity": 18,
      "constitution": 14,
      "intelligence": 12,
      "wisdom": 13,
      "charisma": 16
    },
    "currency": { "cp": 0, "sp": 12, "ep": 0, "gp": 85, "pp": 1 }
  },
  "attacks": [],
  "resources": [],
  "inventory": [],
  "conditions": [],
  "notes": [],
  "wishlist": [],
  "journalArcs": [],
  "spellSlots": [],
  "classFeatures": [],
  "passiveFeatures": [],
  "preparedSpells": [],
  "people": [],
  "quests": [],
  "locations": [],
  "realms": [],
  "combatLog": {
    "entries": [],
    "sessions": []
  }
}`;

const ITEM_JSON_ARRAY_EXAMPLE = `[
  {
    "name": "Longsword",
    "category": "weapon",
    "quantity": 1,
    "equipped": true,
    "damageDice": "1d8",
    "damageType": "slashing",
    "isProficient": true,
    "tags": ["Versatile"],
    "notes": "Family heirloom"
  },
  {
    "name": "Potion of Healing",
    "category": "consumable",
    "quantity": 2,
    "notes": "2d4+2 healing"
  }
]`;

export default function JsonArchitectureOptionsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 16 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}> 
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: c.border }]}> 
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>JSON Architecture</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollHintScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}> 
          <Text style={[styles.jsonGuideTitle, { color: c.foreground }]}>Character and Item JSON Guide</Text>
          <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Import and export format reference with required fields and examples.</Text>

          <Divider color={c.border} />

          <Text style={[styles.jsonGuideTitle, { color: c.foreground }]}>Character snapshot format</Text>
          <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Use this when importing or exporting complete characters. Minimum required fields are _version, character, and character.name plus character.class.</Text>
          <Text style={[styles.jsonGuideCode, { color: c.foreground, backgroundColor: c.secondary, borderColor: c.border }]}>{CHARACTER_SNAPSHOT_JSON_EXAMPLE}</Text>

          <Divider color={c.border} />

          <Text style={[styles.jsonGuideTitle, { color: c.foreground }]}>Item array format</Text>
          <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Use this when importing inventory only. Minimum required item fields are name, category, and quantity.</Text>
          <Text style={[styles.jsonGuideCode, { color: c.foreground, backgroundColor: c.secondary, borderColor: c.border }]}>{ITEM_JSON_ARRAY_EXAMPLE}</Text>

          <Divider color={c.border} />

          <Text style={[styles.jsonGuideTitle, { color: c.foreground }]}>Quick rules</Text>
          <Text style={[styles.jsonGuideBullet, { color: c.mutedForeground }]}>- category must be one of: weapon, armor, consumable, accessory, quest, loot, tool, misc.</Text>
          <Text style={[styles.jsonGuideBullet, { color: c.mutedForeground }]}>- numbers should be plain numbers, not strings.</Text>
          <Text style={[styles.jsonGuideBullet, { color: c.mutedForeground }]}>- unknown fields are ignored, known fields are preserved on export.</Text>
          <Text style={[styles.jsonGuideBullet, { color: c.mutedForeground }]}>- full snapshot imports replace current character state; item imports append to inventory.</Text>
        </View>
      </ScrollHintScrollView>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700" },
  scrollContent: { padding: 16, gap: 0 },
  card: {
    borderWidth: 1,
    borderRadius: colors.radius * 1.15,
    padding: 12,
    gap: 10,
  },
  settingDesc: { fontSize: 12, lineHeight: 16 },
  divider: {
    height: 1,
    borderRadius: 1,
    opacity: 0.7,
  },
  jsonGuideTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  jsonGuideCode: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", web: "monospace", default: "monospace" }),
  },
  jsonGuideBullet: {
    fontSize: 12,
    lineHeight: 18,
  },
});
