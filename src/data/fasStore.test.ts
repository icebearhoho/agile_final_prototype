import { describe, expect, it } from "vitest";
import { MOEFAS_TIER_AMOUNT, SBFAS, SBFAS_BY_TIER, SBFAS_TIER_AMOUNT } from "./budgets";
import { FAMILY_STUDENT_NAMES } from "./parent";
import { STUDENTS } from "./students";
import { fasReducer, initialFasState, selectBudgets, selectChildFas, selectMoefas, selectRecentGrants, selectSbfas } from "./fasStore";

const first = (s = initialFasState()) => s.apps[0]; // SBFAS0001, recommended Tier 1
const approveAt = (s: ReturnType<typeof initialFasState>, id: string, at: string) =>
  fasReducer(s, { type: "decide", id, action: "approve", draft: { justification: "", tier: "Tier 1" }, at });
const approve = (s = initialFasState()) => approveAt(s, first(s).id, "2026-10-18T09:00:00.000Z");

describe("SBFAS stats follow real decisions", () => {
  it("starts at the seeded baseline", () => {
    const s = selectSbfas(initialFasState());
    expect(s).toMatchObject({ budget: SBFAS.budget, used: SBFAS.absorbed, remaining: SBFAS.budget - SBFAS.absorbed });
    expect(s.helped).toBe(SBFAS_BY_TIER.reduce((t, x) => t + x.value, 0));
  });

  it("approving an application adds its tier amount and one student helped", () => {
    const s = selectSbfas(approve());
    expect(s.used).toBe(SBFAS.absorbed + (SBFAS_TIER_AMOUNT["Tier 1"] ?? 0));
    expect(s.helped).toBe(148 + 1);
    expect(s.byTier.find((t) => t.label === "Tier 1")!.value).toBe(52 + 1);
  });

  it("rejecting adds nothing", () => {
    const s0 = initialFasState();
    const s = fasReducer(s0, { type: "decide", id: first(s0).id, action: "reject", draft: { justification: "", tier: "Tier 1" }, at: "2026-10-18T09:00:00.000Z" });
    expect(selectSbfas(s).used).toBe(SBFAS.absorbed);
  });

  it("a grant is still recorded when the budget is already exceeded", () => {
    let s = fasReducer(initialFasState(), { type: "setBudget", scope: "SBFAS", target: "SBFAS", amount: 1000, by: "A", at: "2026-10-18" });
    s = approve(s);
    expect(first(s).status).toBe("Approved");
    expect(selectSbfas(s).remaining).toBeLessThan(0);
  });
});

describe("setBudget", () => {
  it("changes the SBFAS budget and keeps old value, new value, user and date", () => {
    const s = fasReducer(initialFasState(), { type: "setBudget", scope: "SBFAS", target: "SBFAS", amount: 150000, by: "Alicia Tan", at: "2026-10-18" });
    expect(selectSbfas(s).budget).toBe(150000);
    expect(s.history).toEqual([expect.objectContaining({ scope: "SBFAS", from: SBFAS.budget, to: 150000, by: "Alicia Tan", at: "2026-10-18" })]);
  });

  it("changes one MOEFAS level only and totals follow", () => {
    const before = selectMoefas(initialFasState());
    const s = fasReducer(initialFasState(), { type: "setBudget", scope: "MOEFAS", target: "Primary", amount: 21_000_000, by: "Daniel Lim", at: "2026-10-18" });
    const after = selectMoefas(s);
    expect(after.levels.find((l) => l.id === "Primary")!.budget).toBe(21_000_000);
    expect(after.levels.find((l) => l.id === "Secondary")!.budget).toBe(before.levels.find((l) => l.id === "Secondary")!.budget);
    expect(after.budget).toBe(before.budget + 1_000_000);
    expect(s.history[0]).toMatchObject({ scope: "MOEFAS", target: "Primary", from: 20_000_000, to: 21_000_000 });
  });

  it("newest change is first in the history", () => {
    let s = fasReducer(initialFasState(), { type: "setBudget", scope: "SBFAS", target: "SBFAS", amount: 1, by: "A", at: "d1" });
    s = fasReducer(s, { type: "setBudget", scope: "SBFAS", target: "SBFAS", amount: 2, by: "A", at: "d2" });
    expect(s.history.map((h) => h.to)).toEqual([2, 1]);
  });
});

it("selectBudgets feeds the dashboard card in the same shape as before", () => {
  const [moefas, sbfas] = selectBudgets(initialFasState());
  expect(moefas).toMatchObject({ name: "MOEFAS", owner: "MOE HQ", budget: 38_000_000 });
  expect(sbfas).toMatchObject({ name: "SBFAS", owner: "School", used: SBFAS.absorbed, budget: SBFAS.budget });
});

