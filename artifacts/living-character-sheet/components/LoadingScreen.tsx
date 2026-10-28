import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";

interface LoadingScreenProps {
  visible: boolean;
}

export function LoadingScreen({ visible }: LoadingScreenProps) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, spinAnim]);

  // Never keep a full-screen blocking view mounted waiting for an animation
  // completion callback. Some browser runtimes do not complete the fade.
  if (!visible) return null;

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#0F1117",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
      pointerEvents={visible ? "auto" : "none"}
    >
      <View style={{ alignItems: "center", gap: 24 }}>
        {/* Animated Spinner */}
        <Animated.View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            borderWidth: 4,
            borderColor: "#1A1D2E",
            borderTopColor: "#7C3AED",
            borderRightColor: "#7C3AED",
            transform: [{ rotate: spin }],
          }}
        />

        {/* Loading Text */}
        <View style={{ alignItems: "center", gap: 8 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#F1F5F9",
              letterSpacing: 0.5,
            }}
          >
            Loading Companion
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: "#F1F5F9",
              opacity: 0.6,
            }}
          >
            Gathering your character data...
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
