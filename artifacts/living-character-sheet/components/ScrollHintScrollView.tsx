import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useColors } from "@/hooks/useColors";

type Props = ScrollViewProps & {
  scrollHintLabel?: string;
  showScrollHint?: boolean;
  scrollHintBottomOffset?: number;
  scrollHintAutoHideMs?: number;
};

export const ScrollHintScrollView = forwardRef<ScrollView, Props>(function ScrollHintScrollView(
  {
    children,
    horizontal,
    onLayout,
    onScroll,
    onContentSizeChange,
    scrollEventThrottle,
    scrollHintLabel = "Scroll for more",
    showScrollHint = true,
    scrollHintBottomOffset = 0,
    scrollHintAutoHideMs = 4500,
    ...props
  },
  forwardedRef,
) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { settings } = useAppSettings();
  const scrollRef = useRef<ScrollView | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [isHintDismissed, setIsHintDismissed] = useState(false);

  const attachRef = useCallback(
    (node: ScrollView | null) => {
      scrollRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
        return;
      }
      if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  const handleLayout: NonNullable<ScrollViewProps["onLayout"]> = useCallback(
    (event) => {
      const nextViewport = event.nativeEvent.layout.height;
      setViewportHeight(nextViewport);
      if (!horizontal) {
        setCanScroll(contentHeight > nextViewport + 12);
      }
      onLayout?.(event);
    },
    [contentHeight, horizontal, onLayout],
  );

  const handleContentSizeChange = useCallback(
    (width: number, height: number) => {
      const nextContent = horizontal ? width : height;
      setContentHeight(nextContent);
      if (!horizontal) {
        setCanScroll(nextContent > viewportHeight + 12);
      }
      onContentSizeChange?.(width, height);
    },
    [horizontal, onContentSizeChange, viewportHeight],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!horizontal) {
        const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
        const scrollable = contentSize.height > layoutMeasurement.height + 12;
        const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 24;
        if (scrollable !== canScroll) setCanScroll(scrollable);
        if (nearBottom !== isAtBottom) setIsAtBottom(nearBottom);
      }
      onScroll?.(event);
    },
    [canScroll, horizontal, isAtBottom, onScroll],
  );

  useEffect(() => {
    setIsHintDismissed(false);
  }, [contentHeight, viewportHeight, horizontal, showScrollHint, settings.showScrollHints]);

  useEffect(() => {
    if (
      scrollHintAutoHideMs <= 0 ||
      !settings.showScrollHints ||
      !showScrollHint ||
      horizontal ||
      !canScroll ||
      isAtBottom ||
      isHintDismissed
    ) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setIsHintDismissed(true);
    }, scrollHintAutoHideMs);

    return () => clearTimeout(timeoutId);
  }, [
    canScroll,
    horizontal,
    isAtBottom,
    isHintDismissed,
    scrollHintAutoHideMs,
    settings.showScrollHints,
    showScrollHint,
  ]);

  const shouldShowHint = settings.showScrollHints && showScrollHint && !horizontal && canScroll && !isAtBottom && !isHintDismissed;

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      <ScrollView
        ref={attachRef}
        {...props}
        horizontal={horizontal}
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleScroll}
        scrollEventThrottle={scrollEventThrottle ?? 16}
      >
        {children}
      </ScrollView>

      {shouldShowHint ? (
        <View style={[styles.overlay, { pointerEvents: "box-none", bottom: insets.bottom + 14 + scrollHintBottomOffset }]}> 
          <TouchableOpacity
            onPress={() => {
              setIsHintDismissed(true);
              scrollRef.current?.scrollToEnd?.({ animated: true });
              scrollRef.current?.scrollTo?.({ y: contentHeight, animated: true });
            }}
            activeOpacity={0.85}
            style={[styles.pill, { backgroundColor: c.primary + "E6", borderRadius: c.radiusPill }]}
          >
            <Feather name="arrow-down" size={13} color={c.primaryForeground} />
            <Text style={[styles.pillText, { color: c.primaryForeground }]}>{scrollHintLabel}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    flex: 1,
    minHeight: 0,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
  },
});