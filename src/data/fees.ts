import type { Level } from "./students";

export type FeeComponent = { name: string; amount: number };
/** A school-defined fee: a named bundle of components, optionally for one level. `school` is the school code. */
export type FeeType = { id: string; school: string; name: string; level?: Level; scope?: "Primary" | "Secondary"; components: FeeComponent[]; updated: string };
/** `school` of MOE-wide master fee types (HQ catalogue). */
export const MASTER = "MOE";

export type ChargeStatus = "outstanding" | "overdue" | "paid";
export type ChargeComponent = FeeComponent & { subsidy?: number };
/** Fee assistance scheme applied to a charge. A student receives at most one: MOEFAS takes precedence over SBFAS. */
export type FasScheme = "MOEFAS" | "SBFAS";
/** Money a parent paid against one charge, and where it came from. */
export type PayMethod = "Education account" | "Card / PayNow";
export type Payment = { id: string; on: string; amount: number; method: PayMethod };
/**
 * One fee issued to one student — no term: the charge carries its own issued/due dates and its whole
 * money story (components + FAS subsidy + parent payments). Status is derived, never stored
 * (see lib/fees.chargeStatus): paid when payments cover the payable, overdue when past due unpaid.
 */
export type Charge = {
  id: string; studentId: string; ftId: string; title: string;
  issued: string; due: string; components: ChargeComponent[]; fas?: FasScheme; payments: Payment[];
};

/** Default payment window when a charge is generated (no term to derive it from). */
export const DEFAULT_DUE_DAYS = 30;

// ASSUMPTION: invented fee types and amounts (mock data). Schools define their own; HQ views them read-only.
export const FEE_TYPES: FeeType[] = [
  { id: "FT-01", school: "S001", name: "School Fees (Secondary)", updated: "2026-09-28", components: [{ name: "Miscellaneous", amount: 13 }, { name: "Learning Materials", amount: 55 }, { name: "Enrichment", amount: 65 }, { name: "Student Insurance", amount: 8 }] },
  { id: "FT-02", school: "S002", name: "School Fees (Primary)", updated: "2026-09-28", components: [{ name: "Miscellaneous", amount: 10 }, { name: "Learning Materials", amount: 45 }, { name: "Student Insurance", amount: 8 }] },
  { id: "FT-03", school: "S001", name: "Supplementary Fees", level: "Sec 1", updated: "2026-08-20", components: [{ name: "Co-curricular Attire", amount: 70 }, { name: "Camp Fee", amount: 50 }] },
  { id: "MFT-01", school: MASTER, name: "School Fees (Primary)", scope: "Primary", updated: "2026-09-01", components: [{ name: "Tuition Fee", amount: 250 }, { name: "Miscellaneous Fee", amount: 40 }, { name: "Examination Fee", amount: 30 }] },
  { id: "MFT-02", school: MASTER, name: "School Fees (Secondary)", scope: "Secondary", updated: "2026-09-01", components: [{ name: "Tuition Fee", amount: 280 }, { name: "Miscellaneous Fee", amount: 50 }, { name: "Examination Fee", amount: 45 }] },
  { id: "MFT-03", school: MASTER, name: "Supplementary / Enrichment Programme", updated: "2026-09-01", components: [{ name: "Math Enrichment", amount: 60 }, { name: "Materials", amount: 25 }, { name: "Co-curricular Attire", amount: 70 }, { name: "Camp Fee", amount: 50 }] },
  { id: "MFT-04", school: MASTER, name: "Skills Programme", scope: "Secondary", updated: "2026-09-01", components: [{ name: "Miscellaneous Fee", amount: 25 }, { name: "Skills Programme", amount: 15 }] },
];
