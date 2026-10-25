// School-defined SBFAS rule (Requirement 4, school side): each school decides how many tiers it offers
// and each tier's subsidy — a percentage of the fee or a fixed S$ amount — from its own internal funds.
// MOE never configures this — contrast with the HQ-managed MOEFAS rules.
//
// Rules are VERSIONS with a status, exactly like HQ's FAS rules: only one is Active at a time, activating
// one makes the previous Active rule Inactive, and old versions stay as history. No band-to-rank mapping:
// every application enters the queue at a neutral starting rank and the school decides the rank case by case.
import { TODAY } from "../lib/fees";
import { SBFAS_TIERS, SBFAS_TIER_RATES, type SbfasTier } from "./sbfasApplications";

/** What a tier's `rate` means: a percentage of each fee, or a fixed S$ amount off each fee. */
export type SubsidyBasis = "percent" | "fixed";
/** One fee-component override: its own basis (a % of the component or a fixed S$ amount) and rate. */
export type ComponentOverride = { basis: SubsidyBasis; rate: number };
export type ComponentRates = Record<string, ComponentOverride>;
export type SbfasRuleTier = { tier: SbfasTier; basis?: SubsidyBasis; rate: number; components?: ComponentRates };
/** Version statuses, the same lifecycle as HQ's FAS rules: Draft → Active → Inactive. */
export type SbfasRuleStatus = "Active" | "Inactive" | "Draft";

export type SbfasRule = {
  id: string;
  name: string;
  status: SbfasRuleStatus;
  school: string;
  updated: string;
  tiers: SbfasRuleTier[];
  /** Fee components the school subsidises (picked per fee type); undefined = every component of its fee types. */
  coveredComponents?: string[];
};

// ASSUMPTION: default package mirrors the national reference (75/65/55/50); schools adjust from here.
// It is the implicit rule until the school activates its own version.
export const defaultSbfasRule = (school: string, updated = "2026-09-01"): SbfasRule => ({
  id: "SBFASR-DEFAULT",
  name: "Default package",
  status: "Active",
  school,
  updated,
  tiers: SBFAS_TIERS.map((t) => ({ tier: t, basis: "percent", rate: Math.round((SBFAS_TIER_RATES[t] ?? 0) * 100) })),
});

/**
 * The school's rule in effect: its Active version, or the default package until the school activates one.
 * Drafts and Inactive versions never decide anything.
 */
export const ruleForSchool = (rules: Record<string, SbfasRule[]>, school: string): SbfasRule =>
  (rules[school] ?? []).find((r) => r.status === "Active") ?? defaultSbfasRule(school);

/** Only one rule is Active: activating one makes the previous Active rule Inactive (same as HQ's rules). */
export const activateSbfasRule = (versions: SbfasRule[], id: string): SbfasRule[] =>
  versions.map((r) => ({ ...r, status: r.id === id ? "Active" : r.status === "Active" ? "Inactive" : r.status }));

/** SBFASR + YYMM (Singapore) + 4-digit sequence within the month — mirrors HQ's FASR rule IDs. */
export function nextSbfasRuleId(versions: SbfasRule[], now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", year: "2-digit", month: "2-digit" }).formatToParts(now);
  const prefix = "SBFASR" + p.find((x) => x.type === "year")!.value + p.find((x) => x.type === "month")!.value;
  const n = Math.max(0, ...versions.filter((r) => r.id.startsWith(prefix)).map((r) => Number(r.id.slice(-4)))) + 1;
  if (n > 9999) throw new Error("Monthly rule ID limit reached.");
  return prefix + String(n).padStart(4, "0");
}

/**
 * The rank a new application starts from — Tier 3 when the school offers it, else its last rank — never a
 * rank the school does not have. The school decides the final rank case by case.
 */
export function entryTierOf(rule: SbfasRule): SbfasTier {
  return (rule.tiers.find((t) => t.tier === "Tier 3") ?? rule.tiers[rule.tiers.length - 1]).tier;
}

/**
 * Subsidy definition of one tier as saved: a percent of the fee (0–100) or a fixed S$ amount. Undefined
 * when the rule has no such tier (e.g. a decision referencing a tier the school later removed).
 */
export function tierSubsidy(rule: SbfasRule, tier: SbfasTier): { basis: SubsidyBasis; value: number } | undefined {
  const t = rule.tiers.find((x) => x.tier === tier);
  return t ? { basis: t.basis ?? "percent", value: t.rate } : undefined;
}

/**
 * Human summary of a tier's subsidy across fee components — "75%" when uniform (or no per-component rates),
 * a "50–100%" range when components differ. `covered` restricts the summary to the components the school
 * picked for subsidising; undefined = every component with a rate.
 */
