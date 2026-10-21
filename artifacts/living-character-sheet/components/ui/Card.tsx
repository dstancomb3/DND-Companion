import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";
import { DEFAULT_MOTIONS, useAppSettings } from "@/context/AppSettingsContext";
import { createShadowStyle } from "../../utils/shadow";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  accentColor?: string;
}

export function Card({ children, style, padding = 16, accentColor }: CardProps) {
  const c = useColors();
  const { settings } = useAppSettings();
  const motion = settings.motionIntensity ?? "full";
  const motionsEnabled = settings.motions?.enabled ?? DEFAULT_MOTIONS.enabled;
  const cardMotionEnabled = motionsEnabled && motion !== "off" && (settings.motions?.cardEntrance ?? DEFAULT_MOTIONS.cardEntrance);
  const duration = motion === "subtle" ? 110 : 170;
  // Always start at 1 — we only animate transform (translateY/scale), never opacity.
  // This prevents cards from being invisible between mount and when the effect fires.
  const anim = useRef(new Animated.Value(cardMotionEnabled ? 0 : 1)).current;
  const useNativeDriver = Platform.OS !== "web";
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!cardMotionEnabled) {
      anim.setValue(1);
      hasMounted.current = true;
      return;
    }

    if (hasMounted.current) {
      anim.setValue(0);
    }
    hasMounted.current = true;

    Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
  }, [anim, cardMotionEnabled, duration, useNativeDriver]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: accentColor ?? c.border,
          borderRadius: c.radiusXl,
          padding,
          // Opacity is always 1 — only transform animates to avoid invisible flash.
          transform: cardMotionEnabled ? [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [motion === "subtle" ? 2 : 5, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.995, 1],
              }),
            },
          ] : [],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    marginBottom: 12,
    ...createShadowStyle({ y: 2, blur: 4, opacity: 0.15, elevation: 3 }),
  },
});
