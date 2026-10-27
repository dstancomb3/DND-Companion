import React, { useEffect, useState } from "react";
import { Modal, Text, TouchableOpacity, View, ScrollView } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { CombatNpc, LootAssignment } from "@/utils/partyApi";

export function DefeatedNpcLootModal({ npc, pendingAssignments, onClose, onTransfer, onRecover }: {
  npc: CombatNpc | null;
  pendingAssignments: readonly LootAssignment[];
  onRecover: () => Promise<void>;
  onClose: () => void;
  onTransfer: (itemIds: string[]) => Promise<void>;
}) {
  const c = useColors();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setSelected([]); setError(""); }, [npc?.id]);
  const items = npc?.dummyState?.currentHp === 0 && npc.projection?.combatantKind !== "companion" ? npc.gear ?? [] : [];
  async function transfer(ids: string[]) {
    if (!npc || busy || !ids.length) return;
    setBusy(true); setError("");
    try { await onTransfer(ids); setSelected([]); } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to transfer loot.");
    } finally { setBusy(false); }
  }
  return <Modal visible={!!npc} transparent animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: "#000000B8", justifyContent: "center", alignItems: "center", padding: 16 }}>
      <View style={{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 14, width: "100%", maxWidth: 460, maxHeight: "80%", padding: 16, gap: 12 }}>
        <Text style={{ color: c.foreground, fontSize: 18, fontWeight: "800" }}>Loot {npc?.name}</Text>
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Choose which confirmed belongings to transfer. Items already collected disappear from this list.</Text>
        <ScrollView style={{ maxHeight: 340 }}>
          {items.length ? items.map(item => {
            const checked = selected.includes(item.id);
            return <TouchableOpacity key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={`Select ${item.name}`}
              disabled={busy} onPress={() => setSelected(current => checked ? current.filter(id => id !== item.id) : [...current, item.id])}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.border }}>
              <Text style={{ color: checked ? c.primary : c.mutedForeground, fontSize: 18 }}>{checked ? "☑" : "☐"}</Text>
              <View style={{ flex: 1 }}><Text style={{ color: c.foreground, fontWeight: "700" }}>{item.name}</Text>
                <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{item.category}</Text></View>
            </TouchableOpacity>;
          }) : <Text style={{ color: c.mutedForeground }}>No available belongings remain.</Text>}
        </ScrollView>
        {pendingAssignments.length ? <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={async () => { setBusy(true); setError(""); try { await onRecover(); } catch (e) { setError(e instanceof Error ? e.message : "Could not finish pending loot."); } finally { setBusy(false); } }} style={{ borderWidth: 1, borderColor: c.primary, padding: 10, borderRadius: 8 }}><Text style={{ color: c.primary, fontWeight: "700" }}>Finish {pendingAssignments.length} pending transfer(s)</Text></TouchableOpacity> : null}
        {error ? <Text accessibilityRole="alert" style={{ color: c.destructive }}>{error}</Text> : null}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <TouchableOpacity accessibilityRole="button" disabled={busy || !selected.length} onPress={() => void transfer(selected)}
            style={{ backgroundColor: c.primary, padding: 10, borderRadius: 8, opacity: busy || !selected.length ? 0.5 : 1 }}>
            <Text style={{ color: c.primaryForeground, fontWeight: "700" }}>{busy ? "Transferring..." : "Transfer Selected"}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={busy || !items.length} onPress={() => void transfer(items.map(item => item.id))}
            style={{ borderWidth: 1, borderColor: c.primary, padding: 10, borderRadius: 8, opacity: busy || !items.length ? 0.5 : 1 }}>
            <Text style={{ color: c.primary, fontWeight: "700" }}>Transfer All</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={onClose}
            style={{ borderWidth: 1, borderColor: c.border, padding: 10, borderRadius: 8 }}>
            <Text style={{ color: c.foreground }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>;
}
