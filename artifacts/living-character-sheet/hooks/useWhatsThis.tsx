import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { API_BASE_URL } from "@/utils/apiUrl";

type WhatsThisRequest = {
  subject: string;
  details?: string;
  category?: string;
};

type WhatsThisResponse = {
  title: string;
  explanation: string;
};

export function useWhatsThis() {
  const c = useColors();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("What's this?");
  const [answer, setAnswer] = useState("");

  const openWhatsThis = async ({ subject, details, category }: WhatsThisRequest) => {
    setVisible(true);
    setLoading(true);
    setTitle(subject || "What's this?");
    setAnswer("");

    try {
      const resp = await fetch(`${API_BASE_URL}/api/ai/whats-this`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, details, category }),
      });
      const raw = await resp.json();
      const data = raw as Partial<WhatsThisResponse>;
      if (!resp.ok) {
        throw new Error(typeof data.explanation === "string" ? data.explanation : "Could not fetch explanation.");
      }
      setTitle(typeof data.title === "string" && data.title.trim() ? data.title : subject);
      setAnswer(typeof data.explanation === "string" ? data.explanation : "No explanation available.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to contact AI.";
      setAnswer(`I could not fetch a live explanation right now.\n\n${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const whatsThisModal = useMemo(
    () => (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.header, { borderBottomColor: c.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <View style={[styles.iconWrap, { backgroundColor: c.primary + "20" }]}>
                  <Feather name="help-circle" size={15} color={c.primary} />
                </View>
                <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>
                  {title}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={18} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.body}>
              {loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={c.primary} />
                  <Text style={[styles.loadingText, { color: c.mutedForeground }]}>Asking AI...</Text>
                </View>
              ) : (
                <Text style={[styles.answer, { color: c.foreground }]}>{answer}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    ),
    [answer, c.border, c.card, c.foreground, c.mutedForeground, c.primary, loading, title, visible]
  );

  return { openWhatsThis, whatsThisModal };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "center",
    padding: 18,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 14,
    maxHeight: "70%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  body: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingBottom: 18,
  },
  loadingWrap: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 12,
  },
  answer: {
    fontSize: 14,
    lineHeight: 21,
  },
});
