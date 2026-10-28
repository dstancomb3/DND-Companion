import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createParty,
  joinParty,
  registerPartyMember,
  hasPartyMemberAccess,
  syncPartyMember,
  fetchPartyMembers,
  fetchPartyCombatState,
  acknowledgePartyRestRequest,
  leaveParty,
  type PartyMemberSummary,
  type PartyCombatState,
  type PartyRestType,
  type SyncPayload,
  PartyConflictError,
  PartyMemberAccessError,
} from "@/utils/partyApi";
import { useCharacter } from "@/context/CharacterContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useEquippedEffects, getResourceExtraMax } from "@/hooks/useEquippedEffects";
import { triggerEffect } from "@/utils/triggerEffect";
import { validateSelectedRestProvisions } from "@/utils/adventure/restProvisionSelection";
import { readRestApplicationPhase, restApplicationNextStep } from "@/utils/adventure/restApplicationReceipt";

const STORAGE_KEY = "@party_session";
const POLL_INTERVAL = 3000;
const SYNC_DEBOUNCE_MS = 2000;

interface StoredSession {
  memberId: string;
  partyCode: string;
}

interface PartyContextType {
  isHydrated: boolean;
  partyCode: string | null;
  memberId: string | null;
  members: PartyMemberSummary[];
  combatState: PartyCombatState | null;
  combatStateLoadError: string | null;
  isInParty: boolean;
  isLoading: boolean;
  error: string | null;
  createAndJoinParty: () => Promise<void>;
  joinExistingParty: (code: string, initial?: { characterId: string; snapshot: SyncPayload }) => Promise<void>;
  leaveCurrentParty: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  refreshCombatState: (codeOverride?: string) => Promise<PartyCombatState | null>;
}

const PartyContext = createContext<PartyContextType | null>(null);

