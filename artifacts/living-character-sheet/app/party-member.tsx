import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useParty } from "@/context/PartyContext";
import {
  normalizeMemberIdParam,
  resolvePartyMemberForSheet,
  type PartyMemberSheetSource,
} from "@/utils/partyMemberSheetNavigation";

function formatLastUpdated(value?: string): string {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString();
}

function statValue(value: number | null | undefined): string {
  if (typeof value !== "number") return "--";
  return `${value >= 0 ? "+" : ""}${value}`;
}

export default function PartyMemberSheetScreen() {
  const c = useColors();
  const { members } = useParty();
  const params = useLocalSearchParams<{ memberId?: string | string[]; source?: string | string[] }>();

  const source = useMemo<PartyMemberSheetSource>(() => {
    const raw = Array.isArray(params.source) ? params.source[0] : params.source;
    return raw === "dm-party" ? "dm-party" : "party";
  }, [params.source]);

  const requestedMemberId = normalizeMemberIdParam(params.memberId);
  const member = useMemo(() => resolvePartyMemberForSheet(members, params.memberId), [members, params.memberId]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(source === "dm-party" ? "/dm-party" : "/party");
  };

  if (!member) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.container}>
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.backButton, { borderColor: c.border, backgroundColor: c.card }]}
          >
            <Feather name="arrow-left" size={14} color={c.foreground} />
            <Text style={{ color: c.foreground, fontWeight: "700" }}>Back</Text>
          </TouchableOpacity>

          <View style={[styles.emptyCard, { borderColor: c.border, backgroundColor: c.card }]}>
            <Feather name="alert-circle" size={24} color="#f87171" />
            <Text style={{ fontSize: 18, fontWeight: "800", color: c.foreground }}>Unable to open member sheet</Text>
            <Text style={{ color: c.mutedForeground, textAlign: "center", lineHeight: 20 }}>
              The selected party member is missing or no longer in this party.
            </Text>
            <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
              Requested member id: {requestedMemberId ?? "missing"}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const profileUri = member.presentation?.profileImageUri?.trim() || "";
  const core = member.coreStats;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.backButton, { borderColor: c.border, backgroundColor: c.card }]}
        >
          <Feather name="arrow-left" size={14} color={c.foreground} />
          <Text style={{ color: c.foreground, fontWeight: "700" }}>Back</Text>
        </TouchableOpacity>

        <View style={[styles.sheetCard, { borderColor: c.border, backgroundColor: c.card }]}>
          <View style={styles.headerRow}>
            <View style={styles.identityRow}>
              {profileUri ? (
                <Image source={{ uri: profileUri }} style={styles.avatar} resizeMode="cover" />
              ) : (
                <View style={[styles.avatarPlaceholder, { borderColor: c.border, backgroundColor: c.secondary }]}>
                  <Feather name="user" size={18} color={c.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: c.foreground }} numberOfLines={1}>
                  {member.characterName}
                </Text>
                <Text style={{ fontSize: 13, color: c.mutedForeground }}>{member.characterClass}</Text>
              </View>
            </View>
            <View style={[styles.acBadge, { borderColor: c.border, backgroundColor: c.secondary }]}>
              <Text style={{ fontSize: 10, color: c.mutedForeground, fontWeight: "700" }}>AC</Text>
              <Text style={{ fontSize: 18, color: c.foreground, fontWeight: "800" }}>{member.armorClass}</Text>
            </View>
          </View>

          <View style={{ marginTop: 12, gap: 6 }}>
            <Text style={{ color: c.mutedForeground, fontSize: 11, fontWeight: "700" }}>HIT POINTS</Text>
            <Text style={{ color: c.foreground, fontSize: 16, fontWeight: "800" }}>
              {member.currentHp}/{member.maxHp}
              {member.tempHp > 0 ? ` (+${member.tempHp} temp)` : ""}
            </Text>
          </View>

          <View style={{ marginTop: 16, gap: 8 }}>
            <Text style={{ color: c.mutedForeground, fontSize: 11, fontWeight: "700" }}>CORE STATS</Text>
            <View style={styles.statGrid}>
              <View style={[styles.statChip, { borderColor: c.border }]}><Text style={{ color: c.foreground, fontSize: 12 }}>SPD {core?.speed ?? "--"}</Text></View>
              <View style={[styles.statChip, { borderColor: c.border }]}><Text style={{ color: c.foreground, fontSize: 12 }}>INIT {statValue(core?.initiativeBonus)}</Text></View>
              <View style={[styles.statChip, { borderColor: c.border }]}><Text style={{ color: c.foreground, fontSize: 12 }}>STR {statValue(core?.strength)}</Text></View>
              <View style={[styles.statChip, { borderColor: c.border }]}><Text style={{ color: c.foreground, fontSize: 12 }}>DEX {statValue(core?.dexterity)}</Text></View>
              <View style={[styles.statChip, { borderColor: c.border }]}><Text style={{ color: c.foreground, fontSize: 12 }}>CON {statValue(core?.constitution)}</Text></View>
              <View style={[styles.statChip, { borderColor: c.border }]}><Text style={{ color: c.foreground, fontSize: 12 }}>INT {statValue(core?.intelligence)}</Text></View>
              <View style={[styles.statChip, { borderColor: c.border }]}><Text style={{ color: c.foreground, fontSize: 12 }}>WIS {statValue(core?.wisdom)}</Text></View>
              <View style={[styles.statChip, { borderColor: c.border }]}><Text style={{ color: c.foreground, fontSize: 12 }}>CHA {statValue(core?.charisma)}</Text></View>
            </View>
          </View>

          {member.conditions.length > 0 && (
            <View style={{ marginTop: 16, gap: 8 }}>
              <Text style={{ color: c.mutedForeground, fontSize: 11, fontWeight: "700" }}>CONDITIONS</Text>
              <View style={styles.statGrid}>
                {member.conditions.map((condition) => (
                  <View key={condition.id} style={[styles.statChip, { borderColor: "#f9731655", backgroundColor: "#f9731614" }]}>
                    <Text style={{ color: "#f97316", fontSize: 12, fontWeight: "700" }}>{condition.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={{ marginTop: 16, gap: 8 }}>
            <Text style={{ color: c.mutedForeground, fontSize: 11, fontWeight: "700" }}>DEFENSES</Text>
            <Text style={{ color: c.foreground, fontSize: 13 }}>
              Resistances: {(member.damageResistances ?? []).length > 0 ? member.damageResistances!.join(", ") : "None"}
            </Text>
            <Text style={{ color: c.foreground, fontSize: 13 }}>
              Damage Immunities: {(member.damageImmunities ?? []).length > 0 ? member.damageImmunities!.join(", ") : "None"}
            </Text>
            <Text style={{ color: c.foreground, fontSize: 13 }}>
              Condition Immunities: {(member.conditionImmunities ?? []).length > 0 ? member.conditionImmunities!.join(", ") : "None"}
            </Text>
          </View>

          <Text style={{ marginTop: 16, color: c.mutedForeground, fontSize: 11 }}>
            Last updated: {formatLastUpdated(member.updatedAt)}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 14,
  },
  backButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    gap: 10,
    alignItems: "center",
  },
  sheetCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  acBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 62,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
