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

export function SessionEventLogPanel({ events, members = [], npcNames = [] }: {
  events: readonly PartyEvent[];
  members?: readonly PartyMemberSummary[];
  npcNames?: readonly { id: string; name: string }[];
}) {
  const c = useColors();
  const actorName = (id: unknown) => {
    if (id === "environment") return "The environment";
    if (typeof id !== "string") return "A combatant";
    return members.find(member => member.id === id)?.characterName ??
      npcNames.find(npc => npc.id === id)?.name ?? "A combatant";
  };
  const describe = (event: PartyEvent): { heading: string; description: string } | null => {
    const meta = event.metadata ?? {};
    const actor = event.memberId ? actorName(event.memberId) : "A combatant";
    if (event.type === "turn_advanced") {
      return { heading: "Initiative", description: `${actorName(meta.from)} ends their turn. ${actorName(meta.to)} is next.` };
    }
    if (event.type === "player_economy_spend") {
      const slot = meta.slot === "bonusAction" ? "bonus action" : meta.slot === "action" ? "action" :
        meta.slot === "reaction" ? "reaction" : meta.slot === "movement" ? "movement" : "turn resource";
      return { heading: "Action economy", description: `${actor} uses their ${slot}.` };
    }
    if (event.type === "player_attack_used") {
      const attackName = typeof meta.attackName === "string" ? meta.attackName : event.message.replace(/^Attack:\\s*/,"");
      return { heading: "Attack", description: `${actor} attacks with ${attackName}.` };
    }
    if (event.type === "combat_remote_outcome_applied") {
      const count = typeof meta.appliedCount === "number" ? meta.appliedCount : 0;
      return { heading: "Combat resolved", description: `The combat engine commits ${count} target update${count === 1 ? "" : "s"} for ${actor}.` };
    }
    if (event.type === "npc_weapon_turn_committed") {
      return { heading: "NPC attack", description: event.message };
    }
    if (event.type === "npc_defeated") return { heading: "Defeated", description: event.message };
    return { heading: event.type.replaceAll("_", " "), description: event.message };
  };
  const readable = events.slice(0, 30).map(event => ({ id: event.id, item: describe(event) })).filter(entry => entry.item);
  return <View style={{ gap: 12 }}>
    {readable.length ? readable.map(({ id, item }) => <View key={id} style={{ gap: 3 }}>
      <Text style={{ color: c.mutedForeground, fontSize: 10, textTransform: "capitalize" }}>{item!.heading}</Text>
      <Text style={{ color: c.foreground, fontSize: 12, lineHeight: 18 }}>{item!.description}</Text>
    </View>) : <Text style={{ color: c.mutedForeground }}>No shared session events yet.</Text>}
  </View>;
}
