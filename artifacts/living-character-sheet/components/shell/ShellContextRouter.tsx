import React, { useMemo } from "react";
import { usePathname } from "expo-router";

import { useCharacter } from "@/context/CharacterContext";
import { useCombat } from "@/context/CombatContext";
import { useParty } from "@/context/PartyContext";

export type ShellKind = "player" | "dm";

export type ShellContextState = {
  battleActive: boolean;
  lootReviewActive: boolean;
  pendingLevelUps: number;
  partyActive: boolean;
  partyCombatActive: boolean;
  partyMemberCount: number;
};

export type ShellContextSnapshot = {
  shell: ShellKind;
  pathname: string;
  state: ShellContextState;
};

type Props = {
  children: (snapshot: ShellContextSnapshot) => React.ReactNode;
};

export function ShellContextRouter({ children }: Props) {
  const pathname = usePathname() || "/";
  const { pendingLevelUps = 0 } = useCharacter();
  const combat = useCombat();
  const { isInParty, memberId, members, combatState } = useParty();

  const partyBattleId = memberId ? combatState?.participantBattleById?.[memberId] ?? null : null;
  const partyCurrentTurnId = partyBattleId ? combatState?.currentTurnIdByBattle?.[partyBattleId] ?? null : null;

  const snapshot = useMemo<ShellContextSnapshot>(() => {
    const shell: ShellKind = pathname.startsWith("/dm-") ? "dm" : "player";

    return {
      shell,
      pathname,
      state: {
        battleActive: Boolean(combat.active || combat.currentTurnId),
        lootReviewActive: pathname.startsWith("/loot-review"),
        pendingLevelUps,
        partyActive: Boolean(isInParty),
        partyCombatActive: Boolean(partyCurrentTurnId),
        partyMemberCount: members.length,
      },
    };
  }, [combat.active, combat.currentTurnId, isInParty, members.length, partyCurrentTurnId, pathname, pendingLevelUps]);

  return <>{children(snapshot)}</>;
}
