import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useParty } from "@/context/PartyContext";
import { useCombat } from "@/context/CombatContext";
import { useColors } from "@/hooks/useColors";
import { THEMES, useAppSettings } from "@/context/AppSettingsContext";
import { getCombatNpcPresentation } from "@/utils/combat/companionCombatPresentation";

const NPC_STAT_PILLS = [
  { key: "speed", label: "SPD" },
  { key: "initiativeBonus", label: "INIT" },
  { key: "strength", label: "STR" },
  { key: "dexterity", label: "DEX" },
  { key: "constitution", label: "CON" },
  { key: "intelligence", label: "INT" },
  { key: "wisdom", label: "WIS" },
  { key: "charisma", label: "CHA" },
] as const;

type ConditionSummary = { id: string; name: string };

function ConditionBadges({ conditions }: { conditions: ConditionSummary[] }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  if (conditions.length === 0) return null;

  return (
    <View style={styles.conditionRow}>
      {conditions.map((condition) => (
        <View
          key={condition.id}
          style={[
            styles.conditionBadge,
            { backgroundColor: c.primary + "22", borderColor: c.primary + "55" },
          ]}
        >
          <Text style={{ fontSize: 9, color: c.primary, fontWeight: "700" }} numberOfLines={1}>
            {condition.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

interface PartyMiniListProps {
  npcNameOverridesById?: Record<string, string>;
}

export function PartyMiniList({ npcNameOverridesById }: PartyMiniListProps) {
  const { members, memberId, combatState } = useParty();
  const { turnOrder, currentTurnId, selectedTargetIds: combatSelectedTargetIds } = useCombat();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { settings } = useAppSettings();

  const myBattleId = memberId ? combatState?.participantBattleById?.[memberId] ?? null : null;
  const isPartyMode = Boolean(memberId && combatState);
  const encounterTurnOrder = isPartyMode
    ? (myBattleId ? combatState?.battleTurnOrderById?.[myBattleId] ?? [] : [])
    : turnOrder;
  const encounterCurrentTurnId = isPartyMode
    ? (myBattleId ? combatState?.currentTurnIdByBattle?.[myBattleId] ?? null : null)
    : currentTurnId;

  const visibleMembers = React.useMemo(() => {
    if (!isPartyMode || !myBattleId) return members;
    const participantBattle = combatState?.participantBattleById ?? {};
    return members.filter((member) => participantBattle[member.id] === myBattleId);
  }, [members, combatState?.participantBattleById, isPartyMode, myBattleId]);

  // Sort party members by server turn order
  const sortedMembers = React.useMemo(() => {
    if (!encounterTurnOrder || encounterTurnOrder.length === 0) return visibleMembers;
    const orderMap = new Map(encounterTurnOrder.map((id, idx) => [id, idx]));
    return [...visibleMembers].sort((a, b) => {
      const ai = orderMap.get(a.id);
      const bi = orderMap.get(b.id);
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return a.characterName.localeCompare(b.characterName);
    });
  }, [visibleMembers, encounterTurnOrder]);

  // Get combatants (NPCs) - any disposition
  const combatants = (combatState?.combatNpcs ?? [])
    .filter((npc) => {
      if (!isPartyMode || !myBattleId) return true;
      return combatState?.participantBattleById?.[npc.id] === myBattleId;
    })
    .map((npc) => {
    const initiativeTotal = combatState?.initiative.find((i) => i.memberId === npc.id)?.initiativeTotal;
    return { ...npc, initiativeTotal };
  });

  return (
    <View style={[styles.container, { backgroundColor: c.card, borderColor: c.border }]}>
      {/* PARTY MEMBERS SECTION */}
      {sortedMembers.length > 0 && (
        <>
          <Text style={[styles.header, { color: c.mutedForeground }]}>Party Members</Text>
          <View style={styles.combatantsContainer}>
            {sortedMembers.map((m) => {
              const isMe = m.id === memberId;
              const isTurn = encounterCurrentTurnId ? m.id === encounterCurrentTurnId : (isPartyMode ? false : isMe);
              const isSelectedTarget = combatSelectedTargetIds.has(m.id);
              const profileUri = m.presentation?.profileImageUri?.trim() || "";
              const personalTheme = !settings.disablePartyCardThemes && m.presentation?.themeId
                ? THEMES[m.presentation.themeId as keyof typeof THEMES]
                : null;
              const accent = m.presentation?.accentHex || personalTheme?.palette.primary || c.primary;
              const cardBg = isTurn ? c.primary + "22" : personalTheme?.palette.card || c.background;
              const cardBorder = isTurn ? c.primary : isSelectedTarget ? c.primary : accent + "66";
              const localBg = personalTheme?.palette.background || c.background;
              const localBorder = personalTheme?.palette.border || c.border;
              const localMuted = personalTheme?.palette.mutedForeground || c.mutedForeground;
              const localFg = personalTheme?.palette.foreground || c.foreground;
              const stat = (value: number | null | undefined) => (typeof value === "number" ? `${value >= 0 ? "+" : ""}${value}` : "--");
              const conditions = (m.conditions ?? []) as ConditionSummary[];
              return (
                <View key={m.id}>
                  <View
                    style={[
                      styles.combatantCard,
                      {
                        borderColor: cardBorder,
                        borderWidth: isTurn ? 2 : 1,
                        backgroundColor: cardBg,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {profileUri ? (
                        <Image source={{ uri: profileUri }} style={styles.avatar} resizeMode="cover" />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { borderColor: accent + "66", backgroundColor: accent + "1A" }]}>
                          <Feather name="user" size={12} color={accent} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={[styles.name, { color: localFg, fontWeight: "600" }]} numberOfLines={1}>{m.characterName}</Text>
                          {isMe && <Feather name="user" size={12} color={accent} />}
                          {isSelectedTarget && <Feather name="crosshair" size={12} color={c.primary} />}
                        </View>
                        {/* HP bar in collapsed view */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: localBorder, overflow: "hidden" }}>
                            <View
                              style={{
                                width: `${Math.min(100, (m.currentHp / m.maxHp) * 100)}%`,
                                height: "100%",
                                backgroundColor:
                                  m.currentHp > m.maxHp * 0.5
                                    ? c.primary
                                    : m.currentHp > m.maxHp * 0.25
                                    ? c.mutedForeground
                                    : c.destructive,
                                borderRadius: 2,
                              }}
                            />
                          </View>
                          <Text style={{ fontSize: 10, color: localMuted, minWidth: 36 }}>{m.currentHp}/{m.maxHp}</Text>
                        </View>
                        <ConditionBadges conditions={conditions} />
                        {m.coreStats && (
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                            {[
                              { label: "STR", value: stat(m.coreStats.strength) },
                              { label: "DEX", value: stat(m.coreStats.dexterity) },
                              { label: "CON", value: stat(m.coreStats.constitution) },
                              { label: "INT", value: stat(m.coreStats.intelligence) },
                              { label: "WIS", value: stat(m.coreStats.wisdom) },
                              { label: "CHA", value: stat(m.coreStats.charisma) },
                            ].map(({ label, value }) => (
                              <View key={label} style={[styles.statPill, { borderColor: localBorder, backgroundColor: localBg }]}>
                                <Text style={{ fontSize: 9, fontWeight: "700", color: localMuted }}>{label}</Text>
                                <Text style={{ fontSize: 10, fontWeight: "700", color: localFg }}>{value}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {m.coreStats && (
                        <View style={[styles.acBadge, { backgroundColor: c.primary + "22", borderColor: c.primary + "55" }]}>
                          <Text style={{ fontSize: 9, color: localMuted, fontWeight: "600" }}>INIT</Text>
                          <Text style={{ fontSize: 11, fontWeight: "800", color: c.foreground }}>
                            {m.coreStats.initiativeBonus !== undefined && m.coreStats.initiativeBonus !== null
                              ? (m.coreStats.initiativeBonus >= 0 ? "+" : "") + m.coreStats.initiativeBonus
                              : "--"}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.acBadge, { backgroundColor: accent + "22", borderColor: accent + "55" }]}>
                        <Text style={{ fontSize: 9, color: localMuted, fontWeight: "600" }}>AC</Text>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: accent }}>{m.armorClass}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* COMBATANTS SECTION */}
      {combatants.length > 0 && (
        <>
          {sortedMembers.length > 0 && <View style={{ height: 8 }} />}
          <Text style={[styles.header, { color: c.mutedForeground }]}>Combatants</Text>

          <View style={styles.combatantsContainer}>
            {combatants.map((npc) => {
              const dispositionColor = npc.disposition === "hostile" ? c.destructive : npc.disposition === "friendly" ? c.primary : c.mutedForeground;
              const isTurn = encounterCurrentTurnId === npc.id;
              const isSelectedTarget = combatSelectedTargetIds.has(npc.id);
              const conditions = npc.conditions ?? [];
              const presentation = getCombatNpcPresentation(npc, members, memberId);
              const overriddenDisplayName = npcNameOverridesById?.[npc.id]?.trim();
              const visibleStatPills = NPC_STAT_PILLS.reduce<Array<{ key: typeof NPC_STAT_PILLS[number]["key"]; label: typeof NPC_STAT_PILLS[number]["label"]; value: string }>>((acc, { key, label }) => {
                if (!npc.visibleStatKeys.includes(key)) return acc;
                const value = npc.coreStats?.[key];
                if (typeof value !== "number") return acc;
                acc.push({
                  key,
                  label,
                  value: key === "initiativeBonus" ? `${value >= 0 ? "+" : ""}${value}` : `${value}`,
                });
                return acc;
              }, []);
              
              return (
                <View key={npc.id}>
                  <View
                    style={[
                      styles.combatantCard,
                      styles.combatantCardStack,
                      {
                        borderColor: isTurn ? c.primary : isSelectedTarget ? c.primary : c.border,
                        borderWidth: isTurn ? 2 : 1,
                        backgroundColor: isTurn ? c.primary + "22" : isSelectedTarget ? c.primary + "22" : c.background,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: dispositionColor + "22", borderWidth: 1, borderColor: dispositionColor, alignItems: "center", justifyContent: "center" }}>
                        <Feather name="shield" size={13} color={dispositionColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.name, { color: c.foreground, fontWeight: "600" }]} numberOfLines={1}>{overriddenDisplayName || presentation.displayName}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Text style={[styles.disposition, { color: dispositionColor, fontSize: 10 }]}>{npc.disposition}</Text>
                          <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>{presentation.badgeLabel}</Text>
                        </View>
                        <ConditionBadges conditions={conditions} />
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {typeof npc.initiativeTotal === "number" && (
                        <Text style={[styles.initiative, { color: c.primary }]}>Init {npc.initiativeTotal}</Text>
                      )}
                    </View>
                    {visibleStatPills.length > 0 && (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, width: "100%" }}>
                        {visibleStatPills.map((pill) => (
                          <View key={pill.key} style={[styles.statPill, { borderColor: c.border, backgroundColor: c.card }]}>
                            <Text style={{ fontSize: 9, fontWeight: "700", color: c.mutedForeground }}>{pill.label}</Text>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: c.foreground }}>{pill.value}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const makeStyles = (c: { radiusMd: number; radiusSm: number; radiusPill: number }) => StyleSheet.create({
  container: {
    borderRadius: c.radiusMd,
    borderWidth: 1,
    padding: 6,
    marginBottom: 8,
    alignSelf: "stretch",
  },
  header: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
    letterSpacing: 1,
  },
  row: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
  },
  member: {
    borderRadius: c.radiusSm,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    minWidth: 44,
    alignItems: "center",
    marginRight: 2,
    marginBottom: 2,
  },
  name: {
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 60,
  },
  hp: {
    fontSize: 11,
    fontWeight: "400",
  },
  combatantsContainer: {
    gap: 6,
  },
  combatantCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: c.radiusSm,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  combatantCardStack: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  acBadge: {
    borderRadius: c.radiusSm,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
  },
  statPill: {
    borderRadius: c.radiusMd,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  conditionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  conditionBadge: {
    borderRadius: c.radiusPill,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: "100%",
  },
  disposition: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  initiative: {
    fontSize: 10,
    fontWeight: "700",
  },
});