function PartyProviderInner({ children }: { children: ReactNode }) {
  const {
    character,
    inventory,
    updateItem,
    conditions,
    resources,
    resetResource,
    rechargeSpellEffects,
    rechargeItemEffects,
    restoreAllSpellSlots,
    clearConditionsOnRest,
    updateHp,
    updateTempHp,
    dispatchRuleTrigger,
  } = useCharacter();
  const { settings, accentHex } = useAppSettings();
  const { resourceMaxBonuses } = useEquippedEffects();

  const [partyCode, setPartyCode] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [members, setMembers] = useState<PartyMemberSummary[]>([]);
  const [combatState, setCombatState] = useState<PartyCombatState | null>(null);
  const [combatStateLoadError, setCombatStateLoadError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentCodeRef = useRef<string | null>(null);
  const currentMemberIdRef = useRef<string | null>(null);
  const processingRestRequestIdsRef = useRef<Set<string>>(new Set());
  const localHpRef = useRef({ hp: character.currentHp, tempHp: character.tempHp ?? 0 });
  localHpRef.current = { hp: character.currentHp, tempHp: character.tempHp ?? 0 };
  const lastServerHpRef = useRef<{ hp: number; tempHp: number; updatedAt: string } | null>(null);
  const reconcileCommittedMemberHp = useCallback((results: PartyMemberSummary[], mid: string | null) => {
    const own = results.find(member => member.id === mid);
    if (!own || !Number.isFinite(own.currentHp) || !Number.isFinite(own.tempHp)) return;
    const last = lastServerHpRef.current;
    if (last && own.updatedAt < last.updatedAt) return;
    // Unchanged server HP is not proof that a locally applied healing effect failed.
    // Keep it pending until its guarded sync finishes.
    const serverChanged = !last || own.currentHp !== last.hp || own.tempHp !== last.tempHp;
    lastServerHpRef.current = { hp: own.currentHp, tempHp: own.tempHp, updatedAt: own.updatedAt };
    if (!serverChanged) return;
    const oldTemp = localHpRef.current.tempHp;
    const delta = own.currentHp - localHpRef.current.hp;
    if (delta) {
      updateHp(delta, "ai");
      if (delta < 0) triggerEffect("damage_flash");
      else triggerEffect("heal_flash");
      localHpRef.current.hp = own.currentHp;
    }
    if (own.tempHp !== oldTemp) {
      updateTempHp(own.tempHp);
      localHpRef.current.tempHp = own.tempHp;
      if (!delta && own.tempHp < oldTemp) triggerEffect("damage_flash");
    }
  }, [updateHp, updateTempHp]);

  const combatStateRequestSeqRef = useRef(0);
  const latestCombatStateRef = useRef<{ revision: number; updatedAt: string }>({ revision: -1, updatedAt: "" });

  const isIncomingCombatStateNewer = useCallback((incoming: PartyCombatState) => {
    const incomingRevision = typeof incoming.stateRevision === "number" ? incoming.stateRevision : -1;
    const currentRevision = latestCombatStateRef.current.revision;
    if (incomingRevision !== currentRevision) {
      return incomingRevision > currentRevision;
    }

    const incomingUpdatedAt = typeof incoming.updatedAt === "string" ? incoming.updatedAt : "";
    return incomingUpdatedAt >= latestCombatStateRef.current.updatedAt;
  }, []);

  const buildSnapshot = useCallback(
    (mid: string, code: string): SyncPayload => ({
      memberId: mid,
      partyCode: code,
      characterName: character.name,
      characterClass: character.class + (character.level ? ` ${character.level}` : ""),
      currentHp: character.currentHp,
      maxHp: character.maxHp,
      tempHp: character.tempHp ?? 0,
      expectedCurrentHp: lastServerHpRef.current?.hp,
      expectedTempHp: lastServerHpRef.current?.tempHp,
      armorClass: character.armorClass,
      damageResistances: character.damageResistances ?? [],
      damageImmunities: character.damageImmunities ?? [],
      conditionImmunities: character.conditionImmunities ?? [],
      snapshotUpdatedAt: Date.now(),
      coreStats: {
        speed: character.speed,
        initiativeBonus: character.initiative,
        strength: character.abilityScores.strength,
        dexterity: character.abilityScores.dexterity,
        constitution: character.abilityScores.constitution,
        intelligence: character.abilityScores.intelligence,
        wisdom: character.abilityScores.wisdom,
        charisma: character.abilityScores.charisma,
      },
      presentation: {
        themeId: settings.themeId,
        accentHex,
        profileImageUri: character.profileImageUri ?? null,
      },
      conditions: conditions.map((c) => ({ id: c.id, name: c.name })),
    }),
    [character, conditions, settings.themeId, accentHex]
  );

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const clearSession = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const isSessionGoneError = useCallback((err: unknown) => {
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    return msg.includes("party session not found") || msg.includes("expired");
  }, []);

  const sessionEndedMessage = useCallback((err: unknown) => {
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    if (msg.includes("expired")) return "This party session expired.";
    return "This party was disbanded by the DM.";
  }, []);

  const handleSessionEnded = useCallback(async (message = "This party was disbanded by the DM.") => {
    stopPolling();
    setPartyCode(null);
    setMemberId(null);
    setMembers([]);
    currentCodeRef.current = null;
    currentMemberIdRef.current = null;
    latestCombatStateRef.current = { revision: -1, updatedAt: "" };
    processingRestRequestIdsRef.current.clear();
    lastServerHpRef.current = null;
    await clearSession();
    setError(message);
  }, [clearSession, stopPolling]);

  const applyRestRequest = useCallback((restType: PartyRestType) => {
    if (restType === "short_rest") {
      resources
        .filter((resource) => resource.resetOn === "short_rest")
        .forEach((resource) => resetResource(resource.id, resource.max + getResourceExtraMax(resource, resourceMaxBonuses)));
      rechargeSpellEffects("short_rest");
      rechargeItemEffects("short_rest");
      clearConditionsOnRest("short_rest");
      dispatchRuleTrigger("short_rest");
      return;
    }

    resources.filter(resource => resource.resetOn === "short_rest" || resource.resetOn === "long_rest").forEach((resource) => {
      resetResource(resource.id, resource.max + getResourceExtraMax(resource, resourceMaxBonuses));
    });
    rechargeSpellEffects("long_rest");
    rechargeItemEffects("long_rest");
    restoreAllSpellSlots();
    clearConditionsOnRest("long_rest");
    updateHp(character.maxHp - character.currentHp);
    dispatchRuleTrigger("long_rest");
    triggerEffect("long_rest");
  }, [character.currentHp, character.maxHp, clearConditionsOnRest, dispatchRuleTrigger, rechargeSpellEffects, rechargeItemEffects, resetResource, resourceMaxBonuses, resources, restoreAllSpellSlots, updateHp]);

  const refreshCombatState = useCallback(async (codeOverride?: string): Promise<PartyCombatState | null> => {
    const code = codeOverride ?? currentCodeRef.current;
    if (!code) return null;

    const requestSeq = combatStateRequestSeqRef.current + 1;
    combatStateRequestSeqRef.current = requestSeq;

    try {
      const state = await fetchPartyCombatState(code);
      if (requestSeq !== combatStateRequestSeqRef.current) {
        return null;
      }
      if (!isIncomingCombatStateNewer(state)) {
        return null;
      }
      setCombatState(state);
      setCombatStateLoadError(null);
      latestCombatStateRef.current = {
        revision: typeof state.stateRevision === "number" ? state.stateRevision : -1,
        updatedAt: state.updatedAt ?? "",
      };
      return state;
    } catch (error) {
      if (requestSeq === combatStateRequestSeqRef.current) {
        setCombatStateLoadError(error instanceof Error ? error.message : "Combat state request failed.");
      }
      return null;
    }
  }, [isIncomingCombatStateNewer]);

  const syncApprovedRestRequests = useCallback(async (code: string, mid: string) => {
    try {
      const state = await refreshCombatState(code);
      if (!state) return;
      const pendingApproved = state.restRequests.filter(
        (request) =>
          request.status === "approved" &&
          request.targetMemberIds.includes(mid) &&
          !request.acknowledgements.includes(mid)
      );

      for (const request of pendingApproved) {
        if (processingRestRequestIdsRef.current.has(request.id)) continue;
        processingRestRequestIdsRef.current.add(request.id);
        try {
          // Read the receipt before checking inventory: previously consumed
          // provisions may now have quantity zero after app restart.
          const receiptKey = `@party_rest_applied:${code}:${mid}:${request.id}`;
          const phase = readRestApplicationPhase(await AsyncStorage.getItem(receiptKey));
          const step = restApplicationNextStep(phase);
          if (step === "review") {
            // A prior session crashed mid-application. Applying again could
            // duplicate rest recovery or provision debit. Do not acknowledge.
            console.warn("[PartyContext] Rest application interrupted; manual reconciliation required", { requestId: request.id });
            continue;
          }
          if (step === "apply") {
            const provisionCheck = validateSelectedRestProvisions(request.requestedByMemberId === mid ? request.provisions : undefined, inventory);
            if (!provisionCheck.ok) {
              console.warn("[PartyContext] Approved rest awaits valid provisions:", provisionCheck.reason);
              continue;
            }
            await AsyncStorage.setItem(receiptKey, "applying");
            for (const provision of provisionCheck.debit)
              updateItem(provision.id, { quantity: provision.nextQuantity });
            applyRestRequest(request.restType);
            await AsyncStorage.setItem(receiptKey, "applied");
          }
          await acknowledgePartyRestRequest(code, request.id, { memberId: mid });
        } catch (err) {
          if (err instanceof PartyConflictError) {
            // State was updated concurrently; schedule a fresh pull and skip this cycle.
            console.warn(
              "[PartyContext] runtime conflict acknowledging rest request — refreshing state",
              {
                code: err.conflictCode,
                expectedRevision: err.expectedRevision,
                currentRevision: err.currentRevision,
              }
            );
            void refreshCombatState(code);
          }
        } finally {
          processingRestRequestIdsRef.current.delete(request.id);
        }
      }
    } catch {
      // Keep polling resilient if combat-state sync is temporarily unavailable.
    }
  }, [applyRestRequest, refreshCombatState, inventory, updateItem]);

  const refreshMembers = useCallback(async () => {
    const code = currentCodeRef.current;
    const mid = currentMemberIdRef.current;
    if (!code) return;
    try {
      const result = await fetchPartyMembers(code);
      setMembers(result.members);
      reconcileCommittedMemberHp(result.members, mid);
      setError(null);
      if (mid) {
        await syncApprovedRestRequests(code, mid);
      }
    } catch (err: unknown) {
      if (isSessionGoneError(err)) {
        await handleSessionEnded(sessionEndedMessage(err));
        return;
      }
      const e = err as Error;
      setError(e.message ?? "Failed to refresh party");
    }
  }, [handleSessionEnded, isSessionGoneError, sessionEndedMessage, syncApprovedRestRequests, reconcileCommittedMemberHp]);

  const startPolling = useCallback(
    (code: string) => {
      currentCodeRef.current = code;
      stopPolling();
      pollRef.current = setInterval(async () => {
        if (!currentCodeRef.current) return;
        try {
          const result = await fetchPartyMembers(currentCodeRef.current);
          setMembers(result.members);
          reconcileCommittedMemberHp(result.members, currentMemberIdRef.current);
          if (currentMemberIdRef.current) {
            await syncApprovedRestRequests(currentCodeRef.current, currentMemberIdRef.current);
          }
        } catch (err: unknown) {
          if (isSessionGoneError(err)) {
            await handleSessionEnded(sessionEndedMessage(err));
          }
        }
      }, POLL_INTERVAL);
    },
    [handleSessionEnded, isSessionGoneError, sessionEndedMessage, stopPolling, syncApprovedRestRequests, reconcileCommittedMemberHp]
  );

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(async (raw) => {
      if (!raw) return;
      try {
        const session: StoredSession = JSON.parse(raw);
        if (!session.partyCode || !session.memberId) return;
        if (!await hasPartyMemberAccess(session.partyCode, session.memberId)) {
          await AsyncStorage.removeItem(STORAGE_KEY);
          setError("Party security was updated. Rejoin your party to register this character.");
          return;
        }
        try {
          const result = await fetchPartyMembers(session.partyCode);
          setPartyCode(session.partyCode);
          setMemberId(session.memberId);
          currentCodeRef.current = session.partyCode;
          currentMemberIdRef.current = session.memberId;
          setMembers(result.members);
          reconcileCommittedMemberHp(result.members, session.memberId);
          await refreshCombatState(session.partyCode);
          startPolling(session.partyCode);
        } catch {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      } catch {}
    }).finally(() => {
      setIsHydrated(true);
    });

    return () => stopPolling();
  }, [refreshCombatState, startPolling, stopPolling, reconcileCommittedMemberHp]);

  useEffect(() => {
    const code = currentCodeRef.current;
    const mid = currentMemberIdRef.current;
    if (!code || !mid) return;

    if (syncDebounceRef.current) {
      clearTimeout(syncDebounceRef.current);
    }
    syncDebounceRef.current = setTimeout(async () => {
      if (!currentCodeRef.current || !currentMemberIdRef.current) return;
      const syncCode = currentCodeRef.current;
      const syncMemberId = currentMemberIdRef.current;
      try {
        await syncPartyMember(buildSnapshot(syncMemberId, syncCode));
        await refreshMembers();
      } catch (err) {
        if (err instanceof PartyMemberAccessError) {
          if (currentCodeRef.current === syncCode && currentMemberIdRef.current === syncMemberId) await handleSessionEnded(err.message);
          return;
        }
        if (!(err instanceof PartyConflictError)) setError(err instanceof Error ? err.message : "Party sync failed.");
        if (err instanceof PartyConflictError) {
          setError("Party sync is stale; pulled latest state.");
          void refreshMembers();
          void refreshCombatState();
        }
      }
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
    };
  }, [
    character.currentHp,
    character.maxHp,
    character.tempHp,
    character.armorClass,
    character.speed,
    character.initiative,
    character.profileImageUri,
    character.abilityScores.strength,
    character.abilityScores.dexterity,
    character.abilityScores.constitution,
    character.abilityScores.intelligence,
    character.abilityScores.wisdom,
    character.abilityScores.charisma,
    character.name,
    character.class,
    character.level,
    conditions,
    settings.themeId,
    accentHex,
    handleSessionEnded,
    buildSnapshot,
    refreshMembers,
    refreshCombatState,
  ]);

  useEffect(() => {
    const code = currentCodeRef.current;
    const mid = currentMemberIdRef.current;
    if (!code || !mid) return;

    const syncNow = async () => {
      try {
        await syncPartyMember(buildSnapshot(mid, code));
      } catch (err) {
        if (err instanceof PartyMemberAccessError) {
          if (currentCodeRef.current === code && currentMemberIdRef.current === mid) await handleSessionEnded(err.message);
          return;
        }
        if (!(err instanceof PartyConflictError)) setError(err instanceof Error ? err.message : "Party sync failed.");
        if (err instanceof PartyConflictError) {
          void refreshMembers();
          void refreshCombatState(code);
        }
      }
    };

    syncNow();
    const id = setInterval(syncNow, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [buildSnapshot, partyCode, memberId, refreshCombatState, refreshMembers, handleSessionEnded]);

  const persistSession = useCallback(async (code: string, mid: string) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ partyCode: code, memberId: mid }));
  }, []);

  const createAndJoinParty = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setCombatState(null);
      latestCombatStateRef.current = { revision: -1, updatedAt: "" };
      const { code } = await createParty();
      const { memberId: mid } = await registerPartyMember(code, character.id);
      await syncPartyMember(buildSnapshot(mid, code));
      const result = await fetchPartyMembers(code);
      setPartyCode(code);
      setMemberId(mid);
      currentCodeRef.current = code;
      currentMemberIdRef.current = mid;
      setMembers(result.members);
      reconcileCommittedMemberHp(result.members, mid);
      await refreshCombatState(code);
      await persistSession(code, mid);
      startPolling(code);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Failed to create party");
      throw err; // Session bootstrap must distinguish failure from success and offer retry.
    } finally {
      setIsLoading(false);
    }
  }, [buildSnapshot, persistSession, refreshCombatState, startPolling, character.id, reconcileCommittedMemberHp]);

  const joinExistingParty = useCallback(
    async (code: string, initial?: { characterId: string; snapshot: SyncPayload }) => {
      setIsLoading(true);
      setError(null);
      try {
        setCombatState(null);
        latestCombatStateRef.current = { revision: -1, updatedAt: "" };
        await joinParty(code);
        const { memberId: mid } = await registerPartyMember(code, initial?.characterId ?? character.id);
        await syncPartyMember(initial ? { ...initial.snapshot, memberId: mid, partyCode: code } : buildSnapshot(mid, code));
        const result = await fetchPartyMembers(code);
        setPartyCode(code);
        setMemberId(mid);
        currentCodeRef.current = code;
        currentMemberIdRef.current = mid;
        setMembers(result.members);
        reconcileCommittedMemberHp(result.members, mid);
        await refreshCombatState(code);
        await persistSession(code, mid);
        startPolling(code);
      } catch (err: any) {
        setError(err.message ?? "Failed to join party");
      } finally {
        setIsLoading(false);
      }
    },
    [buildSnapshot, persistSession, refreshCombatState, startPolling, character.id, reconcileCommittedMemberHp]
  );

  const leaveCurrentParty = useCallback(async () => {
    const code = currentCodeRef.current;
    const mid = currentMemberIdRef.current;
    if (!code || !mid) return;
    setIsLoading(true);
    try {
      await leaveParty(mid, code);
    } catch {}
    finally {
      stopPolling();
      setPartyCode(null);
      setMemberId(null);
      setMembers([]);
      setCombatState(null);
      setCombatState(null);
      latestCombatStateRef.current = { revision: -1, updatedAt: "" };
      currentCodeRef.current = null;
      currentMemberIdRef.current = null;
      await clearSession();
      setIsLoading(false);
    }
  }, [stopPolling, clearSession]);

  return (
    <PartyContext.Provider
      value={{
        isHydrated,
        partyCode,
        memberId,
        members,
        combatState,
        isInParty: !!partyCode,
        isLoading,
        error,
        createAndJoinParty,
        joinExistingParty,
        leaveCurrentParty,
        refreshMembers,
        refreshCombatState,
      }}
    >
      {children}
    </PartyContext.Provider>
  );
}

export function PartyProvider({ children }: { children: ReactNode }) {
  return <PartyProviderInner>{children}</PartyProviderInner>;
}

export function useParty(): PartyContextType {
  const ctx = useContext(PartyContext);
  if (!ctx) throw new Error("useParty must be used within PartyProvider");
  return ctx;
}
