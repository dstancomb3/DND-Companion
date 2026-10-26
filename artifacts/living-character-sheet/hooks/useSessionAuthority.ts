import { useEffect, useState } from "react";
import { hasLocalPartyHostCapability } from "@/utils/partyApi";
import { projectSessionAuthority, type HostCapabilityStatus, type SessionMode } from "@/utils/adventure/sessionWorkspace";

export function useSessionAuthority(mode: SessionMode, partyCode: string | null) {
  const [checked, setChecked] = useState<{ code: string; status: HostCapabilityStatus } | null>(null);
  useEffect(() => {
    let active = true;
    setChecked(null);
    if (partyCode) {
      void hasLocalPartyHostCapability(partyCode).then(present => {
        if (active) setChecked({ code: partyCode, status: present ? "present" : "absent" });
      }).catch(() => {
        if (active) setChecked({ code: partyCode, status: "absent" });
      });
    }
    return () => { active = false; };
  }, [partyCode]);
  // Bind the result to its party even before the effect runs on a party switch.
  return projectSessionAuthority({
    mode, connected: Boolean(partyCode),
    hostCapability: checked?.code === partyCode ? checked.status : "checking",
  });
}
