import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/useColors";

import { useWorkspacePreferences } from "../../../hooks/useWorkspacePreferences";
import { presetWorkspaceLayout, saveCustomWorkspace, selectWorkspacePreset, swapWorkspacePanels, toggleWorkspacePanel, type WorkspaceLayout, type WorkspacePanelId, type WorkspaceSlotId } from "../../../utils/adventure/workspaceLayoutPreferences";
export type { WorkspacePanelId } from "../../../utils/adventure/workspaceLayoutPreferences";
export interface WorkspacePanel { title: string; content: ReactNode; footer?: ReactNode }
export type WorkspacePanels = Record<WorkspacePanelId, WorkspacePanel>;
export interface AdventureWorkspaceHandle { focusActions: (y?: number) => void }

// Stable widget identities and ancestry across breakpoints preserve local drafts
// and pending controls. Slot assignments hold view preferences, never game state.
const panelOrder: WorkspacePanelId[] = ["narrative", "actions", "encounter", "party", "inventory", "events"];
export function workspacePanelFrames(width: number, height: number, base = "balanced", focus: "none" | "immersive" | "simplify" = "none") {
  if (width < 1100 || height < 480) return null;
  const gap = 12;
  const rail = Math.floor((width - gap * 2) * (focus === "simplify" ? 0.12 : focus === "immersive" ? 0.16 : 0.22));
  const center = width - rail * 2 - gap * 2;
  const half = (height - gap) / 2;
  const story = Math.floor((height - gap) * (base === "tactical" ? 0.42 : base === "immersive" ? 0.7 : 0.58));
  return {
    party: { left: 0, top: 0, width: rail, height: half },
    inventory: { left: 0, top: half + gap, width: rail, height: half },
    narrative: { left: rail + gap, top: 0, width: center, height: story },
    actions: { left: rail + gap, top: story + gap, width: center, height: height - story - gap },
    encounter: { left: width - rail, top: 0, width: rail, height: half },
    events: { left: width - rail, top: half + gap, width: rail, height: half },
  };
}

