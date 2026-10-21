import { useEffect, useRef } from "react";
import { Animated, Easing, Platform } from "react-native";

import { DEFAULT_MOTIONS, type AppSettings } from "@/context/AppSettingsContext";

export function useFilterPanelMotion(showFilters: boolean, settings: AppSettings) {
  const filterAnim = useRef(new Animated.Value(0)).current;
  const motionIntensity = settings.motionIntensity ?? "full";
  const filterMotionEnabled =
    (settings.motions?.enabled ?? DEFAULT_MOTIONS.enabled) &&
    motionIntensity !== "off" &&
    (settings.motions?.filterPanelRevealTransition ?? DEFAULT_MOTIONS.filterPanelRevealTransition);

  useEffect(() => {
    if (!showFilters) {
      filterAnim.setValue(0);
      return;
    }
    if (!filterMotionEnabled) {
      filterAnim.setValue(1);
      return;
    }
    filterAnim.setValue(0);
    Animated.timing(filterAnim, {
      toValue: 1,
      duration: motionIntensity === "subtle" ? 110 : 170,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [filterAnim, filterMotionEnabled, motionIntensity, showFilters]);

  return {
    filterPanelAnimatedStyle: {
      opacity: filterAnim,
      transform: [
        {
          translateY: filterAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [6, 0],
          }),
        },
      ],
    },
  };
}
