import { Platform, type ViewStyle } from "react-native";

type ShadowOptions = {
  color?: string;
  x?: number;
  y?: number;
  blur?: number;
  opacity?: number;
  elevation?: number;
};

function toRgb(color: string) {
  const normalized = color.trim();

  if (normalized.startsWith("#")) {
    const hex = normalized.slice(1);
    const expanded = hex.length === 3
      ? hex.split("").map((char) => char + char).join("")
      : hex;

    if (expanded.length === 6) {
      return {
        r: Number.parseInt(expanded.slice(0, 2), 16),
        g: Number.parseInt(expanded.slice(2, 4), 16),
        b: Number.parseInt(expanded.slice(4, 6), 16),
      };
    }
  }

  const rgbMatch = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: Number.parseInt(rgbMatch[1], 10),
      g: Number.parseInt(rgbMatch[2], 10),
      b: Number.parseInt(rgbMatch[3], 10),
    };
  }

  return { r: 0, g: 0, b: 0 };
}

export function createShadowStyle({
  color = "#000",
  x = 0,
  y = 2,
  blur = 4,
  opacity = 0.15,
  elevation = 3,
}: ShadowOptions = {}): ViewStyle {
  if (Platform.OS === "web") {
    const { r, g, b } = toRgb(color);
    return {
      boxShadow: `${x}px ${y}px ${blur}px rgba(${r}, ${g}, ${b}, ${opacity})`,
    } as ViewStyle;
  }

  return {
    shadowColor: color,
    shadowOffset: { width: x, height: y },
    shadowOpacity: opacity,
    shadowRadius: blur,
    elevation,
  };
}