describe("recent grants", () => {
  it("is empty until something is granted", () => {
    expect(selectRecentGrants(initialFasState())).toEqual([]);
  });

  it("lists granted applications newest first with tier, amount and date", () => {
    const s0 = initialFasState();
    let s = approveAt(s0, s0.apps[0].id, "2026-10-18T09:00:00.000Z");
    s = approveAt(s, s0.apps[1].id, "2026-10-18T10:30:00.000Z");
    const out = selectRecentGrants(s);
    expect(out.map((g) => g.id)).toEqual([s0.apps[1].id, s0.apps[0].id]);
    expect(out[0]).toMatchObject({ student: s0.apps[1].student, tier: "Tier 1", amount: SBFAS_TIER_AMOUNT["Tier 1"], at: "2026-10-18T10:30:00.000Z" });
  });

  it("leaves out rejected and pending applications", () => {
    const s0 = initialFasState();
    const s = fasReducer(s0, { type: "decide", id: s0.apps[0].id, action: "reject", draft: { justification: "", tier: "Tier 1" }, at: "2026-10-18T09:00:00.000Z" });
    expect(selectRecentGrants(s)).toEqual([]);
  });

  it("shows at most the limit", () => {
    const s0 = initialFasState();
    const s = s0.apps.slice(0, 4).reduce((acc, a, i) => approveAt(acc, a.id, `2026-10-18T0${i}:00:00.000Z`), s0);
    expect(selectRecentGrants(s, 3)).toHaveLength(3);
  });
});

it("MOEFAS students helped by tier add up to the students helped total", () => {
  const m = selectMoefas(initialFasState());
  expect(m.byTier.reduce((t, x) => t + x.value, 0)).toBe(m.helped);
  expect(m.byTier.map((t) => t.label)).toEqual(["Tier 1", "Tier 2", "Tier 3", "Tier 4"]);
});

describe("a family application from the parent portal", () => {
  const [ethan, chloe] = FAMILY_STUDENT_NAMES.map((n) => STUDENTS.find((s) => s.name === n)!);
  const ids = [ethan.id, chloe.id];
  const at = "2026-10-18T09:00:00.000Z";
  const submit = (tier: "MOEFAS Tier 1" | "MOEFAS Tier 2" | "SBFAS" | null, s = initialFasState()) =>
    fasReducer(s, { type: "submitFamily", studentIds: ids, band: { id: "bx", label: "$751 - $1,000 per person", tier }, at });

  it("an application starts at the rank the school's rule passes, not a hard-coded Tier 3", () => {
    const start = { [ethan.id]: "Tier 2" as const };
    const s = fasReducer(initialFasState(), { type: "submitFamily", studentIds: [ethan.id], band: { id: "b3", label: "x", tier: "SBFAS" }, at, start });
    expect(s.apps.find((a) => a.studentId === ethan.id)!.recommendedTier).toBe("Tier 2");
  });

  it("a MOEFAS band grants MOEFAS straight away for every child", () => {
    const s = submit("MOEFAS Tier 2");
    expect(s.moefas[ethan.id]).toEqual({ tier: "Tier 2", at });
    expect(s.moefas[chloe.id].tier).toBe("Tier 2");
    expect(s.apps).toHaveLength(initialFasState().apps.length);
  });

  it("MOEFAS grants count in the HQ budget: amount, students helped and the child's level", () => {
    const before = selectMoefas(initialFasState());
    const after = selectMoefas(submit("MOEFAS Tier 2"));
    expect(after.used).toBe(before.used + 2 * (MOEFAS_TIER_AMOUNT["Tier 2"] ?? 0));
    expect(after.helped).toBe(before.helped + 2);
    expect(after.levels.find((l) => l.id === "Primary")!.beneficiaries).toBe(before.levels.find((l) => l.id === "Primary")!.beneficiaries + 1);
    expect(after.levels.find((l) => l.id === "Secondary")!.used).toBe(before.levels.find((l) => l.id === "Secondary")!.used + (MOEFAS_TIER_AMOUNT["Tier 2"] ?? 0));
    expect(after.byTier.find((t) => t.label === "Tier 2")!.value).toBe(before.byTier.find((t) => t.label === "Tier 2")!.value + 2);
  });

  it("an SBFAS band puts one pending application per child in the school's queue", () => {
    const s = submit("SBFAS");
    const added = s.apps.slice(initialFasState().apps.length);
    expect(added.map((a) => a.studentId)).toEqual(ids);
    expect(added.every((a) => a.status === "Pending" && a.incomeBand === "$751 - $1,000 per person")).toBe(true);
    expect(new Set(s.apps.map((a) => a.id)).size).toBe(s.apps.length);
    expect(Object.keys(s.moefas)).toHaveLength(0);
  });

  it("an SBFAS band arrives as a MOE referral with the MyInfo sync date", () => {
    const s = submit("SBFAS");
    const added = s.apps.find((a) => a.studentId === ethan.id)!;
    expect(added.source).toBe("MOE referral");
    expect(added.incomeSyncedOn).toBe(at.slice(0, 10));
  });

  it("a band above both schemes changes nothing", () => {
    expect(submit(null)).toEqual(initialFasState());
  });

  it("submitting again does not duplicate applications or grants", () => {
    expect(submit("SBFAS", submit("SBFAS"))).toEqual(submit("SBFAS"));
    expect(submit("MOEFAS Tier 1", submit("MOEFAS Tier 1"))).toEqual(submit("MOEFAS Tier 1"));
  });

  it("each child's outcome follows the school's decision", () => {
    expect(selectChildFas(initialFasState(), ethan.id)).toBeNull();
    expect(selectChildFas(submit("MOEFAS Tier 1"), ethan.id)).toEqual({ scheme: "MOEFAS", status: "Granted", tier: "Tier 1" });
    const s = submit("SBFAS");
    expect(selectChildFas(s, ethan.id)).toEqual({ scheme: "SBFAS", status: "Awaiting school decision" });
    const appId = s.apps.find((a) => a.studentId === ethan.id)!.id;
    const ok = fasReducer(s, { type: "decide", id: appId, action: "approve", draft: { justification: "", tier: "Tier 3" }, at });
    expect(selectChildFas(ok, ethan.id)).toEqual({ scheme: "SBFAS", status: "Granted", tier: "Tier 3" });
    const no = fasReducer(s, { type: "decide", id: appId, action: "reject", draft: { justification: "Income above range", tier: "Tier 1" }, at });
    expect(selectChildFas(no, ethan.id)).toEqual({ scheme: "SBFAS", status: "Not granted", reason: "Income above range" });
  });
});

