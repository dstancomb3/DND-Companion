import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { API_BASE_URL } from "@/utils/apiUrl";

const POLL_INTERVAL_MS = 30_000;
const TIMEOUT_MS = 4_000;

export function useNetworkStatus(): { isOnline: boolean } {
  // On web, navigator.onLine gives a reliable immediate signal.
  // On native, we fall back to an interval health-check against our own API.
  const [isOnline, setIsOnline] = useState(() => {
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      return navigator.onLine;
    }
    return true; // optimistic until first check
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      const handleOnline  = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online",  handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online",  handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    // Native: poll with a short timeout fetch
    async function check() {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const resp = await fetch(`${API_BASE_URL}/api/health`, {
          method: "HEAD",
          signal: controller.signal,
        });
        clearTimeout(id);
        setIsOnline(resp.ok || resp.status < 500);
      } catch {
        setIsOnline(false);
      }
    }

    check();
    timerRef.current = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current != null) clearInterval(timerRef.current);
    };
  }, []);

  return { isOnline };
}
