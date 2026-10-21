export const AI_DM_CONFIRMATION_POLICY_KEYS = [
  "read_only",
  "safe_auto_apply",
  "confirm_party_mutation",
  "confirm_high_impact",
  "deny_unsupported",
] as const;

export type AiDmConfirmationPolicyKey = (typeof AI_DM_CONFIRMATION_POLICY_KEYS)[number];

export const AI_DM_APPROVAL_SCOPES = [
  "none",
  "character_sheet",
  "party_member",
  "party_inventory",
  "combat_state",
  "quest_notes_world",
] as const;

export type AiDmApprovalScope = (typeof AI_DM_APPROVAL_SCOPES)[number];

export const AI_DM_POLICY_ENFORCEMENT_MODES = [
  "auto_apply",
  "confirm_required",
  "deny_by_default",
  "unsupported",
] as const;

export type AiDmPolicyEnforcementMode = (typeof AI_DM_POLICY_ENFORCEMENT_MODES)[number];

export interface AiDmConfirmationPolicy {
  key: AiDmConfirmationPolicyKey;
  approvalScope: AiDmApprovalScope;
  enforcementMode: AiDmPolicyEnforcementMode;
  denyByDefault?: boolean;
  unsupported?: boolean;
  description?: string;
}

export const AI_DM_BASE_CONFIRMATION_POLICIES: Record<AiDmConfirmationPolicyKey, AiDmConfirmationPolicy> = {
  read_only: {
    key: "read_only",
    approvalScope: "none",
    enforcementMode: "auto_apply",
    description: "Read and summarize state only.",
  },
  safe_auto_apply: {
    key: "safe_auto_apply",
    approvalScope: "character_sheet",
    enforcementMode: "auto_apply",
    description: "Auto-apply bounded safe updates within local authority.",
  },
  confirm_party_mutation: {
    key: "confirm_party_mutation",
    approvalScope: "party_member",
    enforcementMode: "confirm_required",
    description: "Require confirmation before mutating party-level state.",
  },
  confirm_high_impact: {
    key: "confirm_high_impact",
    approvalScope: "combat_state",
    enforcementMode: "confirm_required",
    description: "Require confirmation for high-impact or irreversible actions.",
  },
  deny_unsupported: {
    key: "deny_unsupported",
    approvalScope: "none",
    enforcementMode: "unsupported",
    denyByDefault: true,
    unsupported: true,
    description: "Reject unsupported actions by default.",
  },
};
