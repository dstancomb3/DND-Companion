import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname } from "expo-router";

import { useAppSettings } from "@/context/AppSettingsContext";
import { ParticleLayer, Particle } from "./ParticleLayer";
import { useCharacter } from "@/context/CharacterContext";
import { registerEffectTrigger } from "@/utils/triggerEffect";
import type { EffectType, EffectTriggerEvent } from "@/utils/triggerEffect";

// Type alias to avoid JSX ambiguity with generic syntax in destructuring
type AnimatedValueType = Animated.Value | Animated.AnimatedInterpolation<number>;

const fill = StyleSheet.absoluteFillObject;

const CAN_USE_NATIVE_LINEAR_GRADIENT = Platform.OS === "web";

// ── Gaussian-style vignette via four gradient strips ─────────────────────────
// Each strip fades from `color` at the screen edge to `colorTransparent`
// (same hue, zero alpha) toward the center, avoiding the grey/black shift
// that occurs when interpolating toward CSS "transparent".
function VignetteLayer({
  color,
  colorTransparent,
  opacity,
  thickness = 32,
}: {
  color: string;
  colorTransparent: string;
  opacity: Animated.Value | Animated.AnimatedInterpolation<number>;
  thickness?: number;
}) {
  const edgeColors = [color, colorTransparent] as [string, string];
  const edgeColorsRev = [colorTransparent, color] as [string, string];

  if (!CAN_USE_NATIVE_LINEAR_GRADIENT) {
    return (
      <Animated.View style={[fill, { opacity, pointerEvents: "none" }]}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: thickness, backgroundColor: color }} />
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: thickness, backgroundColor: color }} />
        <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: thickness, backgroundColor: color }} />
        <View style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: thickness, backgroundColor: color }} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[fill, { opacity, pointerEvents: "none" }]}>
      {/* Top */}
      <LinearGradient
        colors={edgeColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: thickness }}
      />
      {/* Bottom */}
      <LinearGradient
        colors={edgeColorsRev}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: thickness }}
      />
      {/* Left */}
      <LinearGradient
        colors={edgeColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: thickness }}
      />
      {/* Right */}
      <LinearGradient
        colors={edgeColorsRev}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: thickness }}
      />
    </Animated.View>
  );
}

