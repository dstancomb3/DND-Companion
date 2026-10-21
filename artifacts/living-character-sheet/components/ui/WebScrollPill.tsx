import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useColors } from "@/hooks/useColors";

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3
    ? clean.split("").map((ch) => ch + ch).join("")
    : clean;

  if (normalized.length !== 6) return `rgba(124, 58, 237, ${alpha})`;

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(124, 58, 237, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function WebScrollPill() {
  const { accentHex } = useAppSettings();
  const c = useColors();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const styleId = "lcs-web-scrollbar-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        html, body, * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        html::-webkit-scrollbar, body::-webkit-scrollbar, *::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none;
        }
      `;
      document.head.appendChild(style);
    }

    let lastTop = 0;
    let lastMotionAt = 0;

    const getBestScrollMetrics = () => {
      const doc = document.documentElement;
      const windowTop = window.scrollY || doc.scrollTop || 0;
      const windowMax = Math.max(0, doc.scrollHeight - window.innerHeight);

      let bestTop = windowTop;
      let bestMax = windowMax;

      const candidates = document.querySelectorAll("div");
      for (const node of Array.from(candidates)) {
        const el = node as HTMLElement;
        const max = el.scrollHeight - el.clientHeight;
        if (max <= bestMax || max <= 0) continue;
        const style = window.getComputedStyle(el);
        if (style.overflowY === "hidden") continue;
        bestTop = el.scrollTop;
        bestMax = max;
      }

      return { top: bestTop, max: bestMax };
    };

    const tick = () => {
      const { top, max } = getBestScrollMetrics();
      const now = Date.now();

      if (max <= 0) {
        setProgress(0);
        setVisible(false);
        lastTop = 0;
        return;
      }

      setProgress(Math.max(0, Math.min(1, top / max)));

      if (Math.abs(top - lastTop) > 1) {
        lastMotionAt = now;
        setVisible(true);
      } else if (now - lastMotionAt > 900) {
        setVisible(false);
      }

      lastTop = top;
    };

    tick();
    const interval = window.setInterval(tick, 120);
    window.addEventListener("resize", tick);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", tick);
    };
  }, []);

  if (Platform.OS !== "web") return null;

  return (
    <View testID="web-scroll-pill-track" style={[styles.track, !visible && styles.trackHidden, { pointerEvents: "none", borderRadius: c.radiusPill }]}> 
      <View
        testID="web-scroll-pill-thumb"
        style={[styles.pill, { top: `${progress * 76}%`, backgroundColor: hexToRgba(accentHex, 0.72), borderRadius: c.radiusLg }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: "absolute",
    right: 10,
    top: 96,
    bottom: 110,
    width: 10,
    justifyContent: "flex-start",
    backgroundColor: "rgba(148, 163, 184, 0.08)",
    zIndex: 9999,
    opacity: 1,
  },
  trackHidden: {
    opacity: 0,
  },
  pill: {
    position: "absolute",
    left: 1,
    width: 8,
    height: 52,
  },
});