export const CURRENT_PARTY_RUNTIME_SCHEMA_VERSION = 1;

// Server-created party-scoped admission provenance, never accepted from request bodies.
export interface CompanionAdmission {
  schemaVersion: "companion-admission.v1";
  memberId: string;
  companionId: string;
  detachedAt?: string;
  recoveredFrom?: { memberId: string; detachedAt: string; recoveredAt: string };
}

export interface RuntimeSnapshotPayload {
  partyCode: string;
  activeMemberIds: string[];
  participantBattleById: Record<string, string>;
  battleTurnOrderById: Record<string, string[]>;
  turnOrder: string[];
  currentTurnIdByBattle: Record<string, string | null>;
  currentTurnId: string | null;
  includeEnvironment: boolean;
  initiativeByMember: Record<
    string,
    {
      memberId: string;
      initiativeRoll: number;
      initiativeBonus: number;
      initiativeTotal: number;
    }
  >;
  combatNpcs: Array<{
    id: string;
    name: string;
    sourceType: "dm-npc" | "character" | "manual" | "monster";
    sourceId?: string;
    disposition: "hostile" | "passive" | "friendly";
    coreStats: {
      speed: number;
      initiativeBonus: number;
      strength: number;
      dexterity: number;
      constitution: number;
      intelligence: number;
      wisdom: number;
      charisma: number;
    };
    visibleStatKeys: string[];
    dummyState?: {
      maxHp: number;
      currentHp: number;
      armorClass: number;
      actionUsed: boolean;
      bonusActionUsed?: boolean;
      reactionUsed?: boolean;
      movementUsed?: number;
    };
    gear?: Array<Record<string, unknown>>;
    conditions?: Array<{ id: string; name: string }>;
    projection?: {
      combatantKind: "companion";
      companionId?: string;
      ownerMemberId?: string;
      ownerCharacterId?: string;
    };
    companionAdmission?: CompanionAdmission;
    createdAt: string;
  }>;
  memberStatsById: Record<
    string,
    {
      speed: number;
      initiativeBonus: number;
      strength: number;
      dexterity: number;
      constitution: number;
      intelligence: number;
      wisdom: number;
      charisma: number;
    }
  >;
  memberDefensesById: Record<
    string,
    {
      damageResistances: string[];
      damageImmunities: string[];
      conditionImmunities: string[];
    }
  >;
  memberSyncClockById: Record<
    string,
    {
      snapshotUpdatedAt: number;
      payloadHash: string;
    }
  >;
  memberPresentationById: Record<
    string,
    {
      themeId?: string | null;
      accentHex?: string | null;
      profileImageUri?: string | null;
    }
  >;
  rollRequests: Array<Record<string, unknown>>;
  lootAssignments: Array<Record<string, unknown>>;
  noteAssignments: Array<Record<string, unknown>>;
  restRequests: Array<Record<string, unknown>>;
  eventLog: Array<Record<string, unknown>>;
  playerEconomyByMember: Record<
    string,
    {
      actionsUsed: number;
      bonusActionsUsed: number;
      reactionUsed: boolean;
      movementUsedFeet: number;
    }
  >;
  updatedAt: string;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") result[key] = entry;
  }
  return result;
}

function asNullableStringRecord(value: unknown): Record<string, string | null> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, string | null> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string" || entry === null) result[key] = entry;
  }
  return result;
}

function asStringArrayRecord(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, string[]> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = asStringArray(entry);
  }
  return result;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
}

