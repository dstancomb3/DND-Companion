import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useColors } from "@/hooks/useColors";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import {
  useAppSettings,
  ACCENT_COLORS,
  THEMES,
  THEME_ORDER,
  DEFAULT_EFFECTS,
  DEFAULT_MOTIONS,
  type AccentColor,
  type ThemeId,
  type ThemePalette,
  type EffectsSettings,
  type MotionSettings,
  type EffectIntensityId,
  type AppSettings,
  type CustomThemeSettings,
  type CardDensityId,
  type FontFamilyId,
  type FontScaleId,
  type LineSpacingId,
  type MotionIntensityId,
  type ProfilePresetId,
  type SpellSourceTagStyle,
  type StatusPillPosition,
  type SavedDisplayPreset,
  type SavedDisplayPresetSlotId,
  type DisplayZoomId,
  DEFAULT_CUSTOM_THEME,
} from "@/context/AppSettingsContext";
import colors from "@/constants/colors";
import { triggerEffect, type EffectType } from "@/utils/triggerEffect";
import { createShadowStyle } from "../../utils/shadow";
import { FONT_FAMILY_RUNTIME } from "@/constants/typography";

const ACCENT_META: { key: AccentColor; label: string }[] = [
  { key: "violet", label: "Violet" },
  { key: "blue",   label: "Blue" },
  { key: "cyan",   label: "Cyan" },
  { key: "green",  label: "Green" },
  { key: "orange", label: "Orange" },
  { key: "red",    label: "Red" },
  { key: "pink",   label: "Pink" },
  { key: "gold",   label: "Gold" },
];

const EFFECT_ROWS: {
  key: keyof Omit<EffectsSettings, "enabled">;
  label: string;
  desc: string;
  icon: string;
  color: string;
}[] = [
  {
    key: "critFailBurst",
    label: "Crits/Fails Effects",
    desc: "Plays a short Nat 20 / Nat 1 screen effect with popup text",
    icon: "target",
    color: "#F59E0B",
  },
  {
    key: "lowHpGlow",
    label: "Low HP Vignette",
    desc: "Pulsing red edge glow when your HP drops below 25%",
    icon: "alert-circle",
    color: "#EF4444",
  },
  {
    key: "deathsDoor",
    label: "Death's Door",
    desc: "Rapid dark-red strobe when HP hits 0 — you're going down",
    icon: "alert-triangle",
    color: "#7C0000",
  },
  {
    key: "healFlash",
    label: "Heal Flash",
    desc: "Green border glow when you regain hit points",
    icon: "heart",
    color: "#10B981",
  },
  {
    key: "damageFlash",
    label: "Damage Flash",
    desc: "Quick red screen flash when you take a hit",
    icon: "shield-off",
    color: "#F97316",
  },
  {
    key: "longRestFade",
    label: "Long Rest Fade",
    desc: "Screen fades to black then back — time skips while you sleep",
    icon: "moon",
    color: "#6366F1",
  },
  {
    key: "potionSparkle",
    label: "Potion Sparkle",
    desc: "Purple shimmer when a potion or consumable is used",
    icon: "droplet",
    color: "#8B5CF6",
  },
  {
    key: "poisonHaze",
    label: "Poison / Drunk Haze",
    desc: "Slow green pulse overlay while Poisoned or Drunk condition is active",
    icon: "wind",
    color: "#4ADE80",
  },
  {
    key: "levelUpBurst",
    label: "Level Up Burst",
    desc: "Golden flash across the screen when your character levels up",
    icon: "star",
    color: "#D97706",
  },
];

const PROFILE_PRESET_META: {
  id: ProfilePresetId;
  label: string;
  desc: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { id: "custom", label: "Custom", desc: "Use your manual setting choices", icon: "sliders" },
  { id: "minimal", label: "Minimal", desc: "Cleaner UI, fewer sections, no effects", icon: "minimize-2" },
  { id: "combat", label: "Combat Focused", desc: "Combat data emphasized, effects enabled", icon: "crosshair" },
  { id: "rp", label: "RP Focused", desc: "Story-facing sections prioritized", icon: "book-open" },
  { id: "dm", label: "DM View", desc: "Dense info view with broad visibility", icon: "eye" },
];

const MOTION_PRESET_META: {
  id: MotionIntensityId;
  label: string;
  desc: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { id: "off", label: "Off", desc: "Disable visual motion and flashes", icon: "pause-circle" },
  { id: "subtle", label: "Subtle", desc: "Softer, lower-intensity effect playback", icon: "minus-circle" },
  { id: "full", label: "Full", desc: "Keep the current full-strength effect behavior", icon: "zap" },
];

const EFFECT_INTENSITY_META: {
  id: EffectIntensityId;
  label: string;
  desc: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { id: "subtle", label: "Subtle", desc: "Softer overlays and gentler flashes", icon: "minus-circle" },
  { id: "full", label: "Full", desc: "Default strength for all visual effects", icon: "zap" },
];

const MOTION_ROWS: {
  key: keyof MotionSettings;
  label: string;
  desc: string;
  usedIn: string;
  icon: string;
  color: string;
}[] = [
  {
    key: "appShellTransition",
    label: "Route Slide",
    desc: "Horizontal screen transition for navigation changes",
    usedIn: "Used in: app-level route navigation",
    icon: "navigation",
    color: "#3B82F6",
  },
  {
    key: "cardEntrance",
    label: "Surface Lift",
    desc: "Subtle lift/settle when content cards appear",
    usedIn: "Used in: shared card components across tabs",
    icon: "layout",
    color: "#14B8A6",
  },
  {
    key: "createCharacterStepTransition",
    label: "Step Shift",
    desc: "Directional transition when moving between staged content",
    usedIn: "Used in: character creation step changes",
    icon: "user-plus",
    color: "#8B5CF6",
  },
  {
    key: "itemCreatorSectionTransition",
    label: "Section Swap",
    desc: "Section-level transition for tabbed or pane content",
    usedIn: "Used in: item creator section switches",
    icon: "package",
    color: "#F97316",
  },
  {
    key: "spellModalTransition",
    label: "Modal Pop",
    desc: "Scale-in style for modal dialogs and overlays",
    usedIn: "Used in: spell add/edit modal",
    icon: "book-open",
    color: "#A855F7",
  },
  {
    key: "filterPanelRevealTransition",
    label: "Filter Reveal",
    desc: "Reveal/collapse motion for advanced filter drawers",
    usedIn: "Used in: search filter panels (spell search and item spell lookup)",
    icon: "filter",
    color: "#06B6D4",
  },
  {
    key: "helpPopupTransition",
    label: "Help Pop",
    desc: "Quick pop animation for contextual help",
    usedIn: "Used in: long-press help popups",
    icon: "help-circle",
    color: "#22C55E",
  },
];

const FONT_SCALE_META: { id: FontScaleId; label: string; desc: string }[] = [
  { id: "sm", label: "Small", desc: "Denser text layout" },
  { id: "md", label: "Medium", desc: "Default sizing" },
  { id: "lg", label: "Large", desc: "Easier reading" },
  { id: "xl", label: "XL", desc: "Largest text baseline" },
];

const FONT_FAMILY_META: { id: FontFamilyId; label: string; desc: string; sample: string; isDefault?: boolean }[] = [
  { id: "inter", label: "Inter", desc: "Clean modern sans", sample: "Quick prep, clean rolls", isDefault: true },
  { id: "cinzel", label: "Cinzel", desc: "D&D-style display serif", sample: "Ancient runes and steel" },
  { id: "lora", label: "Lora", desc: "Book-like serif readability", sample: "Chronicles and notes" },
  { id: "manrope", label: "Bebas Neue", desc: "Tall display sans for punchy headers", sample: "Quest log. Steel. Glory." },
  { id: "nunito", label: "Archivo Black", desc: "Heavy bold sans for high-contrast UI", sample: "CRITICAL ACTIONS STAND OUT" },
];

const LINE_SPACING_META: { id: LineSpacingId; label: string; desc: string }[] = [
  { id: "tight", label: "Tight", desc: "More content on screen" },
  { id: "normal", label: "Normal", desc: "Standard line spacing" },
  { id: "relaxed", label: "Relaxed", desc: "Extra breathing room" },
];

const CARD_DENSITY_META: { id: CardDensityId; label: string; desc: string }[] = [
  { id: "compact", label: "Compact", desc: "Reduced padding and spacing" },
  { id: "comfortable", label: "Comfortable", desc: "Balanced density" },
  { id: "airy", label: "Airy", desc: "More space between elements" },
];

const DISPLAY_ZOOM_META: { id: DisplayZoomId; label: string; desc: string }[] = [
  { id: "80", label: "80%", desc: "Fit more content" },
  { id: "90", label: "90%", desc: "Slightly compact" },
  { id: "100", label: "100%", desc: "Default" },
  { id: "110", label: "110%", desc: "Slightly large" },
  { id: "120", label: "120%", desc: "Easier to read" },
];

const CUSTOM_THEME_COLOR_FIELDS: { key: keyof ThemePalette; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "foreground", label: "Foreground" },
  { key: "card", label: "Card" },
  { key: "cardForeground", label: "Card Text" },
  { key: "primary", label: "Primary" },
  { key: "primaryForeground", label: "Primary Text" },
  { key: "border", label: "Border" },
  { key: "muted", label: "Muted" },
  { key: "mutedForeground", label: "Muted Text" },
  { key: "destructive", label: "Destructive" },
  { key: "destructiveForeground", label: "Destructive Text" },
];

const CUSTOM_THEME_SWATCH_PRESETS = [
  "#0B1020",
  "#111827",
  "#1E293B",
  "#F8FAFC",
  "#E2E8F0",
  "#2563EB",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];

type RgbColor = { r: number; g: number; b: number };

function normalizeHexInput(value: string, fallback: string) {
  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback;
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, value));
}

function hexToRgb(hex: string): RgbColor | null {
  const normalized = normalizeHexInput(hex, "");
  if (!normalized) return null;
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: RgbColor) {
  const toHex = (n: number) => clampByte(n).toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getFileNameFromUri(uri: string) {
  const clean = uri.split("?")[0];
  const parts = clean.split(/[\\/]/);
  return parts[parts.length - 1] || "selected-image";
}

const DEFAULT_DISPLAY_SETTINGS: Partial<AppSettings> = {
  profilePreset: "custom",
  motionIntensity: "full",
  effectsIntensity: "full",
  motions: DEFAULT_MOTIONS,
  fontScale: "md",
  fontFamily: "inter",
  lineSpacing: "normal",
  cardDensity: "comfortable",
  themeId: "default",
  customAccent: null,
  showPassivePerception: true,
  showCurrency: true,
  compactMode: false,
  showConditionsSection: true,
  showTrackedQuest: true,
  showFeatsSection: true,
  showClassFeaturesSection: true,
  showLanguagesDefensesSection: true,
  showBackgroundRoleplaySection: true,
  enableLongPressHelpPopups: true,
  showScrollHints: true,
  showPartyEventPills: true,
  snarkyParseMode: false,
  spellSourceTagStyle: "full",
  effects: DEFAULT_EFFECTS,
};

type AccessibilityPresetId = "contrast" | "reading" | "quiet";

const ACCESSIBILITY_PRESET_META: {
  id: AccessibilityPresetId;
  label: string;
  desc: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  {
    id: "contrast",
    label: "High Contrast",
    desc: "OLED-black surfaces, clear blue accents, and larger readable text.",
    icon: "eye",
  },
  {
    id: "reading",
    label: "Reading Focus",
    desc: "Largest text baseline with relaxed spacing and no animated effects.",
    icon: "book-open",
  },
  {
    id: "quiet",
    label: "Quiet UI",
    desc: "Reduced motion and cleaner spacing for distraction-free play.",
    icon: "moon",
  },
];

type DisplayPageTabId =
  | "preset"
  | "theme"
  | "custom-theme"
  | "layout"
  | "effects"
  | "visibility"
  | "accessibility"
  | "reset";

const DISPLAY_PAGE_TABS: {
  id: DisplayPageTabId;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { id: "preset", label: "Playstyle Presets", icon: "sliders" },
  { id: "theme", label: "Themes & Slots", icon: "droplet" },
  { id: "custom-theme", label: "Custom Theme", icon: "edit-3" },
  { id: "layout", label: "Layout & UI", icon: "layout" },
  { id: "effects", label: "Effects & Motion", icon: "zap" },
  { id: "visibility", label: "Sheet & Status", icon: "eye" },
  { id: "accessibility", label: "Accessibility", icon: "book-open" },
  { id: "reset", label: "Reset Settings", icon: "rotate-ccw" },
];

const PROFILE_PRESET_LABELS: Record<ProfilePresetId, string> = {
  custom: "Custom",
  minimal: "Minimal",
  combat: "Combat Focused",
  rp: "RP Focused",
  dm: "DM View",
};

const MOTION_LABELS: Record<MotionIntensityId, string> = {
  off: "Off",
  subtle: "Subtle",
  full: "Full",
};

const EFFECT_INTENSITY_LABELS: Record<EffectIntensityId, string> = {
  subtle: "Subtle",
  full: "Full",
};

const FONT_SCALE_LABELS: Record<FontScaleId, string> = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
  xl: "XL",
};

