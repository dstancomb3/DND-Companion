import type { CombatNpc, PartyMemberSummary } from "@/utils/partyApi";

export type CombatNpcPresentationKind =
  | "companion"
  | "monster"
  | "dm-npc"
  | "character"
  | "manual";

export interface CombatNpcPresentation {
  kind: CombatNpcPresentationKind;
  badgeLabel: string;
  ownerMemberId?: string;
  ownerName?: string;
  isOwnedByLocalMember: boolean;
  displayName: string;
}

function findOwnerName(ownerMemberId: string | undefined, members: PartyMemberSummary[]): string | undefined {
  if (!ownerMemberId) return undefined;
  return members.find((entry) => entry.id === ownerMemberId)?.characterName;
}

export function getCombatNpcPresentation(
  npc: CombatNpc,
  members: PartyMemberSummary[],
  localMemberId?: string | null
): CombatNpcPresentation {
  const ownerMemberId = npc.projection?.combatantKind === "companion"
    ? npc.projection.ownerMemberId
    : undefined;
  const ownerName = findOwnerName(ownerMemberId, members);
  const isOwnedByLocalMember = Boolean(ownerMemberId && localMemberId && ownerMemberId === localMemberId);

  if (npc.projection?.combatantKind === "companion") {
    const ownershipSuffix = ownerName ? ` - ${ownerName}` : "";
    return {
      kind: "companion",
      badgeLabel: "Companion",
      ownerMemberId,
      ownerName,
      isOwnedByLocalMember,
      displayName: `${npc.name} (Companion${ownershipSuffix})`,
    };
  }

  if (npc.sourceType === "monster") {
    return {
      kind: "monster",
      badgeLabel: "Monster",
      isOwnedByLocalMember: false,
      displayName: npc.name,
    };
  }

  if (npc.sourceType === "dm-npc") {
    return {
      kind: "dm-npc",
      badgeLabel: "DM NPC",
      isOwnedByLocalMember: false,
      displayName: npc.name,
    };
  }

  if (npc.sourceType === "character") {
    return {
      kind: "character",
      badgeLabel: "Character",
      isOwnedByLocalMember: false,
      displayName: npc.name,
    };
  }

  return {
    kind: "manual",
    badgeLabel: "Combatant",
    isOwnedByLocalMember: false,
    displayName: npc.name,
  };
}
