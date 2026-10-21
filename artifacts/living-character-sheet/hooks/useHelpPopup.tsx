import React, { useCallback, useMemo, useRef, useState } from "react";
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DEFAULT_MOTIONS, useAppSettings } from "@/context/AppSettingsContext";
import { useColors } from "@/hooks/useColors";

type HelpState = {
  title: string;
  body: string;
};

export function useHelpPopup() {
  const c = useColors();
  const { settings } = useAppSettings();
  const motion = settings.motionIntensity ?? "full";
  const motionsEnabled = settings.motions?.enabled ?? DEFAULT_MOTIONS.enabled;
  const popupMotionEnabled = motionsEnabled && motion !== "off" && (settings.motions?.helpPopupTransition ?? DEFAULT_MOTIONS.helpPopupTransition);
  const useNativeDriver = Platform.OS !== "web";

  const [help, setHelp] = useState<HelpState | null>(null);
  const [visible, setVisible] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const closeHelp = useCallback(() => {
    if (!popupMotionEnabled) {
      setVisible(false);
      setHelp(null);
      anim.setValue(0);
      return;
    }

    Animated.timing(anim, {
      toValue: 0,
      duration: motion === "subtle" ? 100 : 150,
      useNativeDriver,
    }).start(() => {
      setVisible(false);
      setHelp(null);
    });
  }, [anim, motion, popupMotionEnabled]);

  const showHelp = useCallback((title: string, body: string) => {
    if (!settings.enableLongPressHelpPopups) return;
    setHelp({ title, body });
    setVisible(true);

    if (!popupMotionEnabled) {
      anim.setValue(1);
      return;
    }

    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: motion === "subtle" ? 130 : 190,
      useNativeDriver,
    }).start();
  }, [anim, motion, popupMotionEnabled, settings.enableLongPressHelpPopups, useNativeDriver]);

  const popup = useMemo(() => {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={closeHelp}
      >
        <Pressable style={styles.overlay} onPress={closeHelp}>
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: c.card, borderColor: c.border },
              {
                opacity: anim,
                transform: [
                  {
                    scale: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                  {
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={[styles.title, { color: c.foreground }]}>{help?.title}</Text>
            <Text style={[styles.body, { color: c.mutedForeground }]}>{help?.body}</Text>
            <TouchableOpacity
              onPress={closeHelp}
              style={[styles.button, { backgroundColor: c.primary }]}
              activeOpacity={0.85}
            >
              <Text style={[styles.buttonText, { color: c.primaryForeground }]}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  }, [anim, c.border, c.card, c.foreground, c.mutedForeground, c.primary, c.primaryForeground, closeHelp, help?.body, help?.title, visible]);

  return {
    showHelp,
    helpPopup: popup,
  };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.58)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    alignSelf: "flex-end",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
