import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultWorkspacePreferences, parseWorkspacePreferences, type WorkspacePreferences } from "../utils/adventure/workspaceLayoutPreferences";

export function useWorkspacePreferences(scope: string) {
  const key = `adventure-workspace.v1:${scope}`;
  const [state, setState] = useState({ key, ready: false, value: defaultWorkspacePreferences(), error: "" });
  const [reload, setReload] = useState(0);
  const current = useRef(state);
  const writeQueue = useRef(Promise.resolve());
  const sequence = useRef(0);
  useEffect(() => {
    let active = true;
    current.current = { key, ready: false, value: defaultWorkspacePreferences(), error: "" };
    setState(current.current);
    void AsyncStorage.getItem(key).then(raw => {
      if (!active) return;
      current.current = { key, ready: true, value: parseWorkspacePreferences(raw), error: "" };
      setState(current.current);
    }).catch(() => {
      if (!active) return;
      current.current = { key, ready: false, value: defaultWorkspacePreferences(), error: "Saved layout could not be loaded. Retry to recover your preferences." };
      setState(current.current);
    });
    return () => { active = false; if (current.current.key === key) current.current = { ...current.current, ready: false }; };
  }, [key, reload]);
  function update(change: (previous: WorkspacePreferences) => WorkspacePreferences) {
    if (!current.current.ready || current.current.key !== key) return;
    const value = change(current.current.value), operation = ++sequence.current;
    current.current = { key, ready: true, value, error: "" }; setState(current.current);
    // Serialize writes, so a slow earlier save cannot overwrite the latest layout.
    writeQueue.current = writeQueue.current.catch(() => {}).then(async () => {
      try { await AsyncStorage.setItem(key, JSON.stringify(value)); }
      catch {
        if (current.current.ready && current.current.key === key && operation === sequence.current) {
          current.current = { ...current.current, error: "Layout could not be saved. Your current view is still available; retry saving." };
          setState(current.current);
        }
      }
    });
  }
  return { preferences: state.key === key ? state.value : defaultWorkspacePreferences(), ready: state.key === key && state.ready,
    error: state.key === key ? state.error : "", update, retry: () => current.current.ready ? update(value => value) : setReload(previous => previous + 1) };
}
