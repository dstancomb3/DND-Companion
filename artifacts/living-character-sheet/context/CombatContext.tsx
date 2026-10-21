import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { v4 as uuidv4 } from 'uuid';
import { useCharacter } from "@/context/CharacterContext";
import { useParty } from "@/context/PartyContext";
import { appendPartyEvent, applyRemoteCombatOutcomes, sendPartyEndTurn, spendPlayerEconomy } from "@/utils/partyApi";
import type { CombatNpc } from "@/utils/partyApi";
import {
  selectBattleCurrentTurnId,
  selectBattleNpcs,
  selectBattleTurnOrder,
  selectMemberBattleId,
  selectMemberEconomy,
} from "@/context/combatRuntimeSelectors";
import { getRuntimeItemProjectedEffects } from "@/utils/mechanics/runtimeMechanicsCompatibility";
import type { CombatActionCommand, CombatActionResult } from "@/types";
import type { CombatResolutionTargetSnapshot, CombatTargetResolutionResult } from "@/types/combatOutcome";
import type { PendingReactionWindow } from "@/types/combatReaction";
import { resolveCombatAction as resolveCombatActionCommand } from "@/utils/combat/resolveCombatAction";
import { formatOutcomeSummary, getCombatRejectMessage } from "@/utils/combat/combatFeedback";
import { getCombatNpcPresentation } from "@/utils/combat/companionCombatPresentation";

export interface ConcentrationSpell {
  id: string;
  name: string;
  remainingRounds: number;
  totalRounds: number;
  casterId?: string;
}

export interface PartyCombatTarget {
  id: string;
  name: string;
  type: "member" | "npc";
}

export interface PartyCombatActorOption {
  id: string;
  label: string;
  kind: "self" | "companion";
  companionNpcId?: string;
}

export interface CombatActionFeedback {
  level: "success" | "error";
  title: string;
  message: string;
  commandId?: string;
  at: number;
}

