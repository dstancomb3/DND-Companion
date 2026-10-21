import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ThemePalette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  destructive: string;
  destructiveForeground: string;
  primary: string;
  primaryForeground: string;
}

export interface CustomThemeSettings {
  enabled: boolean;
  palette: ThemePalette;
  radius: number;
  borderWidth: number;
  borderOpacity: number;
  shadowStrength: number;
  shadowColor: string;
  texturePattern: "none" | "dots" | "grid" | "noise";
  textureIntensity: number;
  backgroundImageUri: string | null;
  backgroundImageOpacity: number;
}

export type ThemeId =
  | "default"
  | "light"
  | "midnight"
  | "dnd5e"
  | "crimson"
  | "arcane"
  | "verdant"
  | "gold";

export type SpellSourceTagStyle = "full" | "compact" | "dot" | "hidden";
export type StatusPillPosition = "top" | "bottom";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  description: string;
  isDark: boolean;
  palette: ThemePalette;
  previewColors: [string, string, string];
}

const D = "#EF4444";

export const THEMES: Record<ThemeId, ThemeMeta> = {
  default: {
    id: "default",
    name: "Default",
    description: "Dark slate · violet accent",
    isDark: true,
    previewColors: ["#0F1117", "#7C3AED", "#1A1D2E"],
    palette: {
      background: "#0F1117",
      foreground: "#F1F5F9",
      card: "#1A1D2E",
      cardForeground: "#F1F5F9",
      secondary: "#252840",
      secondaryForeground: "#CBD5E1",
      muted: "#252840",
      mutedForeground: "#64748B",
      border: "#2D3154",
      input: "#252840",
      destructive: D,
      destructiveForeground: "#FFFFFF",
      primary: "#7C3AED",
      primaryForeground: "#FFFFFF",
    },
  },
  light: {
    id: "light",
    name: "Light",
    description: "Bright & clean · violet accent",
    isDark: false,
    previewColors: ["#F1F5F9", "#7C3AED", "#FFFFFF"],
    palette: {
      background: "#F1F5F9",
      foreground: "#0F172A",
      card: "#FFFFFF",
      cardForeground: "#0F172A",
      secondary: "#EDF0F7",
      secondaryForeground: "#334155",
      muted: "#E2E8F0",
      mutedForeground: "#64748B",
      border: "#CBD5E1",
      input: "#FFFFFF",
      destructive: "#DC2626",
      destructiveForeground: "#FFFFFF",
      primary: "#7C3AED",
      primaryForeground: "#FFFFFF",
    },
  },
  midnight: {
    id: "midnight",
    name: "Midnight",
    description: "OLED black · sky blue accent",
    isDark: true,
    previewColors: ["#070809", "#38BDF8", "#0D0E12"],
    palette: {
      background: "#070809",
      foreground: "#E2E8F0",
      card: "#0D0E12",
      cardForeground: "#E2E8F0",
      secondary: "#141518",
      secondaryForeground: "#94A3B8",
      muted: "#141518",
      mutedForeground: "#475569",
      border: "#1E2028",
      input: "#141518",
      destructive: D,
      destructiveForeground: "#FFFFFF",
      primary: "#38BDF8",
      primaryForeground: "#020B10",
    },
  },
  dnd5e: {
    id: "dnd5e",
    name: "D&D 5e",
    description: "PHB parchment · crimson red",
    isDark: false,
    previewColors: ["#F5E6C8", "#8B0000", "#EDD9A3"],
    palette: {
      background: "#F5E6C8",
      foreground: "#2C1A0E",
      card: "#EDD9A3",
      cardForeground: "#2C1A0E",
      secondary: "#E4CA88",
      secondaryForeground: "#4A2D15",
      muted: "#DEC07A",
      mutedForeground: "#7A5D40",
      border: "#C4A060",
      input: "#EDD9A3",
      destructive: "#8B0000",
      destructiveForeground: "#F5E6C8",
      primary: "#8B0000",
      primaryForeground: "#F5E6C8",
    },
  },
  crimson: {
    id: "crimson",
    name: "Crimson Keep",
    description: "Dark tavern · blood red",
    isDark: true,
    previewColors: ["#120A0A", "#DC2626", "#1E1010"],
    palette: {
      background: "#120A0A",
      foreground: "#F5DDD5",
      card: "#1E1010",
      cardForeground: "#F5DDD5",
      secondary: "#291515",
      secondaryForeground: "#C9A090",
      muted: "#291515",
      mutedForeground: "#9B7070",
      border: "#3D1A1A",
      input: "#291515",
      destructive: "#EF4444",
      destructiveForeground: "#FFFFFF",
      primary: "#DC2626",
      primaryForeground: "#FFFFFF",
    },
  },
  arcane: {
    id: "arcane",
    name: "Arcane",
    description: "Deep cosmos · arcane purple",
    isDark: true,
    previewColors: ["#08070F", "#A855F7", "#110F1E"],
    palette: {
      background: "#08070F",
      foreground: "#E8E0FF",
      card: "#110F1E",
      cardForeground: "#E8E0FF",
      secondary: "#1A1730",
      secondaryForeground: "#B5ADE0",
      muted: "#1A1730",
      mutedForeground: "#7B72A8",
      border: "#2E2860",
      input: "#1A1730",
      destructive: D,
      destructiveForeground: "#FFFFFF",
      primary: "#A855F7",
      primaryForeground: "#FFFFFF",
    },
  },
  verdant: {
    id: "verdant",
    name: "Verdant",
    description: "Druid's forest · emerald green",
    isDark: true,
    previewColors: ["#070F08", "#22C55E", "#0E1A10"],
    palette: {
      background: "#070F08",
      foreground: "#D4EED8",
      card: "#0E1A10",
      cardForeground: "#D4EED8",
      secondary: "#152418",
      secondaryForeground: "#8FC498",
      muted: "#152418",
      mutedForeground: "#5F8A6B",
      border: "#1F3622",
      input: "#152418",
      destructive: D,
      destructiveForeground: "#FFFFFF",
      primary: "#22C55E",
      primaryForeground: "#061008",
    },
  },
  gold: {
    id: "gold",
    name: "Gold Dragon",
    description: "Ancient hoard · amber gold",
    isDark: true,
    previewColors: ["#100C01", "#D97706", "#1C1703"],
    palette: {
      background: "#100C01",
      foreground: "#FFF4D4",
      card: "#1C1703",
      cardForeground: "#FFF4D4",
      secondary: "#272009",
      secondaryForeground: "#D4B870",
      muted: "#272009",
      mutedForeground: "#A08B50",
      border: "#3D3310",
      input: "#272009",
      destructive: D,
      destructiveForeground: "#FFFFFF",
      primary: "#D97706",
      primaryForeground: "#050300",
    },
  },
};