const FONT_FAMILY_LABELS: Record<FontFamilyId, string> = {
  inter: "Inter",
  cinzel: "Cinzel",
  lora: "Lora",
  manrope: "Bebas Neue",
  nunito: "Archivo Black",
};

const LINE_SPACING_LABELS: Record<LineSpacingId, string> = {
  tight: "Tight",
  normal: "Normal",
  relaxed: "Relaxed",
};

const CARD_DENSITY_LABELS: Record<CardDensityId, string> = {
  compact: "Compact",
  comfortable: "Comfortable",
  airy: "Airy",
};

const SAVED_PRESET_SLOTS: { id: SavedDisplayPresetSlotId; label: string }[] = [
  { id: "slot-1", label: "Slot 1" },
  { id: "slot-2", label: "Slot 2" },
  { id: "slot-3", label: "Slot 3" },
];

function buildPresetSettings(preset: Exclude<ProfilePresetId, "custom">): Partial<AppSettings> {
  switch (preset) {
    case "minimal":
      return {
        motionIntensity: "off",
        fontScale: "sm",
        lineSpacing: "tight",
        cardDensity: "compact",
        compactMode: true,
        showPassivePerception: false,
        showCurrency: false,
        showConditionsSection: true,
        showTrackedQuest: false,
        showFeatsSection: false,
        showClassFeaturesSection: false,
        showLanguagesDefensesSection: false,
        showBackgroundRoleplaySection: false,
        effects: { ...DEFAULT_EFFECTS, enabled: false },
      };
    case "combat":
      return {
        motionIntensity: "full",
        fontScale: "md",
        lineSpacing: "normal",
        cardDensity: "compact",
        compactMode: true,
        showPassivePerception: true,
        showCurrency: true,
        showConditionsSection: true,
        showTrackedQuest: true,
        showFeatsSection: true,
        showClassFeaturesSection: true,
        showLanguagesDefensesSection: true,
        showBackgroundRoleplaySection: false,
        effects: {
          ...DEFAULT_EFFECTS,
          enabled: true,
          longRestFade: false,
          potionSparkle: true,
        },
      };
    case "rp":
      return {
        motionIntensity: "subtle",
        fontScale: "lg",
        lineSpacing: "relaxed",
        cardDensity: "airy",
        compactMode: false,
        showPassivePerception: true,
        showCurrency: true,
        showConditionsSection: true,
        showTrackedQuest: true,
        showFeatsSection: true,
        showClassFeaturesSection: true,
        showLanguagesDefensesSection: true,
        showBackgroundRoleplaySection: true,
        effects: {
          ...DEFAULT_EFFECTS,
          enabled: true,
          damageFlash: false,
          deathsDoor: false,
          lowHpGlow: false,
        },
      };
    case "dm":
      return {
        motionIntensity: "subtle",
        fontScale: "md",
        lineSpacing: "normal",
        cardDensity: "compact",
        compactMode: true,
        showPassivePerception: true,
        showCurrency: true,
        showConditionsSection: true,
        showTrackedQuest: true,
        showFeatsSection: true,
        showClassFeaturesSection: true,
        showLanguagesDefensesSection: true,
        showBackgroundRoleplaySection: true,
        effects: { ...DEFAULT_EFFECTS, enabled: true },
      };
    default:
      return {};
  }
}

function buildAccessibilityPresetSettings(
  preset: AccessibilityPresetId,
  currentEffects: EffectsSettings,
): Partial<AppSettings> {
  switch (preset) {
    case "contrast":
      return {
        themeId: "midnight",
        customAccent: null,
        motionIntensity: "subtle",
        fontScale: "lg",
        lineSpacing: "relaxed",
        cardDensity: "comfortable",
        compactMode: false,
        effects: { ...currentEffects, enabled: true },
      };
    case "reading":
      return {
        themeId: "light",
        customAccent: null,
        motionIntensity: "off",
        fontScale: "lg",
        fontFamily: "inter",
        lineSpacing: "normal",
        cardDensity: "comfortable",
        compactMode: false,
        effects: { ...currentEffects, enabled: false },
      };
    case "quiet":
      return {
        customAccent: null,
        motionIntensity: "off",
        fontScale: "lg",
        lineSpacing: "normal",
        cardDensity: "comfortable",
        compactMode: false,
        effects: { ...currentEffects, enabled: false },
      };
    default:
      return {};
  }
}

function matchesAccessibilityPreset(
  settings: AppSettings,
  currentEffects: EffectsSettings,
  preset: AccessibilityPresetId,
) {
  const expected = buildAccessibilityPresetSettings(preset, currentEffects);
  return Object.entries(expected).every(([key, value]) => {
    if (key === "effects") {
      return Object.entries(value as EffectsSettings).every(
        ([effectKey, effectValue]) => settings.effects[effectKey as keyof EffectsSettings] === effectValue,
      );
    }

    return settings[key as keyof AppSettings] === value;
  });
}

function buildDisplaySnapshot(settings: AppSettings): Partial<AppSettings> {
  return {
    profilePreset: settings.profilePreset,
    motionIntensity: settings.motionIntensity,
    effectsIntensity: settings.effectsIntensity,
    motions: settings.motions,
    fontScale: settings.fontScale,
    fontFamily: settings.fontFamily,
    lineSpacing: settings.lineSpacing,
    cardDensity: settings.cardDensity,
    themeId: settings.themeId,
    customAccent: settings.customAccent,
    showPassivePerception: settings.showPassivePerception,
    showCurrency: settings.showCurrency,
    compactMode: settings.compactMode,
    showConditionsSection: settings.showConditionsSection,
    showTrackedQuest: settings.showTrackedQuest,
    showFeatsSection: settings.showFeatsSection,
    showClassFeaturesSection: settings.showClassFeaturesSection,
    showLanguagesDefensesSection: settings.showLanguagesDefensesSection,
    showBackgroundRoleplaySection: settings.showBackgroundRoleplaySection,
    enableLongPressHelpPopups: settings.enableLongPressHelpPopups,
    showScrollHints: settings.showScrollHints,
    spellSourceTagStyle: settings.spellSourceTagStyle,
    effects: settings.effects,
  };
}

function buildSavedPresetLabel(themeName: string, fontScale: FontScaleId, fontFamily: FontFamilyId, motion: MotionIntensityId) {
  return `${themeName} · ${FONT_SCALE_LABELS[fontScale]} · ${FONT_FAMILY_LABELS[fontFamily]} · ${MOTION_LABELS[motion]}`;
}

function buildSavedPresetOptionTags(snapshot: Partial<AppSettings>) {
  const themeId = snapshot.themeId ?? (DEFAULT_DISPLAY_SETTINGS.themeId as ThemeId) ?? "default";
  const themeName = THEMES[themeId].name;
  const profilePreset = snapshot.profilePreset ?? (DEFAULT_DISPLAY_SETTINGS.profilePreset as ProfilePresetId) ?? "custom";
  const motion = snapshot.motionIntensity ?? (DEFAULT_DISPLAY_SETTINGS.motionIntensity as MotionIntensityId) ?? "full";
  const effectsIntensity = snapshot.effectsIntensity ?? (DEFAULT_DISPLAY_SETTINGS.effectsIntensity as EffectIntensityId) ?? "full";
  const fontScale = snapshot.fontScale ?? (DEFAULT_DISPLAY_SETTINGS.fontScale as FontScaleId) ?? "md";
  const fontFamily = snapshot.fontFamily ?? (DEFAULT_DISPLAY_SETTINGS.fontFamily as FontFamilyId) ?? "inter";
  const lineSpacing = snapshot.lineSpacing ?? (DEFAULT_DISPLAY_SETTINGS.lineSpacing as LineSpacingId) ?? "normal";
  const cardDensity = snapshot.cardDensity ?? (DEFAULT_DISPLAY_SETTINGS.cardDensity as CardDensityId) ?? "comfortable";
  const effectsEnabled = snapshot.effects?.enabled ?? DEFAULT_EFFECTS.enabled;
  const showPassivePerception = snapshot.showPassivePerception ?? (DEFAULT_DISPLAY_SETTINGS.showPassivePerception ?? true);
  const showCurrency = snapshot.showCurrency ?? (DEFAULT_DISPLAY_SETTINGS.showCurrency ?? true);
  const showConditionsSection = snapshot.showConditionsSection ?? (DEFAULT_DISPLAY_SETTINGS.showConditionsSection ?? true);
  const showTrackedQuest = snapshot.showTrackedQuest ?? (DEFAULT_DISPLAY_SETTINGS.showTrackedQuest ?? true);
  const showFeatsSection = snapshot.showFeatsSection ?? (DEFAULT_DISPLAY_SETTINGS.showFeatsSection ?? true);
  const showClassFeaturesSection = snapshot.showClassFeaturesSection ?? (DEFAULT_DISPLAY_SETTINGS.showClassFeaturesSection ?? true);
  const showLanguagesDefensesSection = snapshot.showLanguagesDefensesSection ?? (DEFAULT_DISPLAY_SETTINGS.showLanguagesDefensesSection ?? true);
  const showBackgroundRoleplaySection = snapshot.showBackgroundRoleplaySection ?? (DEFAULT_DISPLAY_SETTINGS.showBackgroundRoleplaySection ?? true);
  const compactMode = snapshot.compactMode ?? (DEFAULT_DISPLAY_SETTINGS.compactMode ?? false);
  const hiddenSectionCount = [
    showPassivePerception,
    showCurrency,
    showConditionsSection,
    showTrackedQuest,
    showFeatsSection,
    showClassFeaturesSection,
    showLanguagesDefensesSection,
    showBackgroundRoleplaySection,
  ].filter((value) => !value).length;

  return [
    `Theme: ${themeName}`,
    `Preset: ${PROFILE_PRESET_LABELS[profilePreset]}`,
    `Motion: ${MOTION_LABELS[motion]}`,
    `Effects Intensity: ${EFFECT_INTENSITY_LABELS[effectsIntensity]}`,
    `Text: ${FONT_SCALE_LABELS[fontScale]}`,
    `Font: ${FONT_FAMILY_LABELS[fontFamily]}`,
    `Spacing: ${LINE_SPACING_LABELS[lineSpacing]}`,
    `Density: ${CARD_DENSITY_LABELS[cardDensity]}`,
    effectsEnabled ? "Effects On" : "Effects Off",
    compactMode ? "Compact Mode" : "Comfortable Mode",
    hiddenSectionCount > 0 ? `${hiddenSectionCount} Sections Hidden` : "All Sections Visible",
    snapshot.customAccent ? "Custom Accent" : null,
  ].filter(Boolean) as string[];
}

function resolveSavedPresetPreviewSettings(snapshot: Partial<AppSettings>) {
  return {
    themeId: snapshot.themeId ?? (DEFAULT_DISPLAY_SETTINGS.themeId as ThemeId) ?? "default",
    customAccent: snapshot.customAccent ?? (DEFAULT_DISPLAY_SETTINGS.customAccent ?? null),
    fontScale: snapshot.fontScale ?? (DEFAULT_DISPLAY_SETTINGS.fontScale as FontScaleId) ?? "md",
    fontFamily: snapshot.fontFamily ?? (DEFAULT_DISPLAY_SETTINGS.fontFamily as FontFamilyId) ?? "inter",
    lineSpacing: snapshot.lineSpacing ?? (DEFAULT_DISPLAY_SETTINGS.lineSpacing as LineSpacingId) ?? "normal",
    cardDensity: snapshot.cardDensity ?? (DEFAULT_DISPLAY_SETTINGS.cardDensity as CardDensityId) ?? "comfortable",
    effectsEnabled:
      snapshot.effects?.enabled ??
      (DEFAULT_DISPLAY_SETTINGS.effects?.enabled ?? DEFAULT_EFFECTS.enabled),
  };
}

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

