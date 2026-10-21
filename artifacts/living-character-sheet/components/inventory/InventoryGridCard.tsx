import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { InventoryItem } from "@/types";
import { CATEGORY_COLORS } from "./InventoryItemRow";
import { useAppSettings } from "@/context/AppSettingsContext";

const CATEGORY_ICONS: Record<string, string> = {
  weapon: "crosshair",
  armor: "shield",
  accessory: "tag",
  consumable: "droplet",
  quest: "flag",
  magic: "star",
  gear: "tool",
  treasure: "dollar-sign",
  map: "map",
  other: "box",
};

interface InventoryGridCardProps {
  item: InventoryItem;
  onPress: () => void;
  onLongPress?: () => void;
  expanded?: boolean;
}

export function InventoryGridCard({ item, onPress, onLongPress, expanded = false }: InventoryGridCardProps) {
  const c = useColors();
  const { settings } = useAppSettings();
  const accent = CATEGORY_COLORS[item.category] ?? "#64748B";
  const icon = CATEGORY_ICONS[item.category] ?? "box";
  const sourceTag = item.sourceTag ?? "custom";
  const sourceTagMode = settings.spellSourceTagStyle;
  const gridSourceTagMode = sourceTagMode === "full" ? "compact" : sourceTagMode;
  const sourceLeft = item.pinned ? 42 : 24;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.card,
        {
          backgroundColor: expanded ? accent + "12" : c.card,
          borderColor: item.pinned ? accent : expanded ? accent : item.equipped ? accent + "80" : c.border,
        },
      ]}
    >
      <View style={[styles.strip, { backgroundColor: accent }]} />

      <View style={[styles.qtyBadge, { backgroundColor: c.secondary, borderColor: c.border }]}> 
        <Text style={[styles.qtyText, { color: c.foreground }]}>{item.quantity}</Text>
      </View>

      {item.equipped && <View style={[styles.equippedDot, { backgroundColor: accent }]} />}
      {item.pinned && <Feather name="bookmark" size={13} color={accent} style={styles.pinnedIcon} />}
      {gridSourceTagMode !== "hidden" && (
        gridSourceTagMode === "dot" ? (
          <View style={[styles.sourceDot, { left: sourceLeft, backgroundColor: sourceTag === "official" ? "#3B82F6" : "#EF4444" }]} />
        ) : (
          <View style={[styles.sourceBadge, { left: sourceLeft, backgroundColor: sourceTag === "official" ? "#3B82F620" : "#EF444420" }]}>
            <Text style={[styles.sourceBadgeText, { color: sourceTag === "official" ? "#3B82F6" : "#EF4444" }]}>
              {gridSourceTagMode === "compact" ? (sourceTag === "official" ? "O" : "C") : (sourceTag === "official" ? "OFFICIAL" : "CUSTOM")}
            </Text>
          </View>
        )
      )}

      <View style={styles.body}>
        <View style={[styles.iconWrap, { backgroundColor: accent + "1A" }]}> 
          <Feather name={icon as any} size={18} color={accent} />
        </View>
        <Text style={[styles.name, { color: c.foreground }]} numberOfLines={2}>{item.name}</Text>
        {!expanded && item.subtype && (
          <Text style={[styles.subtype, { color: c.mutedForeground }]} numberOfLines={1}>{item.subtype}</Text>
        )}
        {!expanded && item.notes && (
          <Text style={[styles.desc, { color: c.mutedForeground }]} numberOfLines={2}>{item.notes}</Text>
        )}
        {!expanded ? (
          <View style={styles.infoRow}>
            {item.weight !== undefined && (
              <Text style={[styles.info, { color: c.mutedForeground }]}>{item.weight}lb</Text>
            )}
            {item.value !== undefined && (
              <Text style={[styles.info, { color: c.mutedForeground }]}>{item.value}gp</Text>
            )}
          </View>
        ) : null}
      </View>

      <View style={[
        styles.equipBtn,
        {
          borderColor: expanded ? accent + "70" : item.equipped ? accent + "60" : c.border,
          backgroundColor: expanded ? accent + "15" : item.equipped ? accent + "15" : "transparent",
        },
      ]}>
        <Text style={[styles.equipText, { color: expanded ? accent : item.equipped ? accent : c.mutedForeground }]}> 
          {expanded ? "Open" : item.equipped ? "Equipped" : "View"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
    minHeight: 140,
    position: "relative",
  },
  strip: { height: 4, width: "100%" },
  qtyBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    zIndex: 2,
  },
  qtyText: { fontSize: 11, fontWeight: "700" },
  equippedDot: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 2,
  },
  pinnedIcon: {
    position: "absolute",
    top: 8,
    left: 24,
    zIndex: 2,
  },
  sourceDot: {
    position: "absolute",
    top: 10,
    left: 24,
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 2,
  },
  sourceBadge: {
    position: "absolute",
    top: 8,
    left: 24,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 2,
  },
  sourceBadgeText: { fontSize: 8, fontWeight: "700", letterSpacing: 0.4 },
  body: { padding: 12, paddingTop: 10, gap: 6, flex: 1 },
  iconWrap: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 12, fontWeight: "700", lineHeight: 16 },
  subtype: { fontSize: 10, fontStyle: "italic" },
  desc: { fontSize: 10, lineHeight: 13 },
  infoRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  info: { fontSize: 9, fontWeight: "500" },
  equipBtn: {
    marginHorizontal: 10,
    marginBottom: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  equipText: { fontSize: 11, fontWeight: "600" },
});
