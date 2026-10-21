import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAppSettings } from "@/context/AppSettingsContext";

interface ConcentrationSaveModalProps {
  visible: boolean;
  onClose: () => void;
  onSaveResult: (success: boolean) => void;
  dc: number;
  damage: number;
  conMod?: number;
}

export const ConcentrationSaveModal: React.FC<ConcentrationSaveModalProps> = ({
  visible,
  onClose,
  onSaveResult,
  dc,
  damage,
  conMod = 0,
}) => {
  const c = useColors();
  const { settings } = useAppSettings();
  const auto = settings.autoConcentrationSave;

  // Auto-roll logic
  React.useEffect(() => {
    if (visible && auto) {
      const d20 = Math.floor(Math.random() * 20) + 1;
      const total = Math.max(1, d20 + conMod);
      setTimeout(() => {
        onSaveResult(total >= dc);
        onClose();
      }, 700);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, auto]);

  if (auto && visible) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.content, { backgroundColor: c.card }]}> 
            <Text style={[styles.title, { color: c.foreground }]}>Concentration Check</Text>
            <Text style={[styles.desc, { color: c.mutedForeground }]}>Auto-rolling... (d20 + {conMod})</Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: c.card }]}> 
          <Text style={[styles.title, { color: c.foreground }]}>Concentration Check</Text>
          <Text style={[styles.desc, { color: c.mutedForeground }]}>You took <Text style={{ color: c.destructive }}>{damage}</Text> damage. Make a Constitution saving throw (DC <Text style={{ color: c.primary }}>{dc}</Text>).</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: c.primary }]}
              onPress={() => { onSaveResult(true); onClose(); }}
            >
              <Feather name="check" size={18} color={c.primaryForeground} />
              <Text style={[styles.buttonText, { color: c.primaryForeground }]}>Success</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: c.destructive }]}
              onPress={() => { onSaveResult(false); onClose(); }}
            >
              <Feather name="x" size={18} color={c.destructiveForeground} />
              <Text style={[styles.buttonText, { color: c.destructiveForeground }]}>Fail</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    width: 320,
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  desc: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 16,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