export const THEME_ORDER: ThemeId[] = [
  "default", "light", "midnight", "dnd5e", "crimson", "arcane", "verdant", "gold",
];

export interface EffectsSettings {
  enabled: boolean;
  critFailBurst: boolean;
  lowHpGlow: boolean;
  deathsDoor: boolean;
  healFlash: boolean;
  damageFlash: boolean;
  longRestFade: boolean;
  potionSparkle: boolean;
  poisonHaze: boolean;
  levelUpBurst: boolean;
}

export const DEFAULT_EFFECTS: EffectsSettings = {
  enabled: true,
  critFailBurst: true,
  lowHpGlow: true,
  deathsDoor: true,
  healFlash: true,
  damageFlash: true,
  longRestFade: true,
  potionSparkle: true,
  poisonHaze: true,
  levelUpBurst: true,
};

export type AccentColor = "violet" | "blue" | "green" | "orange" | "red" | "pink" | "cyan" | "gold";

export const ACCENT_COLORS: Record<AccentColor, string> = {
  violet: "#7C3AED",
  blue:   "#2563EB",
  green:  "#22C55E",
  orange: "#EA580C",
  red:    "#DC2626",
  pink:   "#DB2777",
  cyan:   "#06B6D4",
  gold:   "#D97706",
};

