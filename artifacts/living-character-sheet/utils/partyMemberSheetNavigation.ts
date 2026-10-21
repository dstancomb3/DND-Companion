import type { PartyMemberSummary } from "./partyApi";

export type PartyMemberSheetSource = "party" | "dm-party";

export function buildPartyMemberSheetPath(memberId: string, source: PartyMemberSheetSource): string {
  const normalizedMemberId = memberId.trim();
  const params = new URLSearchParams({
    memberId: normalizedMemberId,
    source,
  });
  return `/party-member?${params.toString()}`;
}

export function normalizeMemberIdParam(memberIdParam: string | string[] | undefined): string | null {
  const value = Array.isArray(memberIdParam) ? memberIdParam[0] : memberIdParam;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolvePartyMemberForSheet(
  members: PartyMemberSummary[],
  memberIdParam: string | string[] | undefined
): PartyMemberSummary | null {
  const normalizedMemberId = normalizeMemberIdParam(memberIdParam);
  if (!normalizedMemberId) return null;
  return members.find((member) => member.id === normalizedMemberId) ?? null;
}