export const AdventureWorkspace = forwardRef<AdventureWorkspaceHandle, { panels: WorkspacePanels; preferenceKey?: string; statusSummary?: string }>(function AdventureWorkspace({ panels, preferenceKey = "default", statusSummary }, ref) {
  const c = useColors();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { preferences, ready, error, update, retry } = useWorkspacePreferences(preferenceKey);
  const [draft, setDraft] = useState<WorkspaceLayout | null>(null);
  const [swapFrom, setSwapFrom] = useState<WorkspacePanelId | null>(null);
  const [focusExpanded, setFocusExpanded] = useState<WorkspacePanelId[]>([]);
  useEffect(() => { setDraft(null); setSwapFrom(null); setFocusExpanded([]); }, [preferenceKey]);
  const layout = draft ?? preferences.layout;
  const focused = !draft && (preferences.simplify || layout.base === "immersive");
  const temporaryFocus = !draft && preferences.simplify;
  const positions = temporaryFocus ? presetWorkspaceLayout().positions : layout.positions;
  const baseFrames = workspacePanelFrames(size.width, size.height, layout.base, focused ? preferences.simplify ? "simplify" : "immersive" : "none");
  const hidden = (id: WorkspacePanelId) => id !== "actions" && (temporaryFocus ? id !== "narrative" && !focusExpanded.includes(id) : layout.collapsed.includes(id));
  const slotSource: Record<WorkspaceSlotId, WorkspacePanelId> = { top_left: "party", bottom_left: "inventory", top_middle: "narrative", bottom_middle: "actions", top_right: "encounter", bottom_right: "events" };
  const frames = baseFrames ? Object.fromEntries(panelOrder.map(id => [id, { ...baseFrames[slotSource[positions[id]]] }])) as typeof baseFrames : null;
  if (frames) {
    for (const [topSlot, bottomSlot] of [["top_left", "bottom_left"], ["top_middle", "bottom_middle"], ["top_right", "bottom_right"]] as const) {
      const top = panelOrder.find(id => positions[id] === topSlot)!, bottom = panelOrder.find(id => positions[id] === bottomSlot)!;
      if (hidden(top)) { frames[top].height = 44; frames[bottom].top = 56; frames[bottom].height = hidden(bottom) ? 44 : size.height - 56; }
      else if (hidden(bottom)) { frames[top].height = size.height - 56; frames[bottom].top = size.height - 44; frames[bottom].height = 44; }
    }
  }
  function toggle(id: WorkspacePanelId) {
    if (temporaryFocus) setFocusExpanded(previous => previous.includes(id) ? previous.filter(x => x !== id) : [...previous, id]);
    else if (draft) setDraft(toggleWorkspacePanel(draft, id));
    else update(current => saveCustomWorkspace(current, toggleWorkspacePanel(current.layout, id)));
  }
  function button(label: string, onPress: () => void, disabled = false, selected = false, displayLabel = label) {
    return <TouchableOpacity key={label} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
      style={{ borderWidth: 1, borderColor: selected ? c.primary : c.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: selected ? c.primary : c.foreground, fontSize: 12 }}>{displayLabel}</Text>
    </TouchableOpacity>;
  }
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
    <View style={styles.root}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingBottom: 10 }}>
        {draft ? <>
          {button("Save layout", () => { update(current => saveCustomWorkspace({ ...current, simplify: false }, draft)); setFocusExpanded([]); setDraft(null); setSwapFrom(null); })}
          {button("Cancel layout changes", () => { setDraft(null); setSwapFrom(null); })}
          {button("Reset draft to Balanced", () => { setDraft(presetWorkspaceLayout()); setSwapFrom(null); })}
        </> : <>
          {button("Customize layout", () => { setDraft(preferences.layout); setSwapFrom(null); }, !ready)}
          {button(preferences.simplify ? "Exit Simplify View" : "Simplify View", () => { setFocusExpanded([]); update(current => ({ ...current, simplify: !current.simplify })); }, !ready, preferences.simplify)}
          {(["balanced", "immersive", "tactical", ...(preferences.custom ? ["custom" as const] : [])] as const).map(preset => button(preset === "custom" ? "My layout" : preset[0].toUpperCase() + preset.slice(1), () => { setFocusExpanded([]); update(current => selectWorkspacePreset(current, preset)); }, !ready, preferences.selected === preset))}
        </>}
      </View>
      {statusSummary ? <Text accessibilityLiveRegion="polite" style={{ color: c.foreground, fontSize: 12, marginBottom: 8 }}>{statusSummary}</Text> : null}
      {draft ? <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 8 }}>Choose Swap on a panel, then choose its destination. Actions stay available. Phones keep story and actions first.</Text> : null}
      {error ? <View><Text accessibilityRole="alert" style={{ color: c.destructive }}>{error}</Text>{button("Retry layout storage", retry)}</View> : null}
      <View testID="adventure-workspace" style={styles.root} onLayout={event => setSize(event.nativeEvent.layout)}>
      <ScrollView ref={outerRef} scrollEnabled={!frames} style={styles.root}
        contentContainerStyle={frames ? { height: size.height } : styles.mobileContent}>
        {panelOrder.map(id => (
          <View key={id} testID={`workspace-${id}`} accessibilityLabel={panels[id].title}
            onLayout={id === "actions" ? event => { actionY.current = event.nativeEvent.layout.y; } : undefined}
            style={[styles.panel, { backgroundColor: c.card, borderColor: c.border },
              frames ? { position: "absolute", ...frames[id] } : id === "narrative" && !hidden(id) ? { height: Math.max(300, Math.min(480, size.height * 0.6)) } : undefined]}>
            <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: c.border, minHeight: 39 }}>
              <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: c.mutedForeground, flex: 1 }]}>{panels[id].title}</Text>
              {draft ? button(swapFrom && swapFrom !== id ? `Swap ${panels[swapFrom].title} with ${panels[id].title}` : `Swap ${panels[id].title}`, () => {
                if (swapFrom && swapFrom !== id) { setDraft(swapWorkspacePanels(draft, swapFrom, id)); setSwapFrom(null); }
                else setSwapFrom(swapFrom === id ? null : id);
              }, false, swapFrom === id, swapFrom && swapFrom !== id ? "Swap here" : "Swap") : null}
              {id !== "actions" && !(temporaryFocus && id === "narrative") ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${hidden(id) ? "Expand" : "Collapse"} ${panels[id].title}`} accessibilityState={{ expanded: !hidden(id) }}
                disabled={!ready} onPress={() => toggle(id)} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
                <Text style={{ color: c.primary }}>{hidden(id) ? "+" : "−"}</Text>
              </TouchableOpacity> : null}
            </View>
            <View style={hidden(id) ? { display: "none" } : frames || id === "narrative" ? styles.root : undefined}
              importantForAccessibility={hidden(id) ? "no-hide-descendants" : "auto"}>
            {id === "narrative" ? <View style={styles.story}>{panels[id].content}</View> : (
              <ScrollView ref={id === "actions" ? actionRef : undefined}
                nestedScrollEnabled style={frames ? styles.root : { maxHeight: id === "actions" ? 640 : 360 }}
                contentContainerStyle={styles.body}>
                {panels[id].content}
              </ScrollView>
            )}
            {panels[id].footer ? <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: c.border }}>{panels[id].footer}</View> : null}
            </View>
          </View>
        ))}
      </ScrollView>
      </View>
    </View>
  );
});
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  mobileContent: { gap: 12, paddingBottom: 16 },
  panel: { borderWidth: 1, borderRadius: 12, overflow: "hidden", minWidth: 0 },
  title: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, paddingHorizontal: 12, paddingVertical: 10 },
  story: { flex: 1, minHeight: 0 },
  body: { padding: 10, gap: 10 },
});
