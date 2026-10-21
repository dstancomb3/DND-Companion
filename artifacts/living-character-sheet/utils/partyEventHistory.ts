import type { CombatNpc, PartyEvent, PartyMemberSummary } from "./partyApi";

export type PartyEventRelevanceFilter = "all" | "combat" | "general";

export interface PartyEventHistoryFilters {
  type: string;
  actor: string;
  relevance: PartyEventRelevanceFilter;
  importantOnly: boolean;
}

export interface PartyEventOption {
  value: string;
  label: string;
}

export interface PartyEventHistoryItem {
  id: string;
  event: PartyEvent;
  timestampMs: number;
  timestampLabel: string;
  actorLabel: string;
  actorFilterValue: string;
  typeFilterValue: string;
  typeLabel: string;
  message: string;
  isCombatRelevant: boolean;
  isImportant: boolean;
}

export interface PartyEventHistorySection {
  key: string;
  label: string;
  items: PartyEventHistoryItem[];
}

export interface PartyEventHistoryView {
  items: PartyEventHistoryItem[];
  sections: PartyEventHistorySection[];
  typeOptions: PartyEventOption[];
  actorOptions: PartyEventOption[];
  recentImportant: PartyEventHistoryItem[];
  /** Total count before any filters are applied. */
  totalUnfilteredCount: number;
  /** True when any filter is set to a non-default value. */
  hasActiveFilters: boolean;
}

const IMPORTANT_TYPES = new Set<string>([
  "initiative_started",
  "encounter_ended",
  "combat_remote_outcome_applied",
  "rest_requested",
  "rest_approved",
  "rest_denied",
  "notes_assigned",
  "loot_assigned",
  "party_member_left",
]);

const COMBAT_TYPES = new Set<string>([
  "initiative_started",
  "initiative_rolled",
  "turn_advanced",
  "player_economy_spend",
  "player_economy_reset",
  "combat_remote_outcome_applied",
  "combat_npc_added",
  "combat_npc_removed",
  "encounter_ended",
  "participants_added",
  "roll_prompt_created",
  "roll_prompt_responded",
]);