export function normalizeRuntimeSnapshotPayload(
  partyCode: string,
  input: unknown,
  fallbackUpdatedAt: string,
): RuntimeSnapshotPayload {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  const initiativeByMemberSource = source.initiativeByMember && typeof source.initiativeByMember === "object"
    ? (source.initiativeByMember as Record<string, unknown>)
    : {};
  const initiativeByMember: RuntimeSnapshotPayload["initiativeByMember"] = {};
  for (const [id, raw] of Object.entries(initiativeByMemberSource)) {
    const parsed = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    initiativeByMember[id] = {
      memberId: typeof parsed.memberId === "string" ? parsed.memberId : id,
      initiativeRoll: asNumber(parsed.initiativeRoll, 0),
      initiativeBonus: asNumber(parsed.initiativeBonus, 0),
      initiativeTotal: asNumber(parsed.initiativeTotal, 0),
    };
  }

  const playerEconomySource = source.playerEconomyByMember && typeof source.playerEconomyByMember === "object"
    ? (source.playerEconomyByMember as Record<string, unknown>)
    : {};
  const playerEconomyByMember: RuntimeSnapshotPayload["playerEconomyByMember"] = {};
  for (const [id, raw] of Object.entries(playerEconomySource)) {
    const parsed = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    playerEconomyByMember[id] = {
      actionsUsed: asNumber(parsed.actionsUsed, 0),
      bonusActionsUsed: asNumber(parsed.bonusActionsUsed, 0),
      reactionUsed: parsed.reactionUsed === true,
      movementUsedFeet: asNumber(parsed.movementUsedFeet, 0),
    };
  }

  const memberDefensesSource = source.memberDefensesById && typeof source.memberDefensesById === "object"
    ? (source.memberDefensesById as Record<string, unknown>)
    : {};
  const memberDefensesById: RuntimeSnapshotPayload["memberDefensesById"] = {};
  for (const [id, raw] of Object.entries(memberDefensesSource)) {
    const parsed = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    memberDefensesById[id] = {
      damageResistances: asStringArray(parsed.damageResistances),
      damageImmunities: asStringArray(parsed.damageImmunities),
      conditionImmunities: asStringArray(parsed.conditionImmunities),
    };
  }

  const memberSyncClockSource = source.memberSyncClockById && typeof source.memberSyncClockById === "object"
    ? (source.memberSyncClockById as Record<string, unknown>)
    : {};
  const memberSyncClockById: RuntimeSnapshotPayload["memberSyncClockById"] = {};
  for (const [id, raw] of Object.entries(memberSyncClockSource)) {
    const parsed = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    memberSyncClockById[id] = {
      snapshotUpdatedAt: asNumber(parsed.snapshotUpdatedAt, 0),
      payloadHash: typeof parsed.payloadHash === "string" ? parsed.payloadHash : "",
    };
  }

  return {
    partyCode,
    activeMemberIds: asStringArray(source.activeMemberIds),
    participantBattleById: asStringRecord(source.participantBattleById),
    battleTurnOrderById: asStringArrayRecord(source.battleTurnOrderById),
    turnOrder: asStringArray(source.turnOrder),
    currentTurnIdByBattle: asNullableStringRecord(source.currentTurnIdByBattle),
    currentTurnId: typeof source.currentTurnId === "string" || source.currentTurnId === null ? source.currentTurnId : null,
    includeEnvironment: source.includeEnvironment !== false,
    initiativeByMember,
    combatNpcs: Array.isArray(source.combatNpcs)
      ? source.combatNpcs.filter((entry): entry is RuntimeSnapshotPayload["combatNpcs"][number] => !!entry && typeof entry === "object")
      : [],
    memberStatsById:
      source.memberStatsById && typeof source.memberStatsById === "object"
        ? (source.memberStatsById as RuntimeSnapshotPayload["memberStatsById"])
        : {},
    memberDefensesById,
    memberSyncClockById,
    memberPresentationById:
      source.memberPresentationById && typeof source.memberPresentationById === "object"
        ? (source.memberPresentationById as RuntimeSnapshotPayload["memberPresentationById"])
        : {},
    rollRequests: Array.isArray(source.rollRequests)
      ? source.rollRequests.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      : [],
    lootAssignments: Array.isArray(source.lootAssignments)
      ? source.lootAssignments.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      : [],
    noteAssignments: Array.isArray(source.noteAssignments)
      ? source.noteAssignments.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      : [],
    restRequests: Array.isArray(source.restRequests)
      ? source.restRequests.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      : [],
    eventLog: Array.isArray(source.eventLog)
      ? source.eventLog.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      : [],
    playerEconomyByMember,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : fallbackUpdatedAt,
  };
}
