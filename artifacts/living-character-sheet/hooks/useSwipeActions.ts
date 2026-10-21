import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder } from "react-native";

import type { AppSettings } from "@/context/AppSettingsContext";

interface UseSwipeActionsOptions {
  actionWidth: number;
  actionCount?: number;
  thresholdRatio?: number;
  canSwipe?: boolean;
  motionIntensity?: AppSettings["motionIntensity"];
}

interface UseSwipeActionsResult {
  animatedStyle: {
    transform: [{ translateX: Animated.Value }];
  };
  panHandlers: ReturnType<typeof PanResponder.create>["panHandlers"];
  revealed: boolean;
  close: () => void;
  open: () => void;
}

const SWIPE_ACTIVATION_DX = 5;
const SWIPE_ACTIVATION_DY = 20;

export function useSwipeActions({
  actionWidth,
  actionCount = 1,
  thresholdRatio = 0.6,
  canSwipe = true,
  motionIntensity = "full",
}: UseSwipeActionsOptions): UseSwipeActionsResult {
  const translateX = useRef(new Animated.Value(0)).current;
  const currentX = useRef(0);
  const [revealed, setRevealed] = useState(false);

  const revealDistance = actionWidth * actionCount;
  const threshold = actionWidth * thresholdRatio;
  const shouldAnimate = motionIntensity !== "off";

  useEffect(() => {
    const id = translateX.addListener(({ value }) => {
      currentX.current = value;
    });
    return () => translateX.removeListener(id);
  }, [translateX]);

  const animateTo = useCallback(
    (toValue: number, nextRevealed: boolean) => {
      const finish = () => setRevealed(nextRevealed);
      if (!shouldAnimate) {
        translateX.stopAnimation();
        translateX.setValue(toValue);
        finish();
        return;
      }
      Animated.spring(translateX, {
        toValue,
        useNativeDriver: true,
      }).start(finish);
    },
    [shouldAnimate, translateX]
  );

  const close = useCallback(() => {
    animateTo(0, false);
  }, [animateTo]);

  const open = useCallback(() => {
    animateTo(-revealDistance, true);
  }, [animateTo, revealDistance]);

  useEffect(() => {
    if (!canSwipe && (revealed || currentX.current !== 0)) {
      close();
    }
  }, [canSwipe, close, revealed]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          canSwipe && Math.abs(gesture.dx) > SWIPE_ACTIVATION_DX && Math.abs(gesture.dy) < SWIPE_ACTIVATION_DY,
        onPanResponderGrant: () => {
          translateX.setOffset(currentX.current);
          translateX.setValue(0);
        },
        onPanResponderMove: (_, gesture) => {
          if (!canSwipe) return;
          translateX.setValue(Math.max(-revealDistance, Math.min(0, gesture.dx)));
        },
        onPanResponderRelease: () => {
          if (!canSwipe) {
            close();
            return;
          }
          translateX.flattenOffset();
          if (currentX.current < -threshold) {
            open();
          } else {
            close();
          }
        },
        onPanResponderTerminate: close,
      }),
    [canSwipe, close, open, revealDistance, threshold, translateX]
  );

  return {
    animatedStyle: { transform: [{ translateX }] },
    panHandlers: panResponder.panHandlers,
    revealed,
    close,
    open,
  };
}