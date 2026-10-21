// Loader for bundled rules data in Expo/React Native runtime.
// Node built-ins like fs/path are unavailable in native bundles, so data must be statically imported.

const RULES_DATA: Record<string, unknown> = {
  "classProgressions.json": require("../data/classProgressions.json"),
};

export function loadRules(file: string): any {
  return (RULES_DATA[file] ?? {}) as any;
}