export type ProfilePresetId = "custom" | "minimal" | "combat" | "rp" | "dm";
export type MotionIntensityId = "off" | "subtle" | "full";
export type EffectIntensityId = "subtle" | "full";
export interface MotionSettings {
  enabled: boolean;
  appShellTransition: boolean;
  cardEntrance: boolean;
  createCharacterStepTransition: boolean;
  itemCreatorSectionTransition: boolean;
  spellModalTransition: boolean;
  filterPanelRevealTransition: boolean;
  helpPopupTransition: boolean;
}

export const DEFAULT_MOTIONS: MotionSettings = {
  enabled: true,
  appShellTransition: true,
  cardEntrance: true,
  createCharacterStepTransition: true,
  itemCreatorSectionTransition: true,
  spellModalTransition: true,
  filterPanelRevealTransition: true,
  helpPopupTransition: true,
};

export type FontScaleId = "sm" | "md" | "lg" | "xl";
export type FontFamilyId = "inter" | "cinzel" | "lora" | "manrope" | "nunito";
export type LineSpacingId = "tight" | "normal" | "relaxed";
export type CardDensityId = "compact" | "comfortable" | "airy";
export type DisplayZoomId = "80" | "90" | "100" | "110" | "120";
export type SavedDisplayPresetSlotId = "slot-1" | "slot-2" | "slot-3";

export interface SavedDisplayPreset {
  id: SavedDisplayPresetSlotId;
  slotName?: string;
  label: string;
  savedAt: number;
  settings: Partial<AppSettings>;
}