export function subsidySummary(
  t: { basis?: SubsidyBasis; rate?: number; components?: ComponentRates },
  covered?: string[],
): string {
  const entries = t.components && Object.keys(t.components).length ? Object.entries(t.components) : [];
  const basis = t.basis ?? "percent";
  // Sparse overrides in the tier's own unit join the flat rate in the summary; other-basis overrides have no common unit.
  let vals = (covered ? entries.filter(([n]) => covered.includes(n)) : entries)
    .map(([, o]) => (o.basis === basis ? o.rate : NaN))
    .filter((v) => Number.isFinite(v));
  if (t.rate != null) vals.push(t.rate);
  if (!vals.length) return "";
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  if (lo === hi) return t.basis === "fixed" ? `S$${lo}` : `${lo}%`;
  return t.basis === "fixed" ? `S$${lo}–${hi}` : `${lo}–${hi}%`;
}

/** SBFAS tiers are RANKS on screen — never "Tier N", which is the MOE income-band vocabulary. */
export const rankOf = (t: SbfasTier | null | undefined) => (t ? `Rank ${String(t).replace(/\D/g, "")}` : "");

/** Editing state; rates stay strings until save. */
export type SbfasRuleDraft = {
  tiers: { basis: SubsidyBasis; rate: string; components?: Record<string, { basis: SubsidyBasis; rate: string }> }[];
  coveredComponents?: string[];
};
export type SbfasRuleErrors = { tiers?: string; components?: string; rows: Record<number, string> };

/** Draft of a saved rule; per-component rates default to the tier's flat rate for any component it does not set. */
export const draftOfSbfasRule = (rule: SbfasRule): SbfasRuleDraft => ({
  tiers: rule.tiers.map((t) => ({
    basis: t.basis ?? "percent",
    rate: String(t.rate),
    ...(t.components && Object.keys(t.components).length
      ? { components: Object.fromEntries(Object.entries(t.components).map(([n, o]) => [n, { basis: o.basis, rate: String(o.rate) }])) }
      : {}),
  })),
});

/**
 * Each tier needs a valid value for its basis — a rate of 0–100 (max 2 decimals) when percent, an amount
 * of at least 0 (max 2 decimals) when fixed — for the flat rate and every per-component rate. The school
 * must keep at least one tier.
 */
export function validateSbfasRule(d: SbfasRuleDraft): SbfasRuleErrors {
  const errors: SbfasRuleErrors = { rows: {} };
  const valid = (v: string, basis: SubsidyBasis) => {
    const re = basis === "fixed" ? /^\d{1,6}(\.\d{1,2})?$/ : /^\d{1,3}(\.\d{1,2})?$/;
    return re.test(v.trim()) && Number(v) >= 0 && (basis === "fixed" || Number(v) <= 100);
  };
  d.tiers.forEach((t, i) => {
    const bad = !valid(t.rate, t.basis) || Object.values(t.components ?? {}).some((o) => !valid(o.rate, o.basis));
    if (bad) {
      errors.rows[i] = t.basis === "fixed"
        ? "Enter an amount of at least 0 (max 2 decimals) for every component."
        : "Enter a rate between 0 and 100 (max 2 decimals) for every component.";
    }
  });
  if (!d.tiers.length) errors.tiers = "Keep at least one rank.";
  if (d.coveredComponents && !d.coveredComponents.length) errors.components = "Select at least one fee component.";
  return errors;
}

export const sbfasRuleOk = (e: SbfasRuleErrors) =>
  !e.tiers && !e.components && !Object.keys(e.rows).length;

/** A draft version; the caller sets the final status (activating swaps it through the store). */
export function toSbfasRule(d: SbfasRuleDraft, school: string, id: string, name: string, updated = TODAY): SbfasRule {
  return {
    id,
    name,
    school,
    updated,
    status: "Draft",
    tiers: d.tiers.map((t, i) => ({
      tier: `Tier ${i + 1}` as SbfasTier,
      basis: t.basis,
      rate: Number(t.rate),
      ...(t.components && Object.keys(t.components).length
        ? { components: Object.fromEntries(Object.entries(t.components).map(([n, o]) => [n, { basis: o.basis, rate: Number(o.rate) }])) }
        : {}),
    })),
    ...(d.coveredComponents ? { coveredComponents: d.coveredComponents } : {}),
  };
}

const seedVersion = (id: string, name: string, status: SbfasRuleStatus, rates: number[], updated: string): SbfasRule => ({
  id, name, status, school: "S001", updated,
  tiers: rates.map((rate, i) => ({ tier: `Tier ${i + 1}` as SbfasTier, basis: "percent" as const, rate })),
});

/** Demo history for the signed-in school, like HQ's rule seed: the 2025 package it replaced, the Active
 * 2026 package, and a 2027 draft it is preparing. */
export const SEED_RULES: Record<string, SbfasRule[]> = {
  S001: [
    seedVersion("SBFASR25100001", "SBFAS 2025 — Previous package", "Inactive", [100, 75, 50], "2025-10-01"),
    seedVersion("SBFASR26100001", "SBFAS 2026 — Standard package", "Active", [100, 75, 50, 25], "2026-09-01"),
    seedVersion("SBFASR26100002", "SBFAS 2027 — Proposed package", "Draft", [100, 80, 60, 40, 20], "2026-10-15"),
  ],
};
