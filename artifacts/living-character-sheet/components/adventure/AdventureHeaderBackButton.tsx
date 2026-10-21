import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";

export interface AdventureHeaderBackButtonProps {
  destination: string;
}

export function AdventureHeaderBackButton({ destination }: AdventureHeaderBackButtonProps) {
  const c = useColors();

  return (
    <TouchableOpacity
      onPress={() => router.replace(destination as any)}
      style={[styles.button, { borderColor: c.border, backgroundColor: c.card }]}
      activeOpacity={0.8}
    >
      <Feather name="arrow-left" size={14} color={c.foreground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 2,
  },
});