export interface AppSettings {
  autoConcentrationSave: boolean;
  profilePreset: ProfilePresetId;
  motionIntensity: MotionIntensityId;
  effectsIntensity: EffectIntensityId;
  motions: MotionSettings;
  fontScale: FontScaleId;
  fontFamily: FontFamilyId;
  lineSpacing: LineSpacingId;
  cardDensity: CardDensityId;
  displayZoom: DisplayZoomId;
  themeId: ThemeId;
  customAccent: string | null;
  customTheme: CustomThemeSettings;
  showPassivePerception: boolean;
  showCurrency: boolean;
  compactMode: boolean;
  autoOpenLevelUpModal: boolean;
  showDevRebuildSteps: boolean;
  showDevDeterministicDetails: boolean;
  showDevLandingDemoContent: boolean;
  showConditionsSection: boolean;
  showTrackedQuest: boolean;
  showFeatsSection: boolean;
  showClassFeaturesSection: boolean;
  showLanguagesDefensesSection: boolean;
  showBackgroundRoleplaySection: boolean;
  confirmBeforeDangerousActions: boolean;
  enableLongPressHelpPopups: boolean;
  showHoldToInfoHints: boolean;
  inspectModeEnabled: boolean;
  showScrollHints: boolean;
  showPartyEventPills: boolean;
  snarkyParseMode: boolean;
  disablePartyCardThemes: boolean;
  confirmDmDeleteActions: boolean;
  disableStartingGoldCap: boolean;
  statusPillPosition: StatusPillPosition;
  spellSourceTagStyle: SpellSourceTagStyle;
  effects: EffectsSettings;
  savedDisplayPresets: SavedDisplayPreset[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function normalizeHexColor(input: string, fallback: string): string {
  const value = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  return fallback;
}

function toRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex, "");
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function applyAlpha(hex: string, alpha: number, fallback: string) {
  const rgb = toRgb(hex);
  if (!rgb) return fallback;
  const a = clamp(alpha, 0, 1);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

const DEFAULT_CUSTOM_THEME_PALETTE: ThemePalette = { ...THEMES.default.palette };

export const DEFAULT_CUSTOM_THEME: CustomThemeSettings = {
  enabled: false,
  palette: DEFAULT_CUSTOM_THEME_PALETTE,
  radius: 10,
  borderWidth: 1,
  borderOpacity: 1,
  shadowStrength: 0.2,
  shadowColor: "#000000",
  texturePattern: "none",
  textureIntensity: 0.7,
  backgroundImageUri: null,
  backgroundImageOpacity: 0.2,
};

const DEFAULT_SETTINGS: AppSettings = {
  autoConcentrationSave: false,
  profilePreset: "custom",
  motionIntensity: "full",
  effectsIntensity: "full",
  motions: DEFAULT_MOTIONS,
  fontScale: "md",
  fontFamily: "inter",
  lineSpacing: "normal",
  cardDensity: "comfortable",
  displayZoom: "100",
  themeId: "default",
  customAccent: null,
  customTheme: DEFAULT_CUSTOM_THEME,
  showPassivePerception: true,
  showCurrency: true,
  compactMode: false,
  autoOpenLevelUpModal: true,
  showDevRebuildSteps: false,
  showDevDeterministicDetails: false,
  showDevLandingDemoContent: false,
  showConditionsSection: true,
  showTrackedQuest: true,
  showFeatsSection: true,
  showClassFeaturesSection: true,
  showLanguagesDefensesSection: true,
  showBackgroundRoleplaySection: true,
  confirmBeforeDangerousActions: true,
  enableLongPressHelpPopups: true,
  showHoldToInfoHints: true,
  inspectModeEnabled: false,
  showScrollHints: true,
  showPartyEventPills: true,
  snarkyParseMode: false,
  disablePartyCardThemes: false,
  confirmDmDeleteActions: true,
  disableStartingGoldCap: false,
  statusPillPosition: "bottom",
  spellSourceTagStyle: "full",
  effects: DEFAULT_EFFECTS,
  savedDisplayPresets: [],
};

interface AppSettingsContextType {
  settings: AppSettings;
  theme: ThemeMeta;
  palette: ThemePalette;
  accentHex: string;
  updateSettings: (updates: Partial<AppSettings>) => void;
}

const DEFAULT_THEME = THEMES.default;
const DEFAULT_CTX: AppSettingsContextType = {
  settings: DEFAULT_SETTINGS,
  theme: DEFAULT_THEME,
  palette: DEFAULT_THEME.palette,
  accentHex: DEFAULT_THEME.palette.primary,
  updateSettings: () => {},
};

const AppSettingsContext = createContext<AppSettingsContextType>(DEFAULT_CTX);

// User-facing app settings are persisted in AsyncStorage and intentionally
// separate from dev-only localStorage feature flags.
const SETTINGS_KEY = "@lcs_app_settings";

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const migrated: Partial<AppSettings> = {};
          if (parsed.accentColor && !parsed.customAccent && !parsed.themeId) {
            const hex = ACCENT_COLORS[parsed.accentColor as AccentColor];
            if (hex) migrated.customAccent = hex;
          }
          if (
            parsed.confirmDmDeleteActions == null &&
            parsed.confirmDmQuestDeletes != null
          ) {
            migrated.confirmDmDeleteActions = Boolean(parsed.confirmDmQuestDeletes);
          }
          // Deprecated in Options A2: no runtime consumers remain for these keys.
          // Strip them from hydrated settings while preserving backward compatibility
          // with previously saved snapshots that still include them.
          delete parsed.showBattleNpcDisposition;
          delete parsed.showBattleNpcInitiative;
          delete parsed.showBattleNpcSourceType;
          if (parsed.effects) {
            parsed.effects = { ...DEFAULT_EFFECTS, ...parsed.effects };
          }
          if (parsed.customTheme) {
            const nextRadius = Number(parsed.customTheme.radius);
            const nextBorderWidth = Number(parsed.customTheme.borderWidth);
            const nextBorderOpacity = Number(parsed.customTheme.borderOpacity);
            const nextShadowStrength = Number(parsed.customTheme.shadowStrength);
            const nextTextureIntensity = Number(parsed.customTheme.textureIntensity);
            const nextBackgroundImageOpacity = Number(parsed.customTheme.backgroundImageOpacity);
            parsed.customTheme = {
              ...DEFAULT_CUSTOM_THEME,
              ...parsed.customTheme,
              palette: {
                ...DEFAULT_CUSTOM_THEME.palette,
                ...(parsed.customTheme.palette ?? {}),
              },
              radius: Number.isFinite(nextRadius) ? clamp(nextRadius, 0, 32) : DEFAULT_CUSTOM_THEME.radius,
              borderWidth: Number.isFinite(nextBorderWidth)
                ? clamp(nextBorderWidth, 0, 6)
                : DEFAULT_CUSTOM_THEME.borderWidth,
              borderOpacity: Number.isFinite(nextBorderOpacity)
                ? clamp(nextBorderOpacity, 0, 1)
                : DEFAULT_CUSTOM_THEME.borderOpacity,
              shadowStrength: Number.isFinite(nextShadowStrength)
                ? clamp(nextShadowStrength, 0, 1)
                : DEFAULT_CUSTOM_THEME.shadowStrength,
              textureIntensity: Number.isFinite(nextTextureIntensity)
                ? clamp(nextTextureIntensity, 0, 1)
                : DEFAULT_CUSTOM_THEME.textureIntensity,
              shadowColor: normalizeHexColor(parsed.customTheme.shadowColor ?? "", DEFAULT_CUSTOM_THEME.shadowColor),
              texturePattern:
                parsed.customTheme.texturePattern === "dots" ||
                parsed.customTheme.texturePattern === "grid" ||
                parsed.customTheme.texturePattern === "noise"
                  ? parsed.customTheme.texturePattern
                  : "none",
              backgroundImageUri:
                typeof parsed.customTheme.backgroundImageUri === "string"
                  ? parsed.customTheme.backgroundImageUri
                  : null,
              backgroundImageOpacity: Number.isFinite(nextBackgroundImageOpacity)
                ? clamp(nextBackgroundImageOpacity, 0, 1)
                : DEFAULT_CUSTOM_THEME.backgroundImageOpacity,
            };
          }
          if (parsed.effectsIntensity == null) {
            parsed.effectsIntensity = "full";
          }
          if (parsed.motions) {
            if (
              Object.prototype.hasOwnProperty.call(parsed.motions, "spellFilterPanelTransition") &&
              !Object.prototype.hasOwnProperty.call(parsed.motions, "filterPanelRevealTransition")
            ) {
              parsed.motions.filterPanelRevealTransition = parsed.motions.spellFilterPanelTransition;
            }
            delete parsed.motions.spellFilterPanelTransition;
            parsed.motions = { ...DEFAULT_MOTIONS, ...parsed.motions };
          }
          setSettings((prev) => ({ ...prev, ...parsed, ...migrated }));
        } catch {}
      }
    });
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next: AppSettings = { ...prev, ...updates };

      const isApplyingNamedPreset =
        updates.profilePreset != null && updates.profilePreset !== "custom";
      const explicitlySetPreset = Object.prototype.hasOwnProperty.call(updates, "profilePreset");

      // If a user tweaks settings after applying a named preset, mark preset as custom.
      if (!isApplyingNamedPreset && !explicitlySetPreset && prev.profilePreset !== "custom") {
        next.profilePreset = "custom";
      }

      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const theme = THEMES[settings.themeId] ?? THEMES.default;
  const customTheme = settings.customTheme ?? DEFAULT_CUSTOM_THEME;
  const resolvedPalette = customTheme.enabled
    ? { ...theme.palette, ...customTheme.palette }
    : theme.palette;
  const palette: ThemePalette = {
    ...resolvedPalette,
    border:
      customTheme.enabled && customTheme.borderOpacity < 1
        ? applyAlpha(resolvedPalette.border, customTheme.borderOpacity, resolvedPalette.border)
        : resolvedPalette.border,
  };
  const accentHex = settings.customAccent ?? palette.primary;

  return (
    <AppSettingsContext.Provider value={{ settings, theme, palette, accentHex, updateSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextType {
  return useContext(AppSettingsContext);
}
