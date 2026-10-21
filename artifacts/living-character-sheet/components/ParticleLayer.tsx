import React from "react";
import { Animated } from "react-native";

export interface Particle {
  key: string;
  color: string;
  size: number;
  shape?: "rect" | "circle" | "star";
  drift: number;
  startY: number;
  endY: number;
  startX: number;
  endX: number;
  rotate?: number;
}

export function ParticleLayer({
  particles,
  progress,
}: {
  particles: Particle[];
  progress: Animated.Value | Animated.AnimatedInterpolation<number>;
}) {
  return (
    <>
      {particles.map((p, idx) => {
        const style: any = {
          position: "absolute",
          top: `${p.startY}%`,
          left: `${p.startX}%`,
          width: p.size,
          height: p.size,
          opacity: progress.interpolate({
            inputRange: [0, 0.08, 0.78, 1],
            outputRange: [0, 1, 0.9, 0],
          }),
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, p.endY],
              }),
            },
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, p.drift],
              }),
            },
            ...(p.rotate !== undefined
              ? [
                  {
                    rotate: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", `${p.rotate}deg`],
                    }),
                  },
                ]
              : []),
          ],
          backgroundColor: p.shape === "circle" ? undefined : p.color,
          borderRadius: p.shape === "circle" ? p.size / 2 : 2,
          pointerEvents: "none",
          zIndex: 100,
          borderWidth: 1,
          borderColor: "#fff",
        };
        return <Animated.View key={p.key} style={style} />;
      })}
    </>
  );
}
