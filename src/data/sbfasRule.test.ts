import { describe, expect, it } from "vitest";
import {
  activateSbfasRule, defaultSbfasRule, draftOfSbfasRule, entryTierOf, nextSbfasRuleId, ruleForSchool, sbfasRuleOk,
  tierSubsidy, toSbfasRule, validateSbfasRule, SEED_RULES, type SbfasRule, type SbfasRuleDraft,
} from "./sbfasRule";

const mk = (name = "SBFAS 2026 — Standard package", rates = ["100", "75", "50", "25"], id = "SBFASR26100001", school = "S001"): SbfasRule =>
  toSbfasRule({ tiers: rates.map((rate) => ({ basis: "percent" as const, rate })) }, school, id, name);

describe("SBFAS school rule: defaults and lookup", () => {
  it("the default package mirrors the national reference rates, all percent", () => {
    const rule = defaultSbfasRule("S001");
    expect(rule.tiers.map((t) => t.rate)).toEqual([100, 75, 50, 25]);
    expect(rule.tiers.every((t) => (t.basis ?? "percent") === "percent")).toBe(true);
  });

  it("the Active version is in effect; drafts and inactive versions never decide anything", () => {
    const active = { ...mk(), status: "Active" as const };
    const draft = mk("2027 — Proposed", ["90"], "SBFASR26100002");
    const inactive = { ...mk("2025 — Previous", ["100"], "SBFASR25100001"), status: "Inactive" as const };
    const rules: Record<string, SbfasRule[]> = { S001: [inactive, active, draft] };
    expect(ruleForSchool(rules, "S001")).toBe(active);
  });

  it("falls back to the default package until the school activates a rule of its own", () => {
    expect(ruleForSchool({}, "S002").tiers[0].rate).toBe(100);
    const onlyDraft = { S002: [mk("Draft only", ["90"], "SBFASR26100001", "S002")] };
    expect(ruleForSchool(onlyDraft, "S002").name).toBe("Default package");
    expect(ruleForSchool({ S002: [mk()] }, "S001").tiers[0].rate).toBe(100); // other schools untouched
  });

  it("tierSubsidy reads the tier as saved — percent or a fixed amount", () => {
    const rule = toSbfasRule({ tiers: [{ basis: "percent", rate: "80" }, { basis: "percent", rate: "60" }, { basis: "fixed", rate: "20" }] }, "S001", "SBFASR26100001", "R");
    expect(tierSubsidy(rule, "Tier 1")).toEqual({ basis: "percent", value: 80 });
    expect(tierSubsidy(rule, "Tier 3")).toEqual({ basis: "fixed", value: 20 });
    expect(tierSubsidy(rule, "Tier 9")).toBeUndefined(); // tier the school removed
  });

  it("the school decides how many tiers exist — names follow position", () => {
    const rule = mk("Five ranks", ["100", "50", "25", "10", "20"]);
    expect(rule.tiers.map((t) => t.tier)).toEqual(["Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5"]);
    expect(rule.tiers[4]).toEqual({ tier: "Tier 5", basis: "percent", rate: 20 });
  });
});

describe("SBFAS school rule: validation", () => {
  const ok: SbfasRuleDraft = { tiers: [{ basis: "percent", rate: "80" }, { basis: "percent", rate: "60" }, { basis: "percent", rate: "55" }, { basis: "percent", rate: "50" }] };

  it("accepts a complete package", () => {
    expect(sbfasRuleOk(validateSbfasRule(ok))).toBe(true);
  });

  it("rejects out-of-range percent rates, and non-numeric or 3-decimal values", () => {
    expect(validateSbfasRule({ tiers: ok.tiers.map((t, i) => (i === 1 ? { ...t, rate: "150" } : t)) }).rows[1]).toBeTruthy();
    expect(validateSbfasRule({ tiers: ok.tiers.map((t, i) => (i === 2 ? { ...t, rate: "abc" } : t)) }).rows[2]).toBeTruthy();
    expect(validateSbfasRule({ tiers: ok.tiers.map((t, i) => (i === 2 ? { ...t, rate: "1.234" } : t)) }).rows[2]).toBeTruthy();
  });

  it("a fixed tier takes an amount, not a rate — amounts may exceed 100", () => {
    const fixed = ok.tiers.map((t, i) => (i === 1 ? { ...t, basis: "fixed" as const, rate: "150" } : t));
    expect(sbfasRuleOk(validateSbfasRule({ tiers: fixed }))).toBe(true); // S$150 off a fee is fine
    expect(validateSbfasRule({ tiers: ok.tiers.map((t, i) => (i === 1 ? { ...t, basis: "fixed" as const, rate: "-5" } : t)) }).rows[1]).toBeTruthy();
  });

  it("the school must keep at least one tier", () => {
    expect(validateSbfasRule({ tiers: [] }).tiers).toBe("Keep at least one rank.");
  });

  it("draftOfSbfasRule round-trips a saved rule", () => {
    const rule = toSbfasRule({ tiers: [{ basis: "fixed", rate: "80" }, { basis: "percent", rate: "60" }, { basis: "percent", rate: "55" }, { basis: "percent", rate: "50" }] }, "S001", "SBFASR26100001", "R");
    expect(draftOfSbfasRule(rule).tiers[0]).toEqual({ basis: "fixed", rate: "80" });
    expect(rule.tiers.map((t) => t.tier)).toEqual(["Tier 1", "Tier 2", "Tier 3", "Tier 4"]);
  });
});

describe("SBFAS starting rank", () => {
  it("a school with the default package starts at Tier 3; a shorter package starts at its last rank", () => {
    expect(entryTierOf(defaultSbfasRule("S001"))).toBe("Tier 3");
    const two = mk("Two ranks", ["100", "50"]);
    expect(entryTierOf(two)).toBe("Tier 2");
  });
});

describe("SBFAS rule versions: one Active at a time", () => {
  it("activating makes exactly one rule Active and demotes the previous Active to Inactive", () => {
    const a = { ...mk(), status: "Active" as const };
    const b = mk("2027 — Proposed", ["90"], "SBFASR26100002");
    const out = activateSbfasRule([a, b], b.id);
    expect(out.find((r) => r.id === b.id)!.status).toBe("Active");
    expect(out.find((r) => r.id === a.id)!.status).toBe("Inactive");
    expect(out.filter((r) => r.status === "Active")).toHaveLength(1);
  });

  it("nextSbfasRuleId continues the SBFASR + YYMM sequence within the month", () => {
    const now = new Date("2026-10-20T09:00:00+08:00");
    expect(nextSbfasRuleId(SEED_RULES.S001, now)).toBe("SBFASR26100003"); // seeds end at 26100002
    expect(nextSbfasRuleId([], now)).toBe("SBFASR26100001");              // fresh month starts at 0001
  });

  it("the seed gives the demo school a full lifecycle: replaced, active and draft versions", () => {
    expect(SEED_RULES.S001.map((r) => r.status)).toEqual(["Inactive", "Active", "Draft"]);
  });
});