type ActionLogPayload = {
  type?: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

export interface CombatContextType {
  active: boolean;
  // Count-based tracking
  actionsTotal: number;
  actionsUsed: number;
  bonusActionsTotal: number;
  bonusActionsUsed: number;
  reactionUsed: boolean;
  objectInteractionUsed: boolean;
  movementUsed: number;
  // Increments every endTurn / toggleCombat — cards watch this to reset local state
  turnKey: number;
  // Derived convenience booleans (all slots spent)
  actionUsed: boolean;
  bonusActionUsed: boolean;
  // Turn order and current turn
  turnOrder: string[];
  currentTurnId: string | null;
  combatNpcs: CombatNpc[];
  partyTargets: PartyCombatTarget[];
  selectedTargetId: string | null;
  selectedTargetIds: Set<string>;
  setSelectedTargetId: (id: string | null) => void;
  toggleTargetId: (id: string, maxTargets?: number) => void;
  clearTargetIds: () => void;
  selectedTargetName: string | null;
  actorOptions: PartyCombatActorOption[];
  activeActorOptionId: string;
  activeActorLabel: string;
  setActiveActorOptionId: (id: string) => void;
  actionFeedback: CombatActionFeedback | null;
  dismissActionFeedback: () => void;
  remoteApplyFailureMessage: string | null;
  dismissRemoteApplyFailure: () => void;
  // Concentration spell tracking
  concentrationSpells: ConcentrationSpell[];
  addConcentrationSpell: (spell: { id?: string; name: string; rounds: number; casterId?: string }) => void;
  decrementConcentrationRounds: () => void;
  breakConcentration: (spellId: string) => void;
  pendingReactionWindow: PendingReactionWindow | null;
  declineReactionWindow: (windowId: string) => void;
  // Mutators
  toggleCombat: () => void;
  useAction: (payload?: ActionLogPayload) => void;
  refundAction: () => void;
  useBonusAction: (payload?: ActionLogPayload) => void;
  refundBonusAction: () => void;
  toggleAction: () => void;
  toggleBonusAction: () => void;
  toggleReaction: (payload?: ActionLogPayload) => void;
  toggleObjectInteraction: () => void;
  spendMovement: (feet: number) => void;
  refundMovement: (feet: number) => void;
  resolveCombatAction: (command: CombatActionCommand) => Promise<CombatActionResult>;
  endTurn: () => void;
}

const CombatContext = createContext<CombatContextType>({
  active: false,
  actionsTotal: 1,
  actionsUsed: 0,
  bonusActionsTotal: 1,
  bonusActionsUsed: 0,
  reactionUsed: false,
  objectInteractionUsed: false,
  movementUsed: 0,
  turnKey: 0,
  actionUsed: false,
  bonusActionUsed: false,
  turnOrder: [],
  currentTurnId: null,
  combatNpcs: [],
  partyTargets: [],
  selectedTargetId: null,
  selectedTargetIds: new Set(),
  setSelectedTargetId: () => {},
  toggleTargetId: () => {},
  clearTargetIds: () => {},
  selectedTargetName: null,
  actorOptions: [{ id: "self", label: "Self", kind: "self" }],
  activeActorOptionId: "self",
  activeActorLabel: "Self",
  setActiveActorOptionId: () => {},
  actionFeedback: null,
  dismissActionFeedback: () => {},
  concentrationSpells: [],
  remoteApplyFailureMessage: null,
  dismissRemoteApplyFailure: () => {},
  addConcentrationSpell: () => {},
  decrementConcentrationRounds: () => {},
  breakConcentration: () => {},
  pendingReactionWindow: null,
  declineReactionWindow: () => {},
  toggleCombat: () => {},
  useAction: () => {},
  refundAction: () => {},
  useBonusAction: () => {},
  refundBonusAction: () => {},
  toggleAction: () => {},
  toggleBonusAction: () => {},
  toggleReaction: () => {},
  toggleObjectInteraction: () => {},
  spendMovement: () => {},
  refundMovement: () => {},
  resolveCombatAction: async () => ({
    commandId: "unknown",
    resolvedAt: Date.now(),
    status: "rejected",
    reasonCode: "unknown",
    economyDelta: {
      actionUsedDelta: 0,
      bonusActionUsedDelta: 0,
      reactionUsedChanged: false,
      movementUsedDeltaFeet: 0,
    },
    debug: { pathway: "local" },
  }),
  endTurn: () => {},
});

// Keyword patterns that grant an extra full Action
const EXTRA_ACTION_RE = /extra action|additional action|action surge/i;
// Keyword patterns that grant an extra Bonus Action
const EXTRA_BONUS_RE =
  /extra bonus action|additional bonus action|flurry of blows/i;
const MAX_SUPPORTED_PARTY_ECONOMY_SLOTS = 2;

function mergeUnconsciousAtZeroHp(conditionNames: string[], currentHp?: number): string[] {
  const merged = [...conditionNames];
  if (typeof currentHp === "number" && currentHp <= 0) {
    const hasUnconscious = merged.some((name) => name.trim().toLowerCase() === "unconscious");
    if (!hasUnconscious) merged.push("Unconscious");
  }
  return merged;
}


function CombatInner({ children }: { children: ReactNode }) {
  const { inventory, tickConditions, character, applyResolvedLocalDamage, conditions, removeConditionsByConcentrationLink } = useCharacter();
  const { isInParty, partyCode, memberId, members, combatState, refreshCombatState } = useParty();
  const [active, setActive] = useState(false);
  const [actionsUsed, setActionsUsed] = useState(0);
  const [bonusActionsUsed, setBonusActionsUsed] = useState(0);
  const [reactionUsed, setReactionUsed] = useState(false);
  const [objectInteractionUsed, setObjectInteractionUsed] = useState(false);
  const [movementUsed, setMovementUsed] = useState(0);
  const [turnKey, setTurnKey] = useState(0);
  // New: turn order and current turn
  const [turnOrder, setTurnOrder] = useState<string[]>([]);
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  const [combatNpcs, setCombatNpcs] = useState<CombatNpc[]>([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());
  const [activeActorOptionId, setActiveActorOptionId] = useState<string>("self");
  // Concentration spell state
  const [concentrationSpells, setConcentrationSpells] = useState<ConcentrationSpell[]>([]);
  const [pendingReactionWindow, setPendingReactionWindow] = useState<PendingReactionWindow | null>(null);
  const [actionFeedback, setActionFeedback] = useState<CombatActionFeedback | null>(null);
  const [remoteApplyFailureMessage, setRemoteApplyFailureMessage] = useState<string | null>(null);
  // ...existing code for actions, bonus, etc...
  // Add a new concentration spell
  const addConcentrationSpell = useCallback((spell: { id?: string; name: string; rounds: number; casterId?: string }) => {
      setConcentrationSpells((prev: ConcentrationSpell[]) => [
        ...prev,
        {
          id: spell.id ?? uuidv4(),
        name: spell.name,
        remainingRounds: spell.rounds,
        totalRounds: spell.rounds,
        casterId: spell.casterId,
      },
    ]);
  }, []);
  // Decrement all concentration spell rounds (call at end of turn)
  const decrementConcentrationRounds = useCallback(() => {
    let expiredIds: string[] = [];
    setConcentrationSpells((prev: ConcentrationSpell[]) => {
      const decremented = prev.map((s: ConcentrationSpell) => ({ ...s, remainingRounds: s.remainingRounds - 1 }));
      expiredIds = decremented.filter((s: ConcentrationSpell) => s.remainingRounds <= 0).map((s) => s.id);
      return decremented.filter((s: ConcentrationSpell) => s.remainingRounds > 0);
    });
    for (const spellId of expiredIds) {
      removeConditionsByConcentrationLink(spellId);
    }
  }, [removeConditionsByConcentrationLink]);
  // Break concentration (e.g., failed save or manual). Phase D: also cleans up linked conditions.
  const breakConcentration = useCallback((spellId: string) => {
    setConcentrationSpells((prev: ConcentrationSpell[]) => prev.filter((s: ConcentrationSpell) => s.id !== spellId));
    removeConditionsByConcentrationLink(spellId);
  }, [removeConditionsByConcentrationLink]);
  // Compute extra slots from equipped item effects
  const { actionsTotal, bonusActionsTotal } = useMemo(() => {
    let extra = 0;
    let extraBonus = 0;
    for (const item of inventory) {
      if (!item.equipped) continue;
      for (const eff of getRuntimeItemProjectedEffects(item)) {
        const text = `${eff.label} ${eff.description ?? ""}`;
        if (EXTRA_ACTION_RE.test(text)) extra++;
        if (EXTRA_BONUS_RE.test(text)) extraBonus++;
      }
    }
    return { actionsTotal: 1 + extra, bonusActionsTotal: 1 + extraBonus };
  }, [inventory]);
  // Keep latest totals accessible inside callbacks without stale closure
  const actionsTotalRef = useRef(actionsTotal);
  const bonusTotalRef = useRef(bonusActionsTotal);
  actionsTotalRef.current = actionsTotal;
  bonusTotalRef.current = bonusActionsTotal;
  const tickConditionsRef = useRef(tickConditions);
  tickConditionsRef.current = tickConditions;
  const isPartyAuthoritative = Boolean(isInParty && partyCode && memberId);
  const boundedPartyActionsTotal = Math.max(1, Math.min(actionsTotal, MAX_SUPPORTED_PARTY_ECONOMY_SLOTS));
  const boundedPartyBonusActionsTotal = Math.max(1, Math.min(bonusActionsTotal, MAX_SUPPORTED_PARTY_ECONOMY_SLOTS));
  const resolvedActionsTotal = isPartyAuthoritative ? boundedPartyActionsTotal : actionsTotal;
  const resolvedBonusActionsTotal = isPartyAuthoritative ? boundedPartyBonusActionsTotal : bonusActionsTotal;

  const warnPartyLocalMutation = useCallback((path: string) => {
    if (isPartyAuthoritative && process.env.NODE_ENV === "development") {
      console.warn(`[CombatContext] blocked local authoritative mutation in party mode: ${path}`);
    }
  }, [isPartyAuthoritative]);

  const resetTurn = () => {
    tickConditionsRef.current("onTargetTurnEnd");
    setActionsUsed(0);
    setBonusActionsUsed(0);
    setReactionUsed(false);
    setObjectInteractionUsed(false);
    setMovementUsed(0);
    setSelectedTargetIds(new Set());
    setTurnKey((k: number) => k + 1);
  };

  const clearExpiredPendingReactionWindow = useCallback(() => {
    setPendingReactionWindow((prev) => {
      if (!prev) return prev;
      if (turnKey <= prev.expiresAtTurnKey) return prev;
      return null;
    });
  }, [turnKey]);

  const declineReactionWindow = useCallback((windowId: string) => {
    setPendingReactionWindow((prev) => {
      if (!prev) return prev;
      if (prev.windowId !== windowId) return prev;
      return null;
    });
  }, []);

  useEffect(() => {
    clearExpiredPendingReactionWindow();
  }, [clearExpiredPendingReactionWindow, turnKey]);

  const appendActionEvent = useCallback(
    (type: string, message: string, metadata?: Record<string, unknown>) => {
      if (!isInParty || !partyCode || !memberId) return;
      void appendPartyEvent(partyCode, { type, message, memberId, metadata });
    },
    [isInParty, partyCode, memberId]
  );

  const activeBattleId = useMemo(() => {
    if (!isPartyAuthoritative) return null;
    return selectMemberBattleId(combatState, memberId);
  }, [combatState, isPartyAuthoritative, memberId]);

  const canonicalTurnOrder = useMemo(() => {
    if (!isPartyAuthoritative) return turnOrder;
    return selectBattleTurnOrder(combatState, activeBattleId);
  }, [activeBattleId, combatState, isPartyAuthoritative, turnOrder]);

  const canonicalCurrentTurnId = useMemo(() => {
    if (!isPartyAuthoritative) return currentTurnId;
    return selectBattleCurrentTurnId(combatState, activeBattleId);
  }, [activeBattleId, combatState, currentTurnId, isPartyAuthoritative]);

  const canonicalCombatNpcs = useMemo(() => {
    if (!isPartyAuthoritative) return combatNpcs;
    return selectBattleNpcs(combatState, activeBattleId);
  }, [activeBattleId, combatNpcs, combatState, isPartyAuthoritative]);

  const canonicalEconomy = useMemo(() => {
    if (!isPartyAuthoritative) return null;
    return selectMemberEconomy(combatState, memberId);
  }, [combatState, isPartyAuthoritative, memberId]);

  const resolvedActionsUsed = isPartyAuthoritative ? (canonicalEconomy?.actionsUsed ?? 0) : actionsUsed;
  const resolvedBonusActionsUsed = isPartyAuthoritative ? (canonicalEconomy?.bonusActionsUsed ?? 0) : bonusActionsUsed;
  const resolvedReactionUsed = isPartyAuthoritative ? (canonicalEconomy?.reactionUsed ?? false) : reactionUsed;
  const resolvedMovementUsed = isPartyAuthoritative ? (canonicalEconomy?.movementUsedFeet ?? 0) : movementUsed;
  const movementTotalFeet = useMemo(() => {
    const soloSpeed = typeof character?.speed === "number" ? character.speed : 0;
    if (!isPartyAuthoritative) return soloSpeed;

    const partySpeed = members.find((member) => member.id === memberId)?.coreStats?.speed;
    if (typeof partySpeed === "number") return partySpeed;
    return soloSpeed;
  }, [character?.speed, isPartyAuthoritative, memberId, members]);
  const remainingMovementFeet = Math.max(0, movementTotalFeet - resolvedMovementUsed);

  const partyTargets = useMemo<PartyCombatTarget[]>(() => {
    const participantBattleById = combatState?.participantBattleById;
    const memberTargets = members
      .filter((member) => {
        if (!isInParty || !activeBattleId || !participantBattleById) return true;
        return participantBattleById[member.id] === activeBattleId;
      })
      .map((member) => ({
        id: member.id,
        name: member.characterName,
        type: "member" as const,
      }));
    const npcTargets = canonicalCombatNpcs.map((npc) => ({
      id: npc.id,
      name: npc.name,
      type: "npc" as const,
    }));
    return [...memberTargets, ...npcTargets];
  }, [members, canonicalCombatNpcs, combatState?.participantBattleById, isInParty, activeBattleId]);

  const selectedTargetId = useMemo(() => {
    const first = selectedTargetIds.values().next();
    return first.done ? null : first.value;
  }, [selectedTargetIds]);

  const setSelectedTargetId = useCallback((id: string | null) => {
    setSelectedTargetIds(id ? new Set([id]) : new Set());
  }, []);

  const toggleTargetId = useCallback((id: string, maxTargets?: number) => {
    setSelectedTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (maxTargets === 1) {
        return new Set([id]);
      }
      if (typeof maxTargets === "number" && maxTargets > 0 && next.size >= maxTargets) {
        return prev;
      }
      next.add(id);
      return next;
    });
  }, []);

  const clearTargetIds = useCallback(() => {
    setSelectedTargetIds(new Set());
  }, []);

  const selectedTarget = useMemo(() => {
    if (!selectedTargetId) return null;
    return partyTargets.find((target) => target.id === selectedTargetId) ?? null;
  }, [partyTargets, selectedTargetId]);

  const selectedTargetName = selectedTarget?.name ?? null;

  const actorOptions = useMemo<PartyCombatActorOption[]>(() => {
    const base: PartyCombatActorOption[] = [{ id: "self", label: "Self", kind: "self" }];
    if (!isPartyAuthoritative || !memberId) return base;

    for (const npc of canonicalCombatNpcs) {
      const presentation = getCombatNpcPresentation(npc, members, memberId);
      if (presentation.kind !== "companion") continue;
      if (!presentation.isOwnedByLocalMember) continue;
      base.push({
        id: `companion:${npc.id}`,
        label: presentation.displayName,
        kind: "companion",
        companionNpcId: npc.id,
      });
    }

    return base;
  }, [canonicalCombatNpcs, isPartyAuthoritative, memberId, members]);

  useEffect(() => {
    if (actorOptions.some((entry) => entry.id === activeActorOptionId)) return;
    setActiveActorOptionId("self");
  }, [activeActorOptionId, actorOptions]);

  const activeActorOption = useMemo(() => {
    return actorOptions.find((entry) => entry.id === activeActorOptionId) ?? actorOptions[0] ?? { id: "self", label: "Self", kind: "self" as const };
  }, [activeActorOptionId, actorOptions]);

  const effectiveActive = isInParty ? !!activeBattleId : active;

  useEffect(() => {
    if (partyTargets.length === 0) {
      if (selectedTargetIds.size > 0) setSelectedTargetIds(new Set());
      return;
    }
    const partyTargetSet = new Set(partyTargets.map((target) => target.id));
    const filteredSelected = new Set([...selectedTargetIds].filter((id) => partyTargetSet.has(id)));
    if (filteredSelected.size !== selectedTargetIds.size) {
      setSelectedTargetIds(filteredSelected);
      return;
    }
    if (filteredSelected.size > 0) return;

    const preferredNpc = partyTargets.find((target) => target.type === "npc");
    const preferredOtherMember = partyTargets.find((target) => target.type === "member" && target.id !== memberId);
    const fallback = preferredNpc ?? preferredOtherMember ?? partyTargets[0];
    setSelectedTargetIds(new Set([fallback.id]));
  }, [memberId, partyTargets, selectedTargetIds]);

  const toggleCombat = useCallback(() => {
    setActive((v: boolean) => !v);
    resetTurn();
  }, []);
  const useAction = useCallback(
    (payload?: ActionLogPayload) => {
      if (isPartyAuthoritative && partyCode && memberId) {
        if (payload) {
          const baseType = payload.type ?? "player_action_used";
          const baseMessage = payload.message ?? "Used Action";
          const targetSuffix = selectedTarget ? ` -> ${selectedTarget.id === memberId ? "Self" : selectedTarget.name}` : "";
          appendActionEvent(baseType, `${baseMessage}${targetSuffix}`, {
            ...payload.metadata,
            ...(selectedTarget ? {
              targetId: selectedTarget.id,
              targetName: selectedTarget.name,
              targetType: selectedTarget.type,
            } : {}),
          });
        } else {
          appendActionEvent("player_action_used", "Used Action");
        }
        void spendPlayerEconomy(partyCode, memberId, "action", undefined, {
          actionLimit: resolvedActionsTotal,
        })
          .then(() => refreshCombatState(partyCode))
          .catch((e: unknown) => {
            if (process.env.NODE_ENV === "development") console.warn("[CombatContext] economy spend (action) failed:", e);
          });
        return;
      }
      setActionsUsed((n: number) => {
        const next = Math.min(n + 1, actionsTotalRef.current);
        if (next > n) {
          if (payload) {
            const baseType = payload.type ?? "player_action_used";
            const baseMessage = payload.message ?? "Used Action";
            const targetSuffix = selectedTarget ? ` -> ${selectedTarget.id === memberId ? "Self" : selectedTarget.name}` : "";
            appendActionEvent(baseType, `${baseMessage}${targetSuffix}`, {
              ...payload.metadata,
              ...(selectedTarget ? {
                targetId: selectedTarget.id,
                targetName: selectedTarget.name,
                targetType: selectedTarget.type,
              } : {}),
            });
          } else {
            appendActionEvent("player_action_used", "Used Action");
          }
        }
        return next;
      });
    },
    [appendActionEvent, isPartyAuthoritative, memberId, partyCode, refreshCombatState, resolvedActionsTotal, selectedTarget]
  );
  const refundAction = useCallback(
    () => {
      if (isPartyAuthoritative) {
        warnPartyLocalMutation("refundAction");
        return;
      }
      if (active) return;
      setActionsUsed((n: number) => Math.max(n - 1, 0));
    },
    [active, isPartyAuthoritative, warnPartyLocalMutation]
  );
  const useBonusAction = useCallback(
    (payload?: ActionLogPayload) => {
      if (isPartyAuthoritative && partyCode && memberId) {
        if (payload) {
          appendActionEvent(payload.type ?? "player_bonus_action_used", payload.message ?? "Used Bonus Action", payload.metadata);
        } else {
          appendActionEvent("player_bonus_action_used", "Used Bonus Action");
        }
        void spendPlayerEconomy(partyCode, memberId, "bonusAction", undefined, {
          bonusActionLimit: resolvedBonusActionsTotal,
        })
          .then(() => refreshCombatState(partyCode))
          .catch((e: unknown) => {
            if (process.env.NODE_ENV === "development") console.warn("[CombatContext] economy spend (bonusAction) failed:", e);
          });
        return;
      }
      setBonusActionsUsed((n: number) => {
        const next = Math.min(n + 1, bonusTotalRef.current);
        if (next > n) {
          if (payload) {
            appendActionEvent(payload.type ?? "player_bonus_action_used", payload.message ?? "Used Bonus Action", payload.metadata);
          } else {
            appendActionEvent("player_bonus_action_used", "Used Bonus Action");
          }
        }
        return next;
      });
    },
    [appendActionEvent, isPartyAuthoritative, memberId, partyCode, refreshCombatState, resolvedBonusActionsTotal]
  );
  const refundBonusAction = useCallback(
    () => {
      if (isPartyAuthoritative) {
        warnPartyLocalMutation("refundBonusAction");
        return;
      }
      if (active) return;
      setBonusActionsUsed((n: number) => Math.max(n - 1, 0));
    },
    [active, isPartyAuthoritative, warnPartyLocalMutation]
  );
  const toggleAction = useCallback(
    () => {
      if (isPartyAuthoritative) {
        warnPartyLocalMutation("toggleAction");
        return;
      }
      setActionsUsed((n: number) => (n < actionsTotalRef.current ? n + 1 : 0));
    },
    [isPartyAuthoritative, warnPartyLocalMutation]
  );
  const toggleBonusAction = useCallback(
    () => {
      if (isPartyAuthoritative) {
        warnPartyLocalMutation("toggleBonusAction");
        return;
      }
      setBonusActionsUsed((n: number) => (n < bonusTotalRef.current ? n + 1 : 0));
    },
    [isPartyAuthoritative, warnPartyLocalMutation]
  );
  const toggleReaction = useCallback(
    (payload?: ActionLogPayload) => {
      if (isPartyAuthoritative && partyCode && memberId) {
        if (payload) {
          appendActionEvent(payload.type ?? "player_reaction_used", payload.message ?? "Used Reaction", payload.metadata);
        } else {
          appendActionEvent("player_reaction_used", "Used Reaction");
        }
        void spendPlayerEconomy(partyCode, memberId, "reaction")
          .then(() => refreshCombatState(partyCode))
          .catch((e: unknown) => {
            if (process.env.NODE_ENV === "development") console.warn("[CombatContext] economy spend (reaction) failed:", e);
          });
        return;
      }
      setReactionUsed((v: boolean) => {
        if (v && active) return v;
        const next = !v;
        if (next) {
          if (payload) {
            appendActionEvent(payload.type ?? "player_reaction_used", payload.message ?? "Used Reaction", payload.metadata);
          } else {
            appendActionEvent("player_reaction_used", "Used Reaction");
          }
        }
        return next;
      });
    },
    [active, appendActionEvent, isPartyAuthoritative, memberId, partyCode, refreshCombatState]
  );
  const toggleObjectInteraction = useCallback(
    () =>
      setObjectInteractionUsed((v: boolean) => {
        const next = !v;
        if (next) appendActionEvent("player_object_interaction_used", "Used Object Interaction");
        return next;
      }),
    [appendActionEvent]
  );
  const spendMovement = useCallback(
    (feet: number) => {
      if (feet <= 0) return;
      appendActionEvent("player_movement_used", `Spent ${feet} ft movement`, { feet });

      if (isPartyAuthoritative && partyCode && memberId) {
        void spendPlayerEconomy(partyCode, memberId, "movement", feet)
          .then(() => refreshCombatState(partyCode))
          .catch((e: unknown) => {
            if (process.env.NODE_ENV === "development") console.warn("[CombatContext] economy spend (movement) failed:", e);
          });
        return;
      }

      setMovementUsed((n: number) => n + feet);
    },
    [appendActionEvent, isPartyAuthoritative, memberId, partyCode, refreshCombatState]
  );
  const refundMovement = useCallback(
    (feet: number) => {
      if (isPartyAuthoritative) {
        warnPartyLocalMutation("refundMovement");
        return;
      }
      setMovementUsed((n: number) => Math.max(0, n - feet));
    },
    [isPartyAuthoritative, warnPartyLocalMutation]
  );

  const applyLocalTargetResult = useCallback((result: CombatTargetResolutionResult) => {
    applyResolvedLocalDamage(result, "manual");
  }, [applyResolvedLocalDamage]);

  const buildTargetSnapshotsById = useCallback((targetIds: string[]): Record<string, CombatResolutionTargetSnapshot> => {
    const snapshots: Record<string, CombatResolutionTargetSnapshot> = {};
    const memberById = new Map(members.map((member) => [member.id, member]));
    const npcById = new Map(canonicalCombatNpcs.map((npc) => [npc.id, npc]));

    for (const targetId of targetIds) {
      if (memberId && targetId === memberId) {
        const selfConditions = mergeUnconsciousAtZeroHp(
          conditions.map((c) => c.name),
          character.currentHp
        );
        snapshots[targetId] = {
          targetId,
          targetType: "self",
          armorClass: character.armorClass,
          currentHp: character.currentHp,
          tempHp: character.tempHp,
          damageResistances: character.damageResistances,
          damageImmunities: character.damageImmunities,
          conditionImmunities: character.conditionImmunities,
          mitigationKnown: true,
          authority: {
            mode: "local_authoritative",
            canApplyLocally: true,
            certainty: "confirmed",
            reason: "local_character",
          },
          isLocalCharacter: true,
          conditions: selfConditions,
        };
        continue;
      }

      const member = memberById.get(targetId);
      if (member) {
        const memberConditions = mergeUnconsciousAtZeroHp(
          (member.conditions ?? []).map((condition) => condition.name),
          member.currentHp
        );
        snapshots[targetId] = {
          targetId,
          targetType: "member",
          armorClass: member.armorClass,
          currentHp: member.currentHp,
          tempHp: member.tempHp,
          damageResistances: member.damageResistances,
          damageImmunities: member.damageImmunities,
          conditionImmunities: member.conditionImmunities,
          mitigationKnown: true,
          authority: {
            mode: "preview_only",
            canApplyLocally: false,
            certainty: "confirmed",
            reason: "remote_member_preview_only",
          },
          isLocalCharacter: false,
          conditions: memberConditions,
        };
        continue;
      }

      const npc = npcById.get(targetId);
      if (npc) {
        const npcConditions = mergeUnconsciousAtZeroHp(
          (npc.conditions ?? []).map((condition) => condition.name),
          npc.dummyState?.currentHp
        );
        snapshots[targetId] = {
          targetId,
          targetType: "npc",
          armorClass: npc.dummyState?.armorClass,
          currentHp: npc.dummyState?.currentHp,
          tempHp: 0,
          mitigationKnown: false,
          authority: {
            mode: "preview_only",
            canApplyLocally: false,
            certainty: "limited",
            reason: "remote_npc_preview_only",
          },
          isLocalCharacter: false,
          conditions: npcConditions,
        };
      }
    }

    return snapshots;
  }, [canonicalCombatNpcs, character.armorClass, character.conditionImmunities, character.currentHp, character.damageImmunities, character.damageResistances, character.tempHp, conditions, memberId, members]);

  const resolveCombatAction = useCallback(async (command: CombatActionCommand): Promise<CombatActionResult> => {
    if (
      command.action.actionKind === "reaction" &&
      command.action.mode === "use" &&
      command.reaction?.decision === "decline"
    ) {
      const requestedWindowId = command.reaction.windowId;
      if (pendingReactionWindow && requestedWindowId && requestedWindowId !== pendingReactionWindow.windowId) {
        return {
          commandId: command.commandId,
          resolvedAt: Date.now(),
          status: "rejected",
          reasonCode: "reaction_window_mismatch",
          economyDelta: {
            actionUsedDelta: 0,
            bonusActionUsedDelta: 0,
            reactionUsedChanged: false,
            movementUsedDeltaFeet: 0,
          },
          debug: {
            pathway: isPartyAuthoritative ? "party" : "local",
            notes: ["reaction window decline requested with mismatched window id"],
          },
        };
      }
      if (pendingReactionWindow && requestedWindowId === pendingReactionWindow.windowId) {
        declineReactionWindow(requestedWindowId);
      }
      return {
        commandId: command.commandId,
        resolvedAt: Date.now(),
        status: "accepted",
        economyDelta: {
          actionUsedDelta: 0,
          bonusActionUsedDelta: 0,
          reactionUsedChanged: false,
          movementUsedDeltaFeet: 0,
        },
        debug: {
          pathway: isPartyAuthoritative ? "party" : "local",
          notes: ["reaction window declined"],
        },
      };
    }

    const commandWithActorMetadata: CombatActionCommand = {
      ...command,
      metadata: {
        ...(command.metadata ?? {}),
        actingAs: {
          actorKind: activeActorOption.kind,
          actorLabel: activeActorOption.label,
          companionNpcId: activeActorOption.companionNpcId,
          ownerMemberId: memberId ?? undefined,
          resourceModel: "player_turn_economy",
        },
      },
    };

    const targetSnapshotsById = buildTargetSnapshotsById(commandWithActorMetadata.targets?.targetIds ?? []);
    const actorConditions = mergeUnconsciousAtZeroHp(
      conditions.map((c) => c.name),
      character.currentHp
    );

    const result = resolveCombatActionCommand(commandWithActorMetadata, {
      active: effectiveActive,
      isPartyAuthoritative,
      actorMemberId: memberId ?? null,
      currentTurnId: canonicalCurrentTurnId,
      actionsUsed: resolvedActionsUsed,
      actionsTotal: resolvedActionsTotal,
      bonusActionsUsed: resolvedBonusActionsUsed,
      bonusActionsTotal: resolvedBonusActionsTotal,
      reactionUsed: resolvedReactionUsed,
      remainingMovementFeet,
      useAction,
      refundAction,
      useBonusAction,
      refundBonusAction,
      toggleReaction,
      spendMovement,
      refundMovement,
      targetSnapshotsById,
      applyLocalTargetResult,
      // Phase D: pass actor conditions for incapacitation gating.
      actorConditions,
      pendingReactionWindowId: pendingReactionWindow?.windowId ?? null,
      pendingReactionExpiresAtTurnKey: pendingReactionWindow?.expiresAtTurnKey ?? null,
      pendingReactionTriggerType: pendingReactionWindow?.triggerType ?? null,
      currentTurnKey: turnKey,
    });

    if (result.status !== "accepted") {
      setActionFeedback({
        level: "error",
        title: "Action Rejected",
        message: getCombatRejectMessage(result.reasonCode),
        commandId: result.commandId,
        at: Date.now(),
      });
    }

    if (
      result.status === "accepted" &&
      isPartyAuthoritative &&
      partyCode &&
      memberId &&
      commandWithActorMetadata.action.mode === "use"
    ) {
      const remotePreviewResults = (result.targetResults ?? []).filter((targetResult) => {
        if (targetResult.applyState !== "preview_only") return false;
        return (
          targetResult.authority.reason === "remote_member_preview_only"
          || targetResult.authority.reason === "remote_npc_preview_only"
        );
      });

      if (remotePreviewResults.length > 0) {
        try {
          await applyRemoteCombatOutcomes(partyCode, {
            commandId: commandWithActorMetadata.commandId,
            sourceMemberId: memberId,
            targetResults: remotePreviewResults,
          });
          setRemoteApplyFailureMessage(null);
          await refreshCombatState(partyCode);
        } catch (error) {
          setRemoteApplyFailureMessage("Remote outcomes did not sync. Verify party HP/conditions with the DM before retrying this action.");
          setActionFeedback({
            level: "error",
            title: "Remote Apply Failed",
            message: "Action resolved, but remote outcomes did not sync. Verify HP/conditions with the DM before retry.",
            commandId: result.commandId,
            at: Date.now(),
          });
          if (process.env.NODE_ENV === "development") {
            console.warn("[CombatContext] remote outcome apply failed", error);
          }
          return {
            ...result,
            debug: {
              pathway: result.debug?.pathway ?? (isPartyAuthoritative ? "party" : "local"),
              notes: [...(result.debug?.notes ?? []), "remote_outcome_apply_failed"],
            },
          };
        }
      }
    }

    if (
      result.status === "accepted" &&
      commandWithActorMetadata.action.actionKind !== "reaction" &&
      result.reactionWindow
    ) {
      setPendingReactionWindow(result.reactionWindow);
    }

    if (
      result.status === "accepted" &&
      commandWithActorMetadata.action.actionKind === "reaction" &&
      commandWithActorMetadata.reaction?.windowId &&
      pendingReactionWindow?.windowId === commandWithActorMetadata.reaction.windowId
    ) {
      setPendingReactionWindow(null);
    }

    // Phase D closure pass: explicitly choose concentration spell candidate for checks.
    const localAppliedDamage = (result.targetResults ?? [])
      .filter((targetResult) => targetResult.applyState === "applied_local")
      .reduce((highestDamage, targetResult) => {
        const breakdown = targetResult.damageBreakdown;
        if (!breakdown) return highestDamage;
        const damageTaken = Math.max(0, breakdown.hpDamage + breakdown.tempHpAbsorbed);
        return Math.max(highestDamage, damageTaken);
      }, 0);

    const selectConcentrationSpellForCheck = () => {
      if (concentrationSpells.length === 0) return { spellId: null as string | null, reason: "none" as const };

      const localCasterId = memberId ?? character.id;
      const explicitlyOwned = concentrationSpells.filter((spell) => spell.casterId === localCasterId);
      if (explicitlyOwned.length === 1) {
        return { spellId: explicitlyOwned[0].id, reason: "explicit_owner" as const };
      }
      if (explicitlyOwned.length > 1) {
        return { spellId: null as string | null, reason: "ambiguous_multiple_owned" as const };
      }

      const legacyUnscoped = concentrationSpells.filter((spell) => !spell.casterId);
      if (legacyUnscoped.length === 1) {
        return { spellId: legacyUnscoped[0].id, reason: "legacy_single" as const };
      }
      if (legacyUnscoped.length > 1) {
        return { spellId: null as string | null, reason: "ambiguous_multiple_legacy" as const };
      }

      if (concentrationSpells.length === 1) {
        return { spellId: concentrationSpells[0].id, reason: "single_fallback" as const };
      }

      return { spellId: null as string | null, reason: "ambiguous_mixed" as const };
    };

    if (
      result.status === "accepted" &&
      localAppliedDamage > 0 &&
      concentrationSpells.length > 0
    ) {
      const concentrationTarget = selectConcentrationSpellForCheck();
      if (!concentrationTarget.spellId) {
        const ambiguityNote = "Concentration check required, but active concentration spell is ambiguous; no spell was auto-selected.";
        setActionFeedback({
          level: "success",
          title: "Action Confirmed",
          message: ambiguityNote,
          commandId: result.commandId,
          at: Date.now(),
        });
        return {
          ...result,
          resolutionSummary: result.resolutionSummary
            ? {
                ...result.resolutionSummary,
                notes: [...(result.resolutionSummary.notes ?? []), ambiguityNote],
              }
            : {
                targetedCount: 0,
                resolvedCount: 0,
                appliedLocalCount: 0,
                previewOnlyCount: 0,
                totalHpDamageAppliedLocal: 0,
                totalHpDamagePreview: 0,
                notes: [ambiguityNote],
              },
          debug: {
            pathway: result.debug?.pathway ?? (isPartyAuthoritative ? "party" : "local"),
            notes: [...(result.debug?.notes ?? []), `concentration_selection_${concentrationTarget.reason}`],
          },
        };
      }

      const dc = Math.max(10, Math.floor(localAppliedDamage / 2));
      return {
        ...result,
        concentrationCheckNeeded: { dc, spellId: concentrationTarget.spellId, damageTaken: localAppliedDamage },
      };
    }

    if (result.status === "accepted") {
      const summary = formatOutcomeSummary(result);
      const fallback =
        commandWithActorMetadata.action.mode === "undo"
          ? `${commandWithActorMetadata.action.actionKind.replace("_", " ")} undone.`
          : `${commandWithActorMetadata.action.actionKind.replace("_", " ")} accepted.`;
      setActionFeedback({
        level: "success",
        title: "Action Confirmed",
        message: summary ?? fallback,
        commandId: result.commandId,
        at: Date.now(),
      });
    }

    return result;
  }, [
    resolvedActionsTotal,
    activeActorOption,
    applyLocalTargetResult,
    resolvedBonusActionsTotal,
    buildTargetSnapshotsById,
    canonicalCurrentTurnId,
    character.id,
    conditions,
    concentrationSpells,
    declineReactionWindow,
    effectiveActive,
    isPartyAuthoritative,
    memberId,
    pendingReactionWindow,
    refundAction,
    refundBonusAction,
    refundMovement,
    resolvedActionsUsed,
    resolvedBonusActionsUsed,
    resolvedReactionUsed,
    turnKey,
    remainingMovementFeet,
    spendMovement,
    toggleReaction,
    useAction,
    useBonusAction,
  ]);
  // New: turn order and current turn logic (stub, to be implemented as needed)
  // Example: setTurnOrder([/* member ids in initiative order */]); setCurrentTurnId(turnOrder[0]);
  const endTurn = useCallback(() => {
    decrementConcentrationRounds();

    if (isInParty && partyCode) {
      void (async () => {
        try {
          await sendPartyEndTurn(partyCode, {
            ...(memberId ? { memberId } : {}),
            ...(activeBattleId ? { battleId: activeBattleId } : {}),
          });
          await refreshCombatState(partyCode);
          resetTurn();
        } catch {
          // Ignore transient network/server errors and keep current local state.
        }
      })();
      return;
    }

    // Local fallback when not in a synced party.
    setTurnOrder((order) => {
      if (!order || order.length === 0) return order;
      const next = order.slice(1).concat(order[0]);
      setCurrentTurnId(next[0]);
      return next;
    });
    resetTurn();
  }, [activeBattleId, decrementConcentrationRounds, isInParty, memberId, partyCode, refreshCombatState]);

  return (
    <CombatContext.Provider
      value={{
        active: effectiveActive,
        actionsTotal: resolvedActionsTotal,
        actionsUsed: resolvedActionsUsed,
        bonusActionsTotal: resolvedBonusActionsTotal,
        bonusActionsUsed: resolvedBonusActionsUsed,
        reactionUsed: resolvedReactionUsed,
        objectInteractionUsed,
        movementUsed: resolvedMovementUsed,
        turnKey,
        actionUsed: resolvedActionsUsed >= resolvedActionsTotal,
        bonusActionUsed: resolvedBonusActionsUsed >= resolvedBonusActionsTotal,
        turnOrder: canonicalTurnOrder,
        currentTurnId: canonicalCurrentTurnId,
        combatNpcs: canonicalCombatNpcs,
        partyTargets,
        selectedTargetId,
        selectedTargetIds,
        setSelectedTargetId,
        toggleTargetId,
        clearTargetIds,
        selectedTargetName,
        actorOptions,
        activeActorOptionId,
        activeActorLabel: activeActorOption.label,
        setActiveActorOptionId,
        actionFeedback,
        dismissActionFeedback: () => setActionFeedback(null),
        concentrationSpells,
        addConcentrationSpell,
        decrementConcentrationRounds,
        breakConcentration,
        pendingReactionWindow,
        declineReactionWindow,
        toggleCombat,
        useAction,
        refundAction,
        useBonusAction,
        refundBonusAction,
        toggleAction,
        toggleBonusAction,
        toggleReaction,
        toggleObjectInteraction,
        spendMovement,
        refundMovement,
        resolveCombatAction,
        endTurn,
        remoteApplyFailureMessage,
        dismissRemoteApplyFailure: () => setRemoteApplyFailureMessage(null),
      }}
    >
      {children}
    </CombatContext.Provider>
  );
}

// CombatProvider is a thin wrapper so CombatInner can call useCharacter()
// (CharacterProvider must be an ancestor — guaranteed by _layout.tsx order)
export function CombatProvider({ children }: { children: ReactNode }) {
  return <CombatInner>{children}</CombatInner>;
}

export function useCombat() {
  return useContext(CombatContext);
}
