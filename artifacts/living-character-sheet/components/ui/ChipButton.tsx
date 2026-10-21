import React from "react";
import { TouchableOpacity, Text, StyleSheet, type ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface ChipButtonProps {
  label: string;
  onPress: () => void;
  variant?: "default" | "primary" | "destructive" | "ghost";
  style?: ViewStyle;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function ChipButton({
  label,
  onPress,
  variant = "default",
  style,
  disabled,
  size = "md",
}: ChipButtonProps) {
  const c = useColors();

  const bgColors = {
    default: c.secondary,
    primary: c.primary,
    destructive: c.destructive,
    ghost: "transparent",
  };

  const textColors = {
    default: c.secondaryForeground,
    primary: c.primaryForeground,
    destructive: c.destructiveForeground,
    ghost: c.mutedForeground,
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          backgroundColor: bgColors[variant],
          borderRadius: c.radius,
          opacity: disabled ? 0.5 : 1,
          paddingVertical: size === "sm" ? 6 : 10,
          paddingHorizontal: size === "sm" ? 12 : 16,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: textColors[variant] },
          size === "sm" && styles.smallLabel,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  smallLabel: {
    fontSize: 12,
  },
});
