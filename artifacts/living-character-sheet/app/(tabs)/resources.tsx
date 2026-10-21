import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import { useParty } from "@/context/PartyContext";
import { triggerEffect } from "@/utils/triggerEffect";
import { useEquippedEffects, getResourceExtraMax } from "@/hooks/useEquippedEffects";
import { ResourceRow } from "@/components/resources/ResourceRow";
import { ScrollHintScrollView } from "@/components/ScrollHintScrollView";
import { SPELL_LEVEL_LABELS } from "@/data/spellSlots";
import { SpellsSection } from "@/components/sheet/SpellsSection";
import { createShadowStyle } from "../../utils/shadow";
import { RuleEffectsInspector } from "@/components/rules/RuleEffectsInspector";
import { createPartyRestRequest } from "@/utils/partyApi";

const RESET_LABELS: Record<string, string> = {
  short_rest: "Short Rest",
  long_rest: "Long Rest",
  dawn: "Dawn",
};

const SPELLCASTER_CLASSES = [
  "wizard", "sorcerer", "bard", "warlock", "cleric", "druid",
  "paladin", "ranger", "artificer", "blood hunter",
];

function isScroll(name: string) {
  return /scroll/i.test(name);
}
function isPotion(name: string) {
  return /potion/i.test(name);
}

type ConfirmType = "short_rest" | "long_rest" | null;

