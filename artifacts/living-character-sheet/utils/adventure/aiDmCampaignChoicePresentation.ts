export interface CampaignChoiceOption {
  id: string;
  rawChoice: string;
  label: string;
  detail?: string;
}

function stripChoicePrefix(choice: string): string {
  return choice
    .trim()
    .replace(/^([0-9]+|[A-Za-z])[\)\].:-]\s+/, "")
    .replace(/^[\-*]\s+/, "")
    .trim();
}

function splitChoiceLabelAndDetail(cleanedChoice: string): { label: string; detail?: string } {
  const dividerMatch = cleanedChoice.match(/\s[-|]\s|:\s/);
  if (!dividerMatch || dividerMatch.index === undefined || dividerMatch.index <= 0) {
    return { label: cleanedChoice };
  }

  const dividerIndex = dividerMatch.index;
  const dividerLength = dividerMatch[0].length;
  const label = cleanedChoice.slice(0, dividerIndex).trim();
  const detail = cleanedChoice.slice(dividerIndex + dividerLength).trim();
  if (!label) {
    return { label: cleanedChoice };
  }
  return detail ? { label, detail } : { label };
}

export function buildCampaignChoiceOptions(choices: string[]): CampaignChoiceOption[] {
  return choices
    .map((choice) => choice.trim())
    .filter((choice) => choice.length > 0)
    .map((choice, index) => {
      const cleaned = stripChoicePrefix(choice);
      const split = splitChoiceLabelAndDetail(cleaned);
      return {
        id: `choice-${index + 1}`,
        rawChoice: choice,
        label: split.label,
        detail: split.detail,
      };
    });
}
