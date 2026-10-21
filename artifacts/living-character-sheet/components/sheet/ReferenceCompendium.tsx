import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useColors } from "@/hooks/useColors";
import {
  CURRENCY_TABLE,
  LIFESTYLE_EXPENSES,
  WEAPON_PRICES,
  ARMOR_PRICES,
  ADVENTURING_GEAR,
  POTION_PRICES,
  MAGIC_ITEM_PRICE_GUIDE,
  CONDITIONS,
  XP_THRESHOLDS,
  CR_XP_TABLE,
  MONSTER_MULTIPLIERS,
  REST_REFERENCE,
  GEMSTONE_VALUES,
  SERVICES_COSTS,
  LORE_ENTRIES,
} from "@/data/dnd5eReference";

const RESOURCE_SECTIONS = [
  { id: "currency", label: "Currency" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "weapons", label: "Weapons" },
  { id: "armor", label: "Armor" },
  { id: "gear", label: "Gear" },
  { id: "potions", label: "Potions" },
  { id: "conditions", label: "Conditions" },
  { id: "xp", label: "XP / CR" },
  { id: "rest", label: "Rest" },
  { id: "gems", label: "Gems" },
  { id: "services", label: "Services" },
  { id: "lore", label: "Lore" },
] as const;

export function ReferenceCompendium() {
  const c = useColors();
  const [resourceSection, setResourceSection] = useState<string>("currency");

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resourceTabRow}>
        {RESOURCE_SECTIONS.map((section) => (
          <TouchableOpacity
            key={section.id}
            onPress={() => setResourceSection(section.id)}
            style={[
              styles.resourceTab,
              {
                backgroundColor: resourceSection === section.id ? c.primary : c.card,
                borderColor: resourceSection === section.id ? c.primary : c.border,
              },
            ]}
          >
            <Text style={[styles.resourceTabText, { color: resourceSection === section.id ? "#fff" : c.mutedForeground }]}>
              {section.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {resourceSection === "currency" && (
        <View style={styles.refSection}>
          <RefTitle title="Currency Conversions" />
          <DataTable headers={["Coin", "Symbol", "In Gold", "In Silver"]} rows={CURRENCY_TABLE.map((row) => [row.coin, row.abbr, row.inGold, row.inSilver])} />
          <InfoBox>50 coins = 1 lb — all coin types weigh the same.</InfoBox>
          <RefTitle title="Magic Item Price Guide" />
          <DataTable headers={["Rarity", "Typical Cost", "Attunement"]} rows={MAGIC_ITEM_PRICE_GUIDE.map((row) => [row.rarity, row.avgCost, row.attunement])} />
        </View>
      )}

      {resourceSection === "lifestyle" && (
        <View style={styles.refSection}>
          <RefTitle title="Lifestyle Expenses (per day)" />
          <DataTable headers={["Lifestyle", "Cost", "Notes"]} rows={LIFESTYLE_EXPENSES.map((row) => [row.lifestyle, row.cost, row.notes])} />
          <RefTitle title="Common Services" />
          <DataTable headers={["Service", "Cost"]} rows={SERVICES_COSTS.map((row) => [row.service, row.cost])} />
        </View>
      )}

      {resourceSection === "weapons" && (
        <View style={styles.refSection}>
          <RefTitle title="Weapon Prices" />
          <DataTable headers={["Weapon", "Cost", "Damage", "Properties"]} rows={WEAPON_PRICES.map((row) => [row.item, row.cost, row.damage, row.properties])} />
        </View>
      )}

      {resourceSection === "armor" && (
        <View style={styles.refSection}>
          <RefTitle title="Armor & Shields" />
          <DataTable headers={["Armor", "Cost", "AC", "Stealth", "Weight"]} rows={ARMOR_PRICES.map((row) => [row.item, row.cost, row.ac, row.stealth, row.weight])} />
        </View>
      )}

      {resourceSection === "gear" && (
        <View style={styles.refSection}>
          <RefTitle title="Adventuring Gear" />
          <DataTable headers={["Item", "Cost", "Notes"]} rows={ADVENTURING_GEAR.map((row) => [row.item, row.cost, row.notes])} />
        </View>
      )}

      {resourceSection === "potions" && (
        <View style={styles.refSection}>
          <RefTitle title="Common Potions" />
          <DataTable headers={["Item", "Rarity", "Effect", "Cost"]} rows={POTION_PRICES.map((row) => [row.item, row.rarity, row.heal, row.cost])} />
          <RefTitle title="Gemstone Values" />
          <DataTable headers={["Value", "Examples"]} rows={GEMSTONE_VALUES.map((row) => [row.value, row.examples])} />
        </View>
      )}

      {resourceSection === "conditions" && (
        <View style={styles.refSection}>
          <RefTitle title="Conditions Reference" />
          {CONDITIONS.map((condition) => (
            <View key={condition.name} style={[styles.condCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.condName, { color: c.foreground }]}>{condition.name}</Text>
              {condition.effects.map((effect, index) => (
                <View key={index} style={styles.condRow}>
                  <Text style={[styles.condBullet, { color: c.primary }]}>•</Text>
                  <Text style={[styles.condEffect, { color: c.mutedForeground }]}>{effect}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {resourceSection === "xp" && (
        <View style={styles.refSection}>
          <RefTitle title="XP Thresholds by Level" />
          <DataTable headers={["Lvl", "Easy", "Med", "Hard", "Deadly"]} rows={XP_THRESHOLDS.map((row) => [String(row.level), String(row.easy), String(row.medium), String(row.hard), String(row.deadly)])} />
          <RefTitle title="Monster Count Multipliers" />
          <DataTable headers={["# Monsters", "XP ×"]} rows={MONSTER_MULTIPLIERS.map((row) => [row.monsters, row.multiplier])} />
          <RefTitle title="CR → XP Table" />
          <DataTable headers={["CR", "XP", "Prof Bonus"]} rows={CR_XP_TABLE.map((row) => [row.cr, row.xp.toLocaleString(), row.profBonus])} />
        </View>
      )}

      {resourceSection === "rest" && (
        <View style={styles.refSection}>
          <RefTitle title="Rest & Recovery" />
          {REST_REFERENCE.map((entry) => (
            <View key={entry.type} style={[styles.condCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.condName, { color: c.foreground }]}>{entry.type}</Text>
              <Text style={[styles.condEffect, { color: c.mutedForeground, marginBottom: 4 }]}>Duration: {entry.duration}</Text>
              {entry.benefits.map((benefit, index) => (
                <View key={index} style={styles.condRow}>
                  <Text style={[styles.condBullet, { color: c.primary }]}>•</Text>
                  <Text style={[styles.condEffect, { color: c.mutedForeground }]}>{benefit}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {resourceSection === "gems" && (
        <View style={styles.refSection}>
          <RefTitle title="Gemstone Values" />
          <DataTable headers={["Value", "Examples"]} rows={GEMSTONE_VALUES.map((row) => [row.value, row.examples])} />
        </View>
      )}

      {resourceSection === "services" && (
        <View style={styles.refSection}>
          <RefTitle title="Services & Spellcasting Costs" />
          <DataTable headers={["Service", "Cost"]} rows={SERVICES_COSTS.map((row) => [row.service, row.cost])} />
        </View>
      )}

      {resourceSection === "lore" && (
        <View style={styles.refSection}>
          {LORE_ENTRIES.map((group) => (
            <View key={group.category}>
              <RefTitle title={group.category} />
              {group.entries.map((entry, index) => (
                <View key={index} style={[styles.loreRow, { borderBottomColor: c.border }]}>
                  <Text style={[styles.loreText, { color: c.foreground }]}>{entry}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

    </View>
  );
}

function RefTitle({ title }: { title: string }) {
  const c = useColors();
  return <Text style={[styles.refTitle, { color: c.foreground }]}>{title}</Text>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const c = useColors();
  return (
    <View style={[styles.table, { borderColor: c.border }]}>
      <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: c.primary + "15" }]}> 
        {headers.map((header) => (
          <Text key={header} style={[styles.tableHeaderCell, { color: c.primary, flex: 1 }]}>{header}</Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={[
            styles.tableRow,
            {
              borderTopColor: c.border,
              backgroundColor: rowIndex % 2 === 0 ? "transparent" : c.card + "80",
            },
          ]}
        >
          {row.map((cell, cellIndex) => (
            <Text key={cellIndex} style={[styles.tableCell, { color: cellIndex === 0 ? c.foreground : c.mutedForeground, flex: 1 }]}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.infoBox, { backgroundColor: c.primary + "10", borderColor: c.primary + "30" }]}> 
      <Text style={[styles.infoBoxText, { color: c.mutedForeground }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  resourceTabRow: { gap: 6, paddingBottom: 4, paddingHorizontal: 2 },
  resourceTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  resourceTabText: { fontSize: 12, fontWeight: "600" },
  refSection: { gap: 12, marginTop: 8 },
  refTitle: { fontSize: 14, fontWeight: "700", marginBottom: -4 },
  table: { borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  tableRow: { flexDirection: "row", padding: 8, borderTopWidth: 1 },
  tableHeader: { borderTopWidth: 0 },
  tableHeaderCell: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  tableCell: { fontSize: 11, lineHeight: 17 },
  infoBox: { borderWidth: 1, borderRadius: 8, padding: 10 },
  infoBoxText: { fontSize: 12 },
  condCard: { borderWidth: 1, borderRadius: 10 * 1.2, padding: 12, gap: 4 },
  condName: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  condRow: { flexDirection: "row", gap: 6 },
  condBullet: { fontSize: 13, fontWeight: "700", marginTop: 1 },
  condEffect: { flex: 1, fontSize: 12, lineHeight: 18 },
  loreRow: { paddingVertical: 6, borderBottomWidth: 1 },
  loreText: { fontSize: 12, lineHeight: 19 },
  tipRow: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10 * 1.2,
    alignItems: "flex-start",
  },
  tipNum: { fontSize: 15, fontWeight: "800", width: 22, textAlign: "right", flexShrink: 0 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 20 },
});
