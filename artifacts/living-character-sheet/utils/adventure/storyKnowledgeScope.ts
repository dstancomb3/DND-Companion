/** Narrative world information is scoped independently from lasting character progression. */
export type StoryKnowledgeScope =
  | { kind: "character"; characterId: string }
  | { kind: "one_off"; characterId: string; sessionId: string }
  | { kind: "campaign"; characterId: string; campaignId: string };

export type StoryKnowledgeCategory = "notes" | "people" | "quests" | "planes" | "locations";

export function storyKnowledgeScopeKey(scope: StoryKnowledgeScope): string {
  const safe = (value: string) => {
    if (!value || value.length > 128 || !/^[A-Za-z0-9_-]+$/.test(value))
      throw new Error("Invalid story knowledge scope identifier");
    return value;
  };
  switch (scope.kind) {
    case "character": return `character:${safe(scope.characterId)}`;
    case "one_off": return `one_off:${safe(scope.characterId)}:${safe(scope.sessionId)}`;
    case "campaign": return `campaign:${safe(scope.characterId)}:${safe(scope.campaignId)}`;
  }
}

/** Applies to all five categories and their linked references. */
export function canUseKnowledgeInAdventure(
  entryScope: StoryKnowledgeScope,
  activeScope: StoryKnowledgeScope,
): boolean {
  return storyKnowledgeScopeKey(entryScope) === storyKnowledgeScopeKey(activeScope);
}
