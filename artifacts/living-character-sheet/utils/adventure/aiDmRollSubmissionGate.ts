/** Prevent rapid taps from submitting the same roll twice before React rerenders. */
export function createRollSubmissionGate() {
  const active = new Set<string>();
  return {
    begin(id: string): boolean {
      if (!id || active.has(id)) return false;
      active.add(id);
      return true;
    },
    end(id: string): void { active.delete(id); },
  };
}
