import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { useSync } from "@/context/SyncContext";
import { useColors } from "@/hooks/useColors";
import type { PendingAICall } from "@/utils/aiQueue";
import { MAX_RETRIES } from "@/utils/aiQueue";

const TYPE_LABELS: Record<PendingAICall["type"], string> = {
  "parse-update": "Quick Update",
  "analyze-loot": "Loot Analysis",
  "parse-quest-update": "Quest Update",
};

function SyncModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const c = useColors();
  const { failedItems, pendingCount, dismissFailed, dismissAllFailed, retryAll, isOnline } = useSync();
  const onlineTone = c.primary;
  const offlineTone = c.mutedForeground;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={[st.modalWrap, { backgroundColor: c.background }]}>
        {/* Header */}
        <View style={[st.modalHeader, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <Text style={[st.modalTitle, { color: c.foreground }]}>Sync Status</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Feather name="x" size={20} color={c.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {/* Online / offline indicator */}
          <View
            style={[
              st.statusRow,
              {
                backgroundColor: isOnline ? onlineTone + "20" : offlineTone + "20",
                borderColor: isOnline ? onlineTone : offlineTone,
                borderRadius: c.radius,
              },
            ]}
          >
            <Feather
              name={isOnline ? "wifi" : "wifi-off"}
              size={14}
              color={isOnline ? onlineTone : offlineTone}
            />
            <Text style={[st.statusText, { color: isOnline ? onlineTone : offlineTone }]}>
              {isOnline ? "Online — AI features available" : "Offline — AI calls will queue automatically"}
            </Text>
          </View>

          {pendingCount > 0 && (
            <Text style={[st.sectionLabel, { color: c.mutedForeground }]}>
              {pendingCount} PENDING CALL{pendingCount !== 1 ? "S" : ""}
            </Text>
          )}

          {failedItems.length === 0 && pendingCount === 0 && (
            <View style={[st.emptyRow, { backgroundColor: c.card, borderRadius: c.radius }]}>
              <Feather name="check-circle" size={16} color={c.primary} />
              <Text style={[st.emptyText, { color: c.mutedForeground }]}>
                All synced — nothing pending
              </Text>
            </View>
          )}

          {failedItems.length > 0 && (
            <>
              <Text style={[st.sectionLabel, { color: c.mutedForeground }]}>
                {failedItems.length} FAILED (EXCEEDED {MAX_RETRIES} RETRIES)
              </Text>
              {failedItems.map((item) => (
                <View
                  key={item.id}
                  style={[st.failedRow, { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius }]}
                >
                  <View style={st.failedLeft}>
                    <Text style={[st.failedType, { color: c.foreground }]}>
                      {TYPE_LABELS[item.type] ?? item.type}
                    </Text>
                    <Text style={[st.failedLabel, { color: c.mutedForeground }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={[st.failedTime, { color: c.mutedForeground }]}>
                      {new Date(item.enqueuedAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => dismissFailed(item.id)}
                    activeOpacity={0.7}
                    style={[st.dismissBtn, { borderColor: c.border, borderRadius: c.radiusSm }]}
                  >
                    <Feather name="x" size={14} color={c.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                onPress={dismissAllFailed}
                activeOpacity={0.7}
                style={[st.clearBtn, { borderColor: c.border, borderRadius: c.radius }]}
              >
                <Text style={[st.clearBtnText, { color: c.mutedForeground }]}>
                  Clear All Failed
                </Text>
              </TouchableOpacity>
            </>
          )}

          {pendingCount > 0 && isOnline && (
            <TouchableOpacity
              onPress={retryAll}
              activeOpacity={0.8}
              style={[st.retryBtn, { backgroundColor: c.primary, borderRadius: c.radius }]}
            >
              <Feather name="refresh-cw" size={14} color={c.primaryForeground} />
              <Text style={[st.retryBtnText, { color: c.primaryForeground }]}>
                Retry Now
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Small pill badge shown for pending / failed AI sync state. Hidden when clean. */
export function SyncStatusBadge() {
  const { pendingCount, failedCount, isOnline } = useSync();
  const c = useColors();
  const [modalVisible, setModalVisible] = useState(false);

  const hasIssue = pendingCount > 0 || failedCount > 0 || !isOnline;

  if (!hasIssue) return null;

  const hasFailed  = failedCount > 0;
  const color      = hasFailed ? c.destructive : c.primary;
  const label      = !isOnline
    ? "Offline"
    : hasFailed
    ? `${failedCount} failed`
    : `${pendingCount} pending`;
  const icon       = !isOnline ? "wifi-off" : hasFailed ? "alert-circle" : "upload-cloud";

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
        style={[
          st.pill,
          {
            backgroundColor: color + "22",
            borderColor: color + "66",
            borderRadius: c.radiusPill,
          },
        ]}
      >
        <Feather name={icon as any} size={11} color={color} />
        <Text style={[st.pillText, { color }]}>{label}</Text>
      </TouchableOpacity>

      <SyncModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
}

const st = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  modalWrap: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 16, fontWeight: "700" },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderWidth: 1,
  },
  statusText: { fontSize: 13, flex: 1 },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
  },
  emptyText: { fontSize: 13 },
  failedRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
    borderWidth: 1,
  },
  failedLeft: { flex: 1 },
  failedType: { fontSize: 13, fontWeight: "700" },
  failedLabel: { fontSize: 12, marginTop: 2 },
  failedTime: { fontSize: 11, marginTop: 2 },
  dismissBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  clearBtn: {
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  clearBtnText: { fontSize: 13, fontWeight: "600" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
  },
  retryBtnText: { fontSize: 14, fontWeight: "700" },
});