export default function DisplayOptionsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { settings, theme: activeTheme, updateSettings } = useAppSettings();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const useWidePresetGrid = Platform.OS === "web" && width >= 900;
  const responsivePresetGridStyle = useWidePresetGrid
    ? { flexDirection: "row" as const, flexWrap: "wrap" as const }
    : null;
  const responsivePresetCardStyle = useWidePresetGrid
    ? { flexBasis: "49%" as const, maxWidth: "49%" as const, minWidth: 0 }
    : null;
  const useWideSectionGrid = Platform.OS === "web" && width >= 1180;
  const sectionGridStyle = useWideSectionGrid
    ? { flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "flex-start" as const }
    : null;
  const getSectionCardStyle = (expanded = false) => {
    if (!useWideSectionGrid) return null;
    return expanded
      ? { flexBasis: "100%" as const, maxWidth: "100%" as const }
      : { flexBasis: "49.2%" as const, maxWidth: "49.2%" as const, minWidth: 0 };
  };
  const useWideSavedPresetGrid = Platform.OS === "web" && width >= 1200;
  const savedPresetGridStyle = useWideSavedPresetGrid
    ? { flexDirection: "row" as const, flexWrap: "wrap" as const }
    : null;
  const savedPresetCardStyle = useWideSavedPresetGrid
    ? { flexBasis: "49%" as const, maxWidth: "49%" as const, minWidth: 0 }
    : null;
  const sectionsLockedOpen = true;
  const [showReusableDisplaySlots, setShowReusableDisplaySlots] = useState(false);
  const [showThemePresets, setShowThemePresets] = useState(false);
  const [showProfilePresets, setShowProfilePresets] = useState(false);
  const [showLayoutUi, setShowLayoutUi] = useState(false);
  const [showCustomTheme, setShowCustomTheme] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showStatusSourceDisplay, setShowStatusSourceDisplay] = useState(false);
  const [showSheetDisplayToggles, setShowSheetDisplayToggles] = useState(false);
  const [showAccessibilityShortcuts, setShowAccessibilityShortcuts] = useState(false);
  const [activeDisplayTab, setActiveDisplayTab] = useState<DisplayPageTabId>("layout");

  const hasCustomAccent = settings.customAccent !== null;
  const customTheme = settings.customTheme ?? DEFAULT_CUSTOM_THEME;
  const [customThemePaletteDraft, setCustomThemePaletteDraft] = useState<ThemePalette>(customTheme.palette);
  const [customThemeShadowDraft, setCustomThemeShadowDraft] = useState(customTheme.shadowColor);
  const [selectedCustomThemeColorKey, setSelectedCustomThemeColorKey] = useState<keyof ThemePalette>("background");

  useEffect(() => {
    setCustomThemePaletteDraft(customTheme.palette);
    setCustomThemeShadowDraft(customTheme.shadowColor);
  }, [customTheme.palette, customTheme.shadowColor]);

  useEffect(() => {
    if (activeDisplayTab === "preset") setShowProfilePresets(true);
    if (activeDisplayTab === "theme") {
      setShowReusableDisplaySlots(true);
      setShowThemePresets(true);
    }
    if (activeDisplayTab === "custom-theme") setShowCustomTheme(true);
    if (activeDisplayTab === "layout") setShowLayoutUi(true);
    if (activeDisplayTab === "effects") setShowEffects(true);
    if (activeDisplayTab === "visibility") {
      setShowStatusSourceDisplay(true);
      setShowSheetDisplayToggles(true);
    }
    if (activeDisplayTab === "accessibility") setShowAccessibilityShortcuts(true);
  }, [activeDisplayTab]);

  useEffect(() => {
    if (sectionsLockedOpen) {
      if (activeDisplayTab === "preset" && !showProfilePresets) setShowProfilePresets(true);
      if (activeDisplayTab === "theme") {
        if (!showReusableDisplaySlots) setShowReusableDisplaySlots(true);
        if (!showThemePresets) setShowThemePresets(true);
      }
      if (activeDisplayTab === "custom-theme" && !showCustomTheme) setShowCustomTheme(true);
      if (activeDisplayTab === "layout" && !showLayoutUi) setShowLayoutUi(true);
      if (activeDisplayTab === "effects" && !showEffects) setShowEffects(true);
      if (activeDisplayTab === "visibility") {
        if (!showStatusSourceDisplay) setShowStatusSourceDisplay(true);
        if (!showSheetDisplayToggles) setShowSheetDisplayToggles(true);
      }
      if (activeDisplayTab === "accessibility" && !showAccessibilityShortcuts) setShowAccessibilityShortcuts(true);
    }
  }, [
    activeDisplayTab,
    sectionsLockedOpen,
    showReusableDisplaySlots,
    showProfilePresets,
    showThemePresets,
    showCustomTheme,
    showLayoutUi,
    showEffects,
    showStatusSourceDisplay,
    showSheetDisplayToggles,
    showAccessibilityShortcuts,
  ]);

  const fx = settings.effects ?? DEFAULT_EFFECTS;
  const motionIntensity = settings.motionIntensity ?? "full";
  const effectsIntensity = settings.effectsIntensity ?? "full";
  const fontScale = settings.fontScale ?? "md";
  const fontFamily = settings.fontFamily ?? "inter";
  const lineSpacing = settings.lineSpacing ?? "normal";
  const cardDensity = settings.cardDensity ?? "comfortable";
  const motionSettings = settings.motions ?? DEFAULT_MOTIONS;
  const updateMotion = (key: keyof MotionSettings, value: boolean) =>
    updateSettings({ motions: { ...motionSettings, [key]: value } });
  const motionPreviewAnim = useRef(new Animated.Value(1)).current;
  const [activeMotionPreview, setActiveMotionPreview] = useState<keyof MotionSettings | null>(null);
  const useNativeDriver = Platform.OS !== "web";

  const playMotionPreview = (key: keyof MotionSettings) => {
    if (motionIntensity === "off") {
      Alert.alert("Motion intensity is off", "Set Motion Intensity to Subtle or Full, then tap Test again.");
      return;
    }

    const duration = motionIntensity === "subtle" ? 170 : 260;
    setActiveMotionPreview(key);
    motionPreviewAnim.setValue(0);

    let sequence: Animated.CompositeAnimation;
    if (key === "appShellTransition") {
      sequence = Animated.sequence([
        Animated.timing(motionPreviewAnim, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
        Animated.delay(260),
        Animated.timing(motionPreviewAnim, {
          toValue: 0,
          duration: Math.round(duration * 0.85),
          easing: Easing.in(Easing.cubic),
          useNativeDriver,
        }),
        Animated.timing(motionPreviewAnim, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
      ]);
    } else if (key === "cardEntrance") {
      sequence = Animated.sequence([
        Animated.timing(motionPreviewAnim, {
          toValue: 1,
          duration: Math.round(duration * 0.85),
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver,
        }),
        Animated.delay(220),
        Animated.timing(motionPreviewAnim, {
          toValue: 1,
          duration: Math.round(duration * 0.65),
          easing: Easing.out(Easing.quad),
          useNativeDriver,
        }),
      ]);
    } else if (key === "createCharacterStepTransition") {
      sequence = Animated.sequence([
        Animated.timing(motionPreviewAnim, {
          toValue: 1,
          duration: Math.round(duration * 0.9),
          easing: Easing.out(Easing.exp),
          useNativeDriver,
        }),
        Animated.delay(190),
        Animated.timing(motionPreviewAnim, {
          toValue: 0,
          duration: Math.round(duration * 0.6),
          easing: Easing.in(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(motionPreviewAnim, {
          toValue: 1,
          duration: Math.round(duration * 0.9),
          easing: Easing.out(Easing.exp),
          useNativeDriver,
        }),
      ]);
    } else if (key === "itemCreatorSectionTransition") {
      sequence = Animated.sequence([
        Animated.timing(motionPreviewAnim, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.sin),
          useNativeDriver,
        }),
        Animated.delay(220),
        Animated.timing(motionPreviewAnim, {
          toValue: 0,
          duration: Math.round(duration * 0.52),
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(motionPreviewAnim, {
          toValue: 1,
          duration: Math.round(duration * 0.78),
          easing: Easing.out(Easing.sin),
          useNativeDriver,
        }),
      ]);
    } else if (key === "spellModalTransition") {
      sequence = Animated.sequence([
        Animated.timing(motionPreviewAnim, {
          toValue: 0.82,
          duration: Math.round(duration * 0.45),
          easing: Easing.out(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(motionPreviewAnim, {
          toValue: 1,
          duration: Math.round(duration * 0.7),
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver,
        }),
      ]);
    } else if (key === "filterPanelRevealTransition") {
      sequence = Animated.sequence([
        Animated.timing(motionPreviewAnim, {
          toValue: 1,
          duration: Math.round(duration * 0.72),
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
        Animated.delay(180),
        Animated.timing(motionPreviewAnim, {
          toValue: 0.3,
          duration: Math.round(duration * 0.45),
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(motionPreviewAnim, {
          toValue: 1,
          duration: Math.round(duration * 0.55),
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
      ]);
    } else {
      sequence = Animated.sequence([
        Animated.timing(motionPreviewAnim, {
          toValue: 1,
          duration: Math.round(duration * 0.55),
          easing: Easing.out(Easing.back(1.8)),
          useNativeDriver,
        }),
        Animated.timing(motionPreviewAnim, {
          toValue: 0.86,
          duration: Math.round(duration * 0.34),
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(motionPreviewAnim, {
          toValue: 1,
          duration: Math.round(duration * 0.52),
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver,
        }),
      ]);
    }

    sequence.start();
  };

  const previewDistance = motionIntensity === "subtle" ? 8 : 16;
  const previewTranslateY = motionPreviewAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [previewDistance, 0],
  });
  const previewTranslateX = motionPreviewAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [previewDistance * 1.25, 0],
  });
  const previewFilterLift = motionPreviewAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-(previewDistance * 0.7), 0],
  });
  const previewScale = motionPreviewAnim.interpolate({
    inputRange: [0, 0.82, 1],
    outputRange: [0.88, 0.97, 1],
  });
  const previewPulseScale = motionPreviewAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.9, 1.05, 1],
  });
  const previewOpacity = motionPreviewAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 1],
  });
  const previewSoftOpacity = motionPreviewAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });
  const previewRotate = motionPreviewAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-3deg", "0deg"],
  });
  const previewTilt = motionPreviewAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "1.2deg"],
  });

  const previewContainerStyle =
    activeMotionPreview === "appShellTransition"
      ? {
          opacity: previewOpacity,
          transform: [{ translateX: previewTranslateX }],
        }
      : activeMotionPreview === "cardEntrance"
      ? {
          opacity: previewSoftOpacity,
          transform: [{ translateY: previewTranslateY }, { scale: previewScale }],
        }
      : activeMotionPreview === "createCharacterStepTransition"
      ? {
          opacity: previewOpacity,
          transform: [{ translateX: previewTranslateX }, { translateY: previewTranslateY }],
        }
      : activeMotionPreview === "itemCreatorSectionTransition"
      ? {
          opacity: previewSoftOpacity,
          transform: [{ translateY: previewTranslateY }, { rotate: previewTilt }],
        }
      : activeMotionPreview === "spellModalTransition"
      ? {
          opacity: previewOpacity,
          transform: [{ scale: previewScale }],
        }
      : activeMotionPreview === "filterPanelRevealTransition"
      ? {
          opacity: previewOpacity,
          transform: [{ translateY: previewFilterLift }, { scaleY: previewScale }],
        }
      : {
          opacity: previewSoftOpacity,
          transform: [{ scale: previewPulseScale }, { rotate: previewRotate }],
        };

  const playEffectPreview = (key: keyof Omit<EffectsSettings, "enabled">) => {
    if (!fx.enabled) {
      Alert.alert("Effects are disabled", "Enable Effects to preview visual effects.");
      return;
    }

    const map: Record<keyof Omit<EffectsSettings, "enabled">, EffectType> = {
      critFailBurst: "nat_20",
      lowHpGlow: "low_hp_glow",
      deathsDoor: "deaths_door",
      healFlash: "heal_flash",
      damageFlash: "damage_flash",
      longRestFade: "long_rest",
      potionSparkle: "potion",
      poisonHaze: "poison_haze",
      levelUpBurst: "level_up",
    };

    if (key === "poisonHaze") {
      // Temporarily enable poison condition for 3 seconds, then clear
      const { setConditions, conditions } = require("@/context/CharacterContext");
      if (typeof setConditions === "function") {
        setConditions([...(conditions || []), { name: "Poisoned", source: "test", duration: 3 }]);
        setTimeout(() => {
          setConditions((conds: any[]) => conds.filter(c => c.name !== "Poisoned" || c.source !== "test"));
        }, 3000);
      } else {
        triggerEffect(map[key]);
      }
    } else {
      triggerEffect(map[key]);
    }
  };
  const updateEffect = (key: keyof EffectsSettings, value: boolean) =>
    updateSettings({ effects: { ...fx, [key]: value } });

  const resetDisplaySettings = () => {
    updateSettings(DEFAULT_DISPLAY_SETTINGS);
  };

  const confirmResetDisplaySettings = () => {
    if (!settings.confirmBeforeDangerousActions) {
      resetDisplaySettings();
      return;
    }

    Alert.alert(
      "Reset display settings?",
      "This will restore theme, presets, readability, motion, and section visibility to their default values.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: resetDisplaySettings },
      ],
    );
  };

  const applyProfilePreset = (preset: ProfilePresetId) => {
    if (preset === "custom") {
      updateSettings({ profilePreset: "custom" });
      return;
    }

    updateSettings({
      ...buildPresetSettings(preset),
      profilePreset: preset,
    });
  };

  const saveCurrentDisplayPreset = (slotId: SavedDisplayPresetSlotId) => {
    const existing = settings.savedDisplayPresets.find((slot) => slot.id === slotId);
    const nextPreset: SavedDisplayPreset = {
      id: slotId,
      slotName: existing?.slotName,
      label: buildSavedPresetLabel(activeTheme.name, fontScale, fontFamily, motionIntensity),
      savedAt: Date.now(),
      settings: buildDisplaySnapshot(settings),
    };

    updateSettings({
      profilePreset: settings.profilePreset,
      savedDisplayPresets: [
        ...settings.savedDisplayPresets.filter((slot) => slot.id !== slotId),
        nextPreset,
      ].sort((left, right) => left.id.localeCompare(right.id)),
    });
  };

  const applySavedDisplayPreset = (preset: SavedDisplayPreset) => {
    updateSettings(preset.settings);
  };

  const renameSavedDisplayPreset = (slotId: SavedDisplayPresetSlotId, slotName: string) => {
    const normalized = slotName.trim();
    updateSettings({
      profilePreset: settings.profilePreset,
      savedDisplayPresets: settings.savedDisplayPresets.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              slotName: normalized.length > 0 ? normalized : undefined,
            }
          : slot,
      ),
    });
  };

  const deleteSavedDisplayPreset = (slotId: SavedDisplayPresetSlotId) => {
    updateSettings({
      profilePreset: settings.profilePreset,
      savedDisplayPresets: settings.savedDisplayPresets.filter((slot) => slot.id !== slotId),
    });
  };

  const updateCustomTheme = (updates: Partial<CustomThemeSettings>) => {
    updateSettings({
      customTheme: {
        ...customTheme,
        ...updates,
      },
    });
  };

  const updateCustomThemePalette = (key: keyof ThemePalette, value: string) => {
    updateCustomTheme({
      palette: {
        ...customTheme.palette,
        [key]: normalizeHexInput(value, customTheme.palette[key]),
      },
    });
  };

  const selectedCustomThemeColorMeta =
    CUSTOM_THEME_COLOR_FIELDS.find((field) => field.key === selectedCustomThemeColorKey) ?? CUSTOM_THEME_COLOR_FIELDS[0];
  const selectedCustomThemeColorHex = customThemePaletteDraft[selectedCustomThemeColorMeta.key];
  const selectedCustomThemeColorRgb =
    hexToRgb(selectedCustomThemeColorHex) ?? hexToRgb(customTheme.palette[selectedCustomThemeColorMeta.key]) ?? { r: 0, g: 0, b: 0 };

  const applySelectedThemeColor = (nextHex: string) => {
    const normalized = normalizeHexInput(nextHex, customTheme.palette[selectedCustomThemeColorMeta.key]);
    setCustomThemePaletteDraft((prev) => ({
      ...prev,
      [selectedCustomThemeColorMeta.key]: normalized,
    }));
    updateCustomThemePalette(selectedCustomThemeColorMeta.key, normalized);
  };

  const updateSelectedThemeColorChannel = (channel: keyof RgbColor, delta: number) => {
    const next = {
      ...selectedCustomThemeColorRgb,
      [channel]: clampByte(selectedCustomThemeColorRgb[channel] + delta),
    };
    applySelectedThemeColor(rgbToHex(next));
  };

  const pickCustomThemeBackgroundImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const pickedUri = result.assets[0]?.uri;
      if (!pickedUri) {
        Alert.alert("Image selection failed", "Could not read the selected image file.");
        return;
      }

      updateCustomTheme({ backgroundImageUri: pickedUri });
    } catch {
      Alert.alert("Image selection failed", "Please try again.");
    }
  };

  const resetCustomTheme = () => {
    updateSettings({
      customTheme: {
        ...DEFAULT_CUSTOM_THEME,
        palette: { ...activeTheme.palette },
      },
    });
  };

  const customPreviewPalette = customTheme.enabled ? customTheme.palette : activeTheme.palette;
  const customPreviewRadius = customTheme.enabled ? customTheme.radius : colors.radius;
  const customPreviewBorderWidth = customTheme.enabled ? customTheme.borderWidth : 1;
  const selectedBackgroundImageLabel = customTheme.backgroundImageUri
    ? getFileNameFromUri(customTheme.backgroundImageUri)
    : "No image selected";

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: c.border }]}> 
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>Display</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.displayTabBarContent}
        style={[styles.displayTabBar, { backgroundColor: c.card, borderBottomColor: c.border }]}
      >
        {DISPLAY_PAGE_TABS.map((tab) => {
          const active = activeDisplayTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveDisplayTab(tab.id)}
              activeOpacity={0.85}
              style={[
                styles.displayTab,
                {
                  borderBottomColor: active ? c.primary : "transparent",
                  backgroundColor: c.card,
                },
              ]}
            >
              <Feather name={tab.icon} size={14} color={active ? c.primary : c.mutedForeground} />
              <Text style={[styles.displayTabText, { color: active ? c.primary : c.mutedForeground }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollHintScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === "web" ? 14 : insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={sectionGridStyle}>
            {activeDisplayTab === "theme" && (
            <View style={[styles.card, getSectionCardStyle(showReusableDisplaySlots), { backgroundColor: c.card, borderColor: c.border }]}> 
              <TouchableOpacity
                onPress={() => { if (!sectionsLockedOpen) setShowReusableDisplaySlots((prev) => !prev); }}
                activeOpacity={sectionsLockedOpen ? 1 : 0.82}
                style={[styles.savedPresetSectionToggle, { borderColor: c.border, backgroundColor: c.secondary }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: c.foreground }]}>Reusable Display Slots</Text>
                  <Text style={[styles.settingDesc, { color: c.mutedForeground }]}> 
                    Save your current display setup to a slot, then reapply it later with one tap.
                  </Text>
                </View>
                {sectionsLockedOpen ? null : <Feather name={showReusableDisplaySlots ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />}
              </TouchableOpacity>
              {showReusableDisplaySlots && (
                <View style={[styles.savedPresetGrid, savedPresetGridStyle]}>
                  {SAVED_PRESET_SLOTS.map((slotMeta) => {
                    const slot = settings.savedDisplayPresets.find((entry) => entry.id === slotMeta.id);
                    const slotOptionTags = slot ? buildSavedPresetOptionTags(slot.settings) : [];
                    return (
                      <View
                        key={slotMeta.id}
                        style={[styles.savedPresetCard, savedPresetCardStyle, { backgroundColor: c.secondary, borderColor: c.border }]}
                      >
                        <View style={styles.savedPresetHeader}>
                          {slot ? (
                            <TextInput
                              style={[styles.slotNameInput, { color: c.foreground, borderColor: c.border, backgroundColor: c.card }]}
                              placeholder={slotMeta.label}
                              placeholderTextColor={c.mutedForeground}
                              value={slot.slotName ?? ""}
                              onChangeText={(value) => renameSavedDisplayPreset(slotMeta.id, value)}
                              maxLength={28}
                            />
                          ) : (
                            <Text style={[styles.savedPresetTitle, { color: c.foreground }]}>{slotMeta.label}</Text>
                          )}
                          <TouchableOpacity
                            onPress={() => saveCurrentDisplayPreset(slotMeta.id)}
                            activeOpacity={0.82}
                            style={[styles.savedPresetActionBtn, { backgroundColor: c.primary + "18", borderColor: c.primary + "33" }]}
                          >
                            <Feather name="save" size={13} color={c.primary} />
                            <Text style={[styles.savedPresetActionText, { color: c.primary }]}>{slot ? "Replace" : "Save"}</Text>
                          </TouchableOpacity>
                        </View>
                        {slot ? (
                          <>
                            <View style={styles.savedPresetInfoRow}>
                              <View style={styles.savedPresetInfoLeft}>
                                <View style={styles.savedPresetInfoText}>
                                  <Text style={[styles.savedPresetLabel, { color: c.foreground }]}>{slot.label}</Text>
                                  <Text style={[styles.savedPresetMeta, { color: c.mutedForeground }]}>Saved {new Date(slot.savedAt).toLocaleDateString()}</Text>
                                </View>
                                <View style={styles.savedPresetOptionGrid}>
                                  {slotOptionTags.map((tag) => (
                                    <Text key={`${slot.id}-${tag}`} style={styles.savedPresetOptionItem} numberOfLines={1}>{tag}</Text>
                                  ))}
                                </View>
                              </View>
                              <SavedPresetVisualPreview settings={slot.settings} />
                            </View>
                            <View style={styles.savedPresetControls}>
                              <TouchableOpacity
                                onPress={() => applySavedDisplayPreset(slot)}
                                activeOpacity={0.82}
                                style={[styles.savedPresetSecondaryBtn, { backgroundColor: c.card, borderColor: c.border }]}
                              >
                                <Feather name="upload" size={13} color={c.foreground} />
                                <Text style={[styles.savedPresetSecondaryText, { color: c.foreground }]}>Apply</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => deleteSavedDisplayPreset(slotMeta.id)}
                                activeOpacity={0.82}
                                style={[styles.savedPresetSecondaryBtn, { backgroundColor: c.card, borderColor: c.border }]}
                              >
                                <Feather name="trash-2" size={13} color={c.destructive} />
                                <Text style={[styles.savedPresetSecondaryText, { color: c.destructive }]}>Delete</Text>
                              </TouchableOpacity>
                            </View>
                          </>
                        ) : (
                          <Text style={[styles.savedPresetMeta, { color: c.mutedForeground }]}>Empty slot. Save the current layout here.</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
            )}

            {activeDisplayTab === "preset" && (
            <View style={[styles.card, getSectionCardStyle(showProfilePresets), { backgroundColor: c.card, borderColor: c.border }]}> 
              <TouchableOpacity
                onPress={() => { if (!sectionsLockedOpen) setShowProfilePresets((prev) => !prev); }}
                activeOpacity={sectionsLockedOpen ? 1 : 0.82}
                style={[styles.savedPresetSectionToggle, { borderColor: c.border, backgroundColor: c.secondary }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: c.foreground }]}>UI & Playstyle Preset</Text>
                  <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Applies a named bundle of existing display, effects, and visibility settings.</Text>
                </View>
                {sectionsLockedOpen ? null : <Feather name={showProfilePresets ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />}
              </TouchableOpacity>
              {showProfilePresets && (
                <View style={[styles.presetGrid, responsivePresetGridStyle]}>
                  {PROFILE_PRESET_META.map((preset) => {
                    const active = settings.profilePreset === preset.id;
                    return (
                      <TouchableOpacity
                        key={preset.id}
                        onPress={() => applyProfilePreset(preset.id)}
                        activeOpacity={0.84}
                        style={[
                          styles.presetCard,
                          responsivePresetCardStyle,
                          {
                            borderColor: active ? c.primary : c.border,
                            backgroundColor: active ? c.primary + "18" : c.secondary,
                          },
                        ]}
                      >
                        <View style={[styles.presetIcon, { backgroundColor: active ? c.primary + "30" : c.muted + "55" }]}> 
                          <Feather name={preset.icon} size={14} color={active ? c.primary : c.mutedForeground} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.presetTitle, { color: active ? c.primary : c.foreground }]}>{preset.label}</Text>
                          <Text style={[styles.presetDesc, { color: c.mutedForeground }]} numberOfLines={2}>{preset.desc}</Text>
                        </View>
                        {active ? <Feather name="check" size={14} color={c.primary} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
            )}

            {activeDisplayTab === "theme" && (
            <View style={[styles.card, getSectionCardStyle(showThemePresets), { backgroundColor: c.card, borderColor: c.border }]}> 
              <TouchableOpacity
                onPress={() => { if (!sectionsLockedOpen) setShowThemePresets((prev) => !prev); }}
                activeOpacity={sectionsLockedOpen ? 1 : 0.82}
                style={[styles.savedPresetSectionToggle, { borderColor: c.border, backgroundColor: c.secondary }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: c.foreground }]}>Theme Preset</Text>
                  <Text style={[styles.settingDesc, { color: c.mutedForeground }]}> 
                    Choose the base visual style for the app before applying accents and other display overrides.
                  </Text>
                </View>
                {sectionsLockedOpen ? null : <Feather name={showThemePresets ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />}
              </TouchableOpacity>
              {showThemePresets && (
                <>
                  <View style={styles.themeGrid}>
                    {THEME_ORDER.map((id) => {
                      const t = THEMES[id];
                      const active = settings.themeId === id;
                      const [bg, accent, card] = t.previewColors;
                      return (
                        <TouchableOpacity
                          key={id}
                          onPress={() => updateSettings({ themeId: id as ThemeId })}
                          activeOpacity={0.82}
                          style={[
                            styles.themeCard,
                            {
                              backgroundColor: c.card,
                              borderColor: active ? c.primary : c.border,
                              borderWidth: active ? 2 : 1,
                              borderRadius: colors.radius * 1.5,
                            },
                          ]}
                        >
                          <View style={[styles.swatch, { borderRadius: colors.radius, overflow: "hidden" }]}> 
                            <View style={[styles.swatchBg, { backgroundColor: bg }]}> 
                              <View style={[styles.swatchCard, { backgroundColor: card }]} />
                              <View style={[styles.swatchAccent, { backgroundColor: accent }]} />
                            </View>
                          </View>
                          <View style={styles.themeCardBottom}>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.themeName,
                                  { color: active ? c.primary : c.foreground },
                                ]}
                                numberOfLines={1}
                              >
                                {t.name}
                              </Text>
                              <Text
                                style={[styles.themeDesc, { color: c.mutedForeground }]}
                                numberOfLines={2}
                              >
                                {t.description}
                              </Text>
                            </View>
                            {active && (
                              <View style={[styles.activeCheck, { backgroundColor: c.primary }]}> 
                                <Feather name="check" size={11} color={activeTheme.palette.primaryForeground} />
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Divider color={c.border} />
                  <Text style={[styles.settingLabel, { color: c.foreground }]}>Override Accent Color</Text>
                  <Text style={[styles.settingDesc, { color: c.mutedForeground }]}> 
                    Pick a custom accent that overrides the theme's built-in color. Affects buttons, highlights, and active states.
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                    <View style={{ flexDirection: "row", gap: 10, paddingVertical: 4 }}>
                      {ACCENT_META.map(({ key, label }) => {
                        const hex = ACCENT_COLORS[key];
                        const selected = settings.customAccent === hex;
                        return (
                          <TouchableOpacity
                            key={key}
                            onPress={() => updateSettings({ customAccent: hex })}
                            activeOpacity={0.8}
                            style={{ alignItems: "center", gap: 5 }}
                          >
                            <View
                              style={[
                                styles.accentCircle,
                                { backgroundColor: hex },
                                selected && [styles.accentCircleActive, { borderColor: hex }],
                              ]}
                            >
                              {selected && <Feather name="check" size={14} color="#FFFFFF" />}
                            </View>
                            <Text style={[styles.accentLabel, { color: selected ? hex : c.mutedForeground, fontWeight: selected ? "700" : "400" }]}>
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                  {hasCustomAccent && (
                    <TouchableOpacity
                      onPress={() => updateSettings({ customAccent: null })}
                      activeOpacity={0.8}
                      style={[styles.resetBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                    >
                      <Feather name="refresh-ccw" size={13} color={c.mutedForeground} />
                      <Text style={[styles.resetBtnText, { color: c.mutedForeground }]}> 
                        Reset to theme default ({activeTheme.name})
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
            )}

            {activeDisplayTab === "custom-theme" && (
            <View style={[styles.card, getSectionCardStyle(showCustomTheme), { backgroundColor: c.card, borderColor: c.border }]}> 
              <TouchableOpacity
                onPress={() => { if (!sectionsLockedOpen) setShowCustomTheme((prev) => !prev); }}
                activeOpacity={sectionsLockedOpen ? 1 : 0.82}
                style={[styles.savedPresetSectionToggle, { borderColor: c.border, backgroundColor: c.secondary }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: c.foreground }]}>Custom Theme</Text>
                  <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Create your own look with custom colors, corners, borders, shadow, texture, and optional background image URI.</Text>
                </View>
                {sectionsLockedOpen ? null : <Feather name={showCustomTheme ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />}
              </TouchableOpacity>
              {showCustomTheme && (
                <>
                  <View style={styles.customThemeSwitchRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.settingLabel, { color: c.foreground }]}>Enable Custom Theme</Text>
                      <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>When enabled, custom theme colors and style tokens apply app-wide where theme tokens are consumed.</Text>
                    </View>
                    <Switch
                      value={customTheme.enabled}
                      onValueChange={(value) => updateCustomTheme({ enabled: value })}
                      trackColor={{ false: c.muted, true: c.primary }}
                      thumbColor="#FFFFFF"
                      ios_backgroundColor={c.muted}
                    />
                  </View>
                  <Divider color={c.border} />

                  <Text style={[styles.customThemeSectionLabel, { color: c.foreground }]}>Palette</Text>
                  <View style={styles.customThemePaletteColumns}>
                    {CUSTOM_THEME_COLOR_FIELDS.map((field) => (
                      <TouchableOpacity
                        key={field.key}
                        activeOpacity={0.86}
                        onPress={() => setSelectedCustomThemeColorKey(field.key)}
                        style={[
                          styles.customThemeColorTile,
                          {
                            borderColor: selectedCustomThemeColorMeta.key === field.key ? c.primary : c.border,
                            backgroundColor: c.secondary,
                          },
                        ]}
                      >
                        <View style={[styles.customThemeSwatch, { backgroundColor: customTheme.palette[field.key] }]} />
                        <Text style={[styles.customThemeFieldLabel, { color: c.foreground }]} numberOfLines={1}>{field.label}</Text>
                        <Text style={[styles.customThemeTileHex, { color: c.mutedForeground }]} numberOfLines={1}>
                          {customTheme.palette[field.key]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={[styles.customThemeEditorShell, { borderColor: c.border, backgroundColor: c.secondary }]}>
                    <View style={styles.customThemeEditorHeader}>
                      <Text style={[styles.customThemeFieldLabel, { color: c.foreground }]}>
                        Editing: {selectedCustomThemeColorMeta.label}
                      </Text>
                      <View style={[styles.customThemeEditorSwatch, { backgroundColor: selectedCustomThemeColorHex }]} />
                    </View>

                    <View style={styles.customThemePresetRow}>
                      {CUSTOM_THEME_SWATCH_PRESETS.map((hex) => (
                        <TouchableOpacity
                          key={`${selectedCustomThemeColorMeta.key}-${hex}`}
                          onPress={() => applySelectedThemeColor(hex)}
                          activeOpacity={0.86}
                          style={[
                            styles.customThemePresetSwatch,
                            {
                              backgroundColor: hex,
                              borderColor: selectedCustomThemeColorHex.toUpperCase() === hex ? c.primary : c.border,
                            },
                          ]}
                        />
                      ))}
                    </View>

                    {(["r", "g", "b"] as const).map((channel) => (
                      <View key={channel} style={styles.customThemeTokenRow}>
                        <Text style={[styles.settingDesc, { color: c.mutedForeground }]}> 
                          {channel.toUpperCase()}: {selectedCustomThemeColorRgb[channel]}
                        </Text>
                        <View style={styles.customThemeStepRow}>
                          <TouchableOpacity
                            onPress={() => updateSelectedThemeColorChannel(channel, -8)}
                            style={[styles.customThemeStepBtn, { borderColor: c.border, backgroundColor: c.card }]}
                          >
                            <Feather name="minus" size={13} color={c.foreground} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => updateSelectedThemeColorChannel(channel, 8)}
                            style={[styles.customThemeStepBtn, { borderColor: c.border, backgroundColor: c.card }]}
                          >
                            <Feather name="plus" size={13} color={c.foreground} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    <TextInput
                      style={[styles.customThemeHexInput, { color: c.foreground, borderColor: c.border, backgroundColor: c.card }]}
                      value={customThemePaletteDraft[selectedCustomThemeColorMeta.key]}
                      onChangeText={(value) =>
                        setCustomThemePaletteDraft((prev) => ({
                          ...prev,
                          [selectedCustomThemeColorMeta.key]: value,
                        }))
                      }
                      onBlur={() => updateCustomThemePalette(selectedCustomThemeColorMeta.key, customThemePaletteDraft[selectedCustomThemeColorMeta.key])}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      placeholder="#000000"
                      placeholderTextColor={c.mutedForeground}
                    />
                  </View>

                  <Divider color={c.border} />
                  <Text style={[styles.customThemeSectionLabel, { color: c.foreground }]}>Shape & Surface</Text>
                  <View style={styles.customThemeTokenRow}>
                    <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Corner Radius: {customTheme.radius}px</Text>
                    <View style={styles.customThemeStepRow}>
                      <TouchableOpacity
                        onPress={() => updateCustomTheme({ radius: Math.max(0, customTheme.radius - 1) })}
                        style={[styles.customThemeStepBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                      >
                        <Feather name="minus" size={13} color={c.foreground} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => updateCustomTheme({ radius: Math.min(32, customTheme.radius + 1) })}
                        style={[styles.customThemeStepBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                      >
                        <Feather name="plus" size={13} color={c.foreground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.customThemeTokenRow}>
                    <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Border Width: {customTheme.borderWidth}px</Text>
                    <View style={styles.customThemeStepRow}>
                      <TouchableOpacity
                        onPress={() => updateCustomTheme({ borderWidth: Math.max(0, customTheme.borderWidth - 1) })}
                        style={[styles.customThemeStepBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                      >
                        <Feather name="minus" size={13} color={c.foreground} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => updateCustomTheme({ borderWidth: Math.min(6, customTheme.borderWidth + 1) })}
                        style={[styles.customThemeStepBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                      >
                        <Feather name="plus" size={13} color={c.foreground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.customThemeTokenRow}>
                    <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Border Opacity: {Math.round(customTheme.borderOpacity * 100)}%</Text>
                    <View style={styles.customThemeStepRow}>
                      <TouchableOpacity
                        onPress={() => updateCustomTheme({ borderOpacity: Math.max(0, Number((customTheme.borderOpacity - 0.1).toFixed(2))) })}
                        style={[styles.customThemeStepBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                      >
                        <Feather name="minus" size={13} color={c.foreground} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => updateCustomTheme({ borderOpacity: Math.min(1, Number((customTheme.borderOpacity + 0.1).toFixed(2))) })}
                        style={[styles.customThemeStepBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                      >
                        <Feather name="plus" size={13} color={c.foreground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.customThemeTokenRow}>
                    <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Shadow Strength: {Math.round(customTheme.shadowStrength * 100)}%</Text>
                    <View style={styles.customThemeStepRow}>
                      <TouchableOpacity
                        onPress={() => updateCustomTheme({ shadowStrength: Math.max(0, Number((customTheme.shadowStrength - 0.1).toFixed(2))) })}
                        style={[styles.customThemeStepBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                      >
                        <Feather name="minus" size={13} color={c.foreground} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => updateCustomTheme({ shadowStrength: Math.min(1, Number((customTheme.shadowStrength + 0.1).toFixed(2))) })}
                        style={[styles.customThemeStepBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                      >
                        <Feather name="plus" size={13} color={c.foreground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TextInput
                    style={[styles.customThemeHexInput, { color: c.foreground, borderColor: c.border, backgroundColor: c.secondary }]}
                    value={customThemeShadowDraft}
                    onChangeText={setCustomThemeShadowDraft}
                    onBlur={() =>
                      updateCustomTheme({
                        shadowColor: normalizeHexInput(customThemeShadowDraft, customTheme.shadowColor),
                      })
                    }
                    autoCapitalize="characters"
                    autoCorrect={false}
                    placeholder="Shadow color hex"
                    placeholderTextColor={c.mutedForeground}
                  />

                  <Divider color={c.border} />
                  <Text style={[styles.customThemeSectionLabel, { color: c.foreground }]}>Texture and Background</Text>
                  <View style={styles.customThemePatternRow}>
                    {([
                      { id: "none", label: "None" },
                      { id: "dots", label: "Dots" },
                      { id: "grid", label: "Grid" },
                      { id: "noise", label: "Noise" },
                    ] as const).map((opt) => {
                      const active = customTheme.texturePattern === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => updateCustomTheme({ texturePattern: opt.id })}
                          style={[
                            styles.customThemePatternBtn,
                            {
                              borderColor: active ? c.primary : c.border,
                              backgroundColor: active ? c.primary + "22" : c.secondary,
                            },
                          ]}
                        >
                          <Text style={{ color: active ? c.primary : c.mutedForeground, fontSize: 11, fontWeight: "700" }}>{opt.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.customThemeTokenRow}>
                    <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Texture Intensity: {Math.round(customTheme.textureIntensity * 100)}%</Text>
                    <View style={styles.customThemeStepRow}>
                      <TouchableOpacity
                        onPress={() =>
                          updateCustomTheme({
                            textureIntensity: Math.max(0, Number((customTheme.textureIntensity - 0.1).toFixed(2))),
                          })
                        }
                        style={[styles.customThemeStepBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                      >
                        <Feather name="minus" size={13} color={c.foreground} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          updateCustomTheme({
                            textureIntensity: Math.min(1, Number((customTheme.textureIntensity + 0.1).toFixed(2))),
                          })
                        }
                        style={[styles.customThemeStepBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                      >
                        <Feather name="plus" size={13} color={c.foreground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.customThemeBackgroundRow}>
                    <TouchableOpacity
                      onPress={pickCustomThemeBackgroundImage}
                      style={[styles.customThemeBackgroundBtn, { borderColor: c.primary, backgroundColor: c.primary + "1f" }]}
                    >
                      <Feather name="upload" size={13} color={c.primary} />
                      <Text style={[styles.customThemeActionText, { color: c.primary }]}>Upload Image</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => updateCustomTheme({ backgroundImageUri: null })}
                      style={[styles.customThemeBackgroundBtn, { borderColor: c.border, backgroundColor: c.card }]}
                    >
                      <Feather name="x-circle" size={13} color={c.foreground} />
                      <Text style={[styles.customThemeActionText, { color: c.foreground }]}>Clear Image</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.customThemeTokenRow}>
                    <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Image Opacity: {Math.round(customTheme.backgroundImageOpacity * 100)}%</Text>
                    <View style={styles.customThemeStepRow}>
                      <TouchableOpacity
                        onPress={() =>
                          updateCustomTheme({
                            backgroundImageOpacity: Math.max(0, Number((customTheme.backgroundImageOpacity - 0.1).toFixed(2))),
                          })
                        }
                        style={[styles.customThemeStepBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                      >
                        <Feather name="minus" size={13} color={c.foreground} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          updateCustomTheme({
                            backgroundImageOpacity: Math.min(1, Number((customTheme.backgroundImageOpacity + 0.1).toFixed(2))),
                          })
                        }
                        style={[styles.customThemeStepBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                      >
                        <Feather name="plus" size={13} color={c.foreground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={[styles.customThemeBackgroundMeta, { color: c.mutedForeground }]} numberOfLines={1}> 
                    {customTheme.backgroundImageUri ? `Selected: ${selectedBackgroundImageLabel}` : selectedBackgroundImageLabel}
                  </Text>

                  <Divider color={c.border} />
                  <Text style={[styles.customThemeSectionLabel, { color: c.foreground }]}>Live Preview</Text>
                  <View
                    style={[
                      styles.customThemePreviewShell,
                      {
                        backgroundColor: customPreviewPalette.background,
                        borderColor: customPreviewPalette.border,
                        borderRadius: customPreviewRadius,
                        borderWidth: customPreviewBorderWidth,
                        ...(customTheme.enabled
                          ? createShadowStyle({
                              color: customTheme.shadowColor,
                              opacity: customTheme.shadowStrength,
                              blur: 8,
                              y: 3,
                              elevation: 4,
                            })
                          : null),
                      },
                    ]}
                  >
                    <View style={[styles.customThemePreviewCard, { backgroundColor: customPreviewPalette.card, borderColor: customPreviewPalette.border, borderRadius: customPreviewRadius, borderWidth: customPreviewBorderWidth }]}> 
                      <Text style={[styles.customThemePreviewTitle, { color: customPreviewPalette.cardForeground }]}>Quest Card Preview</Text>
                      <Text style={[styles.customThemePreviewDesc, { color: customPreviewPalette.mutedForeground }]}>Tracked quest and notes surface</Text>
                      <View style={[styles.customThemePreviewPill, { backgroundColor: customPreviewPalette.primary }]}>
                        <Text style={[styles.customThemePreviewPillText, { color: customPreviewPalette.primaryForeground }]}>Primary Action</Text>
                      </View>
                    </View>
                    <View style={styles.customThemePreviewFooter}>
                      <Text style={[styles.customThemePreviewMeta, { color: customPreviewPalette.foreground }]}>Texture: {customTheme.texturePattern}</Text>
                      <Text style={[styles.customThemePreviewMeta, { color: customPreviewPalette.mutedForeground }]}>
                        {customTheme.backgroundImageUri ? "Image URI set" : "No image URI"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.customThemeActionRow}>
                    <TouchableOpacity
                      onPress={() => updateCustomTheme({ enabled: true })}
                      style={[styles.customThemeActionBtn, { borderColor: c.primary, backgroundColor: c.primary + "1f" }]}
                    >
                      <Feather name="check-circle" size={13} color={c.primary} />
                      <Text style={[styles.customThemeActionText, { color: c.primary }]}>Apply Custom Theme</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={resetCustomTheme}
                      style={[styles.customThemeActionBtn, { borderColor: c.border, backgroundColor: c.secondary }]}
                    >
                      <Feather name="rotate-ccw" size={13} color={c.foreground} />
                      <Text style={[styles.customThemeActionText, { color: c.foreground }]}>Reset</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
            )}

            {activeDisplayTab === "layout" && (
            <View style={[styles.card, getSectionCardStyle(showLayoutUi), { backgroundColor: c.card, borderColor: c.border }]}> 
              <TouchableOpacity
                onPress={() => { if (!sectionsLockedOpen) setShowLayoutUi((prev) => !prev); }}
                activeOpacity={sectionsLockedOpen ? 1 : 0.82}
                style={[styles.savedPresetSectionToggle, { borderColor: c.border, backgroundColor: c.secondary }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: c.foreground }]}>Layout & UI Controls</Text>
                  <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Manage text, spacing, density, and compact layout options.</Text>
                </View>
                {sectionsLockedOpen ? null : <Feather name={showLayoutUi ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />}
              </TouchableOpacity>
              {showLayoutUi && (
                <>
                  <View>
                    <Text style={[styles.settingLabel, { color: c.foreground }]}>Font Size</Text>
                    <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Adjust global UI size scaling.</Text>
                  </View>
                  <View style={[styles.presetGrid, responsivePresetGridStyle]}>
                    {FONT_SCALE_META.map((preset) => {
                      const active = fontScale === preset.id;
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          onPress={() => updateSettings({ fontScale: preset.id })}
                          activeOpacity={0.84}
                          style={[
                            styles.presetCard,
                            responsivePresetCardStyle,
                            {
                              borderColor: active ? c.primary : c.border,
                              backgroundColor: active ? c.primary + "18" : c.secondary,
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.presetTitle, { color: active ? c.primary : c.foreground }]}>{preset.label}</Text>
                            <Text style={[styles.presetDesc, { color: c.mutedForeground }]}>{preset.desc}</Text>
                          </View>
                          {active ? <Feather name="check" size={14} color={c.primary} /> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Divider color={c.border} />
                  <View>
                    <Text style={[styles.settingLabel, { color: c.foreground }]}>Font Style</Text>
                    <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Choose your global font family.</Text>
                  </View>
                  <View style={[styles.presetGrid, responsivePresetGridStyle]}>
                    {FONT_FAMILY_META.map((preset) => {
                      const active = fontFamily === preset.id;
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          onPress={() => updateSettings({ fontFamily: preset.id })}
                          activeOpacity={0.84}
                          style={[
                            styles.presetCard,
                            responsivePresetCardStyle,
                            {
                              borderColor: active ? c.primary : c.border,
                              backgroundColor: active ? c.primary + "18" : c.secondary,
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.presetTitle,
                                {
                                  color: active ? c.primary : c.foreground,
                                  fontFamily: FONT_FAMILY_RUNTIME[preset.id],
                                },
                              ]}
                            >
                              {preset.label}{preset.isDefault ? " (Default)" : ""}
                            </Text>
                            <Text style={[styles.presetDesc, { color: c.mutedForeground }]}>{preset.desc}</Text>
                            <Text style={[styles.fontSampleText, { color: c.mutedForeground, fontFamily: FONT_FAMILY_RUNTIME[preset.id] }]}>{preset.sample}</Text>
                          </View>
                          {active ? <Feather name="check" size={14} color={c.primary} /> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Divider color={c.border} />
                  <View>
                    <Text style={[styles.settingLabel, { color: c.foreground }]}>Line Spacing</Text>
                    <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Adjust vertical breathing room globally.</Text>
                  </View>
                  <View style={[styles.presetGrid, responsivePresetGridStyle]}>
                    {LINE_SPACING_META.map((preset) => {
                      const active = lineSpacing === preset.id;
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          onPress={() => updateSettings({ lineSpacing: preset.id })}
                          activeOpacity={0.84}
                          style={[
                            styles.presetCard,
                            responsivePresetCardStyle,
                            {
                              borderColor: active ? c.primary : c.border,
                              backgroundColor: active ? c.primary + "18" : c.secondary,
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.presetTitle, { color: active ? c.primary : c.foreground }]}>{preset.label}</Text>
                            <Text style={[styles.presetDesc, { color: c.mutedForeground }]}>{preset.desc}</Text>
                          </View>
                          {active ? <Feather name="check" size={14} color={c.primary} /> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Divider color={c.border} />
                  <View>
                    <Text style={[styles.settingLabel, { color: c.foreground }]}>Card Density</Text>
                    <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Control card spacing and padding.</Text>
                  </View>
                  <View style={[styles.presetGrid, responsivePresetGridStyle]}>
                    {CARD_DENSITY_META.map((preset) => {
                      const active = cardDensity === preset.id;
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          onPress={() => updateSettings({ cardDensity: preset.id })}
                          activeOpacity={0.84}
                          style={[
                            styles.presetCard,
                            responsivePresetCardStyle,
                            {
                              borderColor: active ? c.primary : c.border,
                              backgroundColor: active ? c.primary + "18" : c.secondary,
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.presetTitle, { color: active ? c.primary : c.foreground }]}>{preset.label}</Text>
                            <Text style={[styles.presetDesc, { color: c.mutedForeground }]}>{preset.desc}</Text>
                          </View>
                          {active ? <Feather name="check" size={14} color={c.primary} /> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Divider color={c.border} />
                  <View>
                    <Text style={[styles.settingLabel, { color: c.foreground }]}>UI Zoom</Text>
                    <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Scale the entire interface for readability.</Text>
                  </View>
                  <View style={[styles.presetGrid, responsivePresetGridStyle]}>
                    {DISPLAY_ZOOM_META.map((preset) => {
                      const active = settings.displayZoom === preset.id;
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          onPress={() => updateSettings({ displayZoom: preset.id })}
                          activeOpacity={0.84}
                          style={[
                            styles.presetCard,
                            responsivePresetCardStyle,
                            {
                              borderColor: active ? c.primary : c.border,
                              backgroundColor: active ? c.primary + "18" : c.secondary,
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.presetTitle, { color: active ? c.primary : c.foreground }]}>{preset.label}</Text>
                            <Text style={[styles.presetDesc, { color: c.mutedForeground }]}>{preset.desc}</Text>
                          </View>
                          {active ? <Feather name="check" size={14} color={c.primary} /> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Divider color={c.border} />
                  <ToggleRow
                    label="Compact Mode"
                    desc="Reduces spacing and card padding throughout the app"
                    value={settings.compactMode}
                    onChange={(v) => updateSettings({ compactMode: v })}
                    trackColor={c.primary}
                  />
                </>
              )}
            </View>
            )}

            {activeDisplayTab === "effects" && (
            <View style={[styles.card, getSectionCardStyle(showEffects), { backgroundColor: c.card, borderColor: c.border }]}> 
              <TouchableOpacity
                onPress={() => { if (!sectionsLockedOpen) setShowEffects((prev) => !prev); }}
                activeOpacity={sectionsLockedOpen ? 1 : 0.82}
                style={[styles.savedPresetSectionToggle, { borderColor: c.border, backgroundColor: c.secondary }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: c.foreground }]}>Effects Settings</Text>
                  <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Configure motion intensity, motion controls, effect intensity, and individual effect toggles.</Text>
                </View>
                {sectionsLockedOpen ? null : <Feather name={showEffects ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />}
              </TouchableOpacity>
              {showEffects && (
                <>
              <OptionGroupHeader
                title="Motion Intensity"
                desc="Sets the overall strength of screen motion and flash-style effects while keeping the individual toggles below."
              />
              <View style={[styles.presetGrid, responsivePresetGridStyle]}>
                {MOTION_PRESET_META.map((preset) => {
                  const active = motionIntensity === preset.id;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      onPress={() => updateSettings({ motionIntensity: preset.id })}
                      activeOpacity={0.84}
                      style={[
                        styles.presetCard,
                        responsivePresetCardStyle,
                        {
                          borderColor: active ? c.primary : c.border,
                          backgroundColor: active ? c.primary + "18" : c.secondary,
                        },
                      ]}
                    >
                      <View style={[styles.presetIcon, { backgroundColor: active ? c.primary + "30" : c.muted + "55" }]}> 
                        <Feather name={preset.icon} size={14} color={active ? c.primary : c.mutedForeground} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.presetTitle, { color: active ? c.primary : c.foreground }]}>{preset.label}</Text>
                        <Text style={[styles.presetDesc, { color: c.mutedForeground }]} numberOfLines={2}>{preset.desc}</Text>
                      </View>
                      {active ? <Feather name="check" size={14} color={c.primary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Divider color={c.border} />
              <View style={[styles.effectMasterRow]}>
                <View style={[styles.effectIconBox, { backgroundColor: c.primary + "22" }]}> 
                  <Feather name="sliders" size={18} color={c.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.settingLabel, { color: c.foreground }]}>Enable Motions</Text>
                  <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Master switch for all interface motion styles</Text>
                </View>
                <Switch
                  value={motionSettings.enabled}
                  onValueChange={(v) => updateSettings({ motions: { ...motionSettings, enabled: v } })}
                  trackColor={{ false: c.muted, true: c.primary }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={c.muted}
                />
              </View>
              <Divider color={c.border} />
              <OptionGroupHeader
                title="Interface Motion Controls"
                desc="Motion is configured by style. Each style lists where it is used so behavior stays consistent app-wide."
              />

              {MOTION_ROWS.map((row) => {
                const motionLocked = motionIntensity === "off" || !motionSettings.enabled;
                const isTesting = activeMotionPreview === row.key;

                return (
                  <React.Fragment key={row.key}>
                    <Divider color={c.border} />
                    <View style={[styles.effectRow, motionLocked ? styles.rowDisabled : null]}>
                      <View style={[styles.effectIconBox, { backgroundColor: row.color + "22" }]}> 
                        <Feather name={row.icon as any} size={16} color={row.color} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.settingLabel, { color: c.foreground }]}>{row.label}</Text>
                        <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>{row.desc}</Text>
                        <Text style={[styles.motionUsageText, { color: c.mutedForeground }]}>{row.usedIn}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => playMotionPreview(row.key)}
                        activeOpacity={0.82}
                        style={[
                          styles.motionTestBtn,
                          {
                            borderColor: row.color + "66",
                            backgroundColor: isTesting ? row.color + "22" : c.secondary,
                            opacity: motionLocked ? 0.65 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.motionTestBtnText, { color: isTesting ? row.color : c.foreground }]}>Test</Text>
                      </TouchableOpacity>
                      <Switch
                        value={motionSettings[row.key]}
                        onValueChange={(v) => updateMotion(row.key, v)}
                        trackColor={{ false: c.muted, true: row.color }}
                        thumbColor="#FFFFFF"
                        ios_backgroundColor={c.muted}
                        disabled={motionLocked}
                      />
                    </View>
                  </React.Fragment>
                );
              })}
              <View style={[styles.motionPreviewCard, motionIntensity === "off" || !motionSettings.enabled ? styles.rowDisabled : null, { borderColor: c.border, backgroundColor: c.secondary }]}> 
                <Text style={[styles.motionPreviewLabel, { color: c.mutedForeground }]}>Motion Preview</Text>
                <Animated.View
                  style={previewContainerStyle}
                >
                  <View style={[styles.motionPreviewTile, { backgroundColor: c.card, borderColor: c.primary + "44" }]}> 
                    <Text style={[styles.motionPreviewTitle, { color: c.foreground }]}>
                      {activeMotionPreview
                        ? `${MOTION_ROWS.find((row) => row.key === activeMotionPreview)?.label ?? "Motion"} Preview`
                        : "Tap Test on any motion row"}
                    </Text>
                    <Text style={[styles.motionPreviewDesc, { color: c.mutedForeground }]}>Current intensity: {MOTION_LABELS[motionIntensity]}</Text>
                  </View>
                </Animated.View>
              </View>
              <Divider color={c.border} />
              <View style={[styles.effectMasterRow]}>
                <View style={[styles.effectIconBox, { backgroundColor: c.primary + "22" }]}> 
                  <Feather name="zap" size={18} color={c.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.settingLabel, { color: c.foreground }]}>Enable Effects</Text>
                  <Text style={[styles.settingDesc, { color: c.mutedForeground }]}> 
                    Animated overlays that react to gameplay events
                  </Text>
                </View>
                <Switch
                  value={fx.enabled}
                  onValueChange={(v) => updateEffect("enabled", v)}
                  trackColor={{ false: c.muted, true: c.primary }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={c.muted}
                />
              </View>
              <Divider color={c.border} />
              <OptionGroupHeader
                title="Effects Intensity"
                desc="Controls only visual effect strength. Motion settings do not change this intensity."
              />
              <View style={[styles.presetGrid, responsivePresetGridStyle]}>
                {EFFECT_INTENSITY_META.map((preset) => {
                  const active = effectsIntensity === preset.id;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      onPress={() => updateSettings({ effectsIntensity: preset.id })}
                      activeOpacity={0.84}
                      style={[
                        styles.presetCard,
                        responsivePresetCardStyle,
                        {
                          borderColor: active ? c.primary : c.border,
                          backgroundColor: active ? c.primary + "18" : c.secondary,
                        },
                      ]}
                    >
                      <View style={[styles.presetIcon, { backgroundColor: active ? c.primary + "30" : c.muted + "55" }]}> 
                        <Feather name={preset.icon} size={14} color={active ? c.primary : c.mutedForeground} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.presetTitle, { color: active ? c.primary : c.foreground }]}>{preset.label}</Text>
                        <Text style={[styles.presetDesc, { color: c.mutedForeground }]} numberOfLines={2}>{preset.desc}</Text>
                      </View>
                      {active ? <Feather name="check" size={14} color={c.primary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
              
              {EFFECT_ROWS.map((row, i) => {
                const effectsLocked = !fx.enabled;

                return (
                  <React.Fragment key={row.key}>
                    <Divider color={c.border} />
                    <View style={[styles.effectRow, effectsLocked ? styles.rowDisabled : null]}>
                      <View style={[styles.effectIconBox, { backgroundColor: row.color + "22" }]}> 
                        <Feather name={row.icon as any} size={16} color={row.color} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.settingLabel, { color: c.foreground }]}>{row.label}</Text>
                        <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>{row.desc}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => playEffectPreview(row.key)}
                        activeOpacity={0.82}
                        style={[
                          styles.motionTestBtn,
                          {
                            borderColor: row.color + "66",
                            backgroundColor: c.secondary,
                            opacity: effectsLocked ? 0.6 : 1,
                          },
                        ]}
                        disabled={effectsLocked}
                      >
                        <Text style={[styles.motionTestBtnText, { color: row.color }]}>Test</Text>
                      </TouchableOpacity>
                      <Switch
                        value={fx[row.key]}
                        onValueChange={(v) => updateEffect(row.key, v)}
                        trackColor={{ false: c.muted, true: row.color }}
                        thumbColor="#FFFFFF"
                        ios_backgroundColor={c.muted}
                        disabled={effectsLocked}
                      />
                    </View>
                  </React.Fragment>
                );
              })}
                </>
              )}
            </View>
            )}

            {activeDisplayTab === "visibility" && (
            <View style={[styles.card, getSectionCardStyle(showStatusSourceDisplay), { backgroundColor: c.card, borderColor: c.border }]}> 
              <TouchableOpacity
                onPress={() => { if (!sectionsLockedOpen) setShowStatusSourceDisplay((prev) => !prev); }}
                activeOpacity={sectionsLockedOpen ? 1 : 0.82}
                style={[styles.savedPresetSectionToggle, { borderColor: c.border, backgroundColor: c.secondary }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: c.foreground }]}>Status and Source Settings</Text>
                  <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Control condition pill position and source tag display style.</Text>
                </View>
                {sectionsLockedOpen ? null : <Feather name={showStatusSourceDisplay ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />}
              </TouchableOpacity>
              {showStatusSourceDisplay && (
                <>
                  <View style={styles.optionGroupBlock}>
                    <OptionGroupHeader
                      title="Condition/Buff Event Pill Position"
                      desc="Choose where the 5-second status pill appears when conditions are added or removed."
                    />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {[
                        { id: "top", label: "Top" },
                        { id: "bottom", label: "Bottom" },
                      ].map((opt) => {
                        const active = settings.statusPillPosition === opt.id;
                        return (
                          <TouchableOpacity
                            key={opt.id}
                            onPress={() => updateSettings({ statusPillPosition: opt.id as StatusPillPosition })}
                            activeOpacity={0.85}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: active ? c.primary : c.border,
                              backgroundColor: active ? c.primary + "22" : c.secondary,
                            }}
                          >
                            <Text style={{ color: active ? c.primary : c.mutedForeground, fontSize: 12, fontWeight: "700" }}>{opt.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                  <Divider color={c.border} />
                  <View style={styles.optionGroupBlock}>
                    <OptionGroupHeader
                      title="Spells and Items Source Tags"
                      desc="Show source badges as full labels, O/C tags, dots, or hide them entirely across spells and inventory items."
                    />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {[
                        { id: "full", label: "Official / Custom" },
                        { id: "compact", label: "O / C" },
                        { id: "dot", label: "Blue / Red Dots" },
                        { id: "hidden", label: "Off" },
                      ].map((opt) => {
                        const active = settings.spellSourceTagStyle === opt.id;
                        return (
                          <TouchableOpacity
                            key={opt.id}
                            onPress={() => updateSettings({ spellSourceTagStyle: opt.id as SpellSourceTagStyle })}
                            activeOpacity={0.85}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: active ? c.primary : c.border,
                              backgroundColor: active ? c.primary + "22" : c.secondary,
                            }}
                          >
                            <Text style={{ color: active ? c.primary : c.mutedForeground, fontSize: 12, fontWeight: "700" }}>{opt.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}
            </View>
            )}

            {activeDisplayTab === "visibility" && (
            <View style={[styles.card, getSectionCardStyle(showSheetDisplayToggles), { backgroundColor: c.card, borderColor: c.border }]}> 
              <TouchableOpacity
                onPress={() => { if (!sectionsLockedOpen) setShowSheetDisplayToggles((prev) => !prev); }}
                activeOpacity={sectionsLockedOpen ? 1 : 0.82}
                style={[styles.savedPresetSectionToggle, { borderColor: c.border, backgroundColor: c.secondary }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: c.foreground }]}>Sheet Visibility Toggles</Text>
                  <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Choose which sheet sections are visible.</Text>
                </View>
                {sectionsLockedOpen ? null : <Feather name={showSheetDisplayToggles ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />}
              </TouchableOpacity>
              {showSheetDisplayToggles && (
                <>
                  <ToggleRow
                    label="Show Passive Perception"
                    desc="Display passive perception score on the character sheet"
                    value={settings.showPassivePerception}
                    onChange={(v) => updateSettings({ showPassivePerception: v })}
                    trackColor={c.primary}
                  />
                  <Divider color={c.border} />
                  <ToggleRow
                    label="Show Currency"
                    desc="Display the gold and currency tracker on the character sheet"
                    value={settings.showCurrency}
                    onChange={(v) => updateSettings({ showCurrency: v })}
                    trackColor={c.primary}
                  />
                  <Divider color={c.border} />
                  <ToggleRow
                    label="Show Conditions"
                    desc="Display the active conditions panel and controls"
                    value={settings.showConditionsSection}
                    onChange={(v) => updateSettings({ showConditionsSection: v })}
                    trackColor={c.primary}
                  />
                  <Divider color={c.border} />
                  <ToggleRow
                    label="Show Languages & Defenses"
                    desc="Display the languages, proficiencies, and resistance summary"
                    value={settings.showLanguagesDefensesSection}
                    onChange={(v) => updateSettings({ showLanguagesDefensesSection: v })}
                    trackColor={c.primary}
                  />
                  <Divider color={c.border} />
                  <ToggleRow
                    label="Show Background Roleplay"
                    desc="Display Trait, Ideal, Bond, and Flaw on the character sheet"
                    value={settings.showBackgroundRoleplaySection}
                    onChange={(v) => updateSettings({ showBackgroundRoleplaySection: v })}
                    trackColor={c.primary}
                  />
                  <Divider color={c.border} />
                  <ToggleRow
                    label="Show Feats"
                    desc="Display the feats section and quick feat management"
                    value={settings.showFeatsSection}
                    onChange={(v) => updateSettings({ showFeatsSection: v })}
                    trackColor={c.primary}
                  />
                  <Divider color={c.border} />
                  <ToggleRow
                    label="Show Class Features"
                    desc="Display passive class features in the sheet"
                    value={settings.showClassFeaturesSection}
                    onChange={(v) => updateSettings({ showClassFeaturesSection: v })}
                    trackColor={c.primary}
                  />
                  <Divider color={c.border} />
                  <ToggleRow
                    label="Show Tracked Quest"
                    desc="Display the tracked quest card on the sheet"
                    value={settings.showTrackedQuest}
                    onChange={(v) => updateSettings({ showTrackedQuest: v })}
                    trackColor={c.primary}
                  />
                </>
              )}
            </View>
            )}

            {activeDisplayTab === "accessibility" && (
            <View style={[styles.card, getSectionCardStyle(showAccessibilityShortcuts), { backgroundColor: c.card, borderColor: c.border }]}> 
              <TouchableOpacity
                onPress={() => { if (!sectionsLockedOpen) setShowAccessibilityShortcuts((prev) => !prev); }}
                activeOpacity={sectionsLockedOpen ? 1 : 0.82}
                style={[styles.savedPresetSectionToggle, { borderColor: c.border, backgroundColor: c.secondary }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: c.foreground }]}>Accessibility Display Presets</Text>
                  <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>Applies low-risk combinations of theme, readability, density, and motion settings for faster setup.</Text>
                </View>
                {sectionsLockedOpen ? null : <Feather name={showAccessibilityShortcuts ? "chevron-up" : "chevron-down"} size={18} color={c.mutedForeground} />}
              </TouchableOpacity>
              {showAccessibilityShortcuts && (
                <View style={[styles.presetGrid, responsivePresetGridStyle]}>
                  {ACCESSIBILITY_PRESET_META.map((preset) => {
                    const active = matchesAccessibilityPreset(settings, fx, preset.id);
                    return (
                      <TouchableOpacity
                        key={preset.id}
                        onPress={() => {
                          if (active) {
                            resetDisplaySettings();
                          } else {
                            updateSettings(buildAccessibilityPresetSettings(preset.id, fx));
                          }
                        }}
                        activeOpacity={0.84}
                        style={[
                          styles.presetCard,
                          responsivePresetCardStyle,
                          {
                            borderColor: active ? c.primary : c.border,
                            backgroundColor: active ? c.primary + "18" : c.secondary,
                          },
                        ]}
                      >
                        <View style={[styles.presetIcon, { backgroundColor: active ? c.primary + "30" : c.muted + "55" }]}> 
                          <Feather name={preset.icon} size={14} color={active ? c.primary : c.mutedForeground} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.presetTitle, { color: active ? c.primary : c.foreground }]}>{preset.label}</Text>
                          <Text style={[styles.presetDesc, { color: c.mutedForeground }]} numberOfLines={2}>{preset.desc}</Text>
                        </View>
                        {active ? <Feather name="check" size={14} color={c.primary} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
            )}

            {activeDisplayTab === "reset" && (
            <View style={[styles.card, getSectionCardStyle(), { backgroundColor: c.card, borderColor: c.border }]}> 
              <Text style={[styles.settingLabel, { color: c.foreground }]}>Reset Display Settings</Text>
              <Text style={[styles.settingDesc, { color: c.mutedForeground }]}> 
                Restores theme, display presets, motion, readability, and section visibility to the app defaults.
              </Text>
              <TouchableOpacity
                onPress={confirmResetDisplaySettings}
                activeOpacity={0.85}
                style={[styles.resetDisplayBtn, { backgroundColor: c.secondary, borderColor: c.border }]}
              >
                <Feather name="rotate-ccw" size={14} color={c.foreground} />
                <Text style={[styles.resetDisplayBtnText, { color: c.foreground }]}>Return Display to Default</Text>
              </TouchableOpacity>
            </View>
            )}
        </View>
      </ScrollHintScrollView>
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  const c = useColors();
  return (
    <Text style={[styles.sectionHeader, { color: c.mutedForeground }]}>{label}</Text>
  );
}

function SubsectionLabel({ label }: { label: string }) {
  const c = useColors();
  return (
    <View style={styles.subsectionHeaderRow}>
      <View style={[styles.subsectionHeaderLine, { backgroundColor: c.border }]} />
      <Text style={[styles.subsectionHeader, { color: c.foreground }]}>{label}</Text>
      <View style={[styles.subsectionHeaderLine, { backgroundColor: c.border }]} />
    </View>
  );
}

function OptionGroupHeader({ title, desc }: { title: string; desc: string }) {
  const c = useColors();
  return (
    <View style={styles.optionGroupHeader}>
      <View style={styles.optionGroupHeaderRow}>
        <View style={[styles.optionGroupHeaderLine, { backgroundColor: c.border }]} />
        <Text style={[styles.optionGroupTitle, { color: c.foreground }]}>{title}</Text>
        <View style={[styles.optionGroupHeaderLine, { backgroundColor: c.border }]} />
      </View>
      <Text style={[styles.optionGroupDesc, { color: c.mutedForeground }]}>{desc}</Text>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

function SavedPresetVisualPreview({ settings }: { settings: Partial<AppSettings> }) {
  const resolved = resolveSavedPresetPreviewSettings(settings);
  const theme = THEMES[resolved.themeId];
  const accent = resolved.customAccent ?? theme.palette.primary;
  const previewFontFamily = FONT_FAMILY_RUNTIME[resolved.fontFamily];
  const previewFontLabel = FONT_FAMILY_LABELS[resolved.fontFamily];

  const fontSizeMap: Record<FontScaleId, number> = { sm: 12, md: 14, lg: 17, xl: 20 };
  const spacingMap: Record<LineSpacingId, number> = { tight: 2, normal: 3, relaxed: 5 };
  const densityPaddingMap: Record<CardDensityId, number> = { compact: 4, comfortable: 6, airy: 8 };

  const innerPad = densityPaddingMap[resolved.cardDensity];
  const glyphFontSize = fontSizeMap[resolved.fontScale];
  const lineGap = spacingMap[resolved.lineSpacing];

  return (
    <View style={[styles.savedPresetPreview, { backgroundColor: theme.previewColors[0], borderColor: theme.palette.border }]}> 
      <View style={[styles.savedPresetPreviewTop, { backgroundColor: theme.previewColors[2], paddingHorizontal: innerPad + 2, paddingVertical: 4 }]}> 
        <Text style={[styles.savedPresetPreviewGlyph, { color: theme.palette.foreground, fontSize: glyphFontSize, fontFamily: previewFontFamily }]}>Aa</Text>
        <View style={[styles.savedPresetPreviewAccentDot, { backgroundColor: accent }]} />
      </View>

      <View style={[styles.savedPresetPreviewBody, { paddingHorizontal: innerPad + 2, gap: lineGap }]}> 
        <View style={[styles.savedPresetPreviewLine, { height: 4, width: "86%", backgroundColor: theme.palette.foreground + "28" }]} />
        <View style={[styles.savedPresetPreviewLine, { height: 4, width: "74%", backgroundColor: theme.palette.foreground + "22" }]} />
      </View>

      <View style={[styles.savedPresetPreviewFooter, { backgroundColor: theme.previewColors[2], paddingHorizontal: innerPad + 2 }]}> 
        <View style={styles.savedPresetPreviewFooterLeft}>
          <View style={[styles.savedPresetPreviewPill, { backgroundColor: accent + "33" }]} />
          <Text
            style={[
              styles.savedPresetPreviewFontLabel,
              { color: theme.palette.mutedForeground, fontFamily: previewFontFamily },
            ]}
            numberOfLines={1}
          >
            {previewFontLabel}
          </Text>
        </View>
        {resolved.effectsEnabled ? <Feather name="zap" size={10} color={accent} /> : <Feather name="minus-circle" size={10} color={theme.palette.mutedForeground} />}
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
  trackColor,
}: {
  label: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  trackColor: string;
}) {
  const c = useColors();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.settingLabel, { color: c.foreground }]}>{label}</Text>
        {desc ? <Text style={[styles.settingDesc, { color: c.mutedForeground }]}>{desc}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: c.muted, true: trackColor }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={c.muted}
      />
    </View>
  );
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
  displayTabBar: {
    width: "100%",
    borderBottomWidth: 1,
    flexGrow: 0,
    flexShrink: 0,
    height: 52,
    maxHeight: 52,
  },
  displayTabBarContent: {
    paddingHorizontal: 16,
    paddingVertical: 0,
    minHeight: 52,
    alignItems: "center",
    gap: 8,
  },
  displayTab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderBottomWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  displayTabText: { fontSize: 12, fontWeight: "700" },
  scrollContent: { padding: 16, gap: 12 },

  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4,
  },
  subsectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  subsectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  subsectionHeaderLine: {
    flex: 1,
    height: 1,
    opacity: 0.7,
  },

  // Profile preset cards
  presetGrid: { marginTop: 10, gap: 8 },
  savedPresetGrid: { marginTop: 10, gap: 10 },
  savedPresetSectionToggle: {
    borderWidth: 1,
    borderRadius: colors.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  savedPresetCard: {
    borderWidth: 1,
    borderRadius: colors.radius,
    padding: 12,
    gap: 8,
  },
  savedPresetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  slotNameInput: {
    width: 170,
    maxWidth: "55%",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: "700",
  },
  savedPresetInfoRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 10,
  },
  savedPresetInfoLeft: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  savedPresetInfoText: {
    minWidth: 0,
    gap: 2,
  },
  savedPresetOptionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    paddingRight: 2,
  },
  savedPresetOptionItem: {
    width: "32.5%",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  savedPresetTitle: { fontSize: 13, fontWeight: "700" },
  savedPresetLabel: { fontSize: 13, fontWeight: "600" },
  savedPresetMeta: { fontSize: 11, lineHeight: 16 },
  savedPresetPreview: {
    flex: 1,
    minWidth: 132,
    height: 72,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  savedPresetPreviewTop: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  savedPresetPreviewGlyph: {
    fontWeight: "700",
    lineHeight: 22,
  },
  savedPresetPreviewAccentDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
  },
  savedPresetPreviewBody: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  savedPresetPreviewLine: {
    borderRadius: 999,
  },
  savedPresetPreviewFooter: {
    height: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  savedPresetPreviewFooterLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 0,
  },
  savedPresetPreviewPill: {
    width: 30,
    height: 7,
    borderRadius: 999,
  },
  savedPresetPreviewFontLabel: {
    fontSize: 9,
    lineHeight: 11,
    maxWidth: 62,
  },
  savedPresetControls: { flexDirection: "row", gap: 8 },
  savedPresetActionBtn: {
    borderWidth: 1,
    borderRadius: colors.radius,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  savedPresetActionText: { fontSize: 12, fontWeight: "700" },
  savedPresetSecondaryBtn: {
    borderWidth: 1,
    borderRadius: colors.radius,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  savedPresetSecondaryText: { fontSize: 12, fontWeight: "600" },
  presetCard: {
    borderWidth: 1,
    borderRadius: colors.radius,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  presetIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  presetTitle: { fontSize: 13, fontWeight: "700", marginBottom: 1 },
  presetDesc: { fontSize: 11, lineHeight: 16 },
  fontSampleText: { fontSize: 12, lineHeight: 18, marginTop: 4 },

  // Theme preset grid
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  themeCard: {
    width: "48%",
    padding: 12,
    gap: 10,
  },
  swatch: {
    height: 56,
  },
  swatchBg: {
    flex: 1,
    padding: 6,
    flexDirection: "row",
    gap: 5,
    alignItems: "flex-end",
  },
  swatchCard: {
    flex: 2,
    height: 28,
    borderRadius: 4,
    opacity: 0.9,
  },
  swatchAccent: {
    flex: 1,
    height: 18,
    borderRadius: 9,
    opacity: 0.95,
  },
  themeCardBottom: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  themeName: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  themeDesc: {
    fontSize: 10,
    lineHeight: 14,
  },
  activeCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },

  // Card
  card: {
    borderWidth: 1,
    borderRadius: colors.radius * 1.5,
    padding: 16,
    gap: 12,
  },
  displayToggleBtn: {
    borderWidth: 1,
    borderRadius: colors.radius * 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  displayToggleIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  displayToggleTitle: { fontSize: 14, fontWeight: "700" },
  displayToggleDesc: { fontSize: 11, lineHeight: 15 },
  displaySetupInline: { marginTop: 8, gap: 6 },
  displaySetupInlineLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  collapsedTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  settingLabel: { fontSize: 14, fontWeight: "600" },
  settingDesc: { fontSize: 12, lineHeight: 17 },
  optionGroupBlock: {
    gap: 10,
    paddingVertical: 4,
  },
  optionGroupBlockTight: {
    gap: 8,
    paddingVertical: 2,
  },
  optionGroupHeader: {
    gap: 4,
    alignItems: "center",
    paddingTop: 2,
    paddingBottom: 4,
    marginBottom: 2,
  },
  optionGroupHeaderRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionGroupHeaderLine: {
    flex: 1,
    height: 1,
    opacity: 0.7,
  },
  optionGroupTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    textAlign: "center",
  },
  optionGroupDesc: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    maxWidth: 560,
  },

  // Custom theme builder
  customThemeSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  customThemeSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  customThemePaletteColumns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  customThemeColorGrid: {
    gap: 8,
  },
  customThemeColorTile: {
    width: "48%",
    borderWidth: 1,
    borderRadius: colors.radius,
    padding: 8,
    gap: 6,
  },
  customThemeColorRow: {
    borderWidth: 1,
    borderRadius: colors.radius,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customThemeSwatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  customThemeFieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  customThemeTileHex: {
    fontSize: 10,
    fontWeight: "600",
  },
  customThemeEditorShell: {
    borderWidth: 1,
    borderRadius: colors.radius,
    padding: 10,
    gap: 8,
  },
  customThemeEditorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  customThemeEditorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  customThemePresetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  customThemePresetSwatch: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  customThemeHexInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: "600",
  },
  customThemeTokenRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  customThemeStepRow: {
    flexDirection: "row",
    gap: 6,
  },
  customThemeStepBtn: {
    borderWidth: 1,
    borderRadius: 8,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  customThemePatternRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  customThemePatternBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  customThemePreviewShell: {
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  customThemePreviewCard: {
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  customThemePreviewTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  customThemePreviewDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  customThemePreviewPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  customThemePreviewPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  customThemePreviewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  customThemePreviewMeta: {
    fontSize: 10,
    lineHeight: 14,
  },
  customThemeActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  customThemeBackgroundRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 8,
  },
  customThemeBackgroundBtn: {
    borderWidth: 1,
    borderRadius: colors.radius,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1,
    minHeight: 40,
  },
  customThemeBackgroundMeta: {
    fontSize: 11,
    lineHeight: 16,
    minHeight: 16,
  },
  customThemeActionBtn: {
    borderWidth: 1,
    borderRadius: colors.radius,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  customThemeActionText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Accent
  accentCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  accentCircleActive: {
    borderWidth: 3,
    ...createShadowStyle({ y: 2, blur: 4, opacity: 0.3, elevation: 4 }),
  },
  accentLabel: { fontSize: 10, textAlign: "center" },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: colors.radius,
    alignSelf: "flex-start",
  },
  resetBtnText: { fontSize: 12, fontWeight: "600" },
  resetDisplayBtn: {
    borderWidth: 1,
    borderRadius: colors.radius,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  resetDisplayBtnText: { fontSize: 13, fontWeight: "700" },
  summaryHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  summaryIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  summaryChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  summaryChipCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  summaryChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  summaryChipTextCompact: {
    fontSize: 10,
  },

  // Toggles
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  divider: { height: 1, opacity: 0.4 },

  // About
  aboutRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  versionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  versionText: { fontSize: 11, fontWeight: "600" },

  // Effects
  effectMasterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  effectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  motionTestBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  motionTestBtnText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  motionPreviewCard: {
    borderWidth: 1,
    borderRadius: colors.radius,
    marginTop: 10,
    padding: 10,
    gap: 8,
  },
  motionPreviewLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  motionPreviewTile: {
    borderWidth: 1,
    borderRadius: colors.radius,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  motionPreviewTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  motionPreviewDesc: {
    fontSize: 11,
  },
  motionUsageText: {
    fontSize: 10,
    lineHeight: 14,
    fontStyle: "italic",
  },
  jsonGuideBody: {
    marginTop: 10,
    gap: 10,
  },
  jsonGuideTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  jsonGuideCode: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    borderWidth: 1,
    borderRadius: colors.radius,
    padding: 10,
  },
  jsonGuideBullet: {
    fontSize: 12,
    lineHeight: 17,
  },
  effectIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