// ── Main overlay ─────────────────────────────────────────────────────────────
export function EffectsOverlay() {
  const pathname = usePathname();
  // Reset all animated values and stop loops when returning to the sheet page
  useEffect(() => {
    if (pathname === "/" || pathname === "/index") {
      // Stop all loops
      lowHpLoop.current?.stop();
      deathLoop.current?.stop();
      poisonLoop.current?.stop();
      levelBurstAnim.current?.stop();
      critFailAnim.current?.stop();

      // Reset all animated values
      lowHpPulse.setValue(0);
      deathPulse.setValue(0);
      healFlash.setValue(0);
      damageFlash.setValue(0);
      longRest.setValue(0);
      potionFlash.setValue(0);
      levelBurst.setValue(0);
      poisonOpacity.setValue(0);
      critFailBurst.setValue(0);
      critFailTextOpacity.setValue(0);
      critFailTextScale.setValue(0);
      critFailTilt.setValue(0);
      critFailLift.setValue(36);
      setCritFailText(null);
    }
  }, [pathname]);
  const { settings } = useAppSettings();
  const { character, conditions, hasCharacter } = useCharacter();
  const fx = settings.effects;
  const effectsIntensity = settings.effectsIntensity ?? "full";
  const effectsEnabled = Boolean(fx?.enabled);
  const effectOpacityScale = effectsIntensity === "subtle" ? 0.6 : 1;
  const durationScale = effectsIntensity === "subtle" ? 0.9 : 1;
  const useNativeDriver = Platform.OS !== "web";

  const scaleDuration = (ms: number) => Math.max(40, Math.round(ms * durationScale));
  const scalePeak = (value: number) => Math.max(0, Math.min(1, value * effectOpacityScale));

  // Per-route opacity rules:
  //   Sheet tab (/)                    → full opacity
  //   Actions / Resources / Inventory  → half opacity
  //   Notes / Update / landing / other → hidden
  const pageOpacity = (() => {
    if (pathname === "/options" || pathname.startsWith("/options/")) return 1;
    if (!hasCharacter) return 0;
    if (pathname === "/" || pathname === "/index") return 1;
    if (pathname === "/attacks" || pathname === "/resources" || pathname === "/inventory") return 0.5;
    return 0;
  })();

  const lowHpPulse   = useRef(new Animated.Value(0)).current;
  const deathPulse   = useRef(new Animated.Value(0)).current;
  const healFlash    = useRef(new Animated.Value(0)).current;
  const damageFlash  = useRef(new Animated.Value(0)).current;
  const longRest     = useRef(new Animated.Value(0)).current;
  const potionFlash  = useRef(new Animated.Value(0)).current;
  const levelBurst   = useRef(new Animated.Value(0)).current;
  const poisonOpacity = useRef(new Animated.Value(0)).current;
  const critFailBurst = useRef(new Animated.Value(0)).current;
  const critFailTextOpacity = useRef(new Animated.Value(0)).current;
  const critFailTextScale = useRef(new Animated.Value(0)).current;
  const critFailTilt = useRef(new Animated.Value(0)).current;
  const critFailLift = useRef(new Animated.Value(36)).current;

  const lowHpLoop    = useRef<Animated.CompositeAnimation | null>(null);
  const deathLoop    = useRef<Animated.CompositeAnimation | null>(null);
  const poisonLoop   = useRef<Animated.CompositeAnimation | null>(null);
  const levelBurstAnim = useRef<Animated.CompositeAnimation | null>(null);
  const critFailAnim = useRef<Animated.CompositeAnimation | null>(null);
  const [critFailText, setCritFailText] = useState<"Nat 20!" | "Nat 1!" | null>(null);
  const [critFailTone, setCritFailTone] = useState<"success" | "fail">("success");
  const [manualPreviewActive, setManualPreviewActive] = useState(false);
  const manualPreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bumpManualPreviewWindow = useCallback(() => {
    if (manualPreviewTimeoutRef.current) {
      clearTimeout(manualPreviewTimeoutRef.current);
    }
    setManualPreviewActive(true);
    manualPreviewTimeoutRef.current = setTimeout(() => {
      setManualPreviewActive(false);
      manualPreviewTimeoutRef.current = null;
    }, 2600);
  }, []);

  const triggerLevelUpVisuals = useCallback(() => {
    levelBurstAnim.current?.stop();
    levelBurst.setValue(0);
    const burst = Animated.sequence([
      Animated.timing(levelBurst, { toValue: scalePeak(1), duration: scaleDuration(220), useNativeDriver }),
      Animated.delay(500),
      Animated.timing(levelBurst, { toValue: 0, duration: scaleDuration(1600), useNativeDriver }),
    ]);
    levelBurstAnim.current = burst;
    burst.start(() => { levelBurstAnim.current = null; });

    // Confetti effect removed
  }, [levelBurst, scaleDuration, scalePeak, useNativeDriver]);

  const triggerCritFailVisuals = useCallback((type: "nat_20" | "nat_1", preview = false) => {
    const peak = (value: number) => (preview ? value : scalePeak(value));
    critFailAnim.current?.stop();
    critFailBurst.setValue(0);
    critFailTextOpacity.setValue(0);
    critFailTextScale.setValue(0.06);
    critFailTilt.setValue(0);
    critFailLift.setValue(36);

    const isNat20 = type === "nat_20";
    const timingFactor = 1;
    const timed = (ms: number) => scaleDuration(Math.round(ms * timingFactor));
    setCritFailTone(isNat20 ? "success" : "fail");
    setCritFailText(isNat20 ? "Nat 20!" : "Nat 1!");

    if (isNat20 && fx?.levelUpBurst) {
      triggerLevelUpVisuals();
    }

    const sequence = Animated.parallel([
      Animated.sequence([
        Animated.timing(critFailBurst, { toValue: peak(1), duration: timed(180), useNativeDriver }),
        Animated.delay(timed(220)),
        Animated.timing(critFailBurst, { toValue: 0, duration: timed(900), useNativeDriver }),
      ]),
      Animated.sequence([
        Animated.timing(critFailTextOpacity, { toValue: 1, duration: timed(120), useNativeDriver }),
        Animated.delay(timed(70)),
        Animated.parallel([
          Animated.timing(critFailTextScale, {
            toValue: 1.08,
            duration: timed(380),
            easing: Easing.out(Easing.back(1.15)),
            useNativeDriver,
          }),
          Animated.timing(critFailLift, {
            toValue: 0,
            duration: timed(380),
            easing: Easing.out(Easing.cubic),
            useNativeDriver,
          }),
        ]),
        Animated.timing(critFailTextScale, {
          toValue: 1,
          duration: timed(90),
          easing: Easing.out(Easing.quad),
          useNativeDriver,
        }),
        Animated.sequence([
          Animated.timing(critFailTilt, { toValue: 1, duration: timed(70), easing: Easing.inOut(Easing.quad), useNativeDriver }),
          Animated.timing(critFailTilt, { toValue: -1, duration: timed(90), easing: Easing.inOut(Easing.quad), useNativeDriver }),
          Animated.timing(critFailTilt, { toValue: 0.6, duration: timed(80), easing: Easing.inOut(Easing.quad), useNativeDriver }),
          Animated.timing(critFailTilt, { toValue: 0, duration: timed(80), easing: Easing.inOut(Easing.quad), useNativeDriver }),
        ]),
        Animated.parallel([
          Animated.timing(critFailTextScale, {
            toValue: 0.72,
            duration: timed(220),
            easing: Easing.in(Easing.cubic),
            useNativeDriver,
          }),
          Animated.timing(critFailLift, {
            toValue: 18,
            duration: timed(220),
            easing: Easing.in(Easing.cubic),
            useNativeDriver,
          }),
        ]),
        Animated.timing(critFailTextScale, {
          toValue: 0.75,
          duration: timed(80),
          easing: Easing.out(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(critFailTextOpacity, {
          toValue: 0,
          duration: timed(420),
          easing: Easing.in(Easing.quad),
          useNativeDriver,
        }),
      ]),
    ]);

    critFailAnim.current = sequence;
    sequence.start(() => {
      critFailAnim.current = null;
      setCritFailText(null);
    });
  }, [critFailBurst, critFailLift, critFailTextOpacity, critFailTextScale, critFailTilt, fx?.levelUpBurst, scaleDuration, scalePeak, triggerLevelUpVisuals, useNativeDriver]);

  const prevHp      = useRef(character.currentHp);
  const prevLevel   = useRef(character.level);
  const prevCharId  = useRef(character.id);

  // HP change → heal or damage flash
  useEffect(() => {
    const prev = prevHp.current;
    const curr = character.currentHp;
    const charChanged = prevCharId.current !== character.id;
    prevHp.current = curr;

    // Never fire on a character load — just sync the baseline
    if (charChanged) return;

    if (curr !== prev && effectsEnabled) {
      if (curr > prev && fx?.healFlash) {
        healFlash.setValue(0);
        Animated.sequence([
          Animated.timing(healFlash, { toValue: scalePeak(1), duration: scaleDuration(120), useNativeDriver }),
          Animated.timing(healFlash, { toValue: 0, duration: scaleDuration(1400), useNativeDriver }),
        ]).start();
      } else if (curr < prev && fx?.damageFlash) {
        damageFlash.setValue(0);
        Animated.sequence([
          Animated.timing(damageFlash, { toValue: scalePeak(1), duration: scaleDuration(70), useNativeDriver }),
          Animated.timing(damageFlash, { toValue: 0, duration: scaleDuration(700), useNativeDriver }),
        ]).start();
      }
    }
  }, [character.currentHp, character.id, effectsEnabled, fx?.healFlash, fx?.damageFlash, useNativeDriver]); // eslint-disable-line react-hooks/exhaustive-deps

  // Level-up burst
  useEffect(() => {
    const prev = prevLevel.current;
    const curr = character.level;
    const charChanged = prevCharId.current !== character.id;

    // Always update both refs so next comparison has a clean baseline
    prevLevel.current  = curr;
    prevCharId.current = character.id;

    if (charChanged) {
      // A different character was loaded — stop any in-progress burst and reset
      levelBurstAnim.current?.stop();
      levelBurstAnim.current = null;
      levelBurst.setValue(0);
      return;
    }

    if (curr > prev && effectsEnabled && fx?.levelUpBurst) {
      triggerLevelUpVisuals();
    }
  }, [character.level, character.id, effectsEnabled, fx?.levelUpBurst, triggerLevelUpVisuals]); // eslint-disable-line react-hooks/exhaustive-deps

  // Low-HP & death's-door continuous loops
  useEffect(() => {
    const maxHp  = Math.max(character.maxHp ?? 1, 1);
    const hpPct  = character.currentHp / maxHp;
    const isLow  = hpPct > 0 && hpPct < 0.25;
    const isDead = character.currentHp <= 0;

    lowHpLoop.current?.stop();
    lowHpPulse.setValue(0);
    if (effectsEnabled && fx?.lowHpGlow && isLow && !isDead) {
      const loop = Animated.loop(
        Animated.sequence([
          // Lub — main beat (slowed)
          Animated.timing(lowHpPulse, { toValue: scalePeak(1), duration: scaleDuration(220), useNativeDriver }),
          Animated.timing(lowHpPulse, { toValue: scalePeak(0.08), duration: scaleDuration(300), useNativeDriver }),
          // Dub — quick follow-up beat (slowed)
          Animated.timing(lowHpPulse, { toValue: scalePeak(0.65), duration: scaleDuration(180), useNativeDriver }),
          Animated.timing(lowHpPulse, { toValue: 0, duration: scaleDuration(560), useNativeDriver }),
          // Longer rest before next heartbeat (slowed)
          Animated.delay(1200),
        ])
      );
      lowHpLoop.current = loop;
      loop.start();
    }

    deathLoop.current?.stop();
    deathPulse.setValue(0);
    if (effectsEnabled && fx?.deathsDoor && isDead) {
      // Steady glow — fade in once and hold, no pulse
      const anim = Animated.timing(deathPulse, { toValue: scalePeak(0.88), duration: scaleDuration(1000), useNativeDriver });
      deathLoop.current = anim;
      anim.start();
    }

    return () => {
      lowHpLoop.current?.stop();
      deathLoop.current?.stop();
    };
  }, [character.currentHp, character.maxHp, effectsEnabled, fx?.lowHpGlow, fx?.deathsDoor, useNativeDriver, pathname]);

  // Poison haze
  useEffect(() => {
    const active = conditions.some(
      (c) =>
        c.name.toLowerCase() === "poisoned" ||
        c.name.toLowerCase().includes("drunk") ||
        c.name.toLowerCase().includes("intoxicated")
    );

    poisonLoop.current?.stop();
    poisonOpacity.setValue(0);

    if (effectsEnabled && fx?.poisonHaze && active) {
      poisonOpacity.setValue(scalePeak(0.15));
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(poisonOpacity, { toValue: scalePeak(1), duration: scaleDuration(2000), useNativeDriver }),
          Animated.timing(poisonOpacity, { toValue: scalePeak(0.15), duration: scaleDuration(2000), useNativeDriver }),
        ])
      );
      poisonLoop.current = loop;
      loop.start();
    }

    return () => poisonLoop.current?.stop();
  }, [conditions, effectsEnabled, fx?.poisonHaze, useNativeDriver, pathname]);

  // Global triggered effects
  useEffect(() => {
    const handle = ({ type, preview }: EffectTriggerEvent) => {
      if (!effectsEnabled) return;

      // Explicit trigger previews (Options test buttons) should always be visible
      // even when normal route-based overlay opacity would otherwise hide them.
      bumpManualPreviewWindow();

      const peak = (value: number) => (preview ? value : scalePeak(value));

      if (type === "long_rest" && fx?.longRestFade) {
        longRest.setValue(0);
        Animated.sequence([
          Animated.timing(longRest, { toValue: peak(0.80), duration: scaleDuration(750), useNativeDriver }),
          Animated.delay(650),
          Animated.timing(longRest, { toValue: 0, duration: scaleDuration(950), useNativeDriver }),
        ]).start();
      }

      if (type === "potion" && fx?.potionSparkle) {
        potionFlash.setValue(0);
        Animated.sequence([
          Animated.timing(potionFlash, { toValue: peak(1), duration: scaleDuration(160), useNativeDriver }),
          Animated.timing(potionFlash, { toValue: 0, duration: scaleDuration(1600), useNativeDriver }),
        ]).start();
      }

      if (type === "level_up" && fx?.levelUpBurst) {
        triggerLevelUpVisuals();
      }

      if (type === "nat_20" && fx?.critFailBurst) {
        triggerCritFailVisuals("nat_20", preview);
      }

      if (type === "nat_1" && fx?.critFailBurst) {
        triggerCritFailVisuals("nat_1", preview);
      }

      if (type === "low_hp_glow" && fx?.lowHpGlow) {
        lowHpPulse.setValue(0);
        Animated.sequence([
          Animated.timing(lowHpPulse, { toValue: peak(1), duration: scaleDuration(110), useNativeDriver }),
          Animated.timing(lowHpPulse, { toValue: peak(0.1), duration: scaleDuration(130), useNativeDriver }),
          Animated.timing(lowHpPulse, { toValue: peak(0.7), duration: scaleDuration(90), useNativeDriver }),
          Animated.timing(lowHpPulse, { toValue: 0, duration: scaleDuration(260), useNativeDriver }),
        ]).start();
      }

      if (type === "deaths_door" && fx?.deathsDoor) {
        deathPulse.setValue(0);
        Animated.sequence([
          Animated.timing(deathPulse, { toValue: peak(0.95), duration: scaleDuration(220), useNativeDriver }),
          Animated.delay(220),
          Animated.timing(deathPulse, { toValue: 0, duration: scaleDuration(500), useNativeDriver }),
        ]).start();
      }

      if (type === "heal_flash" && fx?.healFlash) {
        healFlash.setValue(0);
        Animated.sequence([
          Animated.timing(healFlash, { toValue: peak(1), duration: scaleDuration(120), useNativeDriver }),
          Animated.timing(healFlash, { toValue: 0, duration: scaleDuration(1200), useNativeDriver }),
        ]).start();
      }

      if (type === "damage_flash" && fx?.damageFlash) {
        damageFlash.setValue(0);
        Animated.sequence([
          Animated.timing(damageFlash, { toValue: peak(1), duration: scaleDuration(70), useNativeDriver }),
          Animated.timing(damageFlash, { toValue: 0, duration: scaleDuration(700), useNativeDriver }),
        ]).start();
      }

      if (type === "poison_haze" && fx?.poisonHaze) {
        poisonOpacity.setValue(0);
        Animated.sequence([
          Animated.timing(poisonOpacity, { toValue: peak(1), duration: scaleDuration(450), useNativeDriver }),
          Animated.delay(260),
          Animated.timing(poisonOpacity, { toValue: 0, duration: scaleDuration(650), useNativeDriver }),
        ]).start();
      }
    };

    registerEffectTrigger(handle);
    return () => registerEffectTrigger(() => {});
  }, [effectsEnabled, fx, triggerLevelUpVisuals, triggerCritFailVisuals, bumpManualPreviewWindow]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (manualPreviewTimeoutRef.current) {
        clearTimeout(manualPreviewTimeoutRef.current);
      }
      critFailAnim.current?.stop();
    };
  }, []);

  if (!effectsEnabled) return null;

  // Interpolated opacity for poison haze vignette
  const poisonHazeOpacity = poisonOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  }).interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.08, 1],
    extrapolate: 'clamp',
  });

  const critFailRotate = critFailTilt.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-6deg", "6deg"],
    extrapolate: "clamp",
  });

  return (
    <>
    {/* Long Rest — rendered outside the pageOpacity wrapper so it always reaches full opacity */}
    {fx?.longRestFade && (
      <Animated.View
        style={[fill, { backgroundColor: "#000000", opacity: longRest, pointerEvents: "none" }]}
      />
    )}

    {(pageOpacity > 0 || manualPreviewActive) && (
    <View style={[fill, { pointerEvents: "none", opacity: manualPreviewActive ? 1 : pageOpacity }]}>

      {/* Deaths Door — fast deep-red strobe vignette */}
      {fx?.deathsDoor && (
        <VignetteLayer
          color="rgba(100,0,0,0.95)"
          colorTransparent="rgba(100,0,0,0)"
          opacity={deathPulse}
          thickness={20}
        />
      )}

      {/* Low HP — slower pulsing red vignette */}
      {fx?.lowHpGlow && (
        <VignetteLayer
          color="rgba(239,68,68,0.82)"
          colorTransparent="rgba(239,68,68,0)"
          opacity={lowHpPulse}
          thickness={17}
        />
      )}

      {/* Damage — whole-screen red flash (stays flat; it's intentionally jarring) */}
      {fx?.damageFlash && (
        <Animated.View
          style={[fill, { backgroundColor: "rgba(239,68,68,0.20)", opacity: damageFlash, pointerEvents: "none" }]}
        />
      )}

      {/* Heal — green vignette */}
      {fx?.healFlash && (
        <>
          <VignetteLayer
            color="rgba(16,185,129,0.92)"
            colorTransparent="rgba(16,185,129,0)"
            opacity={healFlash}
            thickness={16}
          />
          <DynamicParticles effectKey={healFlash} type="heal" />
        </>
      )}

      {/* Poison — green tint overlay + vignette */}
      {fx?.poisonHaze && (
        <>
          <VignetteLayer
            color="rgba(74,222,128,0.60)"
            colorTransparent="rgba(74,222,128,0)"
            opacity={poisonHazeOpacity}
            thickness={7}
          />
          <DynamicParticles effectKey={poisonOpacity} type="poison" />
        </>
      )}

      {/* Potion sparkle — purple tint + vignette */}
      {fx?.potionSparkle && (
        <>
          <Animated.View
            style={[fill, { backgroundColor: "rgba(139,92,246,0.13)", opacity: potionFlash, pointerEvents: "none" }]}
          />
          <VignetteLayer
            color="rgba(139,92,246,0.90)"
            colorTransparent="rgba(139,92,246,0)"
            opacity={potionFlash}
            thickness={16}
          />
        </>
      )}

      {/* Level Up — gold tint + vignette (confetti removed) */}
      {fx?.levelUpBurst && (
        <>
          <Animated.View
            style={[fill, { backgroundColor: "rgba(217,119,6,0.22)", opacity: levelBurst, pointerEvents: "none" }]}
          />
          <VignetteLayer
            color="rgba(250,189,0,0.95)"
            colorTransparent="rgba(250,189,0,0)"
            opacity={levelBurst}
            thickness={18}
          />
        </>
      )}

      {fx?.critFailBurst && critFailText && (
        <>
          <Animated.View
            style={[
              fill,
              {
                backgroundColor: critFailTone === "success" ? "rgba(217,119,6,0.18)" : "rgba(185,28,28,0.18)",
                opacity: critFailBurst,
                pointerEvents: "none",
              },
            ]}
          />
          <Animated.View
            style={[
              fill,
              {
                alignItems: "center",
                justifyContent: "center",
                opacity: critFailTextOpacity,
                transform: [{ scale: critFailTextScale }, { translateY: critFailLift }, { rotate: critFailRotate }],
              },
            ]}
          >
            <View style={styles.critFailContent}>
              <Text
                style={[
                  styles.critFailText,
                  {
                    color: critFailTone === "success" ? "#22C55E" : "#EF4444",
                    textShadowColor: critFailTone === "success" ? "rgba(5,46,22,0.98)" : "rgba(127,29,29,0.98)",
                  },
                ]}
              >
                {critFailText}
              </Text>
              {critFailTone === "fail" ? (
                <MaterialCommunityIcons
                  name="skull-crossbones"
                  size={56}
                  color="#FCA5A5"
                  style={styles.failSkull}
                />
              ) : null}
            </View>
          </Animated.View>
        </>
      )}

      {/* Long Rest — full black fade (intentional full-screen blackout) */}
      {/* Note: rendered outside this View — see above */}


    </View>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  critFailContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  critFailText: {
    fontSize: 86,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 16,
  },
  failSkull: {
    textShadowColor: "rgba(127,29,29,0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
});

/**
 * Helper component to regenerate particles on each animation trigger
 */
function DynamicParticles({ effectKey, type }: { effectKey: AnimatedValueType; type: "heal" | "poison" }) {
  const [particles, setParticles] = useState<any[]>([]);
  useEffect(() => {
    // When effectKey animates from 0 to 1, regenerate particles
    let listenerId: string | number | undefined;
    if (effectKey && typeof (effectKey as any).addListener === "function") {
      listenerId = (effectKey as any).addListener(({ value }: any) => {
        if (value > 0.95) {
          setParticles(generateParticles(type));
        }
      });
    }
    // Initial
    setParticles(generateParticles(type));
    return () => {
      if (effectKey && typeof (effectKey as any).removeListener === "function" && listenerId !== undefined) {
        (effectKey as any).removeListener(listenerId);
      }
    };
  }, [effectKey, type]);
  return <ParticleLayer particles={particles} progress={effectKey} />;
}

/**
 * Generate random particles for healing or poison effects
 */
function generateParticles(type: "heal" | "poison"): Particle[] {
  if (type === "heal") {
    return Array.from({ length: 18 }).map((_, idx) => {
      const edge = idx % 2 === 0 ? 0 : 95;
      return {
        key: `heal-sparkle-${idx}-${Math.random()}`,
        color: "rgba(16,185,129,0.85)",
        size: 4 + Math.random() * 3,
        shape: "circle",
        drift: (Math.random() - 0.5) * 20,
        startY: 10 + Math.random() * 80,
        endY: 10 + Math.random() * 80 + (Math.random() - 0.5) * 10,
        startX: edge,
        endX: edge + (edge === 0 ? 5 + Math.random() * 10 : -5 - Math.random() * 10),
      };
    });
  } else {
    return Array.from({ length: 14 }).map((_, idx) => {
      const edgeY = idx % 2 === 0 ? 0 : 95;
      return {
        key: `poison-bubble-${idx}-${Math.random()}`,
        color: "rgba(74,222,128,0.45)",
        size: 6 + Math.random() * 8,
        shape: "circle",
        drift: (Math.random() - 0.5) * 10,
        startY: edgeY,
        endY: edgeY + (edgeY === 0 ? 10 + Math.random() * 10 : -10 - Math.random() * 10),
        startX: 10 + Math.random() * 80,
        endX: 10 + Math.random() * 80 + (Math.random() - 0.5) * 10,
      };
    });
  }
}
