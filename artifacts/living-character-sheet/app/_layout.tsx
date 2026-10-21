import "react-native-reanimated";

import {
  Cinzel_400Regular,
  Cinzel_500Medium,
  Cinzel_700Bold,
} from "@expo-google-fonts/cinzel";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  Lora_400Regular,
  Lora_500Medium,
  Lora_700Bold,
} from "@expo-google-fonts/lora";
import {
  BebasNeue_400Regular,
} from "@expo-google-fonts/bebas-neue";
import {
  ArchivoBlack_400Regular,
} from "@expo-google-fonts/archivo-black";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EffectsOverlay } from "@/components/EffectsOverlay";
import { LoadingScreen } from "@/components/LoadingScreen";
import { CharacterProvider } from "@/context/CharacterContext";
import { AppSettingsProvider } from "@/context/AppSettingsContext";
import { CombatProvider } from "@/context/CombatContext";
import { PartyProvider } from "@/context/PartyContext";
import { SyncProvider } from "@/context/SyncContext";
import { MutationHistoryProvider } from "@/context/MutationHistoryContext";
import { AdventureSessionProvider } from "@/context/AdventureSessionContext";
import { WebScrollPill } from "@/components/ui/WebScrollPill";
import { StatusEventPill } from "@/components/ui/StatusEventPill";
import { PartyStatusPill } from "@/components/ui/PartyStatusPill";
import { DMShell } from "@/components/shell/DMShell";
import { ShellContextRouter } from "@/components/shell/ShellContextRouter";
import { UnifiedUtilityMenu } from "@/components/shell/UnifiedUtilityMenu";
import { DEFAULT_MOTIONS, useAppSettings } from "@/context/AppSettingsContext";
import { DISPLAY_ZOOM_SCALE, FONT_FAMILY_RUNTIME, FONT_UI_SCALE, LINE_SPACING_UI_SCALE } from "@/constants/typography";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const SHELL_SCAFFOLDING_ENABLED = true;
const PATTERN_POSITIONS = Array.from({ length: 13 }, (_, i) => i * 8);
const pct = (value: number) => `${value}%` as `${number}%`;
const NOISE_POINTS = Array.from({ length: 120 }, (_, i) => ({
  left: (i * 17) % 100,
  top: (i * 29) % 100,
  size: (i % 3) + 1,
  opacity: i % 2 === 0 ? 0.06 : 0.11,
}));

const BASE_TEXT_STYLE = (Text as any).defaultProps?.style;
const BASE_TEXT_INPUT_STYLE = (TextInput as any).defaultProps?.style;

function isPlayerShellChromeRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/adventure") ||
    pathname.startsWith("/sheet") ||
    pathname.startsWith("/attacks") ||
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/notes") ||
    pathname.startsWith("/resources") ||
    pathname.startsWith("/quick-update") ||
    pathname.startsWith("/log") ||
    pathname.startsWith("/party") ||
    pathname.startsWith("/loot-review") ||
    pathname.startsWith("/loot-generator")
  );
}

