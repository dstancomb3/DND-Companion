export const WORKSPACE_PANELS = ["narrative", "actions", "encounter", "party", "inventory", "events"] as const;
export type WorkspacePanelId = typeof WORKSPACE_PANELS[number];
export const WORKSPACE_SLOTS = ["top_left", "bottom_left", "top_middle", "bottom_middle", "top_right", "bottom_right"] as const;
export type WorkspaceSlotId = typeof WORKSPACE_SLOTS[number];
export type WorkspacePreset = "balanced" | "immersive" | "tactical";
export interface WorkspaceLayout {
  base: WorkspacePreset;
  positions: Record<WorkspacePanelId, WorkspaceSlotId>;
  collapsed: WorkspacePanelId[];
}
export interface WorkspacePreferences {
  version: 1;
  selected: WorkspacePreset | "custom";
  layout: WorkspaceLayout;
  custom: WorkspaceLayout | null;
  simplify: boolean;
}
export function presetWorkspaceLayout(base: WorkspacePreset = "balanced"): WorkspaceLayout {
  return { base, positions: { party: "top_left", inventory: "bottom_left", narrative: "top_middle", actions: "bottom_middle", encounter: "top_right", events: "bottom_right" }, collapsed: base === "immersive" ? ["party", "inventory", "encounter", "events"] : [] };
}
export function defaultWorkspacePreferences(): WorkspacePreferences {
  return { version: 1, selected: "balanced", layout: presetWorkspaceLayout(), custom: null, simplify: false };
}
function isPreset(value: unknown): value is WorkspacePreset { return value === "balanced" || value === "immersive" || value === "tactical"; }
function parseLayout(value: unknown): WorkspaceLayout | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!isPreset(v.base) || !v.positions || typeof v.positions !== "object" || !Array.isArray(v.collapsed)) return null;
  const p = v.positions as Record<string, unknown>;
  if (WORKSPACE_PANELS.some(id => !WORKSPACE_SLOTS.includes(p[id] as WorkspaceSlotId)) || new Set(WORKSPACE_PANELS.map(id => p[id])).size !== 6 ||
      v.collapsed.some(id => !WORKSPACE_PANELS.includes(id as WorkspacePanelId) || id === "actions")) return null;
  // Reconstruct view preferences only. Never retain arbitrary gameplay/role fields.
  return { base: v.base, positions: Object.fromEntries(WORKSPACE_PANELS.map(id => [id, p[id]])) as WorkspaceLayout["positions"], collapsed: [...new Set(v.collapsed)] as WorkspacePanelId[] };
}
export function parseWorkspacePreferences(raw: string | null): WorkspacePreferences {
  try {
    if (!raw || raw.length > 16000) return defaultWorkspacePreferences();
    const v = JSON.parse(raw);
    if (v.version !== 1 || !(isPreset(v.selected) || v.selected === "custom") || typeof v.simplify !== "boolean") return defaultWorkspacePreferences();
    const layout = parseLayout(v.layout), custom = v.custom === null ? null : parseLayout(v.custom);
    if (!layout || v.custom !== null && !custom || v.selected === "custom" && !custom) return defaultWorkspacePreferences();
    return { version: 1, selected: v.selected, layout, custom, simplify: v.simplify };
  } catch { return defaultWorkspacePreferences(); }
}
export function swapWorkspacePanels(layout: WorkspaceLayout, first: WorkspacePanelId, second: WorkspacePanelId): WorkspaceLayout {
  return { ...layout, positions: { ...layout.positions, [first]: layout.positions[second], [second]: layout.positions[first] } };
}
export function toggleWorkspacePanel(layout: WorkspaceLayout, id: WorkspacePanelId): WorkspaceLayout {
  if (id === "actions") return layout;
  return { ...layout, collapsed: layout.collapsed.includes(id) ? layout.collapsed.filter(x => x !== id) : [...layout.collapsed, id] };
}
export function saveCustomWorkspace(current: WorkspacePreferences, layout: WorkspaceLayout): WorkspacePreferences {
  return { ...current, selected: "custom", layout, custom: layout };
}
export function selectWorkspacePreset(current: WorkspacePreferences, preset: WorkspacePreset | "custom"): WorkspacePreferences {
  if (preset === "custom" && !current.custom) return current;
  return { ...current, selected: preset, layout: preset === "custom" ? current.custom! : presetWorkspaceLayout(preset) };
}