function startCase(input: string): string {
  return input
    .replace(/[_\-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toTimestampMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDateKey(timestampMs: number): string {
  if (timestampMs <= 0) return "unknown";
  return new Date(timestampMs).toISOString().slice(0, 10);
}

function getDateLabel(dateKey: string): string {
  if (dateKey === "unknown") return "Unknown Date";
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  return new Date(dateKey + "T00:00:00.000Z").toLocaleDateString();
}

function isCombatRelevantType(type: string): boolean {
  if (COMBAT_TYPES.has(type)) return true;
  return /(combat|initiative|turn|encounter|roll_prompt|economy|participant)/i.test(type);
}

function resolveParticipantLabel(
  participantId: unknown,
  memberNameById: Map<string, string>,
  npcNameById: Map<string, string>,
): string {
  if (typeof participantId !== "string" || !participantId.trim()) return "—";
  if (participantId === "environment") return "DM";
  return memberNameById.get(participantId)
    ?? npcNameById.get(participantId)
    ?? "Source unavailable";
}

function formatEventMessage(
  event: PartyEvent,
  memberNameById: Map<string, string>,
  npcNameById: Map<string, string>,
): string {
  if (event.type === "turn_advanced") {
    return `Turn advanced from ${resolveParticipantLabel(event.metadata?.from, memberNameById, npcNameById)} to ${resolveParticipantLabel(event.metadata?.to, memberNameById, npcNameById)}.`;
  }
  const message = typeof event.message === "string" ? event.message.trim() : "";
  return message.length > 0 ? message : `Event: ${startCase(event.type || "unknown")}`;
}

function resolveActor(
  event: PartyEvent,
  memberNameById: Map<string, string>,
  npcNameById: Map<string, string>,
): { label: string; filterValue: string } {
  if (typeof event.memberId === "string" && event.memberId.trim()) {
    const memberId = event.memberId.trim();
    return {
      label: resolveParticipantLabel(memberId, memberNameById, npcNameById),
      filterValue: `member:${memberId}`,
    };
  }

  const sourceMemberId = typeof event.metadata?.sourceMemberId === "string"
    ? event.metadata.sourceMemberId.trim()
    : "";
  if (sourceMemberId) {
    return {
      label: resolveParticipantLabel(sourceMemberId, memberNameById, npcNameById),
      filterValue: `source:${sourceMemberId}`,
    };
  }

  return { label: "System", filterValue: "system" };
}

function toHistoryItem(
  event: PartyEvent,
  memberNameById: Map<string, string>,
  npcNameById: Map<string, string>,
): PartyEventHistoryItem {
  const timestampMs = toTimestampMs(event.createdAt);
  const actor = resolveActor(event, memberNameById, npcNameById);
  const typeValue = (event.type || "unknown").trim() || "unknown";

  return {
    id: event.id,
    event,
    timestampMs,
    timestampLabel: timestampMs > 0
      ? new Date(timestampMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "--:--",
    actorLabel: actor.label,
    actorFilterValue: actor.filterValue,
    typeFilterValue: typeValue,
    typeLabel: startCase(typeValue),
    message: formatEventMessage(event, memberNameById, npcNameById),
    isCombatRelevant: isCombatRelevantType(typeValue),
    isImportant: IMPORTANT_TYPES.has(typeValue),
  };
}

export function buildPartyEventHistoryView(params: {
  events: PartyEvent[];
  members: PartyMemberSummary[];
  npcs: CombatNpc[];
  filters: PartyEventHistoryFilters;
}): PartyEventHistoryView {
  const memberNameById = new Map(params.members.map((member) => [member.id, member.characterName] as const));
  const npcNameById = new Map(params.npcs.map((npc) => [npc.id, npc.name] as const));

  const allItems = params.events
    .map((event) => toHistoryItem(event, memberNameById, npcNameById))
    .sort((a, b) => b.timestampMs - a.timestampMs);

  const typeOptions = [
    { value: "all", label: "All Types" },
    ...[...new Set(allItems.map((item) => item.typeFilterValue))]
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: startCase(value) })),
  ];

  const actorOptions = [
    { value: "all", label: "All Sources" },
    ...[...new Set(allItems.map((item) => item.actorFilterValue))]
      .sort((a, b) => a.localeCompare(b))
      .map((value) => {
        const sample = allItems.find((item) => item.actorFilterValue === value);
        return { value, label: sample?.actorLabel ?? value };
      }),
  ];

  const items = allItems.filter((item) => {
    if (params.filters.type !== "all" && item.typeFilterValue !== params.filters.type) return false;
    if (params.filters.actor !== "all" && item.actorFilterValue !== params.filters.actor) return false;
    if (params.filters.relevance === "combat" && !item.isCombatRelevant) return false;
    if (params.filters.relevance === "general" && item.isCombatRelevant) return false;
    if (params.filters.importantOnly && !item.isImportant) return false;
    return true;
  });

  const sectionMap = new Map<string, PartyEventHistoryItem[]>();
  for (const item of items) {
    const key = getDateKey(item.timestampMs);
    const bucket = sectionMap.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      sectionMap.set(key, [item]);
    }
  }

  const sections = [...sectionMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, sectionItems]) => ({
      key,
      label: getDateLabel(key),
      items: sectionItems,
    }));

  const recentImportant = allItems
    .filter((item) => item.isImportant)
    .slice(0, 5);

  const hasActiveFilters =
    params.filters.type !== "all" ||
    params.filters.actor !== "all" ||
    params.filters.relevance !== "all" ||
    params.filters.importantOnly;

  return {
    items,
    sections,
    typeOptions,
    actorOptions,
    recentImportant,
    totalUnfilteredCount: allItems.length,
    hasActiveFilters,
  };
}
