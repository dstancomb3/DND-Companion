import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { Card } from "./Card";
import { MonsterPickerModal } from "./MonsterPickerModal";
import type { Companion, CompendiumMonster } from "@/types";

interface CompanionFormProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<Companion, "id" | "createdAt" | "updatedAt">) => void;
  initialData?: Companion;
  characterId: string;
}

export function CompanionForm({
  visible,
  onClose,
  onSave,
  initialData,
  characterId,
}: CompanionFormProps) {
  const c = useColors();
  const [showMonsterPicker, setShowMonsterPicker] = useState(false);
  const [hitDice, setHitDice] = useState(initialData?.hit_dice ?? "1d8");
  const [speed, setSpeed] = useState(initialData?.speed ?? "30 ft.");
  const [strength, setStrength] = useState(initialData?.strength ?? 10);
  const [dexterity, setDexterity] = useState(initialData?.dexterity ?? 10);
  const [constitution, setConstitution] = useState(initialData?.constitution ?? 10);
  const [intelligence, setIntelligence] = useState(initialData?.intelligence ?? 10);
  const [wisdom, setWisdom] = useState(initialData?.wisdom ?? 10);
  const [charisma, setCharisma] = useState(initialData?.charisma ?? 10);
  const [actions, setActions] = useState(initialData?.actions);
  const [specialAbilities, setSpecialAbilities] = useState(initialData?.special_abilities);

  const [name, setName] = useState(initialData?.name ?? "");
  const [type, setType] = useState(initialData?.type ?? "");
  const [size, setSize] = useState(initialData?.size ?? "Medium");
  const [alignment, setAlignment] = useState(initialData?.alignment ?? "");
  const [AC, setAC] = useState(String(initialData?.armor_class ?? 13));
  const [HP, setHP] = useState(String(initialData?.hit_points ?? 5));
  const [maxHP, setMaxHP] = useState(String(initialData?.max_hit_points ?? 5));
  const [CR, setCR] = useState(String(initialData?.challenge_rating ?? 0));
  const [notes, setNotes] = useState(initialData?.notes ?? "");

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setType(initialData.type);
      setSize(initialData.size ?? "Medium");
      setAlignment(initialData.alignment ?? "");
      setAC(String(initialData.armor_class));
      setHP(String(initialData.hit_points));
      setMaxHP(String(initialData.max_hit_points));
      setCR(String(initialData.challenge_rating));
      setNotes(initialData.notes ?? "");
      setHitDice(initialData.hit_dice ?? "1d8");
      setSpeed(initialData.speed ?? "30 ft.");
      setStrength(initialData.strength ?? 10);
      setDexterity(initialData.dexterity ?? 10);
      setConstitution(initialData.constitution ?? 10);
      setIntelligence(initialData.intelligence ?? 10);
      setWisdom(initialData.wisdom ?? 10);
      setCharisma(initialData.charisma ?? 10);
      setActions(initialData.actions);
      setSpecialAbilities(initialData.special_abilities);
    }
    if (!initialData && visible) {
      setHitDice("1d8");
      setSpeed("30 ft.");
      setStrength(10);
      setDexterity(10);
      setConstitution(10);
      setIntelligence(10);
      setWisdom(10);
      setCharisma(10);
      setActions(undefined);
      setSpecialAbilities(undefined);
    }
  }, [initialData, visible]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Companion name is required");
      return;
    }

    const companion: Omit<Companion, "id" | "createdAt" | "updatedAt"> = {
      characterId,
      name: name.trim(),
      type: type.trim() || "Unknown",
      size: size || "Medium",
      alignment: alignment.trim() || "",
      armor_class: parseInt(AC, 10) || 10,
      hit_points: parseInt(HP, 10) || 1,
      max_hit_points: parseInt(maxHP, 10) || 1,
      hit_dice: hitDice,
      speed,
      strength,
      dexterity,
      constitution,
      intelligence,
      wisdom,
      charisma,
      challenge_rating: String(parseFloat(CR) || 0),
      actions,
      special_abilities: specialAbilities,
      notes: notes.trim() || undefined,
    };

    onSave(companion);
    handleClose();
  };

  const handleClose = () => {
    setName("");
    setType("");
    setSize("Medium");
    setAlignment("");
    setAC("13");
    setHP("5");
    setMaxHP("5");
    setCR("0");
    setNotes("");
    setHitDice("1d8");
    setSpeed("30 ft.");
    setStrength(10);
    setDexterity(10);
    setConstitution(10);
    setIntelligence(10);
    setWisdom(10);
    setCharisma(10);
    setActions(undefined);
    setSpecialAbilities(undefined);
    setShowMonsterPicker(false);
    onClose();
  };

  const handleMonsterSelected = (monster: CompendiumMonster) => {
    setName(monster.name);
    setType(monster.type);
    setSize(monster.size ?? "Medium");
    setAlignment(monster.alignment ?? "");
    setAC(String(monster.armor_class));
    setHP(String(monster.hit_points));
    setMaxHP(String(monster.hit_points));
    setCR(String(monster.challenge_rating));
    setHitDice(monster.hit_dice ?? "1d8");
    setSpeed(monster.speed ?? "30 ft.");
    setStrength(monster.strength ?? 10);
    setDexterity(monster.dexterity ?? 10);
    setConstitution(monster.constitution ?? 10);
    setIntelligence(monster.intelligence ?? 10);
    setWisdom(monster.wisdom ?? 10);
    setCharisma(monster.charisma ?? 10);
    setActions(monster.actions);
    setSpecialAbilities(monster.special_abilities);
    setNotes(`Imported from ${monster.name} (CR ${monster.challenge_rating})`);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={[styles.overlay, { backgroundColor: c.background }]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 32,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <Text
              style={[
                styles.headerText,
                { color: c.foreground, fontSize: 18 },
              ]}
            >
              {initialData ? "Edit Companion" : "Create Companion"}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={20} color={c.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Card padding={12}>
            {/* Import from Compendium Button */}
            <View style={{ marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => setShowMonsterPicker(true)}
                activeOpacity={0.7}
                style={[
                  styles.button,
                  {
                    backgroundColor: c.primary + "20",
                    borderColor: c.primary,
                    borderWidth: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  },
                ]}
              >
                <Feather name="book-open" size={14} color={c.primary} />
                <Text style={[styles.buttonText, { color: c.primary }]}>
                  Import from Compendium
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: c.mutedForeground }]}>
                Name *
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Companion name"
                placeholderTextColor={c.mutedForeground}
                style={[
                  styles.input,
                  {
                    backgroundColor: c.secondary,
                    color: c.foreground,
                    borderColor: c.border,
                  },
                ]}
              />
            </View>

            {/* Type / CR Row */}
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: c.mutedForeground }]}>
                  Type
                </Text>
                <TextInput
                  value={type}
                  onChangeText={setType}
                  placeholder="e.g., Beast, Dragon"
                  placeholderTextColor={c.mutedForeground}
                  style={[
                    styles.input,
                    {
                      backgroundColor: c.secondary,
                      color: c.foreground,
                      borderColor: c.border,
                    },
                  ]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: c.mutedForeground }]}>
                  CR
                </Text>
                <TextInput
                  value={CR}
                  onChangeText={setCR}
                  placeholder="0"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="decimal-pad"
                  style={[
                    styles.input,
                    {
                      backgroundColor: c.secondary,
                      color: c.foreground,
                      borderColor: c.border,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Size / Alignment Row */}
            <View
              style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: c.mutedForeground }]}>
                  Size
                </Text>
                <TextInput
                  value={size}
                  onChangeText={setSize}
                  placeholder="Medium"
                  placeholderTextColor={c.mutedForeground}
                  style={[
                    styles.input,
                    {
                      backgroundColor: c.secondary,
                      color: c.foreground,
                      borderColor: c.border,
                    },
                  ]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: c.mutedForeground }]}>
                  Alignment
                </Text>
                <TextInput
                  value={alignment}
                  onChangeText={setAlignment}
                  placeholder="e.g., Chaotic Evil"
                  placeholderTextColor={c.mutedForeground}
                  style={[
                    styles.input,
                    {
                      backgroundColor: c.secondary,
                      color: c.foreground,
                      borderColor: c.border,
                    },
                  ]}
                />
              </View>
            </View>

            {/* AC / HP Row */}
            <View
              style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: c.mutedForeground }]}>
                  AC
                </Text>
                <TextInput
                  value={AC}
                  onChangeText={setAC}
                  placeholder="13"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="number-pad"
                  style={[
                    styles.input,
                    {
                      backgroundColor: c.secondary,
                      color: c.foreground,
                      borderColor: c.border,
                    },
                  ]}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={[styles.label, { color: c.mutedForeground }]}>
                  HP
                </Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TextInput
                    value={HP}
                    onChangeText={setHP}
                    placeholder="Current"
                    placeholderTextColor={c.mutedForeground}
                    keyboardType="number-pad"
                    style={[
                      styles.input,
                      {
                        flex: 1,
                        backgroundColor: c.secondary,
                        color: c.foreground,
                        borderColor: c.border,
                      },
                    ]}
                  />
                  <Text style={[{ color: c.mutedForeground, marginTop: 8 }]}>
                    /
                  </Text>
                  <TextInput
                    value={maxHP}
                    onChangeText={setMaxHP}
                    placeholder="Max"
                    placeholderTextColor={c.mutedForeground}
                    keyboardType="number-pad"
                    style={[
                      styles.input,
                      {
                        flex: 1,
                        backgroundColor: c.secondary,
                        color: c.foreground,
                        borderColor: c.border,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* Notes Field */}
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: c.mutedForeground }]}>
                Notes
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes about this companion"
                placeholderTextColor={c.mutedForeground}
                multiline
                numberOfLines={3}
                style={[
                  styles.input,
                  {
                    backgroundColor: c.secondary,
                    color: c.foreground,
                    borderColor: c.border,
                    textAlignVertical: "top",
                  },
                ]}
              />
            </View>
          </Card>

          {/* Action Buttons */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              onPress={handleClose}
              style={[
                styles.button,
                {
                  backgroundColor: c.secondary,
                  borderColor: c.border,
                  borderWidth: 1,
                  flex: 1,
                },
              ]}
            >
              <Text style={[styles.buttonText, { color: c.foreground }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[
                styles.button,
                { backgroundColor: c.primary, flex: 1 },
              ]}
            >
              <Text
                style={[styles.buttonText, { color: c.primaryForeground }]}
              >
                {initialData ? "Update" : "Create"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
      
      {/* Monster Picker Modal */}
      <MonsterPickerModal
        visible={showMonsterPicker}
        onClose={() => setShowMonsterPicker(false)}
        onSelect={handleMonsterSelected}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  headerText: {
    fontSize: 18,
    fontWeight: "700",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