function RootLayoutNav({
  contentBackground,
  headerBackground,
  headerTint,
}: {
  contentBackground: string;
  headerBackground: string;
  headerTint: string;
}) {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: contentBackground },
        headerStyle: { backgroundColor: headerBackground },
        headerTintColor: headerTint,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="landing" options={{ headerShown: false }} />
      <Stack.Screen name="adventure" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="characters" options={{ headerShown: false }} />
      <Stack.Screen name="options/index" options={{ headerShown: false }} />
      <Stack.Screen name="options/display" options={{ headerShown: false }} />
      <Stack.Screen name="options/gameplay" options={{ headerShown: false }} />
      <Stack.Screen name="options/dev" options={{ headerShown: false }} />
      <Stack.Screen name="options/json-architecture" options={{ headerShown: false }} />
      <Stack.Screen name="options/about" options={{ headerShown: false }} />
      <Stack.Screen name="create-character" options={{ headerShown: false }} />
      <Stack.Screen name="dm-npc" options={{ headerShown: false }} />
      <Stack.Screen name="dm-item" options={{ headerShown: false }} />
      <Stack.Screen name="dm-notes" options={{ headerShown: false }} />
      <Stack.Screen name="dm-monsters" options={{ headerShown: false }} />
      <Stack.Screen
        name="dm-party"
        options={{
          title: "Back to DM Tools",
          headerBackVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                  return;
                }
                router.replace("/landing");
              }}
              hitSlop={8}
              style={{ paddingHorizontal: 6, paddingVertical: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Back to DM tools"
            >
              <Feather name="arrow-left" size={20} color={headerTint} />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="loot-generator"
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="loot-review"
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="edit-character"
        options={{
          title: "Edit Character",
          presentation: "modal",
          headerStyle: { backgroundColor: headerBackground },
          headerTintColor: headerTint,
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="party"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="party-events"
        options={{
          title: "Party Events",
          headerStyle: { backgroundColor: headerBackground },
          headerTintColor: headerTint,
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}

function AnimatedAppShell() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { settings, palette } = useAppSettings();
  const motion = settings.motionIntensity ?? "full";
  const motionsEnabled = settings.motions?.enabled ?? DEFAULT_MOTIONS.enabled;
  const shellMotionEnabled = motionsEnabled && motion !== "off" && (settings.motions?.appShellTransition ?? DEFAULT_MOTIONS.appShellTransition);
  const duration = motion === "subtle" ? 120 : 200;
  const anim = useRef(new Animated.Value(1)).current;
  const useNativeDriver = Platform.OS !== "web";
  const globalFontFamily = FONT_FAMILY_RUNTIME[settings.fontFamily ?? "inter"];
  const uiScale = FONT_UI_SCALE[settings.fontScale ?? "md"];
  const lineSpacingScale = LINE_SPACING_UI_SCALE[settings.lineSpacing ?? "normal"];
  const displayZoom = DISPLAY_ZOOM_SCALE[settings.displayZoom ?? "100"];
  const shellScale = Platform.OS === "web" ? 1 : uiScale * lineSpacingScale * displayZoom;
  const transformShellScale = shellScale;
  const customTheme = settings.customTheme;
  const customThemeEnabled = Boolean(customTheme?.enabled);
  const texturePattern = customThemeEnabled ? customTheme?.texturePattern ?? "none" : "none";
  const textureIntensity = customThemeEnabled ? customTheme?.textureIntensity ?? 0.7 : 0;
  const backgroundImageUri = customThemeEnabled ? customTheme?.backgroundImageUri ?? null : null;
  const backgroundImageOpacity = customThemeEnabled ? customTheme?.backgroundImageOpacity ?? 0.2 : 0;

  useEffect(() => {
    if (!shellMotionEnabled) {
      anim.setValue(1);
      return;
    }

    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
  }, [anim, duration, pathname, shellMotionEnabled, useNativeDriver]);

  useEffect(() => {
    const TextAny = Text as any;
    const TextInputAny = TextInput as any;

    TextAny.defaultProps = TextAny.defaultProps ?? {};
    TextAny.defaultProps.style = [BASE_TEXT_STYLE, { fontFamily: globalFontFamily }];

    TextInputAny.defaultProps = TextInputAny.defaultProps ?? {};
    TextInputAny.defaultProps.style = [BASE_TEXT_INPUT_STYLE, { fontFamily: globalFontFamily }];

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const styleId = "lcs-global-font-family";
      const css = `
html, body, #root { font-family: ${globalFontFamily}, system-ui, sans-serif !important; }
[style*="-apple-system"],
[style*="BlinkMacSystemFont"],
[style*="Segoe UI"],
[style*="Roboto"],
[style*="Helvetica"],
[style*="Arial"] {
  font-family: ${globalFontFamily}, system-ui, sans-serif !important;
}
`;
      let tag = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!tag) {
        tag = document.createElement("style");
        tag.id = styleId;
        document.head.appendChild(tag);
      }
      tag.textContent = css;

      const shouldSkipFont = (family: string) => {
        const normalized = family.toLowerCase();
        return (
          normalized.includes("feather") ||
          normalized.includes("fontawesome") ||
          normalized.includes("material icons") ||
          normalized.includes("expo symbols")
        );
      };

      const shouldReplaceFont = (family: string) => {
        const normalized = family.toLowerCase();
        return (
          normalized.includes("-apple-system") ||
          normalized.includes("blinkmacsystemfont") ||
          normalized.includes("segoe ui") ||
          normalized.includes("roboto") ||
          normalized.includes("helvetica") ||
          normalized.includes("arial") ||
          normalized.includes("system-ui")
        );
      };

      const applyWebFontToNode = (root: ParentNode) => {
        const nodes = root.querySelectorAll?.("*") ?? [];
        nodes.forEach((node) => {
          const el = node as HTMLElement;
          if (!el || !el.style) return;
          const currentFamily = getComputedStyle(el).fontFamily || "";
          if (shouldSkipFont(currentFamily)) return;
          if (shouldReplaceFont(currentFamily)) {
            el.style.fontFamily = `${globalFontFamily}, system-ui, sans-serif`;
          }
        });
      };

      applyWebFontToNode(document);

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              const currentFamily = getComputedStyle(node).fontFamily || "";
              if (!shouldSkipFont(currentFamily) && shouldReplaceFont(currentFamily)) {
                node.style.fontFamily = `${globalFontFamily}, system-ui, sans-serif`;
              }
              applyWebFontToNode(node);
            }
          });
        }
      });

      const root = document.getElementById("root");
      if (root) {
        observer.observe(root, { childList: true, subtree: true });
      }

      return () => observer.disconnect();
    }
  }, [globalFontFamily]);

  // Apply combined scale (font size × line spacing × zoom) via CSS zoom on web.
  // CSS zoom expands the layout — unlike transform:scale it does not cause letterbox bars.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const combined = uiScale * lineSpacingScale * displayZoom;
    document.documentElement.style.zoom = combined === 1 ? "" : String(combined);
    return () => {
      document.documentElement.style.zoom = "";
    };
  }, [uiScale, lineSpacingScale, displayZoom]);

  const scaledShellStyle =
    transformShellScale === 1
      ? null
      : {
          width: `${100 / transformShellScale}%` as const,
          height: `${100 / transformShellScale}%` as const,
          ...(transformShellScale > 1 ? { alignSelf: "center" as const } : {}),
        };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <Animated.View
        style={{
          ...(transformShellScale === 1 ? { flex: 1 } : { flex: 0 }),
          backgroundColor: palette.background,
          ...(scaledShellStyle ?? {}),
          transform: [
            ...(transformShellScale === 1 ? [] : [{ scale: transformShellScale }]),
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [motion === "subtle" ? 3 : 7, 0],
              }),
            },
          ],
        }}
      >
        {backgroundImageUri ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          >
            <Image
              source={{ uri: backgroundImageUri }}
              resizeMode="cover"
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                opacity: backgroundImageOpacity,
              }}
            />
          </View>
        ) : null}
        {texturePattern !== "none" ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          >
            {texturePattern === "grid" ? (
              <>
                {PATTERN_POSITIONS.map((pos) => (
                  <View
                    key={`grid-v-${pos}`}
                    style={{
                      position: "absolute",
                      left: pct(pos),
                      top: 0,
                      bottom: 0,
                      width: 1,
                      backgroundColor: palette.foreground,
                      opacity: 0.12 * textureIntensity,
                    }}
                  />
                ))}
                {PATTERN_POSITIONS.map((pos) => (
                  <View
                    key={`grid-h-${pos}`}
                    style={{
                      position: "absolute",
                      top: pct(pos),
                      left: 0,
                      right: 0,
                      height: 1,
                      backgroundColor: palette.foreground,
                      opacity: 0.12 * textureIntensity,
                    }}
                  />
                ))}
              </>
            ) : null}
            {texturePattern === "dots" ? (
              <>
                {PATTERN_POSITIONS.map((row) =>
                  PATTERN_POSITIONS.map((col) => (
                    <View
                      key={`dot-${row}-${col}`}
                      style={{
                        position: "absolute",
                        top: pct(row),
                        left: pct(col),
                        width: 2,
                        height: 2,
                        borderRadius: 999,
                        backgroundColor: palette.foreground,
                        opacity: 0.2 * textureIntensity,
                      }}
                    />
                  )),
                )}
              </>
            ) : null}
            {texturePattern === "noise" ? (
              <>
                {NOISE_POINTS.map((point, idx) => (
                  <View
                    key={`noise-${idx}`}
                    style={{
                      position: "absolute",
                      left: pct(point.left),
                      top: pct(point.top),
                      width: point.size,
                      height: point.size,
                      borderRadius: 999,
                      backgroundColor: palette.foreground,
                      opacity: point.opacity * textureIntensity,
                    }}
                  />
                ))}
              </>
            ) : null}
          </View>
        ) : null}
        {SHELL_SCAFFOLDING_ENABLED ? (
          <ShellContextRouter>
            {({ shell, pathname, state }) => {
              const dmShellEnabled = SHELL_SCAFFOLDING_ENABLED && shell === "dm";
              const playerChromeEnabled = SHELL_SCAFFOLDING_ENABLED && shell === "player" && isPlayerShellChromeRoute(pathname);

              return (
                <>
                  <RootLayoutNav
                    contentBackground={palette.background}
                    headerBackground={palette.card}
                    headerTint={palette.foreground}
                  />
                  <UnifiedUtilityMenu shell={shell} pathname={pathname} state={state} enabled={playerChromeEnabled} />
                  <DMShell pathname={pathname} enabled={dmShellEnabled} />
                </>
              );
            }}
          </ShellContextRouter>
        ) : (
          <RootLayoutNav
            contentBackground={palette.background}
            headerBackground={palette.card}
            headerTint={palette.foreground}
          />
        )}
      </Animated.View>
      <EffectsOverlay />
      <StatusEventPill />
      <PartyStatusPill />
      <WebScrollPill />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cinzel_400Regular,
    Cinzel_500Medium,
    Cinzel_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Lora_400Regular,
    Lora_500Medium,
    Lora_700Bold,
    BebasNeue_400Regular,
    ArchivoBlack_400Regular,
  });
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Keep loading screen visible for a bit longer for better UX
      const delay = setTimeout(() => {
        SplashScreen.hideAsync();
        setAppReady(true);
      }, 400);
      return () => clearTimeout(delay);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AppSettingsProvider>
              <AdventureSessionProvider>
                <CharacterProvider>
                  <SyncProvider>
                    <MutationHistoryProvider>
                      <PartyProvider>
                        <CombatProvider>
                          <AnimatedAppShell />
                        </CombatProvider>
                      </PartyProvider>
                    </MutationHistoryProvider>
                  </SyncProvider>
                </CharacterProvider>
              </AdventureSessionProvider>
            </AppSettingsProvider>
            <LoadingScreen visible={!appReady} />
            </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