export default function ResourcesScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [confirmRest, setConfirmRest] = useState<ConfirmType>(null);
  const [sendingRestRequest, setSendingRestRequest] = useState<ConfirmType>(null);
  const { isInParty, partyCode, memberId } = useParty();

  const {
    resources,
    incrementResource,
    decrementResource,
    resetResource,
    spellEffectUses,
    useSpellEffect,
    rechargeSpellEffects,
    rechargeItemEffects,
    character,
    inventory,
    updateItem,
    spellSlots,
    expendSpellSlot,
    restoreSpellSlot,
    restoreAllSpellSlots,
    clearConditionsOnRest,
    updateHp,
    dispatchRuleTrigger,
    rulesState,
  } = useCharacter();

  const consumables = inventory
    .filter((i) => i.category === "consumable" && i.quantity > 0)
    .sort((a, b) => {
      const rank = (n: string) => (isPotion(n) ? 0 : isScroll(n) ? 1 : 2);
      return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);
    });

  const charClass = (character.class ?? "").toLowerCase();
  const isSpellcaster = SPELLCASTER_CLASSES.some((cls) => charClass.includes(cls));

  const { resourceMaxBonuses, spellEffects } = useEquippedEffects();

  function executeShortRest() {
    resources
      .filter((r) => r.resetOn === "short_rest")
      .forEach((r) => resetResource(r.id, r.max + getResourceExtraMax(r, resourceMaxBonuses)));
    rechargeSpellEffects("short_rest");
    rechargeItemEffects("short_rest");
    clearConditionsOnRest("short_rest");
    dispatchRuleTrigger("short_rest");
    setConfirmRest(null);
  }

  function executeLongRest() {
    resources.forEach((r) => resetResource(r.id, r.max + getResourceExtraMax(r, resourceMaxBonuses)));
    rechargeSpellEffects("long_rest");
    rechargeItemEffects("long_rest");
    restoreAllSpellSlots();
    clearConditionsOnRest("long_rest");
    updateHp(character.maxHp - character.currentHp);
    dispatchRuleTrigger("long_rest");
    triggerEffect("long_rest");
    setConfirmRest(null);
  }

  async function requestPartyRest(restType: "short_rest" | "long_rest") {
    if (!partyCode || !memberId) return;
    setSendingRestRequest(restType);
    try {
      await createPartyRestRequest(partyCode, { memberId, restType });
      setConfirmRest(null);
    } finally {
      setSendingRestRequest(null);
    }
  }

  const activeSpellSlots = spellSlots.filter((s) => s.total > 0);

  return (
    <>
      <ScrollHintScrollView
        style={[styles.container, { backgroundColor: c.background }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + 72,
            paddingTop: 12,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Rest buttons */}
        <View style={styles.restRow}>
          <TouchableOpacity
            onPress={() => setConfirmRest("short_rest")}
            activeOpacity={0.8}
            style={[
              styles.restBtn,
              { backgroundColor: "#0EA5E920", borderColor: "#0EA5E9", borderRadius: c.radius },
            ]}
          >
            <Feather name="moon" size={16} color="#0EA5E9" />
            <Text style={[styles.restBtnText, { color: "#0EA5E9" }]}>Short Rest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setConfirmRest("long_rest")}
            activeOpacity={0.8}
            style={[
              styles.restBtn,
              { backgroundColor: "#8B5CF620", borderColor: "#8B5CF6", borderRadius: c.radius },
            ]}
          >
            <Feather name="star" size={16} color="#8B5CF6" />
            <Text style={[styles.restBtnText, { color: "#8B5CF6" }]}>Long Rest</Text>
          </TouchableOpacity>
        </View>

        {/* Rule Effects Inspector */}
        <RuleEffectsInspector rulesState={rulesState} expanded={false} />

        {/* Regular resources */}
        {resources.map((resource) => {
          const extraMax = getResourceExtraMax(resource, resourceMaxBonuses);
          return (
            <ResourceRow
              key={resource.id}
              resource={resource}
              extraMax={extraMax}
              onIncrement={() => incrementResource(resource.id, resource.max + extraMax)}
              onDecrement={() => decrementResource(resource.id)}
              onReset={() => resetResource(resource.id, resource.max + extraMax)}
            />
          );
        })}

        {resources.length === 0 && spellEffects.length === 0 && activeSpellSlots.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: c.foreground }]}>No resources</Text>
            <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
              Add resources to track Focus, spell slots, and more
            </Text>
          </View>
        )}

        {/* Spell Slots */}
        {activeSpellSlots.length > 0 && (
          <View style={{ marginTop: resources.length > 0 ? 16 : 0 }}>
            <View style={[styles.sectionHeader, { borderBottomColor: c.border }]}>
              <Feather name="book-open" size={13} color="#A78BFA" />
              <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>
                Spell Slots
              </Text>
              <Text style={[styles.sectionHint, { color: c.mutedForeground }]}>
                Tap to use · Long-press to restore
              </Text>
            </View>

            {activeSpellSlots.map((slot) => {
              const available = slot.total - slot.used;
              return (
                <View
                  key={slot.level}
                  style={[styles.slotRow, { borderBottomColor: c.border }]}
                >
                  <View style={styles.slotLabelBlock}>
                    <Text style={[styles.slotLevelLabel, { color: c.foreground }]}>
                      {SPELL_LEVEL_LABELS[slot.level] ?? `${slot.level}th`}
                    </Text>
                    <Text style={[styles.slotCountLabel, { color: c.mutedForeground }]}>
                      {available}/{slot.total}
                    </Text>
                  </View>
                  <View style={styles.slotPips}>
                    {Array.from({ length: slot.total }).map((_, i) => {
                      const isUsed = i >= available;
                      return (
                        <TouchableOpacity
                          key={i}
                          onPress={() => {
                            if (!isUsed) {
                              expendSpellSlot(slot.level);
                            }
                          }}
                          onLongPress={() => {
                            if (isUsed) {
                              restoreSpellSlot(slot.level);
                            }
                          }}
                          activeOpacity={0.7}
                          delayLongPress={400}
                          style={[
                            styles.slotPip,
                            {
                              backgroundColor: isUsed ? c.muted : "#A78BFA30",
                              borderColor: isUsed ? c.border : "#A78BFA",
                            },
                          ]}
                        >
                          {!isUsed && (
                            <View style={[styles.slotPipInner, { backgroundColor: "#A78BFA" }]} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Prepared Spells ───────────────────────────────────────────── */}
        <SpellsSection />

        {/* ── Consumables (potions / scrolls) ─────────────────────────────── */}
        {consumables.length > 0 && (
          <View style={{ marginTop: resources.length > 0 || activeSpellSlots.length > 0 ? 16 : 0 }}>
            <View style={[styles.sectionHeader, { borderBottomColor: c.border }]}>
              <Feather name="droplet" size={13} color="#14B8A6" />
              <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>
                Consumables
              </Text>
            </View>

            <View style={styles.consumablesGrid}>
              {consumables.map((item) => {
                const scroll = isScroll(item.name);
                const needsCheck = scroll && !isSpellcaster;
                const accentColor = isPotion(item.name) ? "#10B981" : scroll ? "#8B5CF6" : "#14B8A6";

                return (
                  <View key={item.id} style={styles.consumableGridItem}>
                    <View
                      style={[
                        styles.consumableCard,
                        {
                          backgroundColor: c.card,
                          borderColor: c.border,
                          borderLeftColor: accentColor,
                          borderRadius: c.radius * 1.5,
                        },
                      ]}
                    >
                      <View style={styles.consumableTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.consumableName, { color: c.foreground }]}> 
                            {item.name}
                          </Text>
                          {item.notes ? (
                            <Text style={[styles.consumableNotes, { color: c.mutedForeground }]} numberOfLines={2}>
                              {item.notes}
                            </Text>
                          ) : null}
                          {needsCheck ? (
                            <View style={styles.scrollHint}>
                              <Feather name="alert-circle" size={11} color="#F59E0B" />
                              <Text style={[styles.scrollHintText, { color: "#F59E0B" }]}> 
                                Requires Arcana check (DC 10 + spell level) for non-spellcasters
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <View style={styles.consumableRight}>
                          <View style={[styles.qtyBadge, { backgroundColor: accentColor + "22" }]}> 
                            <Text style={[styles.qtyText, { color: accentColor }]}>×{item.quantity}</Text>
                          </View>

                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => updateItem(item.id, { quantity: item.quantity - 1 })}
                            style={[
                              styles.useBtn,
                              { backgroundColor: accentColor + "20", borderRadius: c.radius },
                            ]}
                          >
                            <Feather name="play" size={12} color={accentColor} />
                            <Text style={[styles.useBtnText, { color: accentColor }]}>Use 1</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Spell effects from equipped items */}
        {spellEffects.length > 0 && (
          <View style={{ marginTop: resources.length > 0 ? 16 : 0 }}>
            <View style={[styles.sectionHeader, { borderBottomColor: c.border }]}>
              <Feather name="zap" size={13} color="#8B5CF6" />
              <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>
                Spells from Equipment
              </Text>
            </View>
            {spellEffects.map((spell) => {
              const remaining = spellEffectUses[spell.effectId] ?? spell.uses;
              const isEmpty = remaining <= 0;
              return (
                <View
                  key={spell.effectId}
                  style={[
                    styles.spellCard,
                    {
                      backgroundColor: c.card,
                      borderColor: isEmpty ? c.border : "#8B5CF640",
                      borderRadius: c.radius * 1.5,
                      borderLeftColor: isEmpty ? c.border : "#8B5CF6",
                      opacity: isEmpty ? 0.6 : 1,
                    },
                  ]}
                >
                  <View style={styles.spellTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.spellName, { color: c.foreground }]}>
                        {spell.label}
                      </Text>
                      <Text style={[styles.spellItem, { color: "#8B5CF6" }]}>
                        {spell.itemName}
                      </Text>
                      {spell.description ? (
                        <Text style={[styles.spellDesc, { color: c.mutedForeground }]}>
                          {spell.description}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.spellUsesBlock}>
                      <Text style={[styles.spellUsesCurrent, { color: isEmpty ? c.mutedForeground : "#8B5CF6" }]}>
                        {remaining}
                      </Text>
                      <Text style={[styles.spellUsesMax, { color: c.mutedForeground }]}>
                        /{spell.uses}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.spellFooter}>
                    <Text style={[styles.spellReset, { color: c.mutedForeground }]}>
                      Resets: {RESET_LABELS[spell.resetOn] ?? spell.resetOn}
                    </Text>
                    <TouchableOpacity
                      onPress={() => useSpellEffect(spell.effectId)}
                      disabled={isEmpty}
                      activeOpacity={0.7}
                      style={[
                        styles.useBtn,
                        {
                          backgroundColor: isEmpty ? c.muted : "#8B5CF620",
                          borderRadius: c.radius,
                        },
                      ]}
                    >
                      <Feather name="zap" size={12} color={isEmpty ? c.mutedForeground : "#8B5CF6"} />
                      <Text style={[styles.useBtnText, { color: isEmpty ? c.mutedForeground : "#8B5CF6" }]}>
                        Cast
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollHintScrollView>

      {/* Rest Confirmation Modal */}
      <Modal
        visible={confirmRest !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmRest(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmSheet, { backgroundColor: c.card, borderColor: c.border }]}>
            {confirmRest === "short_rest" ? (
              <>
                <View style={styles.confirmIcon}>
                  <Feather name="moon" size={28} color="#0EA5E9" />
                </View>
                <Text style={[styles.confirmTitle, { color: c.foreground }]}>Short Rest</Text>
                <Text style={[styles.confirmBody, { color: c.mutedForeground }]}>
                  {isInParty
                    ? "Send a Short Rest request to the DM for the whole party?"
                    : "Reset all short-rest resources and clear applicable conditions?"}
                </Text>
                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    onPress={() => setConfirmRest(null)}
                    style={[styles.confirmCancelBtn, { backgroundColor: c.secondary, borderRadius: c.radius }]}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.confirmCancelText, { color: c.foreground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (isInParty) {
                        void requestPartyRest("short_rest");
                        return;
                      }
                      executeShortRest();
                    }}
                    style={[styles.confirmOkBtn, { backgroundColor: "#0EA5E9", borderRadius: c.radius }]}
                    activeOpacity={0.8}
                    accessibilityLabel="Take Short Rest"
                  >
                    <Feather name="moon" size={14} color="#fff" />
                    <Text style={styles.confirmOkText}>
                      {sendingRestRequest === "short_rest" ? "Sending..." : isInParty ? "Request Short Rest" : "Take Short Rest"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.confirmIcon}>
                  <Feather name="star" size={28} color="#8B5CF6" />
                </View>
                <Text style={[styles.confirmTitle, { color: c.foreground }]}>Long Rest</Text>
                <Text style={[styles.confirmBody, { color: c.mutedForeground }]}>
                  {isInParty
                    ? "Send a Long Rest request to the DM for the whole party?"
                    : "Reset ALL resources, restore full HP, recharge spell slots, and clear applicable conditions?"}
                </Text>
                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    onPress={() => setConfirmRest(null)}
                    style={[styles.confirmCancelBtn, { backgroundColor: c.secondary, borderRadius: c.radius }]}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.confirmCancelText, { color: c.foreground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (isInParty) {
                        void requestPartyRest("long_rest");
                        return;
                      }
                      executeLongRest();
                    }}
                    style={[styles.confirmOkBtn, { backgroundColor: "#8B5CF6", borderRadius: c.radius }]}
                    activeOpacity={0.8}
                    accessibilityLabel="Take Long Rest"
                  >
                    <Feather name="star" size={14} color="#fff" />
                    <Text style={styles.confirmOkText}>
                      {sendingRestRequest === "long_rest" ? "Sending..." : isInParty ? "Request Long Rest" : "Take Long Rest"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  restRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  restBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
  },
  restBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  empty: { alignItems: "center", marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: "center" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    flex: 1,
  },
  sectionHint: {
    fontSize: 10,
    fontStyle: "italic",
  },

  // Spell slots
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  slotLabelBlock: {
    width: 56,
  },
  slotLevelLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  slotCountLabel: {
    fontSize: 11,
    marginTop: 1,
  },
  slotPips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
  },
  slotPip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  slotPipInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  spellCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 10,
    ...createShadowStyle({ y: 1, blur: 2, opacity: 0.1, elevation: 1 }),
  },
  spellTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  spellName: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  spellItem: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
  spellDesc: { fontSize: 12, lineHeight: 17 },
  spellUsesBlock: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  spellUsesCurrent: { fontSize: 26, fontWeight: "700" },
  spellUsesMax: { fontSize: 14, fontWeight: "500", marginLeft: 2 },
  spellFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  spellReset: { fontSize: 11 },
  useBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  useBtnText: { fontSize: 13, fontWeight: "600" },

  // Consumables
  consumablesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },
  consumableGridItem: {
    width: "50%",
    paddingHorizontal: 5,
  },
  consumableCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 10,
    height: "100%",
  },
  consumableTop: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
  },
  consumableName: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  consumableNotes: { fontSize: 12, lineHeight: 16 },
  scrollHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  scrollHintText: { fontSize: 11, flex: 1, lineHeight: 15 },
  consumableRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  qtyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  qtyText: { fontSize: 13, fontWeight: "700" },

  // Rest confirmation modal
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmSheet: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  confirmIcon: {
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  confirmBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  confirmOkBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  confirmOkText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
