import type { SbfasApplication, SbfasStatus, SbfasTier } from "../../../data/sbfasApplications";

export type Action = "approve" | "override" | "reject";
export type Draft = { justification: string; tier: SbfasTier };
export type DecisionError = { field: "justification" | "tier"; message: string };

const STATUS: Record<Action, SbfasStatus> = { approve: "Approved", override: "Overridden", reject: "Rejected" };

/** Pending first, then highest risk score first. Does not mutate. */
export function sortQueue(apps: SbfasApplication[]): SbfasApplication[] {
  const pending = (a: SbfasApplication) => (a.status === "Pending" ? 0 : 1);
  return [...apps].sort((a, b) => pending(a) - pending(b) || b.riskScore - a.riskScore);
}

/** A decided application counts as granted when SBFAS was approved or overridden to a tier, declined when rejected. */
export const isGranted = (a: Pick<SbfasApplication, "status">) => a.status === "Approved" || a.status === "Overridden";
export const isDeclined = (a: Pick<SbfasApplication, "status">) => a.status === "Rejected";

/** Review Focus 3: an override needs a non-blank justification and a tier different from the recommendation. */
export function validateDecision(action: Action, draft: Draft, recommended: SbfasTier): DecisionError | null {
  if (action !== "override") return null;
  if (!draft.justification.trim()) return { field: "justification", message: "Enter a justification to override the AI recommendation." };
  if (draft.tier === recommended) return { field: "tier", message: "Choose a tier different from the recommendation, or approve instead." };
  return null;
}

export function applyDecision(apps: SbfasApplication[], id: string, action: Action, draft: Draft): SbfasApplication[] {
  return apps.map((a) =>
    a.id !== id
      ? a
      : {
          ...a,
          status: STATUS[action],
          sbfasTier: action === "reject" ? undefined : action === "override" ? draft.tier : a.recommendedTier,
          justification: draft.justification.trim() || undefined,
        },
  );
}
