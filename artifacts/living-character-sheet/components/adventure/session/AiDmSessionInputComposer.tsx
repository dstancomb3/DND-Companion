import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from "react-native";

import { useColors } from "@/hooks/useColors";

export interface AiDmSessionInputComposerProps {
  onSubmit: (value: string) => void;
  isPending?: boolean;
  isReady?: boolean;
}

export function AiDmSessionInputComposer({ onSubmit, isPending = false, isReady = true }: AiDmSessionInputComposerProps) {
  const c = useColors();
  const [value, setValue] = useState("");
  const canSubmit = useMemo(() => !isPending && isReady && value.trim().length > 0, [isPending, isReady, value]);

  return (
    <View style={[styles.wrap, { borderColor: c.border, backgroundColor: c.card }]}> 
      <Text style={[styles.label, { color: c.foreground }]}>
        {isPending ? "Waiting for DM..." : "Your Input"}
      </Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={isPending ? "Awaiting response..." : "Tell the DM what you do next"}
        placeholderTextColor={c.mutedForeground}
        style={[styles.input, { borderColor: c.border, backgroundColor: c.background, color: c.foreground, opacity: isPending ? 0.6 : 1 }]}
        multiline
        textAlignVertical="top"
        maxLength={280}
        editable={!isPending}
      />
      <TouchableOpacity
        onPress={() => {
          if (!canSubmit) return;
          const submitted = value.trim();
          setValue("");
          onSubmit(submitted);
        }}
        disabled={!canSubmit}
        activeOpacity={0.85}
        style={[styles.button, { backgroundColor: canSubmit ? c.primary : c.muted, opacity: canSubmit ? 1 : 0.65, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }]}
      >
        {isPending && <ActivityIndicator size="small" color={c.primaryForeground} />}
        <Text style={[styles.buttonText, { color: c.primaryForeground }]}>
          {isPending ? "Waiting..." : !isReady ? "Connecting..." : "Send"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 80,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