describe("a paper (hardcopy) application entered at the school", () => {
  const [ethan] = FAMILY_STUDENT_NAMES.map((n) => STUDENTS.find((s) => s.name === n)!);
  const at = "2026-10-20T14:00:00.000Z";
  const enter = (studentId: string, s = initialFasState(), start?: "Tier 2") =>
    fasReducer(s, {
      type: "addHardcopy", studentId, incomeBand: "S$701 - S$1,000", householdBand: "S$2,501 - S$4,000",
      note: " handed in at the office ", by: "Alicia Tan", at, start,
    });

  it("creates one pending Hardcopy application with the entered bands and no MyInfo sync", () => {
    const s = enter(ethan.id, initialFasState(), "Tier 2");
    const added = s.apps[s.apps.length - 1];
    expect(added).toMatchObject({
      studentId: ethan.id, level: ethan.level, source: "Hardcopy", status: "Pending",
      incomeBand: "S$701 - S$1,000", householdBand: "S$2,501 - S$4,000",
      riskScore: 50, recommendedTier: "Tier 2", slaDays: 10,
    });
    expect(added.id).toBe("SBFAS0019"); // continues from the highest seed (SBFAS0018)
    expect(added.incomeSyncedOn).toBeUndefined();
    expect(added.explanation).toContain("Alicia Tan");
    expect(added.explanation).toContain("handed in at the office"); // the form note is trimmed into the text
    expect(Object.keys(s.moefas)).toHaveLength(0); // paper never grants MOEFAS
  });

  it("starts at Tier 3 when no starting rank is passed", () => {
    const s = enter(ethan.id, initialFasState(), undefined);
    expect(s.apps[s.apps.length - 1].recommendedTier).toBe("Tier 3");
  });

  it("never duplicates: a student in the queue, or granted MOEFAS, cannot be entered again", () => {
    const once = enter(ethan.id);
    expect(enter(ethan.id, once)).toEqual(once);
    const seeded = initialFasState().apps[0].studentId;
    expect(enter(seeded)).toEqual(initialFasState());
    const granted = fasReducer(initialFasState(), { type: "submitFamily", studentIds: [ethan.id], band: { id: "b1", label: "x", tier: "MOEFAS Tier 1" }, at });
    expect(enter(ethan.id, granted)).toEqual(granted);
  });
});
