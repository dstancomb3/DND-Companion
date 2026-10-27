import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { AiDmSessionFeedEntry } from "@/utils/adventure/aiDmSessionFeedScaffold";

interface AiDmSessionFeedShellProps {
  entries: AiDmSessionFeedEntry[];
  guidanceSource: "user" | "fallback";
  campaignMode?: boolean;
  showSystemComments?: boolean;
  onToggleSystemComments?: () => void;
  isStreaming?: boolean;
  streamingText?: string;
}

export function AiDmSessionFeedShell(props: AiDmSessionFeedShellProps) {
  const c = useColors();
  const scrollViewRef = useRef<ScrollView>(null);
  const followingLatest = useRef(true);
  const [hasUnread, setHasUnread] = useState(false);

  const visibleEntries = props.entries.filter((e) =>
    (props.showSystemComments !== false || (e.role !== "system" && e.role !== "tool")) &&
    (!props.campaignMode || e.role === "dm" || e.role === "player")
  );

  useEffect(() => {
    if (!followingLatest.current) setHasUnread(true);
  }, [props.entries.length, props.streamingText]);

  function jumpToLatest() {
    followingLatest.current = true;
    setHasUnread(false);
    scrollViewRef.current?.scrollToEnd({ animated: false });
  }

  return (
    <View style={[styles.wrap, { borderColor: c.border, backgroundColor: c.card }]}>
    {props.onToggleSystemComments ? <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 12, paddingVertical: 5 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={props.showSystemComments === false ? "Show system and tool comments" : "Hide system and tool comments"} onPress={props.onToggleSystemComments} style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
        <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{props.showSystemComments === false ? "Show system comments" : "Hide system comments"}</Text>
      </TouchableOpacity>
    </View> : null}
    <ScrollView
      ref={scrollViewRef}
      testID="adventure-narrative-scroll"
      style={{ flex: 1, minHeight: 0 }}
      contentContainerStyle={styles.content}
      scrollEventThrottle={100}
      onScroll={event => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        followingLatest.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 48;
        if (followingLatest.current) setHasUnread(false);
      }}
      onContentSizeChange={() => {
        if (followingLatest.current) scrollViewRef.current?.scrollToEnd({ animated: false });
        else setHasUnread(true);
      }}
    >
      {visibleEntries.length === 0 && !props.isStreaming ? (
        <Text style={[styles.waiting, { color: c.mutedForeground }]}>The DM is setting the scene...</Text>
      ) : (
        <>
          {visibleEntries.map((item) => (
            <View
              key={item.id}
              style={[
                styles.feedItem,
                {
                  borderColor: item.role === "dm" ? c.primary + "44" : c.border,
                  backgroundColor: item.role === "dm" ? c.primary + "0D" : c.background,
                },
              ]}
            >
              {!props.campaignMode || item.role !== "player" ? (
                <Text style={[styles.role, { color: item.role === "dm" ? c.primary : c.mutedForeground }]}>
                  {item.role === "dm" ? "DUNGEON MASTER" : item.role.toUpperCase()}
                </Text>
              ) : null}
              <Text style={[styles.body, { color: c.foreground }]}>{item.text}</Text>
            </View>
          ))}
          
          {props.isStreaming && (
            <View
              style={[
                styles.feedItem,
                styles.streamingEntry,
                {
                  borderColor: c.primary + "44",
                  backgroundColor: c.primary + "0D",
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ActivityIndicator size="small" color={c.primary} />
                <Text style={[styles.role, { color: c.primary }]}>DUNGEON MASTER</Text>
              </View>
              <Text style={[styles.body, { color: c.foreground }]}>
                {props.streamingText || "Receiving response..."}
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
    {hasUnread ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Jump to latest story"
      onPress={jumpToLatest} style={{ padding: 10, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.border }}>
      <Text style={{ color: c.primary, fontWeight: "700", textAlign: "center" }}>Jump to latest</Text>
    </TouchableOpacity> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 0,
    flex: 1,
  },
  content: {
    padding: 12,
    gap: 10,
    paddingBottom: 16,
  },
  waiting: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20,
  },
  feedItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 5,
  },
  streamingEntry: {
    opacity: 0.9,
  },
  role: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
});
