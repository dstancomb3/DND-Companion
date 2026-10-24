import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import type { CombatNpc, PartyMemberSummary, RecoverCompanionPayload } from "../utils/partyApi";

interface Props {
  npc: CombatNpc;
  members: PartyMemberSummary[];
  revision?: number;
  onRecover(payload: RecoverCompanionPayload): Promise<void>;
  colors: { foreground: string; mutedForeground: string; primary: string; border: string; background: string };
}

export function CompanionRecoveryPanel({ npc, members, revision, onRecover, colors: c }: Props) {
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<RecoverCompanionPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const detachedAt = npc.companionAdmission?.detachedAt;
  const targetMember = members.find(member => member.id === target);
  useEffect(() => { setReview(null); }, [npc.id, detachedAt, revision]);
  useEffect(() => { if (!targetMember) setReview(null); }, [targetMember]);
  if (!detachedAt) return null;
  const canReview = !!targetMember && reason.trim().length >= 3 && reason.trim().length <= 240 &&
    Number.isSafeInteger(revision) && Number(revision) > 0;
  async function confirm() {
    if (!review || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    try { await onRecover(review); setReview(null); }
    catch (failure) {
      setError(failure instanceof Error ? failure.message : "Recovery failed. Refresh and review again.");
      setReview(null);
    } finally { inFlight.current = false; setBusy(false); }
  }
  return (
    <View style={{ marginTop: 10, gap: 8, borderTopWidth: 1, borderColor: c.border, paddingTop: 10 }}>
      <Text style={{ color: c.foreground, fontWeight: "700" }}>Retained companion · awaiting DM review</Text>
      <Text style={{ color: c.mutedForeground }}>Original host only. Choose the receiving player after confirming ownership with them. Current HP, gear and used actions are preserved. Add to an encounter separately.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {members.map(member => (
          <TouchableOpacity key={member.id} disabled={busy} accessibilityRole="button"
            accessibilityState={{ selected: target === member.id, disabled: busy }}
            onPress={() => { setTarget(member.id); setReview(null); setError(null); }}
            style={{ minHeight: 44, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: target === member.id ? c.primary : c.border }}>
            <Text style={{ color: c.foreground }}>{member.characterName || "Unnamed player"} · {member.id.slice(-6)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {members.length === 0 && <Text style={{ color: c.mutedForeground }}>A player must join before recovery.</Text>}
      <TextInput value={reason} editable={!busy} maxLength={240} accessibilityLabel="Companion recovery reason"
        placeholder="Reason for restoring this companion" placeholderTextColor={c.mutedForeground}
        onChangeText={text => { setReason(text); setReview(null); }}
        style={{ minHeight: 44, padding: 10, borderWidth: 1, borderColor: c.border, borderRadius: 6, color: c.foreground, backgroundColor: c.background }} />
      {review ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.foreground }}>Restore {npc.name} to {targetMember?.characterName || "the selected player"}?</Text>
          <Text style={{ color: c.mutedForeground }}>{review.reason}</Text>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void confirm()}
            style={{ minHeight: 44, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: c.primary }}>
            <Text style={{ color: c.primary, fontWeight: "700" }}>{busy ? "Restoring…" : "Confirm recovery"}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => setReview(null)} style={{ minHeight: 44, padding: 10 }}>
            <Text style={{ color: c.mutedForeground }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity accessibilityRole="button" disabled={!canReview || busy}
          accessibilityState={{ disabled: !canReview || busy }}
          onPress={() => {
            if (canReview && detachedAt && revision) setReview({ targetMemberId: target, expectedRevision: revision, expectedDetachedAt: detachedAt, reason: reason.trim() });
          }} style={{ minHeight: 44, padding: 10, opacity: canReview ? 1 : 0.5 }}>
          <Text style={{ color: c.primary, fontWeight: "700" }}>Review recovery</Text>
        </TouchableOpacity>
      )}
      {error && <Text accessibilityRole="alert" style={{ color: "#f87171" }}>{error}</Text>}
    </View>
  );
}
