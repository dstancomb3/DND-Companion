export function shouldAutoCreateOneOffParty(input: {
  hasSavedConversation: boolean;
  hasActivePartySession: boolean;
  launchedAsNewOneOff: boolean;
}): boolean {
  // Previously played sessions must never silently replace the authoritative
  // party whose pending rolls and combat state they may still depend upon.
  if (input.hasSavedConversation) return false;
  return input.launchedAsNewOneOff || !input.hasActivePartySession;
}
