import { useAppSettings } from "@/context/AppSettingsContext";
import colors from "@/constants/colors";
import { FONT_FAMILY_RUNTIME } from "@/constants/typography";

export function useColors() {
  const { palette, accentHex, settings } = useAppSettings();

  const fontScale = settings.fontScale === "sm"
    ? 0.92
    : settings.fontScale === "lg"
    ? 1.12
    : settings.fontScale === "xl"
    ? 1.24
    : 1;

  const lineSpacingScale = settings.lineSpacing === "tight"
    ? 0.92
    : settings.lineSpacing === "relaxed"
    ? 1.15
    : 1;

  const densityScale = settings.cardDensity === "compact"
    ? 0.88
    : settings.cardDensity === "airy"
    ? 1.16
    : 1;

  const scaleFont = (size: number) => Math.max(10, Math.round(size * fontScale));
  const scaleLineHeight = (size: number) => Math.max(scaleFont(10), Math.round(size * fontScale * lineSpacingScale));
  const densitySpace = (size: number) => Math.max(4, Math.round(size * densityScale));
  const fontFamily = FONT_FAMILY_RUNTIME[settings.fontFamily ?? "inter"];
  const customTheme = settings.customTheme;
  const radius = customTheme?.enabled ? customTheme.radius : colors.radius;
  const radiusScale = (multiplier: number, floor = 2) => Math.max(floor, Math.round(radius * multiplier));
  const radiusXs = radiusScale(0.45);
  const radiusSm = radiusScale(0.75);
  const radiusMd = radiusScale(1);
  const radiusLg = radiusScale(1.3);
  const radiusXl = radiusScale(1.6);
  const radiusPill = radiusScale(2.1, 12);
  const borderWidth = customTheme?.enabled ? customTheme.borderWidth : 1;
  const shadowStrength = customTheme?.enabled ? customTheme.shadowStrength : 0.2;
  const shadowColor = customTheme?.enabled ? customTheme.shadowColor : "#000000";
  const texturePattern = customTheme?.enabled ? customTheme.texturePattern : "none";
  const backgroundImageUri = customTheme?.enabled ? customTheme.backgroundImageUri : null;

  return {
    ...palette,
    primary: accentHex,
    accent: accentHex,
    tint: accentHex,
    radius,
    radiusXs,
    radiusSm,
    radiusMd,
    radiusLg,
    radiusXl,
    radiusPill,
    radiusScale,
    borderWidth,
    shadowStrength,
    shadowColor,
    texturePattern,
    backgroundImageUri,
    fontScale,
    lineSpacingScale,
    densityScale,
    fontFamily,
    scaleFont,
    scaleLineHeight,
    densitySpace,
  };
}
