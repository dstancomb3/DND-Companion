import { useEffect, useMemo, useRef } from "react";
import { Animated, Platform } from "react-native";

import type { AppSettings } from "@/context/AppSettingsContext";

interface UseToastAnimationOptions {
  visible: boolean;
  dismissAfterMs: number;
  onDismiss: () => void;
  entryOpacityDuration?: number;
  entryTranslateDuration?: number;
  exitDuration?: number;
  initialOffset?: number;
  exitOffset?: number;
  motionIntensity?: AppSettings["motionIntensity"];
  motionsEnabled?: boolean;
}

interface UseToastAnimationResult {
  animatedStyle: {
    opacity: Animated.Value;
    transform: [{ translateY: Animated.Value }];
  };
}

export function useToastAnimation({
  visible,
  dismissAfterMs,
  onDismiss,
  entryOpacityDuration = 180,
  entryTranslateDuration = 220,
  exitDuration = 260,
  initialOffset = 18,
  exitOffset = 10,
  motionIntensity = "full",
  motionsEnabled = true,
}: UseToastAnimationOptions): UseToastAnimationResult {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(initialOffset)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shouldAnimate = motionsEnabled && motionIntensity !== "off";
  const nativeDriver = Platform.OS !== "web";

  useEffect(() => {
    if (!visible) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    opacity.setValue(0);
    translateY.setValue(initialOffset);

    if (shouldAnimate) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: entryOpacityDuration,
          useNativeDriver: nativeDriver,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: entryTranslateDuration,
          useNativeDriver: nativeDriver,
        }),
      ]).start();
    } else {
      opacity.setValue(1);
      translateY.setValue(0);
    }

    timerRef.current = setTimeout(() => {
      const finish = () => onDismiss();

      if (shouldAnimate) {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: exitDuration,
            useNativeDriver: nativeDriver,
          }),
          Animated.timing(translateY, {
            toValue: exitOffset,
            duration: exitDuration,
            useNativeDriver: nativeDriver,
          }),
        ]).start(finish);
      } else {
        finish();
      }
    }, dismissAfterMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    dismissAfterMs,
    entryOpacityDuration,
    entryTranslateDuration,
    exitDuration,
    exitOffset,
    initialOffset,
    motionIntensity,
    motionsEnabled,
    nativeDriver,
    onDismiss,
    opacity,
    shouldAnimate,
    translateY,
    visible,
  ]);

  return useMemo(
    () => ({
      animatedStyle: {
        opacity,
        transform: [{ translateY }],
      },
    }),
    [opacity, translateY]
  );
}
