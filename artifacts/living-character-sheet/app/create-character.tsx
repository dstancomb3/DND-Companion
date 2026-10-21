// ─── Open5e Background Picker Modal ────────────────────────────────────────
import { fetchOpen5eBackgrounds } from "../utils/open5eApi";
import { View as RNView, Text as RNText, ScrollView as RNScrollView, TouchableOpacity as RNTouchableOpacity, ActivityIndicator } from "react-native";
type Open5eBackground = {
  slug: string;
  name: string;
  desc: string;
  feature?: string;
  feature_desc?: string;
  reference_abr?: string;
};

function Open5eBackgroundPicker({ onSelect, onClose }: { onSelect: (bg: Open5eBackground) => void; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [backgrounds, setBackgrounds] = useState<Open5eBackground[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOpen5eBackgrounds()
      .then(setBackgrounds)
      .catch((e) => setError(e.message || "Failed to load backgrounds"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <RNView style={{ flex: 1, padding: 16, backgroundColor: "#fff" }}>
      <RNView style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <RNTouchableOpacity onPress={onClose} style={{ marginRight: 12 }}>
          <RNText style={{ color: "#007AFF", fontSize: 16 }}>Close</RNText>
        </RNTouchableOpacity>
        <RNText style={{ fontWeight: "bold", fontSize: 18 }}>Browse Open5e Backgrounds</RNText>
      </RNView>
      {loading && <ActivityIndicator size="large" />}
      {error && <RNText style={{ color: "red" }}>{error}</RNText>}
      <RNScrollView>
        {backgrounds.map((bg) => (
          <RNTouchableOpacity
            key={bg.slug}
            onPress={() => onSelect(bg)}
            style={{ marginBottom: 16, padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 8 }}
          >
            <RNText style={{ fontWeight: "bold", fontSize: 16 }}>{bg.name}</RNText>
            <RNText style={{ marginTop: 4 }}>{bg.desc}</RNText>
            {bg.feature && <RNText style={{ marginTop: 4, fontStyle: "italic" }}>Feature: {bg.feature}</RNText>}
            {bg.feature_desc && <RNText style={{ marginTop: 2 }}>{bg.feature_desc}</RNText>}
          </RNTouchableOpacity>
        ))}
      </RNScrollView>
    </RNView>
  );
}
import React, { useState, useEffect, useCallback, useMemo, createContext, useContext, useRef } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useColors } from "@/hooks/useColors";
import { useHelpPopup } from "@/hooks/useHelpPopup";
import { DEFAULT_MOTIONS, useAppSettings } from "@/context/AppSettingsContext";
import { useCharacter } from "@/context/CharacterContext";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { CharacterSheetFormCore, type CharacterSheetFormData, type CharacterSheetFormSection } from "@/components/CharacterSheetFormCore";
import { saveCharacter } from "@/utils/characterStorage";
import { API_BASE_URL } from "@/utils/apiUrl";
import {
  CREATION_GEAR_FILTER_CATEGORIES,
  buildCreationGearCatalog,
  buildRandomCreationGearSelection,
  buildCreationGearLoadout,
  filterCreationGearCatalog,
  CREATION_GEAR_RARITIES,
  formatCreationGearCost,
  getClassFreeChoiceBudgetGp,
  getClassPresetOptions,
  getClassStrictPackageOptions,
  getPackageDetails,
  sortCreationGearCatalogBySelections,
  type CreationGearFilterCategory,
  type CreationGearLoadPreset,
  type CreationGearRarity,
  type GearSelectionMode,
} from "@/utils/creationGear";
import type { Character, AbilityScores, SavingThrow, Skill, CharacterSnapshot, QuestUpdateResult, ClassFeature, Feat, InventoryItem, Quest, NpcPerson, CampaignLocation, Plane } from "@/types";
import { getDmNotesPayload } from "@/utils/dmNotesStorage";
import colors from "@/constants/colors";
import { RACE_GROUPS, ALL_CLASSES, ALL_BACKGROUNDS } from "@/data/dnd5e";
import { roll, roll4d6DropLowest, NPC_GENDERS, generateRandomName } from "@/data/dmTables";
import { Modal } from "react-native";
import { useState as useStateReact } from "react";
import { Open5eBrowser } from "../components/Open5eBrowser";

// ─── Constants ───────────────────────────────────────────────────────────────

const CLASS_HIT_DIE: Record<string, number> = {
  barbarian: 12,
  fighter: 10, paladin: 10, ranger: 10, "blood hunter": 10,
  artificer: 8, bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
  sorcerer: 6, wizard: 6,
};

const CLASS_SAVE_PROFS: Record<string, (keyof AbilityScores)[]> = {
  barbarian: ["strength", "constitution"],
  bard: ["dexterity", "charisma"],
  cleric: ["wisdom", "charisma"],
  druid: ["intelligence", "wisdom"],
  fighter: ["strength", "constitution"],
  monk: ["strength", "dexterity"],
  paladin: ["wisdom", "charisma"],
  ranger: ["strength", "dexterity"],
  rogue: ["dexterity", "intelligence"],
  sorcerer: ["constitution", "charisma"],
  warlock: ["wisdom", "charisma"],
  wizard: ["intelligence", "wisdom"],
  artificer: ["constitution", "intelligence"],
  "blood hunter": ["dexterity", "intelligence"],
};

const ALL_SKILLS: { name: string; ability: keyof AbilityScores }[] = [
  { name: "Acrobatics", ability: "dexterity" },
  { name: "Animal Handling", ability: "wisdom" },
  { name: "Arcana", ability: "intelligence" },
  { name: "Athletics", ability: "strength" },
  { name: "Deception", ability: "charisma" },
  { name: "History", ability: "intelligence" },
  { name: "Insight", ability: "wisdom" },
  { name: "Intimidation", ability: "charisma" },
  { name: "Investigation", ability: "intelligence" },
  { name: "Medicine", ability: "wisdom" },
  { name: "Nature", ability: "intelligence" },
  { name: "Perception", ability: "wisdom" },
  { name: "Performance", ability: "charisma" },
  { name: "Persuasion", ability: "charisma" },
  { name: "Religion", ability: "intelligence" },
  { name: "Sleight of Hand", ability: "dexterity" },
  { name: "Stealth", ability: "dexterity" },
  { name: "Survival", ability: "wisdom" },
];

interface ClassTip { primary: string[]; also: string[]; skills: string[]; note?: string; }
const CLASS_STAT_TIPS: Record<string, ClassTip> = {
  Artificer:     { primary: ["Intelligence"],               also: ["Constitution"],          skills: ["Arcana", "Investigation"] },
  Barbarian:     { primary: ["Strength", "Constitution"],   also: ["Dexterity"],             skills: ["Athletics", "Intimidation"] },
  Bard:          { primary: ["Charisma"],                   also: ["Dexterity"],             skills: ["Performance", "Persuasion"] },
  "Blood Hunter":{ primary: ["Strength", "Dexterity"],      also: ["Intelligence"],          skills: ["Athletics", "Stealth"] },
  Cleric:        { primary: ["Wisdom"],                     also: ["Constitution"],          skills: ["Insight", "Religion"] },
  Druid:         { primary: ["Wisdom"],                     also: ["Constitution"],          skills: ["Nature", "Perception"] },
  Fighter:       { primary: ["Strength", "Dexterity"],      also: ["Constitution"],          skills: ["Athletics", "Perception"], note: "STR for melee, DEX for ranged / finesse" },
  Monk:          { primary: ["Dexterity", "Wisdom"],        also: ["Constitution"],          skills: ["Acrobatics", "Insight"] },
  Paladin:       { primary: ["Strength", "Charisma"],       also: ["Constitution"],          skills: ["Athletics", "Persuasion"] },
  Ranger:        { primary: ["Dexterity", "Wisdom"],        also: ["Constitution"],          skills: ["Perception", "Survival"] },
  Rogue:         { primary: ["Dexterity"],                  also: ["Intelligence", "Charisma"], skills: ["Stealth", "Perception"] },
  Sorcerer:      { primary: ["Charisma"],                   also: ["Constitution"],          skills: ["Arcana", "Persuasion"] },
  Warlock:       { primary: ["Charisma"],                   also: ["Constitution"],          skills: ["Arcana", "Deception"] },
  Wizard:        { primary: ["Intelligence"],               also: ["Dexterity"],             skills: ["Arcana", "History"] },
};

const CLASS_DESCRIPTIONS: Record<string, string> = {
  Artificer:      "Masters of invention who use magic and ingenuity to craft powerful infused items and gadgets. They are excellent support characters who can also deal damage. Choose a Specialist at 3rd level to sharpen your focus.",
  Barbarian:      "Primal warriors who unleash a Rage that grants bonus damage and resistance to physical harm. Extremely durable frontliners who can absorb punishment while dealing heavy blows. No spell preparation — just raw power.",
  Bard:           "Versatile performers who weave magic into music, inspiring allies and hindering foes. They learn spells from nearly every list and shine in social and utility situations. One of the most flexible and fun classes to roleplay.",
  "Blood Hunter": "Warriors who use forbidden rites to fight monsters, sacrificing their own HP to empower their weapons. Combines martial combat with dark magic for punishing effects. Rewarding for players who enjoy risk-reward mechanics.",
  Cleric:         "Divine spellcasters empowered by their deity with healing, buff, and damage spells. Their Domain (chosen at 1st level) determines their specialty and bonus spells. One of the best support classes in the game.",
  Druid:          "Nature-attuned spellcasters who can Wild Shape into beasts for exploration or combat. They wield powerful nature magic and are highly versatile inside and outside of combat. Their Circle further shapes their identity.",
  Fighter:        "Supremely trained warriors who can use any weapon or armor and gain multiple attacks fast. Highly consistent damage with many archetypes to choose from. The best class if you want reliable, low-maintenance effectiveness.",
  Monk:           "Disciplined martial artists who harness ki energy to fight unarmed, move at incredible speed, and deflect missiles. No armor or weapons needed — their body is the weapon. Fast, mobile, and surprising to face.",
  Paladin:        "Holy warriors who blend heavy armor, martial attacks, and powerful divine spells. Their Lay on Hands healing and Smite damage make them formidable in combat. Their Sacred Oath shapes both powers and roleplay identity.",
  Ranger:         "Skilled hunters and trackers who use martial skills alongside nature magic. They excel against favored enemies and in chosen terrains, with great mobility and utility spells. A solid blend of martial and spellcasting.",
  Rogue:          "Cunning and nimble, Rogues deal massive Sneak Attack damage and are the skill specialists. They pick locks, disarm traps, and strike from shadows. Expertise in chosen skills means they reliably succeed where others fail.",
  Sorcerer:       "Innate spellcasters whose magic flows from their bloodline rather than study. They have fewer spells but can modify them with Metamagic for flexible casting. Their Sorcerous Origin grants unique powers from 1st level.",
  Warlock:        "Spellcasters who forged a pact with a powerful patron for magic and abilities. Spell slots are few but recharge on a short rest, and Eldritch Blast provides reliable ranged damage. Roleplay hooks are baked right in.",
  Wizard:         "The most versatile arcane spellcasters, Wizards learn spells from books and have the widest spell selection of any class. Fragile but extraordinarily powerful at higher levels. Arcane School further specializes their magic.",
};

const SUBCLASS_DESCRIPTIONS: Record<string, string> = {
  Berserker: "A relentless rage path focused on all-out offense and intimidation.",
  "Path of the Totem Warrior": "A spiritual barbarian path that channels animal totems for distinct combat roles.",
  Champion: "A straightforward fighter archetype built around consistent weapon excellence.",
  "Battle Master": "A tactical fighter archetype using maneuvers and superiority dice for control and precision.",
  "Eldritch Knight": "A martial fighter blending weapon mastery with wizard spellcasting.",
  "Arcane Trickster": "A rogue archetype combining stealth and precision with illusion/enchantment magic.",
  Thief: "A nimble rogue archetype emphasizing mobility, item use, and infiltration.",
  Assassin: "A high-burst rogue archetype centered on ambushes, disguise, and opening strikes.",
  "Life Domain": "A cleric domain focused on restoring and preserving life.",
  "Light Domain": "A radiant cleric domain specializing in fire, light, and anti-darkness magic.",
  "School of Evocation": "A wizard school focused on raw destructive spellcasting power.",
  "School of Illusion": "A wizard school centered on deception, misdirection, and battlefield trickery.",
};

const SELECTABLE_SUBRACE_PARENT = new Map(
  RACE_GROUPS
    .flatMap((group) => group.races)
    .flatMap((raceEntry) => (raceEntry.subraces ?? []).map((subrace) => [subrace, raceEntry.base] as const)),
);

const SELECTABLE_SUBCLASS_PARENT_CLASS = new Map(
  ALL_CLASSES
    .flatMap((entry) => entry.subclasses.map((subclassName) => [subclassName, entry.name] as const)),
);

function buildTailoredSubraceDescription(subrace: string, parentRace: string): string {
  const lowered = subrace.toLowerCase();
  if (parentRace === "Tiefling") {
    const infernalPatron = subrace.replace(/\s*Tiefling$/i, "").trim();
    return `${subrace} traces its infernal bloodline to ${infernalPatron}, shaping its spell flavor and social tone differently from other tiefling lineages. It still carries Tiefling resilience, but its identity leans into ${infernalPatron.toLowerCase()}-themed magic and roleplay pressure.`;
  }
  if (lowered.includes("sea") || lowered.includes("water")) {
    return `${subrace} is a ${parentRace} lineage adapted to oceans and coasts, with traits that favor mobility and control in water-heavy encounters. It plays best when exploration and aquatic positioning matter.`;
  }
  if (lowered.includes("shadow") || lowered.includes("shadar") || lowered.includes("drow") || lowered.includes("dark")) {
    return `${subrace} is a shadow-touched ${parentRace} lineage built around stealth pressure, altered senses, and high-risk positioning in bright environments. It stands apart from other ${parentRace} lineages through darker magic and ambush-oriented identity.`;
  }
  if (lowered.includes("high") || lowered.includes("arc") || lowered.includes("rock") || lowered.includes("deep")) {
    return `${subrace} is a scholarly ${parentRace} lineage that emphasizes learned craft, precision, and utility over brute force. It is tailored for builds that value problem-solving and controlled magic or tools.`;
  }
  if (lowered.includes("wood") || lowered.includes("forest") || lowered.includes("wild") || lowered.includes("beast")) {
    return `${subrace} is a wilderness-forward ${parentRace} lineage with traits tuned for scouting, terrain play, and sustained travel pressure. It excels when encounters reward movement, tracking, and environmental awareness.`;
  }
  if (lowered.includes("mountain") || lowered.includes("hill") || lowered.includes("duergar") || lowered.includes("beasthide")) {
    return `${subrace} is a hardy ${parentRace} lineage that trades flexibility for durability and frontline staying power. It is tailored for characters that expect repeated attrition and close-range conflict.`;
  }
  return `${subrace} is a distinct ${parentRace} lineage with a tailored feature profile, roleplay identity, and tactical niche separate from sibling lineages. It is designed to feel mechanically and narratively different from other ${parentRace} options.`;
}

function buildTailoredSubclassDescription(subclass: string, className: string): string {
  const lowered = subclass.toLowerCase();
  if (className === "Wizard" && subclass.startsWith("School of ")) {
    const school = subclass.replace(/^School of\s+/i, "");
    return `${subclass} is the Wizard tradition dedicated to ${school.toLowerCase()} mastery, trading broad flexibility for deeper control over that school\'s spells and tactics. It is tailored for players who want a focused arcane identity instead of a generalist spellbook.`;
  }
  if (lowered.includes("wild magic") || lowered.includes("chaos") || lowered.includes("storm")) {
    return `${subclass} is a ${className} path built around volatile power spikes, momentum swings, and adaptive play under uncertainty. It rewards players who can convert unpredictable outcomes into tactical advantage.`;
  }
  if (lowered.includes("shadow") || lowered.includes("phantom") || lowered.includes("assassin") || lowered.includes("necrom")) {
    return `${subclass} is a ${className} specialization focused on pressure from darkness, fear, or attrition tools that punish exposed enemies. It favors setup, timing, and controlled elimination over open brawling.`;
  }
  if (lowered.includes("battle") || lowered.includes("war") || lowered.includes("champion") || lowered.includes("berserker")) {
    return `${subclass} is a ${className} specialization centered on sustained combat tempo, efficient action use, and reliable front-line performance. It is tailored for direct encounter impact rather than utility-heavy play.`;
  }
  if (lowered.includes("arcane") || lowered.includes("eldritch") || lowered.includes("scribe") || lowered.includes("hex")) {
    return `${subclass} is a ${className} hybrid path that blends martial or utility cadence with stronger magical expression. It is tailored for players who want flexible turn choices and layered resource decisions.`;
  }
  if (lowered.includes("life") || lowered.includes("peace") || lowered.includes("devotion") || lowered.includes("redemption")) {
    return `${subclass} is a ${className} support-leaning specialization that amplifies protection, recovery, and team consistency in long adventuring days. It is tailored for table roles that stabilize allies under pressure.`;
  }
  return `${subclass} is a tailored ${className} specialization with its own pacing, feature emphasis, and encounter role distinct from sibling subclasses.`;
}

const CREATE_CHARACTER_HELP: Record<string, string> = {
  "Character Name": "Pick the name shown across your sheet, exports, and party tools. This is mainly flavor but helps with quick switching and organization.",
  Race: "Race sets core lineage traits like speed, special senses, resistances, and sometimes extra movement or innate magic.",
  Class: "Class defines your core combat role, feature progression, and primary ability priorities.",
  "Level · 1": "Choose your starting level for this character. Higher level means stronger baseline stats and more class features.",
  Background: "Background is mostly roleplay flavor, but it can also grant skill, language, tool, and feat-related bonuses.",
  Alignment: "Alignment is a quick roleplay shorthand for your character's moral outlook and worldview.",
  "Background Personality": "These roleplay fields are exported with your character and useful for quick in-session behavior prompts.",
  "Score Method": "Choose how ability scores are assigned: Point Buy for balance, Standard Array for speed, Manual for custom rolls.",
  "Max Hit Points": "Calculated from class hit die, level, and Constitution modifier using your creation choices.",
  "Armor Class": "Auto-derived baseline AC based on class rules and your ability modifiers before equipment changes.",
  "Speed (ft)": "Walking speed is based on race and other deterministic rules in your build.",
  "Flying Speed (ft)": "Shown automatically when your selected race or lineage grants a flying speed.",
  Languages: "Derived from race/background data. You can still adjust language-related details later if needed.",
  "Tool Proficiencies": "Tools come from deterministic race/background features and help with specific checks outside combat.",
  Defenses: "Lists resistances and immunities provided by your selected race/class features.",
  Notes: "Freeform character notes for backstory, goals, and reminders that should persist with the sheet.",
};

const CharacterHelpContext = createContext<(label: string, hint?: string) => void>(() => {});

const RACE_DESCRIPTIONS: Record<string, string> = {
  Human:          "Versatile and adaptable, Humans get +1 to all six ability scores (or +1 to two stats plus a free feat with Variant Human). The most common race in most settings with no special weaknesses. Great for any class.",
  "Variant Human": "A Human who trades the spread of +1s for +1 to two stats of your choice and a feat at 1st level. One of the strongest early-game options due to the free feat. Excellent for nearly every build.",
  Elf:            "Graceful and long-lived, Elves have Darkvision, immunity to sleep magic, and advantage against charm. Choose High Elf for a free cantrip, Wood Elf for extra speed and Mask of the Wild, or Drow for innate spellcasting.",
  "High Elf":     "Elves with a natural affinity for arcane magic — they gain a free cantrip and an additional language. +2 DEX and +1 INT make them solid for Wizards or DEX-based Fighters. One of the most common elven subtypes.",
  "Wood Elf":     "Elves of the forest with +2 DEX and +1 WIS plus a 35 ft movement speed and Mask of the Wild for stealth in nature. Excellent Rangers and Druids. Natural scouts with solid exploration utility.",
  Drow:           "Dark Elves raised in the Underdark with +2 DEX and +1 CHA, Darkvision 120 ft, and innate spellcasting. They have light sensitivity in sunlight. Powerful casters, especially Warlocks and Sorcerers.",
  Dwarf:          "Sturdy and resilient, Dwarves have +2 CON, advantage on poison saves, and Stonecunning. Hill Dwarves gain +1 WIS and bonus HP per level; Mountain Dwarves gain +2 STR and medium armor proficiency.",
  "Hill Dwarf":   "Dwarves with +2 CON and +1 WIS who gain extra HP at every level from Dwarven Toughness. Excellent Clerics and Druids who benefit from the extra durability. A very solid choice for any support role.",
  "Mountain Dwarf": "Dwarves with +2 CON and +2 STR who gain medium armor proficiency for free. Great for melee classes who want durability. One of the better Barbarian or Paladin racial options.",
  Halfling:       "Small but incredibly lucky — Halflings reroll any 1 on attack rolls, ability checks, and saving throws (Lucky). They can also move through larger creatures' spaces. Lightfoot Halflings can hide behind allies.",
  "Lightfoot Halfling": "The most common Halfling subrace, with +2 DEX and +1 CHA and the ability to hide behind creatures larger than themselves. Excellent Rogues and Bards. Lucky makes them frustratingly hard to hurt.",
  "Stout Halfling": "Hardy Halflings with +2 DEX and +1 CON who have resistance to poison and advantage on poison saves. More durable than Lightfoot for frontline roles. Good for melee Rogues or Fighter builds.",
  Gnome:          "Clever tinkerers or nature-lovers with +2 INT and advantage on all Intelligence, Wisdom, and Charisma saving throws against magic. Rock Gnomes love gadgets; Forest Gnomes have Minor Illusion and animal speech.",
  "Rock Gnome":   "Gnomes with +2 INT and +1 CON who can construct small clockwork devices and have proficiency with tinker's tools. Best for Artificers and Wizards who want a mechanically-minded racial flavour.",
  "Forest Gnome": "Gnomes with +2 INT and +1 DEX who can speak to small beasts and cast Minor Illusion at will. Excellent Illusionists and Druids with natural stealth utility through Small Illusions.",
  "Half-Elf":     "Blending human ambition with elven grace, Half-Elves get +2 CHA and +1 to any two stats of their choice. They gain two extra skill proficiencies and resistance to charm and sleep. One of the strongest all-around races.",
  "Half-Orc":     "Fierce and powerful, Half-Orcs get +2 STR and +1 CON along with Relentless Endurance — once per long rest, survive being reduced to 0 HP with 1 HP instead. Savage Attacks deals extra critical damage.",
  Tiefling:       "Descendants of a fiendish bloodline with +2 CHA and +1 INT, fire resistance, and innate spellcasting (Thaumaturgy, Hellish Rebuke, Darkness). Excellent Warlocks and Sorcerers with strong roleplay identity.",
  Dragonborn:     "Proud draconic descendants with +2 STR and +1 CHA plus a breath weapon that matches their Draconic Ancestry type. They also gain resistance to that damage type. Best for melee Paladins or Sorcerers.",
  Githyanki:      "Astral warriors who escaped mind flayer slavery with +2 INT and +1 STR, medium armor and martial weapon proficiency, and innate psionic spellcasting (Mage Hand, Jump, Misty Step). Great for Fighters or Wizards.",
  Githzerai:      "Monastic githzerai with +2 WIS and +1 INT and innate psionic abilities (Mage Hand, Shield, Detect Thoughts). Advantage against being charmed or frightened. Excellent Monks and Clerics.",
  Aasimar:        "Touched by celestial power, Aasimar can heal others with Healing Hands and resist necrotic and radiant damage. Their subrace provides a powerful transformation ability. Great Paladins and Clerics.",
  Genasi:         "Children of elemental planes in four varieties — Air (flight burst), Earth (move through stone), Fire (resistance + flame spells), Water (swim speed + water breathing). Each has innate spellcasting.",
  Goliath:        "Giant-kin mountain dwellers with +2 STR and +1 CON. Stone's Endurance lets them reduce damage by 1d12 + CON once per short rest. Natural athletes with powerful endurance for frontline roles.",
  Tabaxi:         "Curious cat-folk with +2 DEX and +1 CHA who can Feline Agility to double their speed for a turn (recharges when they don't move). They have a climb speed and natural claw attacks. Fun and mobile.",
  Warforged:      "Living constructs built for war with +2 CON and +1 to any other score. They need no food, sleep, or air, and their Integrated Protection grants a natural AC bonus. Excellent durable fighters.",
  Tortle:         "Turtle-folk with +2 STR and +1 WIS and a unique flat AC of 17 from their shell (no armor needed). Their Shell Defense lets them boost AC further. Great with CON-focused builds.",
  Kenku:          "Fallen bird-folk who lost their wings and voices with +2 DEX and +1 WIS. They can perfectly mimic voices and sounds and have proficiency in two chosen skills. Excellent stealthy Rogues.",
  Lizardfolk:     "Cold-blooded reptilians with +2 CON and +1 WIS who have natural armor, a Bite attack, and can hold breath for 15 minutes. Cunning Artisan lets them make basic gear from fallen foes. Unusual and tough.",
  Changeling:     "Shapeshifters who can alter their appearance at will, gaining +2 CHA and +1 to one other score. Excellent at social infiltration with Deception bonuses. Perfect for Rogues, Bards, or Warlocks.",
  Kobold:         "Small draconic humanoids with +2 DEX who gain Pack Tactics — advantage on attacks when an ally is adjacent to the target. They make excellent ambushers and work brilliantly in groups.",
  Goblin:         "Small and quick with +2 DEX and +1 CON. Nimble Escape lets them Disengage or Hide as a bonus action each turn, making them exceptional Rogues and ranged strikers. Surprisingly deadly for their size.",
  Orc:            "Powerful warriors with +2 STR and +1 CON. Aggressive lets them move toward an enemy as a bonus action, closing gaps immediately. Excellent frontline Barbarians and Fighters.",
  Bugbear:        "Stealthy brutes with +2 STR and +1 DEX whose Long-Limbed trait extends melee reach by 5 ft. Surprise Attack deals an extra 2d6 on the first round. Excellent Rogues and ambush Fighters.",
  Hobgoblin:      "Disciplined soldiers with +2 CON and +1 INT who gain light and medium armor proficiency and Saving Face — adding dice to failed saves based on nearby allies. Strong early-game martial characters.",
  "Yuan-ti Pureblood": "Near-human yuan-ti with +2 CHA and +1 INT, immunity to the Poisoned condition, resistance to poison damage, and innate spellcasting including Suggestion. One of the strongest racial ability sets in 5e.",
  Firbolg:        "Gentle giant-kin connected to nature with +2 WIS and +1 STR. They can cast Detect Magic and Disguise Self innately, speak to beasts and plants, and become invisible as a bonus action once per rest.",
  Satyr:          "Fey creatures of revelry with +2 CHA and +1 DEX who have advantage on saves against magic (Magic Resistance). They have a Ram attack, Mirthful Leaps for extra jump distance, and a Reveler bonus. Fun and resilient.",
  Triton:         "Aquatic warriors from the deep seas with +1 STR, CHA, and CON. They can breathe underwater, have a swim speed, cast innate spells, and speak to aquatic beasts. Great Paladins or defensive Fighters.",
};

function resolveRaceDescription(race: string): string | undefined {
  const trimmed = race.trim();
  if (!trimmed) return undefined;
  if (RACE_DESCRIPTIONS[trimmed]) return RACE_DESCRIPTIONS[trimmed];

  const selectableParent = SELECTABLE_SUBRACE_PARENT.get(trimmed);
  if (selectableParent) return buildTailoredSubraceDescription(trimmed, selectableParent);

  const parent = RACE_GROUPS
    .flatMap((group) => group.races)
    .find((entry) => entry.base === trimmed || entry.subraces?.includes(trimmed));
  if (parent?.base && RACE_DESCRIPTIONS[parent.base]) return RACE_DESCRIPTIONS[parent.base];
  if (parent?.base) return `${trimmed} is a ${parent.base} lineage with distinct heritage traits and roleplay flavor.`;
  return `${trimmed} has distinct lineage traits, cultural flavor, and mechanical identity in most 5e settings.`;
}

function resolveClassDescription(className: string): string | undefined {
  const trimmed = className.trim();
  if (!trimmed) return undefined;
  if (CLASS_DESCRIPTIONS[trimmed]) return CLASS_DESCRIPTIONS[trimmed];
  return `${trimmed} defines your core combat role, progression identity, and major feature unlock cadence.`;
}

function resolveSubclassDescription(subclass: string, className: string): string | undefined {
  const trimmedSubclass = subclass.trim();
  if (!trimmedSubclass) return undefined;
  if (SUBCLASS_DESCRIPTIONS[trimmedSubclass]) return SUBCLASS_DESCRIPTIONS[trimmedSubclass];

  const canonicalClass = SELECTABLE_SUBCLASS_PARENT_CLASS.get(trimmedSubclass);
  if (canonicalClass) return buildTailoredSubclassDescription(trimmedSubclass, canonicalClass);

  const trimmedClass = className.trim();
  if (!trimmedClass) return `${trimmedSubclass} is a specialization path with unique features and progression choices.`;
  return `${trimmedSubclass} is a ${trimmedClass} specialization with unique feature choices and progression flavor.`;
}

const ABILITY_KEYS: (keyof AbilityScores)[] = [
  "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
];
const ABILITY_LABELS: Record<keyof AbilityScores, string> = {
  strength: "STR", dexterity: "DEX", constitution: "CON",
  intelligence: "INT", wisdom: "WIS", charisma: "CHA",
};
const ABILITY_FULL: Record<keyof AbilityScores, string> = {
  strength: "Strength", dexterity: "Dexterity", constitution: "Constitution",
  intelligence: "Intelligence", wisdom: "Wisdom", charisma: "Charisma",
};

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

const RANDOM_ALIGNMENTS = [
  "Lawful Good", "Neutral Good", "Chaotic Good",
  "Lawful Neutral", "True Neutral", "Chaotic Neutral",
  "Lawful Evil", "Neutral Evil", "Chaotic Evil",
];

const RANDOM_PERSONALITY_TRAITS = [
  "I keep a journal of every strange encounter.",
  "I speak plainly and expect the same from others.",
  "I joke when danger gets too close.",
  "I always watch the exits in a new room.",
  "I collect small tokens from each town I visit.",
  "I trust deeds more than words.",
  "I ask one too many questions.",
  "I stay calm, even when plans collapse.",
];

const RANDOM_IDEALS = [
  "Justice. The strong should protect the weak.",
  "Freedom. No tyrant gets to decide my life.",
  "Duty. I keep my promises, no matter the cost.",
  "Knowledge. Truth is worth any effort.",
  "Mercy. Everyone deserves a second chance.",
  "Glory. Great deeds should be remembered.",
];

const RANDOM_BONDS = [
  "I owe my mentor a debt I can never fully repay.",
  "My hometown depends on me coming back stronger.",
  "I carry a keepsake from someone I failed to protect.",
  "I promised a friend I would finish their quest.",
  "My family name must be restored.",
  "I am searching for someone who vanished without a trace.",
];

const RANDOM_FLAWS = [
  "I take reckless risks when I think I am right.",
  "I hold grudges longer than I should.",
  "I find it hard to ask for help.",
  "I underestimate subtle threats.",
  "I push myself until I break.",
  "I trust charming people too quickly.",
];

const POINT_BUY_COST: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};
const POINT_BUY_TOTAL = 27;
const DEFAULT_PB_SCORES: Record<ScoreKey, number> = {
  str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8,
};
const DEFAULT_MANUAL_SCORES: Record<ScoreKey, string> = {
  str: "10", dex: "10", con: "10", int: "10", wis: "10", cha: "10",
};
const MANUAL_SCORE_MIN = 1;
const MANUAL_SCORE_MAX = 20;
const MANUAL_SCORE_TOTAL_MAX = 75;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function modStr(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function profBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

function calcHitDie(classStr: string): number {
  return CLASS_HIT_DIE[classStr.toLowerCase().trim()] ?? 8;
}

function calcSuggestedHp(classStr: string, level: number, conScore: number): number {
  const hd = calcHitDie(classStr);
  const con = abilityMod(conScore);
  const l1Hp = hd + con;
  if (level === 1) return Math.max(1, l1Hp);
  const perLevel = Math.floor(hd / 2) + 1 + con;
  return Math.max(level, l1Hp + perLevel * (level - 1));
}

type ScoreKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
const SCORE_KEY_MAP: Record<ScoreKey, keyof AbilityScores> = {
  str: "strength", dex: "dexterity", con: "constitution",
  int: "intelligence", wis: "wisdom", cha: "charisma",
};

const ABILITY_NAME_TO_SCORE_KEY: Record<string, ScoreKey> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

const RACE_FOCUS: Record<string, string[]> = {
  human: ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"],
  "variant human": ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"],
  elf: ["Dexterity"],
  "wood elf": ["Dexterity", "Wisdom"],
  "high elf": ["Dexterity", "Intelligence"],
  drow: ["Dexterity", "Charisma"],
  dwarf: ["Constitution"],
  "hill dwarf": ["Constitution", "Wisdom"],
  "mountain dwarf": ["Strength", "Constitution"],
  halfling: ["Dexterity"],
  "lightfoot halfling": ["Dexterity", "Charisma"],
  "stout halfling": ["Dexterity", "Constitution"],
  gnome: ["Intelligence"],
  "rock gnome": ["Intelligence", "Constitution"],
  "forest gnome": ["Intelligence", "Dexterity"],
  "half-elf": ["Charisma"],
  "half-orc": ["Strength", "Constitution"],
  tiefling: ["Charisma", "Intelligence"],
  dragonborn: ["Strength", "Charisma"],
  githyanki: ["Strength", "Intelligence"],
  githzerai: ["Wisdom", "Intelligence"],
  aasimar: ["Charisma", "Constitution"],
  genasi: ["Constitution"],
  goliath: ["Strength", "Constitution"],
  tabaxi: ["Dexterity", "Charisma"],
  warforged: ["Constitution"],
  tortle: ["Strength", "Wisdom"],
  kenku: ["Dexterity", "Wisdom"],
  lizardfolk: ["Constitution", "Wisdom"],
  changeling: ["Charisma"],
  kobold: ["Dexterity"],
  goblin: ["Dexterity", "Constitution"],
  orc: ["Strength", "Constitution"],
  bugbear: ["Strength", "Dexterity"],
  hobgoblin: ["Constitution", "Intelligence"],
  "yuan-ti pureblood": ["Charisma", "Intelligence"],
  firbolg: ["Wisdom", "Strength"],
  satyr: ["Charisma", "Dexterity"],
  triton: ["Strength", "Constitution", "Charisma"],
};

function normalizeRace(race: string): string {
  return race.trim().toLowerCase();
}

function getRaceFocusStats(race: string): string[] {
  const key = normalizeRace(race);
  if (!key) return [];
  if (RACE_FOCUS[key]) return RACE_FOCUS[key];
  const partial = Object.keys(RACE_FOCUS)
    .sort((a, b) => b.length - a.length)
    .find((k) => key.includes(k));
  return partial ? RACE_FOCUS[partial] : [];
}

function getSuggestedPriority(charClass: string, race: string): ScoreKey[] {
  const classTip = CLASS_STAT_TIPS[charClass] ?? null;
  const raceFocus = getRaceFocusStats(race);
  const orderedNames = [
    ...(classTip?.primary ?? []),
    ...(classTip?.also ?? []),
    ...raceFocus,
    "Constitution",
    "Dexterity",
    "Wisdom",
    "Intelligence",
    "Charisma",
    "Strength",
  ];

  const order: ScoreKey[] = [];
  for (const name of orderedNames) {
    const key = ABILITY_NAME_TO_SCORE_KEY[name.trim().toLowerCase()];
    if (key && !order.includes(key)) order.push(key);
  }

  for (const fallback of ["str", "dex", "con", "int", "wis", "cha"] as ScoreKey[]) {
    if (!order.includes(fallback)) order.push(fallback);
  }

  return order;
}

function calcDeterministicAc(classStr: string, scores: Record<ScoreKey, number>): number {
  const dex = abilityMod(scores.dex);
  const con = abilityMod(scores.con);
  const wis = abilityMod(scores.wis);
  const cls = classStr.trim().toLowerCase();

  if (cls === "barbarian") return 10 + dex + con;
  if (cls === "monk") return 10 + dex + wis;
  return 10 + dex;
}

type MovementProfile = { walk: number; fly?: number };

type DeterministicDefensesAndLanguages = {
  languages: string[];
  toolProficiencies: string[];
  damageResistances: string[];
  damageImmunities: string[];
  conditionImmunities: string[];
};

type ClassSkillRule = {
  choose: number;
  options: string[];
};

type BackgroundBenefit = {
  skills?: string[];
  tools?: string[];
  languages?: string[];
  feat?: { name: string; description?: string };
};

const ELF_LINEAGE_TRAITS: Record<string, Array<{ name: string; description: string }>> = {
  "High Elf": [
    { name: "Cantrip", description: "You know one wizard cantrip of your choice." },
    { name: "Extra Language", description: "You can speak, read, and write one extra language of your choice." },
  ],
  "Wood Elf": [
    { name: "Fleet of Foot", description: "Your base walking speed is 35 feet." },
    { name: "Mask of the Wild", description: "You can attempt to hide even when only lightly obscured by natural phenomena." },
  ],
  "Drow": [
    { name: "Superior Darkvision", description: "Accustomed to life in the Underdark, your darkvision has superior range." },
    { name: "Sunlight Sensitivity", description: "You have disadvantage on checks and attacks relying on sight in direct sunlight." },
    { name: "Drow Magic", description: "You know dancing lights and later gain additional innate spells." },
  ],
  "Eladrin": [
    { name: "Fey Step", description: "You can magically teleport up to 30 feet as a bonus action." },
  ],
  "Sea Elf": [
    { name: "Child of the Sea", description: "You have a swimming speed and can breathe air and water." },
    { name: "Friend of the Sea", description: "You can communicate simple ideas with beasts that have a swim speed." },
  ],
  "Shadar-Kai": [
    { name: "Blessing of the Raven Queen", description: "You can teleport as a bonus action and gain resistance to all damage until your next turn." },
  ],
};

const CLASS_SKILL_RULES: Record<string, ClassSkillRule> = {
  artificer: { choose: 2, options: ["Arcana", "History", "Investigation", "Medicine", "Nature", "Perception", "Sleight of Hand"] },
  barbarian: { choose: 2, options: ["Animal Handling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"] },
  bard: { choose: 3, options: ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"] },
  "blood hunter": { choose: 2, options: ["Acrobatics", "Arcana", "Athletics", "History", "Insight", "Investigation", "Religion", "Survival"] },
  cleric: { choose: 2, options: ["History", "Insight", "Medicine", "Persuasion", "Religion"] },
  druid: { choose: 2, options: ["Arcana", "Animal Handling", "Insight", "Medicine", "Nature", "Perception", "Religion", "Survival"] },
  fighter: { choose: 2, options: ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Survival"] },
  monk: { choose: 2, options: ["Acrobatics", "Athletics", "History", "Insight", "Religion", "Stealth"] },
  paladin: { choose: 2, options: ["Athletics", "Insight", "Intimidation", "Medicine", "Persuasion", "Religion"] },
  ranger: { choose: 3, options: ["Animal Handling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"] },
  rogue: { choose: 4, options: ["Acrobatics", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Perception", "Performance", "Persuasion", "Sleight of Hand", "Stealth"] },
  sorcerer: { choose: 2, options: ["Arcana", "Deception", "Insight", "Intimidation", "Persuasion", "Religion"] },
  warlock: { choose: 2, options: ["Arcana", "Deception", "History", "Intimidation", "Investigation", "Nature", "Religion"] },
  wizard: { choose: 2, options: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"] },
};

const BACKGROUND_BENEFITS: Record<string, BackgroundBenefit> = {
  "Acolyte": { skills: ["Insight", "Religion"], languages: ["Celestial"], feat: { name: "Magic Initiate (Cleric)", description: "Background origin feat." } },
  "Anthropologist": { skills: ["Insight", "Religion"], languages: ["Elvish"], feat: { name: "Skilled", description: "Background origin feat." } },
  "Archaeologist": { skills: ["History", "Survival"], tools: ["Cartographer's Tools"], feat: { name: "Skilled", description: "Background origin feat." } },
  "Athlete": { skills: ["Acrobatics", "Athletics"], feat: { name: "Athlete", description: "Background origin feat." } },
  "Charlatan": { skills: ["Deception", "Sleight of Hand"], tools: ["Disguise Kit", "Forgery Kit"], feat: { name: "Skilled", description: "Background origin feat." } },
  "City Watch": { skills: ["Athletics", "Insight"], languages: ["Dwarvish"], feat: { name: "Alert", description: "Background origin feat." } },
  "Clan Crafter": { skills: ["History", "Insight"], tools: ["Artisan's Tools"], feat: { name: "Crafter", description: "Background origin feat." } },
  "Cloistered Scholar": { skills: ["History", "Religion"], languages: ["Draconic"], feat: { name: "Skilled", description: "Background origin feat." } },
  "Courtier": { skills: ["Insight", "Persuasion"], languages: ["Elvish"], feat: { name: "Skilled", description: "Background origin feat." } },
  "Criminal": { skills: ["Deception", "Stealth"], tools: ["Thieves' Tools"], feat: { name: "Lucky", description: "Background origin feat." } },
  "Entertainer": { skills: ["Acrobatics", "Performance"], tools: ["Disguise Kit", "Musical Instrument"], feat: { name: "Musician", description: "Background origin feat." } },
  "Faction Agent": { skills: ["Insight", "Investigation"], languages: ["Infernal"], feat: { name: "Skilled", description: "Background origin feat." } },
  "Far Traveler": { skills: ["Insight", "Perception"], languages: ["Elvish"], feat: { name: "Skilled", description: "Background origin feat." } },
  "Fisher": { skills: ["History", "Survival"], tools: ["Fishing Tackle"], feat: { name: "Tough", description: "Background origin feat." } },
  "Folk Hero": { skills: ["Animal Handling", "Survival"], tools: ["Artisan's Tools", "Vehicles (Land)"], feat: { name: "Tough", description: "Background origin feat." } },
  "Gladiator": { skills: ["Acrobatics", "Performance"], feat: { name: "Savage Attacker", description: "Background origin feat." } },
  "Guild Artisan": { skills: ["Insight", "Persuasion"], tools: ["Artisan's Tools"], feat: { name: "Crafter", description: "Background origin feat." } },
  "Haunted One": { skills: ["Arcana", "Investigation"], languages: ["Abyssal"], feat: { name: "Alert", description: "Background origin feat." } },
  "Hermit": { skills: ["Medicine", "Religion"], tools: ["Herbalism Kit"], feat: { name: "Magic Initiate (Druid)", description: "Background origin feat." } },
  "Inheritor": { skills: ["History", "Survival"], feat: { name: "Skilled", description: "Background origin feat." } },
  "Knight": { skills: ["History", "Persuasion"], tools: ["Gaming Set"], feat: { name: "Mounted Combatant", description: "Background origin feat." } },
  "Knight of the Order": { skills: ["Persuasion", "Religion"], languages: ["Celestial"], feat: { name: "Magic Initiate (Cleric)", description: "Background origin feat." } },
  "Marine": { skills: ["Athletics", "Survival"], tools: ["Vehicles (Water)", "Navigator's Tools"], feat: { name: "Tough", description: "Background origin feat." } },
  "Mercenary Veteran": { skills: ["Athletics", "Persuasion"], tools: ["Gaming Set", "Vehicles (Land)"], feat: { name: "Savage Attacker", description: "Background origin feat." } },
  "Noble": { skills: ["History", "Persuasion"], tools: ["Gaming Set"], languages: ["Elvish"], feat: { name: "Skilled", description: "Background origin feat." } },
  "Outlander": { skills: ["Athletics", "Survival"], languages: ["Giant"], feat: { name: "Tough", description: "Background origin feat." } },
  "Pirate": { skills: ["Athletics", "Perception"], tools: ["Navigator's Tools", "Vehicles (Water)"], feat: { name: "Savage Attacker", description: "Background origin feat." } },
  "Sage": { skills: ["Arcana", "History"], languages: ["Draconic"], feat: { name: "Magic Initiate (Wizard)", description: "Background origin feat." } },
  "Sailor": { skills: ["Athletics", "Perception"], tools: ["Navigator's Tools", "Vehicles (Water)"], feat: { name: "Tavern Brawler", description: "Background origin feat." } },
  "Soldier": { skills: ["Athletics", "Intimidation"], tools: ["Gaming Set", "Vehicles (Land)"], feat: { name: "Savage Attacker", description: "Background origin feat." } },
  "Spy": { skills: ["Deception", "Stealth"], tools: ["Thieves' Tools"], feat: { name: "Alert", description: "Background origin feat." } },
  "Urban Bounty Hunter": { skills: ["Deception", "Stealth"], tools: ["Thieves' Tools"], feat: { name: "Skilled", description: "Background origin feat." } },
  "Urchin": { skills: ["Sleight of Hand", "Stealth"], tools: ["Disguise Kit", "Thieves' Tools"], feat: { name: "Lucky", description: "Background origin feat." } },
  "Uthgardt Tribe Member": { skills: ["Athletics", "Survival"], languages: ["Giant"], feat: { name: "Tough", description: "Background origin feat." } },
  "Waterdhavian Noble": { skills: ["History", "Persuasion"], tools: ["Gaming Set"], languages: ["Elvish"], feat: { name: "Skilled", description: "Background origin feat." } },
};

function pickDeterministicClassSkills(charClass: string, preferredSkills: string[], alreadyPicked: string[]): string[] {
  const rule = CLASS_SKILL_RULES[charClass.trim().toLowerCase()];
  if (!rule) return [];

  const picked = new Set(alreadyPicked.map((s) => s.toLowerCase()));
  const out: string[] = [];

  for (const pref of preferredSkills) {
    if (out.length >= rule.choose) break;
    const candidate = rule.options.find((opt) => opt.toLowerCase() === pref.toLowerCase());
    if (!candidate) continue;
    const key = candidate.toLowerCase();
    if (picked.has(key)) continue;
    picked.add(key);
    out.push(candidate);
  }

  for (const opt of rule.options) {
    if (out.length >= rule.choose) break;
    const key = opt.toLowerCase();
    if (picked.has(key)) continue;
    picked.add(key);
    out.push(opt);
  }

  return out;
}

function deriveLineageTraits(race: string): Array<{ name: string; description: string; source: string }> {
  const normalized = race.trim().toLowerCase();
  const traits: Array<{ name: string; description: string; source: string }> = [];

  if (normalized.includes("elf") || normalized.includes("eladrin") || normalized.includes("shadar-kai") || normalized.includes("drow")) {
    traits.push(
      { name: "Darkvision", description: "You can see in dim light as if it were bright light, and in darkness as if it were dim light.", source: race },
      { name: "Fey Ancestry", description: "You have advantage on saving throws against being charmed, and magic can't put you to sleep.", source: race },
      { name: "Trance", description: "Elves meditate deeply, remaining semiconscious, instead of sleeping.", source: race },
    );
  }

  const lineageEntry = Object.entries(ELF_LINEAGE_TRAITS).find(([k]) => normalized.includes(k.toLowerCase()));
  if (lineageEntry) {
    for (const t of lineageEntry[1]) {
      traits.push({ ...t, source: lineageEntry[0] });
    }
  }

  return traits;
}

const RACE_MOVEMENT: Record<string, MovementProfile> = {
  "wood elf": { walk: 35 },
  dwarf: { walk: 25 },
  "hill dwarf": { walk: 25 },
  "mountain dwarf": { walk: 25 },
  duergar: { walk: 25 },
  halfling: { walk: 25 },
  "lightfoot halfling": { walk: 25 },
  "stout halfling": { walk: 25 },
  "ghostwise halfling": { walk: 25 },
  gnome: { walk: 25 },
  "forest gnome": { walk: 25 },
  "rock gnome": { walk: 25 },
  "deep gnome": { walk: 25 },
  aaracokra: { walk: 25, fly: 50 },
  aarakocra: { walk: 25, fly: 50 },
  owlin: { walk: 30, fly: 30 },
  fairy: { walk: 30, fly: 30 },
  "winged tiefling": { walk: 30, fly: 30 },
};

function calcDeterministicMovement(race: string): MovementProfile {
  const r = normalizeRace(race);
  if (!r) return { walk: 30 };

  const exact = RACE_MOVEMENT[r];
  if (exact) return exact;

  const partialKey = Object.keys(RACE_MOVEMENT)
    .sort((a, b) => b.length - a.length)
    .find((k) => r.includes(k));
  if (partialKey) return RACE_MOVEMENT[partialKey];

  return { walk: 30 };
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function deriveDeterministicDefensesAndLanguages(params: {
  race: string;
  charClass: string;
  background: string;
  level: number;
}): DeterministicDefensesAndLanguages {
  const race = params.race.trim().toLowerCase();
  const cls = params.charClass.trim().toLowerCase();
  const background = params.background.trim();
  const level = params.level;

  const languages: string[] = ["Common"];
  const toolProficiencies: string[] = [];
  const damageResistances: string[] = [];
  const damageImmunities: string[] = [];
  const conditionImmunities: string[] = [];

  // Race defaults
  if (race.includes("dwarf")) languages.push("Dwarvish");
  if (race.includes("elf") || race.includes("eladrin") || race.includes("shadar-kai") || race.includes("drow")) languages.push("Elvish");
  if (race.includes("halfling")) languages.push("Halfling");
  if (race.includes("gnome")) languages.push("Gnomish");
  if (race.includes("orc") || race.includes("half-orc")) languages.push("Orc");
  if (race.includes("dragonborn")) languages.push("Draconic");
  if (race.includes("tiefling")) languages.push("Infernal");
  if (race.includes("gith")) languages.push("Gith");
  if (race.includes("aasimar")) languages.push("Celestial");
  if (race.includes("firbolg")) languages.push("Elvish", "Giant");
  if (race.includes("goliath")) languages.push("Giant");
  if (race.includes("kenku")) languages.push("Auran");
  if (race.includes("lizardfolk")) languages.push("Draconic");
  if (race.includes("kobold")) languages.push("Draconic");
  if (race.includes("goblin") || race.includes("hobgoblin") || race.includes("bugbear")) languages.push("Goblin");
  if (race.includes("yuan-ti")) languages.push("Abyssal", "Draconic");
  if (race.includes("satyr")) languages.push("Sylvan");
  if (race.includes("triton")) languages.push("Primordial");
  if (race.includes("genasi")) languages.push("Primordial");

  // Race defenses
  if (race.includes("tiefling")) damageResistances.push("Fire");
  if (race.includes("dwarf") || race.includes("stout halfling") || race.includes("warforged") || race.includes("yuan-ti")) damageResistances.push("Poison");
  if (race.includes("aasimar")) damageResistances.push("Radiant", "Necrotic");
  if (race.includes("fire genasi")) damageResistances.push("Fire");
  if (race.includes("water genasi")) damageResistances.push("Acid");
  if (race.includes("earth genasi")) damageResistances.push("Thunder");
  if (race.includes("air genasi")) damageResistances.push("Lightning");
  if (race.includes("yuan-ti")) conditionImmunities.push("Poisoned");

  // Class-granted languages/defenses
  if (cls === "druid") languages.push("Druidic");
  if (cls === "rogue") languages.push("Thieves' Cant");
  if (cls === "barbarian" && level >= 1) {
    damageResistances.push("Bludgeoning (while raging)", "Piercing (while raging)", "Slashing (while raging)");
  }
  if (cls === "monk" && level >= 10) {
    damageImmunities.push("Poison");
    conditionImmunities.push("Poisoned", "Disease");
  }

  const bg = BACKGROUND_BENEFITS[background];
  if (bg?.languages?.length) languages.push(...bg.languages);
  if (bg?.tools?.length) toolProficiencies.push(...bg.tools);

  return {
    languages: dedupe(languages),
    toolProficiencies: dedupe(toolProficiencies),
    damageResistances: dedupe(damageResistances),
    damageImmunities: dedupe(damageImmunities),
    conditionImmunities: dedupe(conditionImmunities),
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function sanitizeManualScoreInput(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) return "";
  const parsed = parseInt(digitsOnly, 10);
  if (Number.isNaN(parsed)) return "";
  return String(Math.min(MANUAL_SCORE_MAX, Math.max(MANUAL_SCORE_MIN, parsed)));
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreateCharacterScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ dmMode?: string }>();
  const isDmMode = params.dmMode === "1" || params.dmMode === "true";
  const { loadCharacter, applyQuestUpdate, queueLevelUps } = useCharacter();
  const { settings } = useAppSettings();
  const { showHelp, helpPopup } = useHelpPopup();
  const motionIntensity = settings.motionIntensity ?? "full";
  const motionsEnabled = settings.motions?.enabled ?? DEFAULT_MOTIONS.enabled;
  const motionEnabled =
    motionsEnabled &&
    motionIntensity !== "off" &&
    (settings.motions?.createCharacterStepTransition ?? DEFAULT_MOTIONS.createCharacterStepTransition);
  const motionDuration = motionIntensity === "subtle" ? 140 : 220;
  const useNativeDriver = Platform.OS !== "web";
  const stepAnim = useRef(new Animated.Value(1)).current;

  // Parse character notes/backstory for people, locations, and planes via AI (fire-and-forget)
  function parseBackstory(notesText: string) {
    if (!notesText.trim()) return;
    fetch(`${API_BASE_URL}/api/ai/parse-quest-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: notesText }),
    })
      .then((r) => r.ok ? r.json() as Promise<QuestUpdateResult> : null)
      .then((result) => { if (result) applyQuestUpdate(result); })
      .catch(() => {});
  }

  const [section, setSection] = useState<"identity" | "scores" | "gear" | "stats" | "quest" | "review">("identity");
  const [creating, setCreating] = useState(false);

  const CREATOR_TABS = [
    { id: "identity",  label: "Identity" },
    { id: "scores",   label: "Ability Scores" },
    { id: "gear",     label: "Gear" },
    { id: "stats",    label: "Stats" },
    ...(isDmMode ? [{ id: "quest" as const, label: "Quest Tie-In" }] : []),
    { id: "review",   label: "Review" },
  ] as const;

  const [dmQuests, setDmQuests] = useState<Quest[]>([]);
  const [dmPeople, setDmPeople] = useState<NpcPerson[]>([]);
  const [dmLocations, setDmLocations] = useState<CampaignLocation[]>([]);
  const [dmPlanes, setDmPlanes] = useState<Plane[]>([]);
  const [linkedQuestIds, setLinkedQuestIds] = useState<string[]>([]);
  const [linkedPeopleIds, setLinkedPeopleIds] = useState<string[]>([]);
  const [linkedLocationIds, setLinkedLocationIds] = useState<string[]>([]);
  const [linkedPlaneIds, setLinkedPlaneIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isDmMode) return;
    getDmNotesPayload().then((payload) => {
      setDmQuests(payload.quests ?? []);
      setDmPeople(payload.people ?? []);
      setDmLocations(payload.locations ?? []);
      setDmPlanes(payload.planes ?? []);
    }).catch(() => {});
  }, [isDmMode]);

  // Step 1
  const [name, setName] = useState("");
  const [race, setRace] = useState("");
  const [charClass, setCharClass] = useState("");
  const [subclass, setSubclass] = useState("");
  const [level, setLevel] = useState(1);
  const [background, setBackground] = useState("");
  const [alignment, setAlignment] = useState("");
  const [personalityTrait, setPersonalityTrait] = useState("");
  const [ideal, setIdeal] = useState("");
  const [bond, setBond] = useState("");
  const [flaw, setFlaw] = useState("");

  // Step 2 – ability scores
  const [scoreMethod, setScoreMethod] = useState<"pointbuy" | "standard" | "manual">("pointbuy");
  const [pbScores, setPbScores] = useState<Record<ScoreKey, number>>(DEFAULT_PB_SCORES);
  const [stdScores, setStdScores] = useState<Partial<Record<ScoreKey, number>>>({});
  const [manualScores, setManualScores] = useState<Record<ScoreKey, string>>(DEFAULT_MANUAL_SCORES);

  const setManualScoreCapped = useCallback((key: ScoreKey, value: string) => {
    setManualScores((prev) => ({
      ...prev,
      [key]: sanitizeManualScoreInput(value),
    }));
  }, []);

  // Step 3
  const [notes, setNotes] = useState("");

  // Step 4 - starting gear
  const [gearMode, setGearMode] = useState<GearSelectionMode>("strict");
  const [strictPackageId, setStrictPackageId] = useState("");
  const [presetId, setPresetId] = useState("");
  const [freeChoiceSelections, setFreeChoiceSelections] = useState<Record<string, number>>({});
  const [gearCategory, setGearCategory] = useState<CreationGearFilterCategory>("all");
  const [gearLoadPreset, setGearLoadPreset] = useState<CreationGearLoadPreset>("moderate");
  const [gearMaxRarity, setGearMaxRarity] = useState<CreationGearRarity>("Artifact");

  // Import JSON
  const [showImport, setShowImport] = useState(false);
  const [importPaste, setImportPaste] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const handlePickImportFile = async () => {
    setImportBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain", "text/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      const text = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      setImportPaste(text);
      setImportError(null);
    } catch (e) {
      setImportError("Could not read file: " + String(e));
    } finally {
      setImportBusy(false);
    }
  };

  const handleImportLoad = async () => {
    setImportError(null);
    let raw: unknown;
    try {
      raw = JSON.parse(importPaste.trim());
    } catch {
      setImportError("Could not parse this text as JSON. Make sure it's valid.");
      return;
    }

    let snapshot: CharacterSnapshot;
    if (raw && typeof raw === "object" && "character" in raw) {
      const s = raw as CharacterSnapshot;
      if (!s.character?.name || !s.character?.class) {
        setImportError("Snapshot is missing character name or class.");
        return;
      }
      snapshot = {
        _version: s._version ?? 1,
        character: {
          ...s.character,
          id: s.character.id || generateId(),
        },
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
        combatLog: s.combatLog,
      };
    } else {
      const ch = raw as Partial<Character>;
      if (!ch.name || !ch.class) {
        setImportError("This doesn't look like a character sheet — missing name or class.");
        return;
      }
      snapshot = {
        _version: 0,
        character: {
          id: generateId(),
          name: ch.name,
          class: ch.class,
          subclass: ch.subclass,
          level: ch.level ?? 1,
          race: ch.race ?? "",
          background: ch.background ?? "",
          alignment: ch.alignment ?? "",
          proficiencyBonus: ch.proficiencyBonus ?? 2,
          armorClass: ch.armorClass ?? 10,
          currentHp: ch.currentHp ?? ch.maxHp ?? 8,
          maxHp: ch.maxHp ?? 8,
          tempHp: ch.tempHp ?? 0,
          speed: ch.speed ?? 30,
          initiative: ch.initiative ?? 0,
          abilityScores: ch.abilityScores ?? { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
          savingThrows: ch.savingThrows ?? [],
          skills: ch.skills ?? [],
          passivePerception: ch.passivePerception ?? 10,
          currency: ch.currency ?? { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
          notes: ch.notes ?? "",
        },
        attacks: [],
        resources: [],
        inventory: [],
        conditions: [],
        notes: [],
      };
    }

    try {
      await saveCharacter(snapshot);
      loadCharacter(snapshot);
      const hasLore =
        (snapshot.people?.length ?? 0) > 0 ||
        (snapshot.locations?.length ?? 0) > 0 ||
        (snapshot.realms?.length ?? 0) > 0;
      if (!hasLore) {
        parseBackstory(snapshot.character.notes ?? "");
      }
      router.replace("/(tabs)");
    } catch (e) {
      setImportError("Failed to save character: " + String(e));
    }
  };

  function resolvedScores(): Record<ScoreKey, number> {
    if (scoreMethod === "pointbuy") return pbScores;
    if (scoreMethod === "standard") {
      const result: Record<ScoreKey, number> = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
      for (const [k, v] of Object.entries(stdScores)) {
        if (v !== undefined) (result as any)[k] = v;
      }
      return result;
    }
    // manual
    const result: Record<ScoreKey, number> = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    for (const [k, v] of Object.entries(manualScores)) {
      const parsed = parseInt(v, 10);
      if (!isNaN(parsed) && parsed >= MANUAL_SCORE_MIN && parsed <= MANUAL_SCORE_MAX) {
        (result as any)[k] = parsed;
      }
    }
    return result;
  }

  // ── Point buy helpers ──
  function pbUsedPoints(): number {
    return (Object.values(pbScores) as number[]).reduce((sum, s) => sum + (POINT_BUY_COST[s] ?? 0), 0);
  }

  function manualTotalScore(): number {
    return (Object.values(manualScores) as string[]).reduce((sum, value) => {
      const parsed = parseInt(value, 10);
      if (Number.isNaN(parsed) || parsed < MANUAL_SCORE_MIN || parsed > MANUAL_SCORE_MAX) {
        return sum;
      }
      return sum + parsed;
    }, 0);
  }
  function pbCanIncrease(key: ScoreKey): boolean {
    const cur = pbScores[key];
    if (cur >= 15) return false;
    const nextCost = (POINT_BUY_COST[cur + 1] ?? 99) - (POINT_BUY_COST[cur] ?? 0);
    return POINT_BUY_TOTAL - pbUsedPoints() >= nextCost;
  }
  function pbCanDecrease(key: ScoreKey): boolean {
    return pbScores[key] > 8;
  }
  function pbAdjust(key: ScoreKey, delta: number) {
    const cur = pbScores[key];
    const next = cur + delta;
    if (next < 8 || next > 15) return;
    setPbScores((p) => ({ ...p, [key]: next }));
  }

  // ── Standard array helpers ──
  function stdUsedValues(): number[] {
    return Object.values(stdScores).filter((v) => v !== undefined) as number[];
  }
  function stdAssignValue(key: ScoreKey, value: number) {
    setStdScores((prev) => {
      const next = { ...prev };
      // Remove this value from any other stat
      for (const [k, v] of Object.entries(next)) {
        if (v === value) delete (next as any)[k];
      }
      (next as any)[key] = value;
      return next;
    });
  }
  function stdIsAvailable(value: number, forKey: ScoreKey): boolean {
    const used = stdUsedValues();
    const currentAssigned = stdScores[forKey];
    if (currentAssigned === value) return true; // it's assigned to THIS stat
    return !used.includes(value);
  }

  // ── Validation ──
  function step1Valid(): boolean {
    return name.trim().length >= 1 && race.trim().length >= 1 && charClass.trim().length >= 1;
  }

  function step2Valid(): boolean {
    if (scoreMethod === "standard") {
      return stdUsedValues().length === 6;
    }
    if (scoreMethod === "pointbuy") {
      return pbUsedPoints() >= POINT_BUY_TOTAL;
    }
    const manualValuesValid = (Object.values(manualScores) as string[]).every((value) => {
      const parsed = parseInt(value, 10);
      return !Number.isNaN(parsed) && parsed >= MANUAL_SCORE_MIN && parsed <= MANUAL_SCORE_MAX;
    });
    return manualValuesValid && manualTotalScore() <= MANUAL_SCORE_TOTAL_MAX;
  }

  function rollCharacterIdentity() {
    const rolledGender = roll(NPC_GENDERS);
    const rolledIdentity = generateRandomName({ gender: rolledGender });
    const allRaces = RACE_GROUPS.flatMap((group) =>
      group.races.flatMap((r) => r.subraces?.length ? r.subraces : [r.base]),
    );
    const selectedClass = ALL_CLASSES.find((entry) => entry.name === charClass) ?? null;
    const chosenClass = selectedClass ?? roll(ALL_CLASSES);
    const chosenBackground = background.trim() || roll(ALL_BACKGROUNDS);

    if (!name.trim()) {
      setName(rolledIdentity.fullName);
    }
    if (!race.trim()) {
      setRace(roll(allRaces));
    }
    if (!charClass.trim()) {
      setCharClass(chosenClass.name);
    }
    if (!subclass.trim()) {
      setSubclass(chosenClass.subclasses?.length ? roll(chosenClass.subclasses) : "");
    }
    if (level === 1) {
      setLevel(Math.floor(Math.random() * 10) + 1);
    }
    if (!background.trim()) {
      setBackground(chosenBackground);
    }
    if (!alignment.trim()) {
      setAlignment(roll(RANDOM_ALIGNMENTS));
    }
    if (!personalityTrait.trim()) {
      setPersonalityTrait(roll(RANDOM_PERSONALITY_TRAITS));
    }
    if (!ideal.trim()) {
      setIdeal(roll(RANDOM_IDEALS));
    }
    if (!bond.trim()) {
      setBond(roll(RANDOM_BONDS));
    }
    if (!flaw.trim()) {
      setFlaw(roll(RANDOM_FLAWS));
    }

    const randomGear = buildRandomCreationGearSelection({ className: chosenClass.name });
    setGearMode(randomGear.mode);
    setStrictPackageId(randomGear.strictPackageId);
    setPresetId(randomGear.presetId);
    setGearCategory(randomGear.category);
    setFreeChoiceSelections(
      Object.fromEntries(randomGear.freeChoices.map((choice) => [choice.name, Math.max(1, choice.quantity)])),
    );
  }

  const hasCustomStandardScores = useMemo(
    () => Object.keys(stdScores).length > 0,
    [stdScores],
  );

  const hasCustomPointBuyScores = useMemo(
    () => (Object.keys(DEFAULT_PB_SCORES) as ScoreKey[]).some((key) => pbScores[key] !== DEFAULT_PB_SCORES[key]),
    [pbScores],
  );

  const hasCustomManualScores = useMemo(
    () => (Object.keys(DEFAULT_MANUAL_SCORES) as ScoreKey[]).some((key) => manualScores[key] !== DEFAULT_MANUAL_SCORES[key]),
    [manualScores],
  );

  const hasDraftSelections = useMemo(
    () => (
      name.trim().length > 0 ||
      race.trim().length > 0 ||
      charClass.trim().length > 0 ||
      subclass.trim().length > 0 ||
      level !== 1 ||
      background.trim().length > 0 ||
      alignment.trim().length > 0 ||
      personalityTrait.trim().length > 0 ||
      ideal.trim().length > 0 ||
      bond.trim().length > 0 ||
      flaw.trim().length > 0 ||
      scoreMethod !== "pointbuy" ||
      hasCustomPointBuyScores ||
      hasCustomStandardScores ||
      hasCustomManualScores ||
      gearMode !== "strict" ||
      Object.keys(freeChoiceSelections).length > 0 ||
      notes.trim().length > 0
    ),
    [
      alignment,
      background,
      bond,
      charClass,
      flaw,
      hasCustomManualScores,
      hasCustomPointBuyScores,
      hasCustomStandardScores,
      gearMode,
      ideal,
      level,
      name,
      notes,
      personalityTrait,
      race,
      scoreMethod,
      subclass,
      freeChoiceSelections,
    ],
  );

  const clearSelections = useCallback(() => {
    setSection("identity");
    setName("");
    setRace("");
    setCharClass("");
    setSubclass("");
    setLevel(1);
    setBackground("");
    setAlignment("");
    setPersonalityTrait("");
    setIdeal("");
    setBond("");
    setFlaw("");
    setScoreMethod("pointbuy");
    setPbScores(DEFAULT_PB_SCORES);
    setStdScores({});
    setManualScores(DEFAULT_MANUAL_SCORES);
    setGearMode("strict");
    setStrictPackageId("");
    setPresetId("");
    setFreeChoiceSelections({});
    setGearCategory("all");
    setNotes("");
    setShowImport(false);
    setImportPaste("");
    setImportError(null);
  }, []);

  function rollManualAbilityScores() {
    setScoreMethod("manual");
    setManualScores({
      str: String(roll4d6DropLowest()),
      dex: String(roll4d6DropLowest()),
      con: String(roll4d6DropLowest()),
      int: String(roll4d6DropLowest()),
      wis: String(roll4d6DropLowest()),
      cha: String(roll4d6DropLowest()),
    });
  }

  function applySuggestedScores() {
    const priority = getSuggestedPriority(charClass, race);

    if (scoreMethod === "pointbuy") {
      const values = [15, 15, 13, 10, 8, 8];
      const next: Record<ScoreKey, number> = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
      priority.forEach((key, idx) => {
        next[key] = values[idx] ?? 8;
      });

      // Spend any leftover point-buy budget so suggested never leaves points unassigned.
      const usedFrom = (scores: Record<ScoreKey, number>) =>
        (Object.values(scores) as number[]).reduce((sum, s) => sum + (POINT_BUY_COST[s] ?? 0), 0);

      let remaining = POINT_BUY_TOTAL - usedFrom(next);
      if (remaining > 0) {
        for (const key of [...priority].reverse()) {
          while (next[key] < 15 && remaining > 0) {
            const curCost = POINT_BUY_COST[next[key]] ?? 99;
            const nextCost = POINT_BUY_COST[next[key] + 1] ?? 99;
            const delta = nextCost - curCost;
            if (delta <= remaining) {
              next[key] += 1;
              remaining -= delta;
            } else {
              break;
            }
          }
          if (remaining <= 0) break;
        }
      }

      setPbScores(next);
      return;
    }

    if (scoreMethod === "standard") {
      const values = [15, 14, 13, 12, 10, 8];
      const next: Partial<Record<ScoreKey, number>> = {};
      priority.forEach((key, idx) => {
        next[key] = values[idx] ?? 8;
      });
      setStdScores(next);
      return;
    }

    const values = [15, 14, 13, 12, 10, 8];
    const next: Record<ScoreKey, string> = { str: "8", dex: "8", con: "8", int: "8", wis: "8", cha: "8" };
    priority.forEach((key, idx) => {
      next[key] = String(values[idx] ?? 8);
    });
    setManualScores(next);
  }

  const scores = useMemo(
    () => resolvedScores(),
    [scoreMethod, pbScores, stdScores, manualScores],
  );

  const deterministicMaxHp = useMemo(
    () => calcSuggestedHp(charClass, level, scores.con),
    [charClass, level, scores],
  );

  const deterministicAc = useMemo(
    () => calcDeterministicAc(charClass, scores),
    [charClass, scores],
  );

  const movement = useMemo(
    () => calcDeterministicMovement(race),
    [race],
  );

  const deterministicDefensesAndLanguages = useMemo(
    () => deriveDeterministicDefensesAndLanguages({ race, charClass, background, level }),
    [race, charClass, background, level],
  );

  const deterministicLineageTraits = useMemo(
    () => deriveLineageTraits(race),
    [race],
  );

  const backgroundBenefit = useMemo(
    () => BACKGROUND_BENEFITS[background.trim()] ?? null,
    [background],
  );

  const strictGearOptions = useMemo(
    () => {
      const trimmedClass = charClass.trim();
      if (!trimmedClass) return [];
      return getClassStrictPackageOptions(trimmedClass);
    },
    [charClass],
  );

  const presetGearOptions = useMemo(
    () => {
      const trimmedClass = charClass.trim();
      if (!trimmedClass) return [];
      return getClassPresetOptions(trimmedClass);
    },
    [charClass],
  );

  const freeChoiceBudgetGp = useMemo(
    () => {
      const trimmedClass = charClass.trim();
      if (!trimmedClass) return 0;
      return getClassFreeChoiceBudgetGp(trimmedClass);
    },
    [charClass],
  );

  const gearCatalogByName = useMemo(
    () => new Map(buildCreationGearCatalog().map((e) => [e.name, e])),
    [],
  );

  const filteredGearCatalog = useMemo(
    () => filterCreationGearCatalog(gearCategory, { maxRarity: gearMaxRarity }),
    [gearCategory, gearMaxRarity],
  );

  const currentLoadout = useMemo(
    () => buildCreationGearLoadout({
      className: charClass,
      race,
      background,
      mode: gearMode,
      strictPackageId,
      presetId,
      freeChoices: Object.entries(freeChoiceSelections).map(([itemName, quantity]) => ({ name: itemName, quantity })),
    }),
    [background, charClass, freeChoiceSelections, gearMode, presetId, race, strictPackageId],
  );

  useEffect(() => {
    if (!strictGearOptions.length) {
      setStrictPackageId("");
      return;
    }
    if (!strictPackageId || !strictGearOptions.some((option) => option.id === strictPackageId)) {
      setStrictPackageId(strictGearOptions[0].id);
    }
  }, [strictGearOptions, strictPackageId]);

  useEffect(() => {
    if (!presetGearOptions.length) {
      setPresetId("");
      return;
    }
    if (!presetId || !presetGearOptions.some((option) => option.id === presetId)) {
      setPresetId(presetGearOptions[0].id);
    }
  }, [presetGearOptions, presetId]);

  const adjustFreeChoiceItem = useCallback((itemName: string, delta: number) => {
    if (delta > 0) {
      const entry = gearCatalogByName.get(itemName);
      const itemCost = entry?.costGp ?? 0;
      const projectedSpend = currentLoadout.spentGp + itemCost * delta;
      if (!settings.disableStartingGoldCap && projectedSpend > freeChoiceBudgetGp) {
        return; // hard budget cap — cannot afford this addition
      }
    }
    setFreeChoiceSelections((prev) => {
      const nextQty = Math.max(0, (prev[itemName] ?? 0) + delta);
      if (nextQty === 0) {
        const { [itemName]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [itemName]: nextQty,
      };
    });
  }, [gearCatalogByName, currentLoadout.spentGp, freeChoiceBudgetGp, settings.disableStartingGoldCap]);

  function step4Valid(): boolean {
    if (gearMode === "strict") return strictGearOptions.length > 0;
    if (gearMode === "preset") return presetGearOptions.length > 0;
    return true;
  }

  function randomizeGearSelection() {
    const trimmedClass = charClass.trim();
    if (!trimmedClass) return;
    const randomGear = buildRandomCreationGearSelection({
      className: trimmedClass,
      mode: gearMode,
      maxRarity: gearMaxRarity,
      loadPreset: gearLoadPreset,
    });
    setGearMode(randomGear.mode);
    setStrictPackageId(randomGear.strictPackageId);
    setPresetId(randomGear.presetId);
    setGearCategory(randomGear.category);
    setFreeChoiceSelections(
      Object.fromEntries(randomGear.freeChoices.map((choice) => [choice.name, Math.max(1, choice.quantity)])),
    );
  }

  // ── Character creation ──
  async function handleCreate() {
    if (!step1Valid()) {
      Alert.alert("Incomplete", "Please fill in Name, Race, and Class before creating.");
      setSection("identity");
      return;
    }
    if (!step2Valid()) {
      Alert.alert("Incomplete Ability Scores", "Please finish assigning all ability scores.");
      setSection("scores");
      return;
    }
    if (!step4Valid()) {
      Alert.alert("Choose Starting Gear", "Select a valid starting gear option before creating.");
      setSection("gear");
      return;
    }
    setCreating(true);
    try {
      const targetLevel = level; // the level the user selected (may be > 1)
      const prof = profBonus(1); // always start at level 1
      const final = scores;
      const abilityScores: AbilityScores = {
        strength: final.str, dexterity: final.dex, constitution: final.con,
        intelligence: final.int, wisdom: final.wis, charisma: final.cha,
      };

      const classKey = charClass.toLowerCase().trim();
      const saveProfAbilities = CLASS_SAVE_PROFS[classKey] ?? [];

      const savingThrows: SavingThrow[] = ABILITY_KEYS.map((key) => ({
        ability: key,
        proficient: saveProfAbilities.includes(key),
        modifier:
          abilityMod(abilityScores[key]) +
          (saveProfAbilities.includes(key) ? prof : 0),
      }));

      const backgroundSkillChoices = backgroundBenefit?.skills ?? [];
      const classPreferred = CLASS_STAT_TIPS[charClass]?.skills ?? [];
      const classSkillChoices = pickDeterministicClassSkills(charClass, classPreferred, backgroundSkillChoices);
      const proficientSkillSet = new Set(
        [...backgroundSkillChoices, ...classSkillChoices].map((s) => s.toLowerCase()),
      );

      const skills: Skill[] = ALL_SKILLS.map((s) => ({
        name: s.name,
        ability: s.ability,
        proficient: proficientSkillSet.has(s.name.toLowerCase()),
        expertise: false,
        modifier: abilityMod(abilityScores[s.ability]) + (proficientSkillSet.has(s.name.toLowerCase()) ? prof : 0),
      }));

      const deterministicRacialFeatures: ClassFeature[] = deterministicLineageTraits.map((t) => ({
        id: generateId(),
        name: t.name,
        description: t.description,
        source: t.source,
        originKind: "progression_generated",
        explanation: "Seeded from deterministic lineage/class bootstrap at character creation.",
        levelGained: 1,
      }));

      const deterministicClassFeatures: ClassFeature[] = [];
      const deterministicWeaponMasteries: string[] = [];
      if (charClass.trim().toLowerCase() === "barbarian") {
        deterministicClassFeatures.push({
          id: generateId(),
          name: "Weapon Mastery",
          description: "You gain weapon mastery with two melee weapon types of your choice.",
          source: "class",
          levelGained: 1,
        });
        deterministicWeaponMasteries.push("Greataxe", "Javelin");
      }

      const backgroundFeats: Feat[] = backgroundBenefit?.feat
        ? [{ id: generateId(), name: backgroundBenefit.feat.name, description: backgroundBenefit.feat.description, source: `Background: ${background}` }]
        : [];
      const creationLoadout = buildCreationGearLoadout({
        className: charClass,
        race,
        background,
        mode: gearMode,
        strictPackageId,
        presetId,
        freeChoices: Object.entries(freeChoiceSelections).map(([itemName, quantity]) => ({ name: itemName, quantity })),
      });

      // Always build the character at level 1; if targetLevel > 1 we'll run
      // the level-up wizard one step at a time after creation.
      const level1Hp = calcSuggestedHp(charClass, 1, final.con);

      const character: Character = {
        id: generateId(),
        name: name.trim(),
        class: charClass.trim(),
        subclass: subclass.trim() || undefined,
        level: 1,
        race: race.trim(),
        background: background.trim(),
        alignment: alignment.trim() || undefined,
        proficiencyBonus: prof,
        armorClass: deterministicAc,
        currentHp: level1Hp,
        maxHp: level1Hp,
        tempHp: 0,
        speed: movement.walk,
        initiative: abilityMod(abilityScores.dexterity),
        abilityScores,
        savingThrows,
        skills,
        passivePerception: 10 + abilityMod(abilityScores.wisdom),
        personalityTrait: personalityTrait.trim() || undefined,
        ideal: ideal.trim() || undefined,
        bond: bond.trim() || undefined,
        flaw: flaw.trim() || undefined,
        toolProficiencies: deterministicDefensesAndLanguages.toolProficiencies,
        weaponMasteries: deterministicWeaponMasteries,
        languages: deterministicDefensesAndLanguages.languages,
        damageResistances: deterministicDefensesAndLanguages.damageResistances,
        damageImmunities: deterministicDefensesAndLanguages.damageImmunities,
        conditionImmunities: deterministicDefensesAndLanguages.conditionImmunities,
        feats: backgroundFeats,
        currency: creationLoadout.currency,
        notes,
      };

      // --- Use rules engine for features/resources ---
      let classFeatures: ClassFeature[] = [...deterministicClassFeatures];
      let resources = [];
      try {
        // Dynamically import to avoid SSR issues
        const { getClassProgression } = require("../rules/engine");
        const prog = getClassProgression(character);
        classFeatures = [
          ...classFeatures,
          ...prog.features.map((f: any) => ({
            ...f,
            id: generateId(),
            source: f.source || "class",
            originKind: "progression_generated",
            explanation: "Seeded from deterministic progression helper at character creation.",
          })),
        ];
        resources = prog.resources?.map((r: any) => ({
          ...r,
          id: generateId(),
        })) || [];
      } catch (e) {
        // fallback: no features/resources
      }

      const snapshot: CharacterSnapshot = {
        _version: 1,
        character,
        attacks: [],
        resources,
        inventory: creationLoadout.items,
        conditions: [],
        notes: [],
        classFeatures,
        passiveFeatures: deterministicRacialFeatures,
        ...(isDmMode ? {
          quests: dmQuests.filter((q) => linkedQuestIds.includes(q.id)),
          people: dmPeople.filter((p) => linkedPeopleIds.includes(p.id)),
          locations: dmLocations.filter((l) => linkedLocationIds.includes(l.id)),
          realms: dmPlanes.filter((p) => linkedPlaneIds.includes(p.id)),
        } : {}),
      };

      await saveCharacter(snapshot);
      loadCharacter(snapshot);
      if (targetLevel > 1) {
        queueLevelUps(targetLevel - 1);
      }
      parseBackstory(notes);
      router.replace("/(tabs)");
    } catch (err) {
      console.error("Failed to create character", err);
      setCreating(false);
    }
  }

  const topPad = Platform.OS === "web" ? 16 : insets.top;
  const showFieldHelp = useCallback((label: string, hint?: string) => {
    const body = CREATE_CHARACTER_HELP[label] ?? hint ?? "This field controls part of your character build and can be changed before final creation.";
    showHelp(label, body);
  }, [showHelp]);

  useEffect(() => {
    if (!motionEnabled) {
      stepAnim.setValue(1);
      return;
    }
    stepAnim.setValue(0);
    Animated.timing(stepAnim, {
      toValue: 1,
      duration: motionDuration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
  }, [motionDuration, motionEnabled, showImport, section, stepAnim, useNativeDriver]);

  return (
    <CharacterHelpContext.Provider value={showFieldHelp}>
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: c.border }]}> 
        <TouchableOpacity
          onPress={() => {
            if (showImport) { setShowImport(false); setImportError(null); return; }
            router.back();
          }}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: c.foreground }]}>
            {showImport ? "Import JSON" : "New Character"}
          </Text>
          <Text style={[styles.headerSub, { color: c.mutedForeground }]}>
            {showImport ? "Paste or pick a character JSON file" : "Build your character"}
          </Text>
        </View>
        {!showImport && (
          <View style={{ flexDirection: "row", gap: 6 }}>
            {hasDraftSelections && (
              <TouchableOpacity
                onPress={clearSelections}
                style={[styles.importHeaderBtn, { backgroundColor: c.card, borderColor: c.border }]}
              >
                <Feather name="x-circle" size={15} color={c.mutedForeground} />
                <Text style={[styles.importHeaderBtnText, { color: c.mutedForeground }]}>Clear</Text>
              </TouchableOpacity>
            )}
            {section === "identity" && (
              <TouchableOpacity
                onPress={rollCharacterIdentity}
                style={[styles.importHeaderBtn, { backgroundColor: c.primary, borderColor: c.primary }]}
              >
                <Feather name="shuffle" size={15} color="#fff" />
                <Text style={[styles.importHeaderBtnText, { color: "#fff" }]}>Randomize</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => { setShowImport(true); setImportError(null); setImportPaste(""); }}
              style={[styles.importHeaderBtn, { backgroundColor: c.primary, borderColor: c.primary }]}
            >
              <Feather name="upload" size={15} color="#fff" />
              <Text style={[styles.importHeaderBtnText, { color: "#fff" }]}>Import JSON</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Tab bar — hidden during import */}
      {!showImport && (
        <View style={[styles.tabRow, { borderBottomColor: c.border, backgroundColor: c.card }]}>
          {CREATOR_TABS.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setSection(t.id)}
              style={[styles.tab, { borderBottomColor: section === t.id ? c.primary : "transparent" }]}
            >
              <Text style={[styles.tabText, { color: section === t.id ? c.primary : c.mutedForeground }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollHintScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 64 : 80) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={{
            opacity: stepAnim,
            transform: [
              {
                translateY: stepAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [motionIntensity === "subtle" ? 5 : 10, 0],
                }),
              },
            ],
          }}
        >
        {/* ── Import JSON panel ── */}
        {showImport && (
          <View style={styles.stepContent}>
            <TouchableOpacity
              onPress={handlePickImportFile}
              disabled={importBusy}
              activeOpacity={0.8}
              style={[styles.importPickBtn, { backgroundColor: c.primary, borderRadius: colors.radius * 1.5 }]}
            >
              <Feather name="file-text" size={18} color="#FFFFFF" />
              <Text style={styles.importPickBtnText}>
                {importBusy ? "Reading file…" : "Pick JSON File"}
              </Text>
            </TouchableOpacity>

            <View style={styles.importOrRow}>
              <View style={[styles.importOrLine, { backgroundColor: c.border }]} />
              <Text style={[styles.importOrText, { color: c.mutedForeground }]}>or paste JSON below</Text>
              <View style={[styles.importOrLine, { backgroundColor: c.border }]} />
            </View>

            <TextInput
              value={importPaste}
              onChangeText={(v) => { setImportPaste(v); setImportError(null); }}
              multiline
              numberOfLines={10}
              placeholder={"Paste character JSON here…\n\nBoth snapshot format and bare character objects are supported."}
              placeholderTextColor={c.mutedForeground}
              style={[
                styles.importPasteInput,
                { color: c.foreground, backgroundColor: c.card, borderColor: importError ? "#EF4444" : c.border },
              ]}
            />

            {importError && (
              <View style={[styles.importError, { backgroundColor: "#EF444420", borderColor: "#EF4444" }]}>
                <Feather name="alert-circle" size={14} color="#EF4444" />
                <Text style={[styles.importErrorText, { color: "#EF4444" }]}>{importError}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleImportLoad}
              disabled={!importPaste.trim()}
              activeOpacity={importPaste.trim() ? 0.8 : 0.4}
              style={[
                styles.importLoadBtn,
                {
                  backgroundColor: importPaste.trim() ? "#10B981" : c.muted,
                  borderRadius: colors.radius * 1.5,
                },
              ]}
            >
              <Feather name="check" size={18} color={importPaste.trim() ? "#FFFFFF" : c.mutedForeground} />
              <Text style={[styles.importLoadBtnText, { color: importPaste.trim() ? "#FFFFFF" : c.mutedForeground }]}>
                Load Character
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setShowImport(false); setImportError(null); setImportPaste(""); }}
              style={styles.importCancelBtn}
            >
              <Text style={[styles.importCancelText, { color: c.mutedForeground }]}>
                Cancel — go back to wizard
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!showImport && section === "identity" && (
          <Step1
            name={name} setName={setName}
            race={race} setRace={setRace}
            charClass={charClass} setCharClass={setCharClass}
            subclass={subclass} setSubclass={setSubclass}
            level={level} setLevel={setLevel}
            background={background} setBackground={setBackground}
            alignment={alignment} setAlignment={setAlignment}
            personalityTrait={personalityTrait} setPersonalityTrait={setPersonalityTrait}
            ideal={ideal} setIdeal={setIdeal}
            bond={bond} setBond={setBond}
            flaw={flaw} setFlaw={setFlaw}
            lineageTraits={deterministicLineageTraits}
            backgroundBenefit={backgroundBenefit}
          />
        )}
        {!showImport && section === "scores" && (
          <Step2
            race={race}
            charClass={charClass}
            scoreMethod={scoreMethod} setScoreMethod={setScoreMethod}
            pbScores={pbScores} pbUsedPoints={pbUsedPoints()}
            pbCanIncrease={pbCanIncrease} pbCanDecrease={pbCanDecrease} pbAdjust={pbAdjust}
            stdScores={stdScores} stdAssignValue={stdAssignValue} stdIsAvailable={stdIsAvailable}
            manualScores={manualScores}
            setManualScores={setManualScoreCapped}
            onRollManual={rollManualAbilityScores}
            onApplySuggested={applySuggestedScores}
          />
        )}
        {!showImport && section === "gear" && (
          <Step4Gear
            className={charClass}
            mode={gearMode}
            setMode={setGearMode}
            onRandomize={randomizeGearSelection}
            strictOptions={strictGearOptions}
            strictPackageId={strictPackageId}
            setStrictPackageId={setStrictPackageId}
            presetOptions={presetGearOptions}
            presetId={presetId}
            setPresetId={setPresetId}
            budgetGp={freeChoiceBudgetGp}
            spentGp={currentLoadout.spentGp}
            catalog={filteredGearCatalog}
            category={gearCategory}
            setCategory={setGearCategory}
            loadPreset={gearLoadPreset}
            setLoadPreset={setGearLoadPreset}
            maxRarity={gearMaxRarity}
            setMaxRarity={setGearMaxRarity}
            freeSelections={freeChoiceSelections}
            onAdjustFreeItem={adjustFreeChoiceItem}
          />
        )}
        {!showImport && section === "stats" && (
          <Step3
            race={race}
            charClass={charClass} level={level}
            maxHp={deterministicMaxHp}
            ac={deterministicAc}
            speed={movement.walk}
            flySpeed={movement.fly}
            languages={deterministicDefensesAndLanguages.languages}
            tools={deterministicDefensesAndLanguages.toolProficiencies}
            damageResistances={deterministicDefensesAndLanguages.damageResistances}
            damageImmunities={deterministicDefensesAndLanguages.damageImmunities}
            conditionImmunities={deterministicDefensesAndLanguages.conditionImmunities}
            notes={notes} setNotes={setNotes}
          />
        )}
        {!showImport && section === "quest" && isDmMode && (
          <View style={styles.stepContent}>
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={[styles.questTieInIntro, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.fieldLabel, { color: c.foreground }]}>Quest Tie-In (Optional)</Text>
                <Text style={[styles.hintText, { color: c.mutedForeground }]}>Attach this character to campaign quests, people, locations, and planes.</Text>
              </View>

              {dmQuests.length > 0 && (
                <View style={styles.tagSection}>
                  <Text style={[styles.tagSectionLabel, { color: c.foreground }]}>Quests ({linkedQuestIds.length})</Text>
                  <View style={styles.chipRow}>
                    {dmQuests.map((quest) => {
                      const sel = linkedQuestIds.includes(quest.id);
                      return (
                        <TouchableOpacity
                          key={quest.id}
                          onPress={() => setLinkedQuestIds((prev) => sel ? prev.filter((id) => id !== quest.id) : [...prev, quest.id])}
                          style={[styles.chip, { backgroundColor: sel ? c.primary + "22" : c.card, borderColor: sel ? c.primary : c.border }]}
                        >
                          <Text style={[styles.chipText, { color: sel ? c.primary : c.mutedForeground }]}>{quest.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {dmPeople.length > 0 && (
                <View style={styles.tagSection}>
                  <Text style={[styles.tagSectionLabel, { color: c.foreground }]}>People ({linkedPeopleIds.length})</Text>
                  <View style={styles.chipRow}>
                    {dmPeople.map((person) => {
                      const sel = linkedPeopleIds.includes(person.id);
                      return (
                        <TouchableOpacity
                          key={person.id}
                          onPress={() => setLinkedPeopleIds((prev) => sel ? prev.filter((id) => id !== person.id) : [...prev, person.id])}
                          style={[styles.chip, { backgroundColor: sel ? c.primary + "22" : c.card, borderColor: sel ? c.primary : c.border }]}
                        >
                          <Text style={[styles.chipText, { color: sel ? c.primary : c.mutedForeground }]}>{person.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {dmLocations.length > 0 && (
                <View style={styles.tagSection}>
                  <Text style={[styles.tagSectionLabel, { color: c.foreground }]}>Locations ({linkedLocationIds.length})</Text>
                  <View style={styles.chipRow}>
                    {dmLocations.map((location) => {
                      const sel = linkedLocationIds.includes(location.id);
                      return (
                        <TouchableOpacity
                          key={location.id}
                          onPress={() => setLinkedLocationIds((prev) => sel ? prev.filter((id) => id !== location.id) : [...prev, location.id])}
                          style={[styles.chip, { backgroundColor: sel ? c.primary + "22" : c.card, borderColor: sel ? c.primary : c.border }]}
                        >
                          <Text style={[styles.chipText, { color: sel ? c.primary : c.mutedForeground }]}>{location.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {dmPlanes.length > 0 && (
                <View style={styles.tagSection}>
                  <Text style={[styles.tagSectionLabel, { color: c.foreground }]}>Planes ({linkedPlaneIds.length})</Text>
                  <View style={styles.chipRow}>
                    {dmPlanes.map((plane) => {
                      const sel = linkedPlaneIds.includes(plane.id);
                      return (
                        <TouchableOpacity
                          key={plane.id}
                          onPress={() => setLinkedPlaneIds((prev) => sel ? prev.filter((id) => id !== plane.id) : [...prev, plane.id])}
                          style={[styles.chip, { backgroundColor: sel ? c.primary + "22" : c.card, borderColor: sel ? c.primary : c.border }]}
                        >
                          <Text style={[styles.chipText, { color: sel ? c.primary : c.mutedForeground }]}>{plane.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {dmQuests.length === 0 && dmPeople.length === 0 && dmLocations.length === 0 && dmPlanes.length === 0 && (
                <Text style={[styles.hintText, { color: c.mutedForeground, marginTop: 10 }]}>No DM notes entities found yet. Add quests, people, locations, or planes in DM Notes.</Text>
              )}
            </View>
          </View>
        )}
        {!showImport && section === "review" && (
          <Step4
            name={name}
            race={race}
            charClass={charClass}
            subclass={subclass}
            level={level}
            background={background}
            alignment={alignment}
            scores={scores}
            maxHp={deterministicMaxHp}
            ac={deterministicAc}
            speed={movement.walk}
            flySpeed={movement.fly}
            notes={notes}
            languages={deterministicDefensesAndLanguages.languages}
            tools={deterministicDefensesAndLanguages.toolProficiencies}
            damageResistances={deterministicDefensesAndLanguages.damageResistances}
            damageImmunities={deterministicDefensesAndLanguages.damageImmunities}
            conditionImmunities={deterministicDefensesAndLanguages.conditionImmunities}
            personalityTrait={personalityTrait}
            ideal={ideal}
            bond={bond}
            flaw={flaw}
            loadout={currentLoadout}
          />
        )}
        </Animated.View>
      </ScrollHintScrollView>

      {/* Create Character button — only on review tab */}
      {!showImport && section === "review" && (
        <View style={[styles.bottomNav, { borderTopColor: c.border, backgroundColor: c.background, paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            onPress={handleCreate}
            disabled={creating}
            activeOpacity={0.85}
            style={[styles.nextBtn, { backgroundColor: "#10B981", borderRadius: colors.radius * 1.5 }]}
          >
            <Feather name="check" size={18} color="#FFFFFF" />
            <Text style={[styles.nextBtnText, { color: "#FFFFFF" }]}>
              {creating ? "Creating…" : "Create Character"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {helpPopup}
    </View>
    </CharacterHelpContext.Provider>
  );
}

// ─── Step 1: Identity ─────────────────────────────────────────────────────────

function Step1({
  name, setName, race, setRace, charClass, setCharClass,
  subclass, setSubclass, level, setLevel, background, setBackground,
  alignment, setAlignment,
  personalityTrait, setPersonalityTrait, ideal, setIdeal, bond, setBond, flaw, setFlaw,
  lineageTraits, backgroundBenefit,
}: {
  name: string; setName: (v: string) => void;
  race: string; setRace: (v: string) => void;
  charClass: string; setCharClass: (v: string) => void;
  subclass: string; setSubclass: (v: string) => void;
  level: number; setLevel: (v: number) => void;
  background: string; setBackground: (v: string) => void;
  alignment: string; setAlignment: (v: string) => void;
  personalityTrait: string; setPersonalityTrait: (v: string) => void;
  ideal: string; setIdeal: (v: string) => void;
  bond: string; setBond: (v: string) => void;
  flaw: string; setFlaw: (v: string) => void;
  lineageTraits: Array<{ name: string; description: string; source: string }>;
  backgroundBenefit: BackgroundBenefit | null;
}) {
  const c = useColors();
  const [raceGroup, setRaceGroup] = useState(RACE_GROUPS[0].label);
  const [open5eBgModal, setOpen5eBgModal] = useStateReact(false);
  const [activeParent, setActiveParent] = useState<string | null>(null);
  const [showAllBg, setShowAllBg] = useState(false);

  const currentGroup = useMemo(
    () => RACE_GROUPS.find((g) => g.label === raceGroup) ?? RACE_GROUPS[0],
    [raceGroup],
  );

  const selectedParentRace = useMemo(() => {
    for (const g of RACE_GROUPS) {
      for (const r of g.races) {
        if (r.base === race || r.subraces?.includes(race)) return r;
      }
    }
    return null;
  }, [race]);

  const expandedParentData = useMemo(
    () => RACE_GROUPS.flatMap((g) => g.races).find((r) => r.base === activeParent) ?? null,
    [activeParent],
  );

  const selectedClassEntry = useMemo(
    () => ALL_CLASSES.find((cl) => cl.name === charClass) ?? null,
    [charClass],
  );

  const selectedRaceDescription = useMemo(
    () => resolveRaceDescription(race),
    [race],
  );

  const selectedClassDescription = useMemo(
    () => resolveClassDescription(charClass),
    [charClass],
  );

  const selectedSubclassDescription = useMemo(
    () => resolveSubclassDescription(subclass, charClass),
    [subclass, charClass],
  );

  return (
    <View style={styles.stepContent}>
      {/* Open5e Backgrounds Modal */}
      <Modal
        visible={open5eBgModal}
        animationType="slide"
        onRequestClose={() => setOpen5eBgModal(false)}
      >
        <Open5eBackgroundPicker
          onSelect={(bg) => {
            setBackground(bg.name);
            setOpen5eBgModal(false);
          }}
          onClose={() => setOpen5eBgModal(false)}
        />
      </Modal>
      {/* ── Character Name ── */}
      <FormField label="Character Name" required>
        <View style={styles.inlineInputRow}>
          <FormInput value={name} onChangeText={setName} placeholder="e.g. Lyra Shadowstep" style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => {
              const rolledGender = roll(NPC_GENDERS);
              setName(generateRandomName({ gender: rolledGender }).fullName);
            }}
            style={[styles.inlineRollBtn, { backgroundColor: c.primary + "20", borderColor: c.primary + "60" }]}
          >
            <Text style={[styles.inlineRollBtnText, { color: c.primary }]}>🎲</Text>
          </TouchableOpacity>
        </View>
      </FormField>

      {/* ── Race ── */}
      <FormField label="Race" required>
        {/* Source group tabs */}
        <View style={[styles.groupTabPanel, { backgroundColor: c.secondary, borderColor: c.border }]}> 
          <Text style={[styles.groupTabHeading, { color: c.mutedForeground }]}>Race source filter</Text>
          <View style={styles.groupTabRow}>
            {RACE_GROUPS.map((g) => {
              const active = raceGroup === g.label;
              const iconName = g.label.toLowerCase().includes("core") ? "book-open" : "layers";
              return (
                <TouchableOpacity
                  key={g.label}
                  onPress={() => { setRaceGroup(g.label); setActiveParent(null); }}
                  style={[
                    styles.groupTab,
                    {
                      backgroundColor: active ? c.primary : c.background,
                      borderColor: active ? c.primary : c.border,
                    },
                  ]}
                >
                  <Feather name={iconName} size={12} color={active ? "#fff" : c.mutedForeground} />
                  <Text style={[styles.groupTabText, { color: active ? "#fff" : c.mutedForeground }]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.groupTabHint, { color: c.mutedForeground }]}>Filters the race list below</Text>
        </View>

        {/* Race chips for selected group */}
        <View style={styles.chipRow}>
          {currentGroup.races.map((r) => {
            const isParentSelected = selectedParentRace?.base === r.base;
            const isExpanded = activeParent === r.base;
            const hasSubraces = (r.subraces?.length ?? 0) > 0;
            return (
              <TouchableOpacity
                key={r.base}
                onPress={() => {
                  if (hasSubraces) {
                    setActiveParent(isExpanded ? null : r.base);
                  } else {
                    setRace(r.base);
                    setActiveParent(null);
                  }
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isParentSelected ? c.primary + "25" : c.card,
                    borderColor: isParentSelected ? c.primary : c.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: isParentSelected ? c.primary : c.mutedForeground }]}>
                  {r.base}{hasSubraces ? " ▾" : ""}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Subrace chips (shown when a parent is expanded) */}
        {activeParent && expandedParentData?.subraces && (
          <View style={{ gap: 6 }}>
            <Text style={[styles.fieldHint, { color: c.primary, marginTop: 2 }]}>
              Choose your {activeParent} subrace:
            </Text>
            <View style={styles.chipRow}>
              {expandedParentData.subraces.map((sr) => (
                <TouchableOpacity
                  key={sr}
                  onPress={() => { setRace(sr); setActiveParent(null); }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: race === sr ? c.primary + "25" : c.secondary,
                      borderColor: race === sr ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: race === sr ? c.primary : c.foreground }]}>
                    {sr}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Selected badge or custom input */}
        {race ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[styles.chip, { backgroundColor: c.primary + "20", borderColor: c.primary }]}>
                <Text style={[styles.chipText, { color: c.primary }]}>✓ {race}</Text>
              </View>
              <TouchableOpacity onPress={() => { setRace(""); setActiveParent(null); }}>
                <Text style={{ color: c.mutedForeground, fontSize: 12 }}>clear</Text>
              </TouchableOpacity>
            </View>
            {selectedRaceDescription && (
              <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <Feather name="info" size={12} color={c.mutedForeground} style={{ marginTop: 1, flexShrink: 0 }} />
                <Text style={[styles.infoCardText, { color: c.mutedForeground }]}>{selectedRaceDescription}</Text>
              </View>
            )}
            {lineageTraits.length > 0 && (
              <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}> 
                <Feather name="star" size={12} color={c.primary} style={{ marginTop: 2, flexShrink: 0 }} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.fieldHint, { color: c.primary }]}>Lineage Traits</Text>
                  {lineageTraits.map((trait) => (
                    <Text key={`${trait.source}-${trait.name}`} style={[styles.infoCardText, { color: c.mutedForeground }]}>• {trait.name}: {trait.description}</Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : (
          <FormInput value={race} onChangeText={setRace} placeholder="Or type a custom race…" />
        )}
      </FormField>

      {/* ── Class ── */}
      <FormField label="Class" required>
        <ChipRow
          chips={ALL_CLASSES.map((cl) => cl.name)}
          onSelect={(v) => { setCharClass(v); setSubclass(""); }}
          selected={charClass}
        />

        {/* Class description tooltip */}
        {selectedClassDescription && (
          <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Feather name="info" size={12} color={c.mutedForeground} style={{ marginTop: 1, flexShrink: 0 }} />
            <Text style={[styles.infoCardText, { color: c.mutedForeground }]}>{selectedClassDescription}</Text>
          </View>
        )}

        {/* Subclass picker — appears when a class is chosen */}
        {selectedClassEntry && (
          <View style={{ gap: 6, marginTop: 4 }}>
            <Text style={[styles.fieldHint, { color: c.primary }]}>
              {selectedClassEntry.subclassLabel ?? "Subclass"} — optional
            </Text>
            <View style={styles.chipRow}>
              {selectedClassEntry.subclasses.map((sc) => (
                <TouchableOpacity
                  key={sc}
                  onPress={() => setSubclass(subclass === sc ? "" : sc)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: subclass === sc ? c.primary + "25" : c.card,
                      borderColor: subclass === sc ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: subclass === sc ? c.primary : c.mutedForeground }]}>
                    {sc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {subclass ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.chip, { backgroundColor: c.primary + "20", borderColor: c.primary }]}>
                  <Text style={[styles.chipText, { color: c.primary }]}>✓ {subclass}</Text>
                </View>
                <TouchableOpacity onPress={() => setSubclass("")}>
                  <Text style={{ color: c.mutedForeground, fontSize: 12 }}>clear</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FormInput value={subclass} onChangeText={setSubclass} placeholder="Or type a custom subclass…" />
            )}
            {selectedSubclassDescription ? (
              <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <Feather name="book-open" size={12} color={c.mutedForeground} style={{ marginTop: 1, flexShrink: 0 }} />
                <Text style={[styles.infoCardText, { color: c.mutedForeground }]}>{selectedSubclassDescription}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Custom class — show subclass input if class typed manually */}
        {!selectedClassEntry && charClass !== "" && (
          <View style={{ gap: 6, marginTop: 4 }}>
            <Text style={[styles.fieldHint, { color: c.mutedForeground }]}>Subclass (optional)</Text>
            <FormInput value={subclass} onChangeText={setSubclass} placeholder="e.g. Thief, Arcane Trickster" />
          </View>
        )}
      </FormField>

      {/* ── Level ── */}
      <FormField label={`Level · ${level}`}>
        <View style={styles.levelRow}>
          {[...Array(20)].map((_, i) => {
            const lv = i + 1;
            return (
              <TouchableOpacity
                key={lv}
                onPress={() => setLevel(lv)}
                style={[
                  styles.levelChip,
                  {
                    backgroundColor: level === lv ? c.primary : c.card,
                    borderColor: level === lv ? c.primary : c.border,
                  },
                ]}
              >
                <Text style={[styles.levelChipText, { color: level === lv ? "#FFFFFF" : c.mutedForeground }]}>
                  {lv}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </FormField>

      {/* ── Background ── */}
      <FormField label="Background" hint="Optional · affects roleplay & skills">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <FormInput value={background} onChangeText={setBackground} placeholder="Or type a custom background…" style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => setOpen5eBgModal(true)}
            style={[styles.chip, { backgroundColor: c.secondary, borderColor: c.primary }]}
          >
            <Text style={[styles.chipText, { color: c.primary }]}>Browse Open5e</Text>
          </TouchableOpacity>
        </View>
        {backgroundBenefit && (
          <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}> 
            <Feather name="book-open" size={12} color={c.primary} style={{ marginTop: 1, flexShrink: 0 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.infoCardText, { color: c.mutedForeground }]}>Skills: {(backgroundBenefit.skills ?? []).join(", ") || "None"}</Text>
              <Text style={[styles.infoCardText, { color: c.mutedForeground }]}>Tools: {(backgroundBenefit.tools ?? []).join(", ") || "None"}</Text>
              <Text style={[styles.infoCardText, { color: c.mutedForeground }]}>Languages: {(backgroundBenefit.languages ?? []).join(", ") || "None"}</Text>
              {backgroundBenefit.feat && <Text style={[styles.infoCardText, { color: c.mutedForeground }]}>Bonus Feat: {backgroundBenefit.feat.name}</Text>}
            </View>
          </View>
        )}
      </FormField>

      <FormField label="Alignment" hint="Optional · roleplay shorthand">
        <ChipRow
          chips={[
            "Lawful Good",
            "Neutral Good",
            "Chaotic Good",
            "Lawful Neutral",
            "True Neutral",
            "Chaotic Neutral",
            "Lawful Evil",
            "Neutral Evil",
            "Chaotic Evil",
          ]}
          onSelect={(value) => setAlignment(alignment === value ? "" : value)}
          selected={alignment}
        />
        <FormInput value={alignment} onChangeText={setAlignment} placeholder="Or type a custom alignment…" />
      </FormField>

      <FormField label="Background Personality" hint="Used for roleplay and exported with your character">
        <FormInput value={personalityTrait} onChangeText={setPersonalityTrait} placeholder="Trait (e.g. I always make eye contact when speaking)" />
        <FormInput value={ideal} onChangeText={setIdeal} placeholder="Ideal (e.g. Charity — I always help those in need)" />
        <FormInput value={bond} onChangeText={setBond} placeholder="Bond (e.g. I protect my village at all costs)" />
        <FormInput value={flaw} onChangeText={setFlaw} placeholder="Flaw (e.g. I trust people too easily)" />
      </FormField>

    </View>
  );
}


// ─── Step 2: Ability Scores ───────────────────────────────────────────────────

// type Step2Props = {
//   charClass: string;
//   scoreMethod: "pointbuy" | "standard" | "manual";
//   setScoreMethod: (v: "pointbuy" | "standard" | "manual") => void;
//   pbScores: Record<ScoreKey, number>;
//   pbUsedPoints: number;
//   pbCanIncrease: (k: ScoreKey) => boolean;
//   pbCanDecrease: (k: ScoreKey) => boolean;
//   pbAdjust: (k: ScoreKey, d: number) => void;
//   stdScores: Partial<Record<ScoreKey, number>>;
//   stdAssignValue: (k: ScoreKey, v: number) => void;
//   stdIsAvailable: (v: number, k: ScoreKey) => boolean;
//   manualScores: Record<ScoreKey, string>;
//   setManualScores: (k: ScoreKey, v: string) => void;
// };

function Step2(props: any) {
  const {
    race,
    charClass,
    scoreMethod, setScoreMethod,
    pbScores, pbUsedPoints, pbCanIncrease, pbCanDecrease, pbAdjust,
    stdScores, stdAssignValue, stdIsAvailable,
    manualScores, setManualScores,
    onRollManual,
    onApplySuggested,
  } = props;
  const c = useColors();
  const SCORE_KEYS: ScoreKey[] = ["str", "dex", "con", "int", "wis", "cha"];
  const tip = charClass ? CLASS_STAT_TIPS[charClass] : undefined;
  const manualTotalUsed = (Object.values(manualScores) as string[]).reduce((sum, value) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return sum;
    return sum + parsed;
  }, 0);
  const manualRemaining = MANUAL_SCORE_TOTAL_MAX - manualTotalUsed;

  return (
    <View style={styles.stepContent}>
      {/* Class tip */}
      {tip && (
        <View style={[styles.classTipCard, { backgroundColor: c.primary + "12", borderColor: c.primary + "35" }]}>
          <View style={styles.classTipHeader}>
            <Feather name="zap" size={13} color={c.primary} />
            <Text style={[styles.classTipTitle, { color: c.primary }]}>{charClass} — stat priority</Text>
          </View>
          <View style={styles.classTipRow}>
            <Text style={[styles.classTipLabel, { color: c.mutedForeground }]}>Primary</Text>
            <Text style={[styles.classTipValue, { color: c.foreground }]}>{tip.primary.join(" · ")}</Text>
          </View>
          <View style={styles.classTipRow}>
            <Text style={[styles.classTipLabel, { color: c.mutedForeground }]}>Also useful</Text>
            <Text style={[styles.classTipValue, { color: c.foreground }]}>{tip.also.join(" · ")}</Text>
          </View>
          <View style={styles.classTipRow}>
            <Text style={[styles.classTipLabel, { color: c.mutedForeground }]}>Key skills</Text>
            <Text style={[styles.classTipValue, { color: c.foreground }]}>{tip.skills.join(" · ")}</Text>
          </View>
          {tip.note && (
            <Text style={[styles.classTipNote, { color: c.mutedForeground }]}>{tip.note}</Text>
          )}
        </View>
      )}
      {/* Method picker */}
      <FormField label="Score Method">
        <View style={styles.methodRow}>
          {(["pointbuy", "standard", "manual"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setScoreMethod(m)}
              style={[
                styles.methodBtn,
                {
                  backgroundColor: scoreMethod === m ? c.primary : c.card,
                  borderColor: scoreMethod === m ? c.primary : c.border,
                },
              ]}
            >
              <Text style={[styles.methodBtnText, { color: scoreMethod === m ? "#FFFFFF" : c.mutedForeground }]}>
                {m === "pointbuy" ? "Point Buy" : m === "standard" ? "Standard Array" : "Manual"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.methodActionsRow}>
          <TouchableOpacity
            onPress={onApplySuggested}
            style={[styles.quickRollBtn, { borderColor: c.border, backgroundColor: c.card }]}
          >
            <Feather name="cpu" size={14} color={c.primary} />
            <Text style={[styles.quickRollBtnText, { color: c.primary }]}>Take Suggested (AI)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onRollManual}
            style={[styles.quickRollBtn, { borderColor: c.border, backgroundColor: c.card }]}
          >
            <Feather name="shuffle" size={14} color={c.primary} />
            <Text style={[styles.quickRollBtnText, { color: c.primary }]}>Roll 4d6 For All Stats</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.hintText, { color: c.mutedForeground }]}>Suggestions prioritize {charClass || "your class"} and {race || "your race"}.</Text>
      </FormField>

      {/* Point Buy */}
      {scoreMethod === "pointbuy" && (
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.pbHeader}>
            <Text style={[styles.pbTitle, { color: c.foreground }]}>Point Buy</Text>
            <View style={[styles.pbPoints, { backgroundColor: c.background }]}>
              <Text style={[styles.pbPointsText, { color: POINT_BUY_TOTAL - pbUsedPoints < 0 ? "#EF4444" : c.primary }]}>
                {POINT_BUY_TOTAL - pbUsedPoints} pts left
              </Text>
            </View>
          </View>
          {SCORE_KEYS.map((key) => (
            <View key={key} style={styles.scoreRow}>
              <Text style={[styles.scoreLabel, { color: c.mutedForeground }]}>
                {ABILITY_LABELS[SCORE_KEY_MAP[key]]}
              </Text>
              <TouchableOpacity
                onPress={() => pbAdjust(key, -1)}
                disabled={!pbCanDecrease(key)}
                style={[styles.scoreBtn, { borderColor: c.border, opacity: pbCanDecrease(key) ? 1 : 0.3 }]}
              >
                <Feather name="minus" size={14} color={c.foreground} />
              </TouchableOpacity>
              <View style={[styles.scoreVal, { backgroundColor: c.background }]}>
                <Text style={[styles.scoreValText, { color: c.foreground }]}>{pbScores[key]}</Text>
                <Text style={[styles.scoreModText, { color: c.primary }]}>
                  {modStr(abilityMod(pbScores[key]))}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => pbAdjust(key, 1)}
                disabled={!pbCanIncrease(key)}
                style={[styles.scoreBtn, { borderColor: c.border, opacity: pbCanIncrease(key) ? 1 : 0.3 }]}
              >
                <Feather name="plus" size={14} color={c.foreground} />
              </TouchableOpacity>
              <Text style={[styles.scoreCost, { color: c.mutedForeground }]}>
                cost: {POINT_BUY_COST[pbScores[key]] ?? "?"}
              </Text>
            </View>
          ))}
          <Text style={[styles.hintText, { color: c.mutedForeground }]}>
            Scores 8–15 • Racial bonuses applied at the table
          </Text>
        </View>
      )}

      {/* Standard Array */}
      {scoreMethod === "standard" && (
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.pbTitle, { color: c.foreground }]}>Standard Array: 15, 14, 13, 12, 10, 8</Text>
          <Text style={[styles.hintText, { color: c.mutedForeground }]}>
            Tap a score value to assign it to each ability score.
          </Text>
          {SCORE_KEYS.map((key) => {
            const abilityKey = SCORE_KEY_MAP[key];
            const assigned = stdScores[key];
            return (
              <View key={key} style={styles.stdRow}>
                <Text style={[styles.scoreLabel, { color: c.mutedForeground }]}>
                  {ABILITY_LABELS[abilityKey]}
                </Text>
                <View style={styles.stdChips}>
                  {STANDARD_ARRAY.map((val) => {
                    const isAssigned = stdScores[key] === val;
                    const isUnavailable = !stdIsAvailable(val, key);
                    return (
                      <TouchableOpacity
                        key={val}
                        onPress={() => stdAssignValue(key, val)}
                        style={[
                          styles.stdChip,
                          {
                            backgroundColor: isAssigned
                              ? c.primary
                              : isUnavailable
                              ? c.background
                              : c.secondary,
                            borderColor: isAssigned ? c.primary : c.border,
                            opacity: isUnavailable && !isAssigned ? 0.35 : 1,
                          },
                        ]}
                      >
                        <Text style={[
                          styles.stdChipText,
                          { color: isAssigned ? "#FFFFFF" : c.foreground }
                        ]}>
                          {val}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {assigned !== undefined && (
                  <Text style={[styles.scoreModText, { color: c.primary }]}>
                    {modStr(abilityMod(assigned))}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Manual */}
      {scoreMethod === "manual" && (
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.pbHeader}>
            <Text style={[styles.pbTitle, { color: c.foreground }]}>Manual Entry</Text>
            <View style={[styles.pbPoints, { backgroundColor: c.background }]}>
              <Text style={[styles.pbPointsText, { color: manualRemaining < 0 ? "#EF4444" : c.primary }]}>
                {manualRemaining} pts left
              </Text>
            </View>
          </View>
          <Text style={[styles.hintText, { color: c.mutedForeground }]}>
            Enter scores manually: each score {MANUAL_SCORE_MIN}-{MANUAL_SCORE_MAX}, total no higher than {MANUAL_SCORE_TOTAL_MAX}.
          </Text>
          {SCORE_KEYS.map((key) => {
            const abilityKey = SCORE_KEY_MAP[key];
            const parsed = parseInt(manualScores[key], 10);
            const mod = !isNaN(parsed) ? abilityMod(parsed) : null;
            return (
              <View key={key} style={styles.scoreRow}>
                <Text style={[styles.scoreLabel, { color: c.mutedForeground }]}>
                  {ABILITY_LABELS[abilityKey]}
                </Text>
                <TextInput
                  value={manualScores[key]}
                  onChangeText={(v) => setManualScores(key, v)}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[
                    styles.manualInput,
                    {
                      color: c.foreground,
                      backgroundColor: c.background,
                      borderColor: c.border,
                    },
                  ]}
                />
                {mod !== null && (
                  <Text style={[styles.scoreModText, { color: c.primary }]}>
                    {modStr(mod)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Step 3: Starting Stats ───────────────────────────────────────────────────


// type Step3Props = {
//   charClass: string; level: number;
//   maxHp: number; setMaxHp: (v: number) => void;
//   ac: number; setAc: (v: number) => void;
//   speed: number; setSpeed: (v: number) => void;
//   notes: string; setNotes: (v: string) => void;
//   suggestedHp: number; onResetHp: () => void;
// };
function Step3(props: any) {
  const {
    race, charClass, level, maxHp, ac, speed, flySpeed,
    languages, tools, damageResistances, damageImmunities, conditionImmunities,
    notes, setNotes,
  } = props;
  const c = useColors();
  const hd = charClass ? calcHitDie(charClass) : 8;
  return (
    <View style={styles.stepContent}>
      {/* Max Hit Points */}
      <FormField label="Max Hit Points" hint={charClass ? `Deterministic from ${charClass} hit die (d${hd}), level, and CON` : "Pick class first"}>
        <View style={[styles.staticStatCard, { borderColor: c.border, backgroundColor: c.card }]}>
          <Text style={[styles.staticStatValue, { color: c.foreground }]}>{maxHp}</Text>
          <Text style={[styles.staticStatHint, { color: c.mutedForeground }]}>Automatically calculated from 5e class progression rules.</Text>
        </View>
      </FormField>
      {/* Armor Class */}
      <FormField label="Armor Class" hint="Deterministic unarmored AC from class + ability modifiers">
        <View style={[styles.staticStatCard, { borderColor: c.border, backgroundColor: c.card }]}>
          <Text style={[styles.staticStatValue, { color: c.foreground }]}>{ac}</Text>
          <Text style={[styles.staticStatHint, { color: c.mutedForeground }]}>Uses unarmored formula for class (Monk/Barbarian) or 10 + DEX by default.</Text>
        </View>
      </FormField>
      {/* Speed */}
      <FormField label="Speed (ft)" hint="Deterministic base speed from race data">
        <View style={[styles.staticStatCard, { borderColor: c.border, backgroundColor: c.card }]}>
          <Text style={[styles.staticStatValue, { color: c.foreground }]}>{speed}</Text>
          <Text style={[styles.staticStatHint, { color: c.mutedForeground }]}>{race || "Selected race"} base walking speed.</Text>
        </View>
      </FormField>
      {typeof flySpeed === "number" && (
        <FormField label="Flying Speed (ft)" hint="Data-driven racial flight speed">
          <View style={[styles.staticStatCard, { borderColor: c.border, backgroundColor: c.card }]}>
            <Text style={[styles.staticStatValue, { color: c.foreground }]}>{flySpeed}</Text>
            <Text style={[styles.staticStatHint, { color: c.mutedForeground }]}>Shown automatically for races/subraces with flight.</Text>
          </View>
        </FormField>
      )}
      <FormField label="Languages" hint="Deterministically derived from race and class">
        <View style={styles.chipRow}>
          {(languages?.length ? languages : ["Common"]).map((lang: string) => (
            <View key={lang} style={[styles.chip, { borderColor: c.border, backgroundColor: c.card }]}>
              <Text style={[styles.chipText, { color: c.foreground }]}>{lang}</Text>
            </View>
          ))}
        </View>
      </FormField>
      {!!tools?.length && (
        <FormField label="Tool Proficiencies" hint="Deterministically derived from background">
          <View style={styles.chipRow}>
            {tools.map((tool: string) => (
              <View key={tool} style={[styles.chip, { borderColor: c.border, backgroundColor: c.card }]}>
                <Text style={[styles.chipText, { color: c.foreground }]}>{tool}</Text>
              </View>
            ))}
          </View>
        </FormField>
      )}
      {(damageResistances?.length || damageImmunities?.length || conditionImmunities?.length) ? (
        <FormField label="Defenses" hint="Deterministically derived from race/class rules">
          <View style={{ gap: 4 }}>
            {!!damageResistances?.length && (
              <Text style={[styles.hintText, { color: c.mutedForeground }]}>Damage Resistances: {damageResistances.join(", ")}</Text>
            )}
            {!!damageImmunities?.length && (
              <Text style={[styles.hintText, { color: c.mutedForeground }]}>Damage Immunities: {damageImmunities.join(", ")}</Text>
            )}
            {!!conditionImmunities?.length && (
              <Text style={[styles.hintText, { color: c.mutedForeground }]}>Condition Immunities: {conditionImmunities.join(", ")}</Text>
            )}
          </View>
        </FormField>
      ) : null}
      {/* Notes */}
      <FormField label="Notes" hint="Optional — backstory, personality traits, etc.">
        <TextInput value={notes} onChangeText={setNotes} multiline numberOfLines={4} placeholder="Add any notes about your character…" placeholderTextColor={c.mutedForeground} style={[styles.notesInput, { color: c.foreground, backgroundColor: c.card, borderColor: c.border }]} />
      </FormField>
      {/* Info Box */}
      <View style={[styles.infoBox, { backgroundColor: c.card, borderColor: c.border }]}>
        <Feather name="info" size={14} color={c.primary} />
        <Text style={[styles.infoText, { color: c.mutedForeground }]}>Starting HP, AC, and speed are computed automatically from your build data and 5e rules. You can still modify armor and effects later on your sheet.</Text>
      </View>
    </View>
  );
}

// ─── Step 4: Starting Gear ───────────────────────────────────────────────────

function Step4Gear(props: any) {
  const {
    className,
    mode,
    setMode,
    onRandomize,
    strictOptions,
    strictPackageId,
    setStrictPackageId,
    presetOptions,
    presetId,
    setPresetId,
    budgetGp,
    spentGp,
    catalog,
    category,
    setCategory,
    loadPreset,
    setLoadPreset,
    maxRarity,
    setMaxRarity,
    freeSelections,
    onAdjustFreeItem,
  } = props;
  const c = useColors();
  const remaining = budgetGp - spentGp;
  const overBudget = remaining < 0;
  const orderedCatalog = useMemo(
    () => sortCreationGearCatalogBySelections(catalog, freeSelections),
    [catalog, freeSelections],
  );
  const likelyProficientNames = useMemo(() => {
    const trimmedClass = typeof className === "string" ? className.trim() : "";
    if (!trimmedClass) return new Set<string>();
    return new Set(
      strictOptions
        .flatMap((option: any) => option.items)
        .map((item: any) => String(item.name).trim().toLowerCase()),
    );
  }, [className, strictOptions]);

  const formatCatalogCategoryLabel = useCallback((value: CreationGearFilterCategory) => {
    if (value === "all") return "All";
    if (value === "component") return "Component";
    if (value === "junk") return "Junk";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }, []);

  return (
    <View style={styles.stepContent}>
      <FormField label="Starting Gear Mode" hint="Choose strict class package, curated preset, or free choice. In free mode the class budget is a hard cap.">
        <View style={styles.methodRow}>
          {([
            ["strict", "Strict 5e"],
            ["preset", "Presets"],
            ["free", "Free Choice"],
          ] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setMode(key)}
              style={[
                styles.methodBtn,
                {
                  backgroundColor: mode === key ? c.primary : c.card,
                  borderColor: mode === key ? c.primary : c.border,
                },
              ]}
            >
              <Text style={[styles.methodBtnText, { color: mode === key ? "#FFFFFF" : c.mutedForeground }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          onPress={onRandomize}
          style={[styles.importHeaderBtn, { backgroundColor: c.card, borderColor: c.border, marginTop: 8, alignSelf: "flex-start" }]}
        >
          <Feather name="shuffle" size={14} color={c.foreground} />
          <Text style={[styles.importHeaderBtnText, { color: c.foreground }]}>Randomize Gear</Text>
        </TouchableOpacity>
      </FormField>

      {mode === "strict" && (
        <View style={{ gap: 12 }}>
          <FormField label="Class Package" hint="Use one of the class-specific package options.">
            <View style={styles.chipRow}>
              {strictOptions.map((option: any) => (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => setStrictPackageId(option.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: strictPackageId === option.id ? c.primary + "25" : c.card,
                      borderColor: strictPackageId === option.id ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: strictPackageId === option.id ? c.primary : c.mutedForeground }]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </FormField>
          
          {strictPackageId && strictOptions.find((opt: any) => opt.id === strictPackageId) && (
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.sectionHeader, { color: c.foreground }]}>Package Contents</Text>
              <View style={{ gap: 8 }}>
                {getPackageDetails(strictOptions.find((opt: any) => opt.id === strictPackageId)).map((item, idx) => (
                  <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontSize: 13, fontWeight: "600" }}>{item.name}</Text>
                      <Text style={{ color: c.mutedForeground, fontSize: 11 }}>qty: {item.quantity}</Text>
                    </View>
                    <Text style={{ color: c.primary, fontSize: 13, fontWeight: "600" }}>{formatCreationGearCost(item.costGp)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {mode === "preset" && (
        <View style={{ gap: 12 }}>
          <FormField label="Gear Preset" hint="Pick a curated preset bundle.">
            <View style={styles.chipRow}>
              {presetOptions.map((option: any) => (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => setPresetId(option.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: presetId === option.id ? c.primary + "25" : c.card,
                      borderColor: presetId === option.id ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: presetId === option.id ? c.primary : c.mutedForeground }]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </FormField>
          
          {presetId && presetOptions.find((opt: any) => opt.id === presetId) && (
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.sectionHeader, { color: c.foreground }]}>Preset Contents</Text>
              <View style={{ gap: 8 }}>
                {getPackageDetails(presetOptions.find((opt: any) => opt.id === presetId)).map((item, idx) => (
                  <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontSize: 13, fontWeight: "600" }}>{item.name}</Text>
                      <Text style={{ color: c.mutedForeground, fontSize: 11 }}>qty: {item.quantity}</Text>
                    </View>
                    <Text style={{ color: c.primary, fontSize: 13, fontWeight: "600" }}>{formatCreationGearCost(item.costGp)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {mode === "free" && (
        <View style={{ gap: 12 }}>
          <View style={[styles.infoBox, { backgroundColor: overBudget ? "#EF444420" : c.card, borderColor: overBudget ? "#EF4444" : c.border }]}>
            <Feather name="shopping-bag" size={14} color={overBudget ? "#EF4444" : c.primary} />
            <Text style={[styles.infoText, { color: overBudget ? "#EF4444" : c.mutedForeground }]}>
              Budget: {budgetGp} gp · Spent: {spentGp} gp · {remaining >= 0 ? `Remaining: ${Math.floor(remaining)} gp` : `Over by ${Math.abs(Math.floor(remaining))} gp`}
            </Text>
          </View>

          <FormField label="Max Rarity">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {CREATION_GEAR_RARITIES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setMaxRarity(r)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: maxRarity === r ? c.primary + "25" : c.card,
                        borderColor: maxRarity === r ? c.primary : c.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: maxRarity === r ? c.primary : c.mutedForeground }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </FormField>

          <FormField label="Load Preset" hint="Limits catalog to items fitting this weight class.">
            <View style={styles.chipRow}>
              {(["light", "moderate", "heavy", "encumbered"] as const).map((preset) => (
                <TouchableOpacity
                  key={preset}
                  onPress={() => setLoadPreset(preset)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: loadPreset === preset ? c.primary + "25" : c.card,
                      borderColor: loadPreset === preset ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: loadPreset === preset ? c.primary : c.mutedForeground }]}>
                    {preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </FormField>

          <FormField label="Catalog Filter">
            <View style={styles.chipRow}>
              {CREATION_GEAR_FILTER_CATEGORIES.map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setCategory(value)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: category === value ? c.primary + "25" : c.card,
                      borderColor: category === value ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: category === value ? c.primary : c.mutedForeground }]}>{formatCatalogCategoryLabel(value)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </FormField>

          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, maxHeight: 360 }]}> 
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
              <View style={{ gap: 8 }}>
                {orderedCatalog.map((item: any) => {
                  const qty = freeSelections[item.name] ?? 0;
                  const isLikelyProficient = (item.category === "weapon" || item.category === "armor")
                    && likelyProficientNames.has(String(item.name).trim().toLowerCase());
                  return (
                    <View key={item.name} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <TouchableOpacity onPress={() => onAdjustFreeItem(item.name, -1)} style={[styles.scoreBtn, { borderColor: c.border }]}>
                          <Feather name="minus" size={13} color={c.foreground} />
                        </TouchableOpacity>
                        <Text style={{ width: 18, textAlign: "center", color: c.foreground }}>{qty}</Text>
                        <TouchableOpacity onPress={() => onAdjustFreeItem(item.name, 1)} style={[styles.scoreBtn, { borderColor: c.border }]}>
                          <Feather name="plus" size={13} color={c.foreground} />
                        </TouchableOpacity>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {isLikelyProficient ? <Text style={{ color: c.primary, fontSize: 12 }}>★</Text> : null}
                          <Text style={{ color: c.foreground, fontSize: 13, fontWeight: "600", flexShrink: 1 }}>{item.name}</Text>
                        </View>
                        <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{item.category} · {formatCreationGearCost(item.costGp)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Step 5: Review ───────────────────────────────────────────────────────────

// type Step4Props = {
//   name: string; race: string; charClass: string; subclass: string;
//   level: number; background: string;
//   scores: Record<ScoreKey, number>;
//   maxHp: number; ac: number; speed: number; notes: string;
// };
function Step4(props: any) {
  const {
    name, race, charClass, subclass, level, background,
    alignment,
    scores, maxHp, ac, speed, flySpeed,
    languages, tools, damageResistances, damageImmunities, conditionImmunities,
    personalityTrait, ideal, bond, flaw,
    loadout,
    notes,
  } = props;
  const c = useColors();
  const SCORE_KEYS: ScoreKey[] = ["str", "dex", "con", "int", "wis", "cha"];
  const prof = profBonus(level);

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.reviewTitle, { color: c.foreground }]}>Review Your Character</Text>

      {/* Identity card */}
      <View style={[styles.reviewCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.reviewCardHeader, { color: c.primary }]}>IDENTITY</Text>
        <ReviewRow label="Name" value={name} />
        <ReviewRow label="Race" value={race} />
        <ReviewRow label="Class" value={charClass + (subclass ? ` (${subclass})` : "")} />
        <ReviewRow label="Level" value={String(level)} />
        {background ? <ReviewRow label="Background" value={background} /> : null}
        {alignment ? <ReviewRow label="Alignment" value={alignment} /> : null}
        <ReviewRow label="Proficiency Bonus" value={`+${prof}`} />
      </View>

      {/* Ability scores card */}
      <View style={[styles.reviewCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.reviewCardHeader, { color: c.primary }]}>ABILITY SCORES</Text>
        <View style={styles.reviewScoreGrid}>
          {SCORE_KEYS.map((key) => (
            <View key={key} style={[styles.reviewScoreCell, { borderColor: c.border }]}>
              <Text style={[styles.reviewScoreAbbr, { color: c.mutedForeground }]}>
                {ABILITY_LABELS[SCORE_KEY_MAP[key]]}
              </Text>
              <Text style={[styles.reviewScoreVal, { color: c.foreground }]}>{scores[key]}</Text>
              <Text style={[styles.reviewScoreMod, { color: c.primary }]}>
                {modStr(abilityMod(scores[key]))}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Stats card */}
      <View style={[styles.reviewCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.reviewCardHeader, { color: c.primary }]}>STARTING STATS</Text>
        <ReviewRow label="Max HP" value={String(maxHp)} />
        <ReviewRow label="Armor Class" value={String(ac)} />
        <ReviewRow label="Speed" value={`${speed} ft`} />
        {typeof flySpeed === "number" ? <ReviewRow label="Flying Speed" value={`${flySpeed} ft`} /> : null}
        <ReviewRow label="Initiative" value={modStr(abilityMod(scores.dex))} />
        <ReviewRow label="Passive Perception" value={String(10 + abilityMod(scores.wis))} />
      </View>

      <View style={[styles.reviewCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.reviewCardHeader, { color: c.primary }]}>STARTING GEAR</Text>
        <ReviewRow label="Gear Mode" value={loadout?.mode ?? "strict"} />
        <ReviewRow
          label="Starting Currency"
          value={`${loadout?.currency?.gp ?? 0} gp${(loadout?.currency?.sp ?? 0) > 0 ? ` ${(loadout?.currency?.sp ?? 0)} sp` : ""}${(loadout?.currency?.cp ?? 0) > 0 ? ` ${(loadout?.currency?.cp ?? 0)} cp` : ""}`}
        />
        {(loadout?.items ?? []).slice(0, 8).map((item: any) => (
          <ReviewRow key={`${item.name}-${item.quantity}`} label={item.name} value={`x${item.quantity}`} />
        ))}
        {(loadout?.items ?? []).length > 8 ? <ReviewRow label="Additional Items" value={`+${(loadout?.items ?? []).length - 8}`} /> : null}
      </View>

      <View style={[styles.reviewCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.reviewCardHeader, { color: c.primary }]}>LANGUAGES & DEFENSES</Text>
        <ReviewRow label="Languages" value={(languages?.length ? languages : ["Common"]).join(", ")} />
        {tools?.length ? <ReviewRow label="Tool Proficiencies" value={tools.join(", ")} /> : null}
        {damageResistances?.length ? <ReviewRow label="Damage Resistances" value={damageResistances.join(", ")} /> : null}
        {damageImmunities?.length ? <ReviewRow label="Damage Immunities" value={damageImmunities.join(", ")} /> : null}
        {conditionImmunities?.length ? <ReviewRow label="Condition Immunities" value={conditionImmunities.join(", ")} /> : null}
      </View>

      {(personalityTrait || ideal || bond || flaw) ? (
        <View style={[styles.reviewCard, { backgroundColor: c.card, borderColor: c.border }]}> 
          <Text style={[styles.reviewCardHeader, { color: c.primary }]}>BACKGROUND ROLEPLAY</Text>
          {personalityTrait ? <ReviewRow label="Trait" value={personalityTrait} /> : null}
          {ideal ? <ReviewRow label="Ideal" value={ideal} /> : null}
          {bond ? <ReviewRow label="Bond" value={bond} /> : null}
          {flaw ? <ReviewRow label="Flaw" value={flaw} /> : null}
        </View>
      ) : null}

      {notes ? (
        <View style={[styles.reviewCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.reviewCardHeader, { color: c.primary }]}>NOTES</Text>
          <Text style={[styles.reviewNotes, { color: c.foreground }]}>{notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function FormField({
  label, hint, required, children,
}: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  const c = useColors();
  const openHelp = useContext(CharacterHelpContext);
  return (
    <View style={styles.formField}>
      <TouchableOpacity
        onLongPress={() => openHelp(label, hint)}
        delayLongPress={380}
        activeOpacity={0.85}
        style={styles.fieldLabelRow}
      >
        <Text style={[styles.fieldLabel, { color: c.foreground }]}>{label}</Text>
        {required && <Text style={[styles.requiredDot, { color: c.primary }]}>*</Text>}
      </TouchableOpacity>
      {hint && <Text style={[styles.fieldHint, { color: c.mutedForeground }]}>{hint}</Text>}
      {children}
    </View>
  );
}

function FormInput({
  value, onChangeText, placeholder, style,
}: {
  value: string; onChangeText: (v: string) => void; placeholder?: string; style?: any;
}) {
  const c = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.mutedForeground}
      style={[styles.formInput, { color: c.foreground, backgroundColor: c.card, borderColor: c.border }, style]}
    />
  );
}

function ChipRow({
  chips, onSelect, selected,
}: {
  chips: string[]; onSelect: (v: string) => void; selected: string;
}) {
  const c = useColors();
  return (
    <View style={styles.chipRow}>
      {chips.map((chip) => (
        <TouchableOpacity
          key={chip}
          onPress={() => onSelect(chip)}
          style={[
            styles.chip,
            {
              backgroundColor: selected === chip ? c.primary + "25" : c.card,
              borderColor: selected === chip ? c.primary : c.border,
            },
          ]}
        >
          <Text style={[styles.chipText, { color: selected === chip ? c.primary : c.mutedForeground }]}>
            {chip}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={styles.reviewRow}>
      <Text style={[styles.reviewRowLabel, { color: c.mutedForeground }]}>{label}</Text>
      <Text style={[styles.reviewRowValue, { color: c.foreground }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 2 },

  stepBar: {
    flexDirection: "row",
    gap: 4,
    padding: 8,
    paddingHorizontal: 16,
  },
  stepDot: { height: 4, borderRadius: 2 },

  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 4,
    backgroundColor: "transparent",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 2,
  },
  tabText: { fontSize: 12, fontWeight: "600" },

  scrollContent: { padding: 16 },
  stepContent: { gap: 20 },

  formField: { gap: 6 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  fieldLabel: { fontSize: 14, fontWeight: "600" },
  requiredDot: { fontSize: 16, fontWeight: "700" },
  fieldHint: { fontSize: 11, marginTop: -2 },
  formInput: {
    borderWidth: 1,
    borderRadius: colors.radius,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  inlineInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineRollBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineRollBtnText: {
    fontSize: 20,
    lineHeight: 22,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "500" },

  levelRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  levelChip: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  levelChipText: { fontSize: 12, fontWeight: "600" },

  card: { borderWidth: 1, borderRadius: colors.radius * 1.5, padding: 16, gap: 12 },
  sectionHeader: { fontSize: 14, fontWeight: "700" },

  methodRow: { flexDirection: "row", gap: 8 },
  methodBtn: { flex: 1, padding: 10, borderWidth: 1, borderRadius: colors.radius * 1.2, alignItems: "center" },
  methodBtnText: { fontSize: 12, fontWeight: "600" },
  questTieInIntro: {
    borderWidth: 1,
    borderRadius: colors.radius * 1.2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  tagSection: { gap: 8, marginTop: 12 },
  tagSectionLabel: { fontSize: 12, fontWeight: "600" },
  methodActionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  quickRollBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  quickRollBtnText: { fontSize: 12, fontWeight: "700" },
  classTipCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  classTipHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  classTipTitle: { fontSize: 13, fontWeight: "700" },
  classTipRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  classTipLabel: { fontSize: 12, fontWeight: "600", width: 80 },
  classTipValue: { fontSize: 12, flex: 1, fontWeight: "500" },
  classTipNote: { fontSize: 11, fontStyle: "italic", marginTop: 2 },
  infoCard: { flexDirection: "row", gap: 7, padding: 10, borderRadius: 10, borderWidth: 1 },
  infoCardText: { flex: 1, fontSize: 12, lineHeight: 18 },

  pbHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pbTitle: { fontSize: 14, fontWeight: "700" },
  pbPoints: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pbPointsText: { fontSize: 13, fontWeight: "700" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scoreLabel: { width: 36, fontSize: 13, fontWeight: "600" },
  scoreBtn: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  scoreVal: { width: 50, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  scoreValText: { fontSize: 16, fontWeight: "700" },
  scoreModText: { fontSize: 12, fontWeight: "600" },
  scoreCost: { fontSize: 11 },

  stdRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  stdChips: { flexDirection: "row", gap: 4, flex: 1, flexWrap: "wrap" },
  stdChip: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
  },
  stdChipText: { fontSize: 12, fontWeight: "600" },

  manualInput: {
    width: 56, height: 40, borderWidth: 1, borderRadius: colors.radius,
    textAlign: "center", fontSize: 16, fontWeight: "600",
  },

  staticStatCard: {
    borderWidth: 1,
    borderRadius: colors.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  staticStatValue: { fontSize: 24, fontWeight: "800" },
  staticStatHint: { fontSize: 12, lineHeight: 18 },

  statAdjRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statInput: {
    width: 64, height: 42, borderWidth: 1, borderRadius: colors.radius,
    textAlign: "center", fontSize: 18, fontWeight: "700",
  },
  resetBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, marginLeft: 8,
  },
  resetBtnText: { fontSize: 12 },

  speedChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: colors.radius, borderWidth: 1,
  },
  speedChipText: { fontSize: 14, fontWeight: "600" },

  notesInput: {
    borderWidth: 1, borderRadius: colors.radius, padding: 12,
    fontSize: 14, minHeight: 100, textAlignVertical: "top",
  },

  hintText: { fontSize: 11 },

  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 12, borderRadius: colors.radius, borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },

  reviewTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  reviewCard: { borderWidth: 1, borderRadius: colors.radius * 1.5, padding: 14, gap: 8 },
  reviewCardHeader: { fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 4 },
  reviewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewRowLabel: { fontSize: 13 },
  reviewRowValue: { fontSize: 13, fontWeight: "600" },
  reviewScoreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reviewScoreCell: { width: "30%", borderWidth: 1, borderRadius: colors.radius, padding: 10, alignItems: "center", gap: 2 },
  reviewScoreAbbr: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  reviewScoreVal: { fontSize: 20, fontWeight: "800" },
  reviewScoreMod: { fontSize: 13, fontWeight: "600" },
  reviewNotes: { fontSize: 13, lineHeight: 20 },

  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    padding: 16,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
  },
  nextBtnText: { fontSize: 16, fontWeight: "700" },
  importHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  importHeaderBtnText: { fontSize: 12, fontWeight: "600" },
  importPickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    marginBottom: 8,
  },
  importPickBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  importOrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 16,
  },
  importOrLine: { flex: 1, height: 1 },
  importOrText: { fontSize: 13, fontWeight: "500" },
  importPasteInput: {
    minHeight: 180,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    lineHeight: 18,
    textAlignVertical: "top",
  },
  importError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  importErrorText: { flex: 1, fontSize: 13, lineHeight: 18 },
  importLoadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    marginTop: 16,
  },
  importLoadBtnText: { fontSize: 16, fontWeight: "700" },
  importCancelBtn: { alignItems: "center", paddingVertical: 14 },
  importCancelText: { fontSize: 14 },

  groupTabPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  groupTabHeading: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  groupTabRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  groupTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  groupTabText: { fontSize: 12, fontWeight: "600" },
  groupTabHint: { fontSize: 11 },
});
