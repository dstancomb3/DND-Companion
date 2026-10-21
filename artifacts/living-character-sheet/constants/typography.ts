import type { DisplayZoomId, FontFamilyId, FontScaleId, LineSpacingId } from "@/context/AppSettingsContext";

export const FONT_FAMILY_RUNTIME: Record<FontFamilyId, string> = {
  inter: "Inter_400Regular",
  cinzel: "Cinzel_400Regular",
  lora: "Lora_400Regular",
  manrope: "BebasNeue_400Regular",
  nunito: "ArchivoBlack_400Regular",
};

export const FONT_UI_SCALE: Record<FontScaleId, number> = {
  sm: 0.96,
  md: 1,
  lg: 1.06,
  xl: 1.12,
};

export const LINE_SPACING_UI_SCALE: Record<LineSpacingId, number> = {
  tight: 0.96,
  normal: 1,
  relaxed: 1.08,
};

export const DISPLAY_ZOOM_SCALE: Record<DisplayZoomId, number> = {
  "80": 0.8,
  "90": 0.9,
  "100": 1,
  "110": 1.1,
  "120": 1.2,
};

export const DISPLAY_ZOOM_LABEL: Record<DisplayZoomId, string> = {
  "80": "80%",
  "90": "90%",
  "100": "100%",
  "110": "110%",
  "120": "120%",
};
