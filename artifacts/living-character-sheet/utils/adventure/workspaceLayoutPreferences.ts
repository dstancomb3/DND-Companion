export const WORKSPACE_PANELS = ["narrative", "actions", "encounter", "party", "inventory", "events"] as const;
export type WorkspacePanelId = typeof WORKSPACE_PANELS[number];
export const WORKSPACE_SLOTS = ["top_left", "bottom_left", "top_middle", "bottom_middle", "top_right", "bottom_right"] as const;
export type WorkspaceSlotId = typeof WORKSPACE_SLOTS[number];
export type WorkspacePreset = "balanced" | "immersive" | "tactical";
export interface WorkspaceLayout {
  base: WorkspacePreset;
  positions: Record<WorkspacePanelId, WorkspaceSlotId>;
  collapsed: WorkspacePanelId[];
  replacements?: Partial<Record<WorkspacePanelId, string>>;
  sizing?: WorkspaceSizing;
}
export interface WorkspaceSizing { left: number; right: number; leftRow: number; middleRow: number; rightRow: number }
export const DEFAULT_WORKSPACE_SIZING: WorkspaceSizing = { left: 0.22, right: 0.22, leftRow: 0.5, middleRow: 0.58, rightRow: 0.5 };
export function clampWorkspaceSizing(value: WorkspaceSizing): WorkspaceSizing {
  const clamp = (x: number, low: number, high: number) => Math.min(high, Math.max(low, x));
  const left = clamp(value.left, 0.15, 0.32);
  const right = clamp(value.right, 0.15, Math.min(0.32, 0.62 - left));
  return { left, right, leftRow: clamp(value.leftRow, 0.2, 0.8), middleRow: clamp(value.middleRow, 0.2, 0.8), rightRow: clamp(value.rightRow, 0.2, 0.8) };
}
export function resizeWorkspaceLayout(layout: WorkspaceLayout, field: keyof WorkspaceSizing, delta: number): WorkspaceLayout {
  if (!Number.isFinite(delta)) return layout;
  return { ...layout, sizing: clampWorkspaceSizing({ ...DEFAULT_WORKSPACE_SIZING, ...layout.sizing, [field]: (layout.sizing?.[field] ?? DEFAULT_WORKSPACE_SIZING[field]) + delta }) };
}
export interface WorkspacePreferences {
  version: 1;
  selected: WorkspacePreset | "custom";
  layout: WorkspaceLayout;
  custom: WorkspaceLayout | null;
  simplify: boolean;
}
export function presetWorkspaceLayout(base: WorkspacePreset = "balanced"): WorkspaceLayout {
  return { base, positions: { party: "top_left", inventory: "bottom_left", narrative: "top_middle", actions: "bottom_middle", encounter: "top_right", events: "bottom_right" }, collapsed: base === "immersive" ? ["party", "inventory", "encounter", "events"] : [], replacements: {}, sizing: { ...DEFAULT_WORKSPACE_SIZING } };
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
  const replacements: WorkspaceLayout["replacements"] = {};
  if (v.replacements !== undefined) {
    if (!v.replacements || typeof v.replacements !== "object" || Array.isArray(v.replacements)) return null;
    for (const [id, choice] of Object.entries(v.replacements)) {
      if (id !== "inventory" || choice !== "character-summary") return null;
      replacements[id] = choice;
    }
  }
  let sizing = { ...DEFAULT_WORKSPACE_SIZING };
  if (v.sizing !== undefined) {
    if (!v.sizing || typeof v.sizing !== "object" || Array.isArray(v.sizing)) return null;
    const raw = v.sizing as Record<string, unknown>;
    if (Object.keys(raw).some(key => !(key in DEFAULT_WORKSPACE_SIZING)) || Object.keys(DEFAULT_WORKSPACE_SIZING).some(key => typeof raw[key] !== "number" || !Number.isFinite(raw[key]))) return null;
    sizing = clampWorkspaceSizing(raw as unknown as WorkspaceSizing);
  }
  // Reconstruct view preferences only. Never retain arbitrary gameplay/role fields.
  return { base: v.base, positions: Object.fromEntries(WORKSPACE_PANELS.map(id => [id, p[id]])) as WorkspaceLayout["positions"], collapsed: [...new Set(v.collapsed)] as WorkspacePanelId[], replacements, sizing };
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

/** View replacement is a local preference, never an authorization or gameplay mutation. */
export function replaceWorkspacePanel(layout: WorkspaceLayout, id: WorkspacePanelId, choice: string | null): WorkspaceLayout {
  if (id !== "inventory" || (choice !== null && choice !== "character-summary")) return layout;
  const replacements = { ...layout.replacements };
  if (choice === null) delete replacements[id]; else replacements[id] = choice;
  return { ...layout, replacements };
}
