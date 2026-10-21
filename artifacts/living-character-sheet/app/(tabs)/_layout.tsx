import { BlurView } from "expo-blur";
import { Tabs, router, usePathname } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCharacter } from "@/context/CharacterContext";
import { useCombat } from "@/context/CombatContext";
import { useParty } from "@/context/PartyContext";

function HomeButton() {
  const c = useColors();
  const { saveCurrentCharacter, hasCharacter } = useCharacter();

  const handlePress = async () => {
    if (hasCharacter) {
      try { await saveCurrentCharacter(); } catch {}
    }
    router.replace("/landing");
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={{ marginLeft: 16, padding: 4 }}>
      <Feather name="home" size={20} color={c.foreground} />
    </TouchableOpacity>
  );
}

function CombatNavButton() {
  const c = useColors();
  const pathname = usePathname();
  const combat = useCombat();
  const isActionsTab = pathname?.includes("/attacks");
  const { memberId, combatState } = useParty();
  const hasActiveEncounter = Boolean(memberId && combatState?.participantBattleById?.[memberId]);
  const handlePress = () => {
    router.push({
      pathname: "/(tabs)/attacks",
      params: hasActiveEncounter
        ? { navTick: Date.now().toString() }
        : { navNotice: "no-active-encounter", navTick: Date.now().toString() },
    });
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={{
        marginRight: 10,
        padding: 4,
        position: "relative",
      }}
    >
      <Feather name="crosshair" size={20} color={isActionsTab || (hasActiveEncounter && combat.active) ? c.primary : c.foreground} />
      {hasActiveEncounter && (isActionsTab || combat.active) && (
        <View style={{
          position: "absolute",
          top: 2,
          right: 2,
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: "#f97316",
        }} />
      )}
    </TouchableOpacity>
  );
}

function OptionsNavButton() {
  const c = useColors();

  return (
    <TouchableOpacity
      onPress={() => router.push("/options" as any)}
      activeOpacity={0.7}
      style={{ marginRight: 10, padding: 4 }}
    >
      <Feather name="settings" size={20} color={c.foreground} />
    </TouchableOpacity>
  );
}

function PartyCombatButtons() {
  const c = useColors();
  const pathname = usePathname();
  const { isInParty, members, combatState } = useParty();
  const isPartyRoute = pathname?.startsWith("/party");
  const partyBadge = combatState?.currentTurnId ? "!" : isInParty && members.length > 1 ? String(members.length) : undefined;

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <TouchableOpacity
        onPress={() => router.push("/party")}
        activeOpacity={0.7}
        style={{ marginRight: 10, padding: 4, position: "relative" }}
      >
        <Feather name="users" size={20} color={isPartyRoute ? c.primary : c.foreground} />
        {partyBadge ? (
          <View
            style={{
              position: "absolute",
              top: -2,
              right: -4,
              minWidth: 15,
              height: 15,
              borderRadius: 8,
              paddingHorizontal: 3,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: combatState?.currentTurnId ? "#f97316" : c.primary,
            }}
          >
            <Text style={{ color: c.primaryForeground, fontSize: 9, fontWeight: "700" }}>{partyBadge}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/resources")}
        activeOpacity={0.7}
        style={{ marginRight: 10, padding: 4 }}
      >
        <Feather name="activity" size={20} color={c.foreground} />
      </TouchableOpacity>
      <CombatNavButton />
      <OptionsNavButton />
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const { pendingLevelUps = 0 } = useCharacter();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        headerLeft: () => <HomeButton />,
        headerRight: () => <PartyCombatButtons />,
        tabBarStyle: {
          position: isWeb ? "relative" : "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: 0,
          borderTopColor: "transparent",
          elevation: 0,
          height: isWeb ? 74 : 54 + Math.max(insets.bottom, 1),
          paddingBottom: isWeb ? 2 : Math.max(insets.bottom - 1, 1),
          paddingTop: isWeb ? 0 : 0,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: "700",
          marginBottom: isWeb ? 5 : 2,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Character",
          tabBarBadge: pendingLevelUps > 0 ? pendingLevelUps : undefined,
          tabBarIcon: ({ color }) => (
            <Feather name="user" size={24} color={color} />
          ),
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <PartyCombatButtons />
              <TouchableOpacity
                onPress={() => router.push("/edit-character")}
                activeOpacity={0.7}
                style={{ marginRight: 16, padding: 4 }}
              >
                <Feather name="edit" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="sheet"
        redirect
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="attacks"
        options={{
          title: "Battle",
          tabBarIcon: ({ color }) => (
            <Feather name="zap" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="resources"
        options={{
          title: "Resources",
          href: null,
          tabBarIcon: ({ color }) => (
            <Feather name="activity" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          tabBarIcon: ({ color }) => (
            <Feather name="package" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: "Notes",
          tabBarIcon: ({ color }) => (
            <Feather name="book-open" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="quick-update"
        options={{
          title: "Update",
          href: null,
          tabBarIcon: ({ color }) => (
            <Feather name="edit-3" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: "Log",
          href: null,
          tabBarIcon: ({ color }) => (
            <Feather name="clock" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({});
