import React, { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export type WorkspacePanelId = "narrative" | "actions" | "encounter" | "party" | "inventory" | "events";
export interface WorkspacePanel { title: string; content: ReactNode; footer?: ReactNode }
export type WorkspacePanels = Record<WorkspacePanelId, WorkspacePanel>;
export interface AdventureWorkspaceHandle { focusActions: (y?: number) => void }

// Stable widget identities and ancestry across breakpoints preserve local drafts
// and pending controls. These fixed Balanced slots hold views, never game state.
const panelOrder: WorkspacePanelId[] = ["narrative", "actions", "encounter", "party", "inventory", "events"];
export function workspacePanelFrames(width: number, height: number) {
  if (width < 1100 || height < 480) return null;
  const gap = 12;
  const rail = Math.floor((width - gap * 2) * 0.22);
  const center = width - rail * 2 - gap * 2;
  const half = (height - gap) / 2;
  const story = Math.floor((height - gap) * 0.58);
  return {
    party: { left: 0, top: 0, width: rail, height: half },
    inventory: { left: 0, top: half + gap, width: rail, height: half },
    narrative: { left: rail + gap, top: 0, width: center, height: story },
    actions: { left: rail + gap, top: story + gap, width: center, height: height - story - gap },
    encounter: { left: width - rail, top: 0, width: rail, height: half },
    events: { left: width - rail, top: half + gap, width: rail, height: half },
  };
}

export const AdventureWorkspace = forwardRef<AdventureWorkspaceHandle, { panels: WorkspacePanels }>(function AdventureWorkspace({ panels }, ref) {
  const c = useColors();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const frames = workspacePanelFrames(size.width, size.height);
  const outerRef = useRef<ScrollView>(null);
  const actionRef = useRef<ScrollView>(null);
  const actionY = useRef(0);
  useImperativeHandle(ref, () => ({
    focusActions(y = 0) {
      if (!frames) outerRef.current?.scrollTo({ y: actionY.current, animated: true });
      actionRef.current?.scrollTo({ y, animated: true });
    },
  }), [frames]);
  return (
    <View testID="adventure-workspace" style={styles.root}
      onLayout={event => setSize(event.nativeEvent.layout)}>
      <ScrollView ref={outerRef} scrollEnabled={!frames} style={styles.root}
        contentContainerStyle={frames ? { height: size.height } : styles.mobileContent}>
        {panelOrder.map(id => (
          <View key={id} testID={`workspace-${id}`} accessibilityLabel={panels[id].title}
            onLayout={id === "actions" ? event => { actionY.current = event.nativeEvent.layout.y; } : undefined}
            style={[styles.panel, { backgroundColor: c.card, borderColor: c.border },
              frames ? { position: "absolute", ...frames[id] } : id === "narrative" ? { height: Math.max(300, Math.min(480, size.height * 0.6)) } : undefined]}>
            <Text accessibilityRole="header" style={[styles.title, { color: c.mutedForeground, borderBottomColor: c.border }]}>{panels[id].title}</Text>
            {id === "narrative" ? <View style={styles.story}>{panels[id].content}</View> : (
              <ScrollView ref={id === "actions" ? actionRef : undefined}
                nestedScrollEnabled style={frames ? styles.root : { maxHeight: id === "actions" ? 640 : 360 }}
                contentContainerStyle={styles.body}>
                {panels[id].content}
              </ScrollView>
            )}
            {panels[id].footer ? <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: c.border }}>{panels[id].footer}</View> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
});
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  mobileContent: { gap: 12, paddingBottom: 16 },
  panel: { borderWidth: 1, borderRadius: 12, overflow: "hidden", minWidth: 0 },
  title: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  story: { flex: 1, minHeight: 0 },
  body: { padding: 10, gap: 10 },
});
