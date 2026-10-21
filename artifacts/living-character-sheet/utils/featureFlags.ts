/**
 * Feature Flags
 *
 * Runtime developer/advanced toggles for progressive rollout of new systems.
 *
 * Important A2 decision:
 * - These flags remain dev-only and intentionally separate from AppSettings.
 * - AppSettings are user-facing and stored in AsyncStorage.
 * - Feature flags are localStorage overrides for development/testing workflows.
 */

/**
 * Feature flag definitions and defaults
 */
const DEFAULT_FLAGS: Record<string, boolean> = {
  // Rules engine v1: data-driven rule evaluation
  rulesEngineV1: false,

  // Companion runtime entities: first-class summons/familiars
  companionRuntimeV1: false,

  // Explainability layer: inspect derived value sources
  explainabilityV1: false,

  // Homebrew schema editor: custom content authoring
  homebrewEditorV1: false,

  // Build planner: non-destructive simulation
  buildPlannerV1: false,

  // Durable snapshots: named checkpoints and restore
  snapshotsV1: false,

  // Structured exports: versioned portability
  exportsV1: false,
};

type FeatureFlagName = keyof typeof DEFAULT_FLAGS;

/**
 * Get feature flag status
 * Order: localStorage override > hardcoded default
 */
export function getFeatureFlag(name: FeatureFlagName): boolean {
  // First check localStorage for dev overrides
  try {
    const stored = localStorage?.getItem(`feature_flag_${name}`);
    if (stored !== null) {
      return stored === "true";
    }
  } catch {
    // localStorage not available (e.g., SSR)
  }

  // Return hardcoded default
  return DEFAULT_FLAGS[name] ?? false;
}

/**
 * Override a feature flag at runtime (dev/testing only)
 */
export function setFeatureFlag(name: FeatureFlagName, enabled: boolean): void {
  try {
    if (enabled) {
      localStorage?.setItem(`feature_flag_${name}`, "true");
    } else {
      localStorage?.removeItem(`feature_flag_${name}`);
    }
  } catch {
    // localStorage not available
  }
}

/**
 * Get all feature flags
 */
export function getAllFeatureFlags(): Record<FeatureFlagName, boolean> {
  const flags: Record<FeatureFlagName, boolean> = {} as Record<FeatureFlagName, boolean>;
  
  (Object.keys(DEFAULT_FLAGS) as FeatureFlagName[]).forEach((flagName) => {
    flags[flagName] = getFeatureFlag(flagName);
  });
  
  return flags;
}

/**
 * Reset all feature flags to defaults
 */
export function resetFeatureFlags(): void {
  try {
    (Object.keys(DEFAULT_FLAGS) as FeatureFlagName[]).forEach((flagName) => {
      localStorage?.removeItem(`feature_flag_${flagName}`);
    });
  } catch {
    // localStorage not available
  }
}

/**
 * Hook for React: useFeatureFlag
 * Designed for use in React components
 */
export function createUseFeatureFlagHook() {
  return function useFeatureFlag(name: FeatureFlagName): boolean {
    // In a real implementation, this would be a React hook with state
    // For now, just delegate to getFeatureFlag
    // React components should re-render when flag changes, but for simplicity
    // we return the current value and rely on manual toggle in dev tools
    return getFeatureFlag(name);
  };
}

/**
 * Pre-made hook instance
 */
export const useFeatureFlag = createUseFeatureFlagHook();

/**
 * Console utilities for dev debugging
 */
export function initFeatureFlagDevTools(): void {
  if (typeof window !== "undefined" && typeof (window as any).__DEBUG__ === "object") {
    (window as any).__DEBUG__.featureFlags = {
      get: getAllFeatureFlags,
      set: setFeatureFlag,
      reset: resetFeatureFlags,
      list: () => Object.keys(DEFAULT_FLAGS),
    };
    console.log("[FeatureFlags] Dev tools available at window.__DEBUG__.featureFlags");
  }
}
