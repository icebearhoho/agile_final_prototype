import type { SbfasApplication, SbfasStatus } from "../../../data/sbfasApplications";
// applyDecision now lives in the data layer so the session store can record decisions without importing UI code.
export { applyDecision, type Action, type Draft } from "../../../data/sbfasApplications";

/** Pending first, then highest risk score first. Does not mutate. */
export function sortQueue(apps: SbfasApplication[]): SbfasApplication[] {
  const pending = (a: SbfasApplication) => (a.status === "Pending" ? 0 : 1);
  return [...apps].sort((a, b) => pending(a) - pending(b) || b.riskScore - a.riskScore);
}

/** A decided application counts as granted when SBFAS was approved or overridden to a tier, declined when rejected. */
export const isGranted = (a: Pick<SbfasApplication, "status">) => a.status === "Approved" || a.status === "Overridden";
export const isDeclined = (a: Pick<SbfasApplication, "status">) => a.status === "Rejected";

/** Status chip vocabulary, kept in sync with the queue tabs: Pending / Granted / Declined ("Not applied" stays). */
export const statusLabel = (s: SbfasStatus | "Not applied"): "Pending" | "Granted" | "Declined" | "Not applied" =>
  s === "Approved" || s === "Overridden" ? "Granted" : s === "Rejected" ? "Declined" : s;
