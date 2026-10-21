/**
 * Rule Effects Inspector
 * 
 * Displays applied rule effects and their provenance (which rule granted them).
 * Surfaces explainability for AC bonuses, stats, action grants, spell grants, and conditions.
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { RulesEngineState, AppliedRuleEffect, RuleProvenance } from "@/types";

interface RuleEffectGrouped {
  category: "stat" | "action" | "spell" | "condition" | "resource";
  label: string;
  effects: AppliedRuleEffect[];
  provenances: RuleProvenance[];
}

interface RuleEffectsInspectorProps {
  rulesState?: RulesEngineState;
  expanded?: boolean;
}

export function RuleEffectsInspector({ rulesState, expanded = false }: RuleEffectsInspectorProps) {
  const c = useColors();

  const grouped = useMemo((): RuleEffectGrouped[] => {
    if (!rulesState || rulesState.appliedEffects.length === 0) return [];

    const groups: Record<string, RuleEffectGrouped> = {};

    for (const effect of rulesState.appliedEffects) {
      let category: RuleEffectGrouped["category"];
      let label: string;

      if (effect.effectType === "modify_stat") {
        category = "stat";
        label = `${effect.statKey}: +${effect.statValue}`;
      } else if (effect.effectType === "add_action" || effect.effectType === "remove_action") {
        category = "action";
        label = effect.actionName || effect.label || "Action";
      } else if (effect.effectType === "grant_spell" || effect.effectType === "revoke_spell") {
        category = "spell";
        label = effect.spellName || effect.label || "Spell";
      } else if (effect.effectType === "add_condition" || effect.effectType === "remove_condition") {
        category = "condition";
        label = effect.conditionName || effect.label || "Condition";
      } else if (effect.effectType === "restore_resource" || effect.effectType === "consume_resource") {
        category = "resource";
        label = effect.resourceName || effect.label || "Resource";
      } else {
        continue;
      }

      const key = `${category}:${label}`;
      if (!groups[key]) {
        groups[key] = {
          category,
          label,
          effects: [],
          provenances: [],
        };
      }
      groups[key].effects.push(effect);
    }

    // Attach provenances
    for (const group of Object.values(groups)) {
      for (const effect of group.effects) {
        const prov = rulesState.activeProvenances.find((p) => p.ruleId === effect.ruleId);
        if (prov && !group.provenances.some((p) => p.ruleId === prov.ruleId)) {
          group.provenances.push(prov);
        }
      }
    }

    return Object.values(groups);
  }, [rulesState]);

  if (!rulesState || rulesState.appliedEffects.length === 0) {
    return null;
  }

  const categoryIcons: Record<RuleEffectGrouped["category"], React.ComponentProps<typeof Feather>["name"]> = {
    stat: "bar-chart-2",
    action: "zap",
     spell: "book",
    condition: "alert-circle",
    resource: "package",
  };

  const categoryColors: Record<RuleEffectGrouped["category"], string> = {
    stat: "#3B82F6",
    action: "#F59E0B",
    spell: "#A78BFA",
    condition: "#EF4444",
    resource: "#10B981",
  };

  return (
    <View style={[styles.container, { borderColor: c.border, backgroundColor: c.card }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="activity" size={16} color={c.foreground} />
          <Text style={[styles.title, { color: c.foreground }]}>Rule Effects</Text>
        </View>
        <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
          {rulesState.appliedEffects.length} effect{rulesState.appliedEffects.length !== 1 ? "s" : ""} active
        </Text>
      </View>

      <ScrollView style={styles.content} scrollEnabled={expanded} nestedScrollEnabled={expanded}>
        {grouped.length === 0 ? (
          <Text style={[styles.empty, { color: c.mutedForeground }]}>No rule effects applied</Text>
        ) : (
          grouped.map((group) => {
            const icon = categoryIcons[group.category];
            const color = categoryColors[group.category];

            return (
              <View key={`${group.category}:${group.label}`} style={[styles.effectGroup, { borderLeftColor: color }]}>
                <View style={styles.effectHeader}>
                  <Feather name={icon} size={14} color={color} />
                  <Text style={[styles.effectLabel, { color: c.foreground }]}>{group.label}</Text>
                  <View style={[styles.badge, { backgroundColor: color + "20" }]}>
                    <Text style={[styles.badgeText, { color }]}>{group.effects.length}</Text>
                  </View>
                </View>

                {group.provenances.map((prov) => (
                  <View key={prov.ruleId} style={styles.provenance}>
                    <Text style={[styles.provLabel, { color: c.mutedForeground }]}>{prov.ruleName}</Text>
                    <Text style={[styles.provDetail, { color: c.mutedForeground }]}>
                      Trigger: {prov.trigger} • Condition: {prov.condition}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 10,
    marginVertical: 8,
    marginHorizontal: 12,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
  },
  content: {
    maxHeight: 200,
    paddingVertical: 8,
  },
  empty: {
    paddingHorizontal: 12,
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 16,
  },
  effectGroup: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 10,
    marginVertical: 4,
    marginHorizontal: 8,
    borderRadius: 6,
  },
  effectHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  effectLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  provenance: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  provLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  provDetail: {
    fontSize: 11,
  },
});
