import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import type { CharacterStatistics } from "@/types";

const EMPTY_STATS: CharacterStatistics = {
  killCount: 0,
  totalGoldEarned: 0,
  lootItemsAdded: 0,
  nearDeaths: 0,
  totalHpHealed: 0,
  totalDamageTaken: 0,
};

function fmtGold(gp: number): string {
  if (gp >= 1000) return `${(gp / 1000).toFixed(1)}k gp`;
  return `${gp % 1 === 0 ? gp : gp.toFixed(2)} gp`;
}

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  accent: string;
  sub?: string;
  onPlus?: () => void;
  onMinus?: () => void;
}

function StatCard({ icon, label, value, accent, sub, onPlus, onMinus }: StatCardProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={[styles.iconBox, { backgroundColor: accent + "22" }]}>
        <Feather name={icon as any} size={20} color={accent} />
      </View>
      <View style={styles.cardMid}>
        <Text style={[styles.cardLabel, { color: c.mutedForeground }]}>{label}</Text>
        {sub ? <Text style={[styles.cardSub, { color: c.mutedForeground + "88" }]}>{sub}</Text> : null}
      </View>
      <View style={styles.cardRight}>
        <Text style={[styles.cardValue, { color: accent }]}>{value}</Text>
        {(onPlus || onMinus) && (
          <View style={styles.stepper}>
            {onMinus && (
              <TouchableOpacity onPress={onMinus} activeOpacity={0.7}
                style={[styles.stepBtn, { borderColor: c.border }]}>
                <Feather name="minus" size={12} color={c.mutedForeground} />
              </TouchableOpacity>
            )}
            {onPlus && (
              <TouchableOpacity onPress={onPlus} activeOpacity={0.7}
                style={[styles.stepBtn, { borderColor: c.border, backgroundColor: accent + "22" }]}>
                <Feather name="plus" size={12} color={accent} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

interface SectionHeaderProps { title: string; }
function SectionHeader({ title }: SectionHeaderProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>{title.toUpperCase()}</Text>
  );
}

export function StatsTab() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { character, quests, people, inventory, incrementKillCount, updateStatistics } = useCharacter();
  const stats = character.statistics ?? EMPTY_STATS;

  const questsCompleted = quests.filter(q => q.status === "completed").length;
  const questsFailed    = quests.filter(q => q.status === "failed").length;
  const questsActive    = quests.filter(q => q.status === "active").length;
  const peopleMet       = people.length;
  const aliveNpcs       = people.filter(p => !p.deceased).length;
  const deceasedNpcs    = people.filter(p => p.deceased).length;
  const totalItems      = inventory.reduce((n, i) => n + i.quantity, 0);
  const equippedItems   = inventory.filter(i => i.equipped).length;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

      <SectionHeader title="Combat & Survival" />

      <StatCard
        icon="crosshair"
        label="Enemies Defeated"
        value={stats.killCount}
        accent="#EF4444"
        sub="Tap + to record a kill"
        onPlus={incrementKillCount}
        onMinus={stats.killCount > 0 ? () => updateStatistics({ killCount: stats.killCount - 1 }) : undefined}
      />
      <StatCard
        icon="alert-triangle"
        label="Near Deaths"
        value={stats.nearDeaths}
        accent="#F97316"
        sub="HP dropped to 5 or below"
      />
      <StatCard
        icon="heart"
        label="Total Damage Taken"
        value={`${stats.totalDamageTaken} HP`}
        accent="#EF4444"
        sub="Accumulated across all hits"
      />
      <StatCard
        icon="plus-circle"
        label="Total HP Healed"
        value={`${stats.totalHpHealed} HP`}
        accent="#10B981"
        sub="From all heals applied"
      />

      <View style={styles.divider} />
      <SectionHeader title="Wealth & Loot" />

      <StatCard
        icon="dollar-sign"
        label="Total Gold Earned"
        value={fmtGold(stats.totalGoldEarned)}
        accent="#F59E0B"
        sub="Accumulated from all sources"
      />
      <StatCard
        icon="package"
        label="Loot Items Added"
        value={stats.lootItemsAdded}
        accent="#8B5CF6"
        sub="Items added to inventory"
      />

      <View style={styles.divider} />
      <SectionHeader title="Inventory" />

      <View style={styles.rowCards}>
        <View style={[styles.miniCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.miniValue, { color: c.foreground }]}>{totalItems}</Text>
          <Text style={[styles.miniLabel, { color: c.mutedForeground }]}>Total Items</Text>
        </View>
        <View style={[styles.miniCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.miniValue, { color: "#6366F1" }]}>{equippedItems}</Text>
          <Text style={[styles.miniLabel, { color: c.mutedForeground }]}>Equipped</Text>
        </View>
        <View style={[styles.miniCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.miniValue, { color: "#0EA5E9" }]}>{inventory.length}</Text>
          <Text style={[styles.miniLabel, { color: c.mutedForeground }]}>Unique Items</Text>
        </View>
      </View>

      <View style={styles.divider} />
      <SectionHeader title="Quests" />

      <View style={styles.rowCards}>
        <View style={[styles.miniCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.miniValue, { color: "#F59E0B" }]}>{questsActive}</Text>
          <Text style={[styles.miniLabel, { color: c.mutedForeground }]}>Active</Text>
        </View>
        <View style={[styles.miniCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.miniValue, { color: "#10B981" }]}>{questsCompleted}</Text>
          <Text style={[styles.miniLabel, { color: c.mutedForeground }]}>Completed</Text>
        </View>
        <View style={[styles.miniCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.miniValue, { color: "#EF4444" }]}>{questsFailed}</Text>
          <Text style={[styles.miniLabel, { color: c.mutedForeground }]}>Failed</Text>
        </View>
      </View>

      <View style={styles.divider} />
      <SectionHeader title="People" />

      <View style={styles.rowCards}>
        <View style={[styles.miniCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.miniValue, { color: c.foreground }]}>{peopleMet}</Text>
          <Text style={[styles.miniLabel, { color: c.mutedForeground }]}>Met</Text>
        </View>
        <View style={[styles.miniCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.miniValue, { color: "#10B981" }]}>{aliveNpcs}</Text>
          <Text style={[styles.miniLabel, { color: c.mutedForeground }]}>Alive</Text>
        </View>
        <View style={[styles.miniCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.miniValue, { color: "#6B7280" }]}>{deceasedNpcs}</Text>
          <Text style={[styles.miniLabel, { color: c.mutedForeground }]}>Deceased</Text>
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const makeStyles = (c: { radiusXl: number; radiusMd: number; radiusSm: number }) => StyleSheet.create({
  container: { padding: 16, gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 4, marginBottom: 4, paddingHorizontal: 2 },
  divider: { height: 8 },
  card: { flexDirection: "row", alignItems: "center", borderRadius: c.radiusXl, borderWidth: 1, padding: 14, gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: c.radiusMd, alignItems: "center", justifyContent: "center" },
  cardMid: { flex: 1 },
  cardLabel: { fontSize: 14, fontWeight: "600" },
  cardSub: { fontSize: 11, marginTop: 2 },
  cardRight: { alignItems: "flex-end", gap: 6 },
  cardValue: { fontSize: 22, fontWeight: "800" },
  stepper: { flexDirection: "row", gap: 6 },
  stepBtn: { width: 26, height: 26, borderRadius: c.radiusSm, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rowCards: { flexDirection: "row", gap: 8 },
  miniCard: { flex: 1, borderRadius: c.radiusXl, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  miniValue: { fontSize: 24, fontWeight: "800" },
  miniLabel: { fontSize: 11, fontWeight: "600", textAlign: "center" },
});
