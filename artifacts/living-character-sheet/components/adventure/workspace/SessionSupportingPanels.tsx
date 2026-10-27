import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { PartyMemberSummary, PartyEvent } from "@/utils/partyApi";
import type { InventoryItem } from "@/types";

export function SessionPartyPanel({ members, currentTurnId }: { members: readonly PartyMemberSummary[]; currentTurnId: string | null }) {
  const c = useColors();
  return <View style={{ gap: 12 }}>
    {members.length === 0 ? <Text style={{ color: c.mutedForeground }}>No connected party members.</Text> : members.map(member => (
      <View key={member.id} style={{ gap: 4 }}>
        <Text style={{ color: member.id === currentTurnId ? c.primary : c.foreground, fontWeight: "700" }}>{member.characterName}{member.id === currentTurnId ? " · Active turn" : ""}</Text>
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>HP {member.currentHp}/{member.maxHp}{member.tempHp > 0 ? ` +${member.tempHp} temporary` : ""}</Text>
        {(member.conditions ?? []).length ? <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{(member.conditions ?? []).map(condition => condition.name).join(", ")}</Text> : null}
      </View>
    ))}
  </View>;
}

export function SessionInventoryPanel({ items }: { items: readonly InventoryItem[] }) {
  const c = useColors();
  const visible = items.filter(item => item.quantity > 0);
  return <View style={{ gap: 10 }}>
    {visible.length ? visible.map(item => <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Text style={{ color: c.foreground, fontSize: 13, flexShrink: 1 }}>{item.name} ×{item.quantity}</Text>
      {item.equipped ? <View accessibilityLabel="Equipped" accessibilityRole="image"><Feather name="check-circle" size={13} color={c.primary} /></View> : null}
    </View>) : <Text style={{ color: c.mutedForeground }}>No items in inventory.</Text>}
  </View>;
}

export function SessionEventLogPanel({ events }: { events: readonly PartyEvent[] }) {
  const c = useColors();
  return <View style={{ gap: 12 }}>
    {events.length ? events.slice(0, 20).map(event => <View key={event.id} style={{ gap: 3 }}>
      <Text style={{ color: c.mutedForeground, fontSize: 10 }}>{event.type.replaceAll("_", " ")}</Text>
      <Text style={{ color: c.foreground, fontSize: 12, lineHeight: 18 }}>{event.message}</Text>
    </View>) : <Text style={{ color: c.mutedForeground }}>No shared session events yet.</Text>}
  </View>;
}
