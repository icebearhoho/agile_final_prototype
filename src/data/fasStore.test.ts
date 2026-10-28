import { describe, expect, it } from "vitest";
import { MOEFAS_TIER_AMOUNT, SBFAS, SBFAS_BY_TIER, SBFAS_TIER_AMOUNT } from "./budgets";
import type { FamilyDraft } from "./familyApplications";
import type { Band } from "./familyFas";
import { FAMILY_STUDENT_NAMES } from "./parent";
import { STUDENTS } from "./students";
import { fasReducer, initialFasState, latestAppFor, selectBudgets, selectChildFas, selectMoefas, selectRecentGrants, selectSbfas } from "./fasStore";
import { yearOf } from "./sbfasApplications";

const first = (s = initialFasState()) => s.apps[0]; // SBFAS0001, recommended Tier 1
const approveAt = (s: ReturnType<typeof initialFasState>, id: string, at: string) =>
  fasReducer(s, { type: "decide", id, action: "approve", draft: { justification: "", tier: "Tier 1" }, at });
const approve = (s = initialFasState()) => approveAt(s, first(s).id, "2026-10-18T09:00:00.000Z");

describe("SBFAS stats follow real decisions", () => {
  it("starts at the seeded baseline", () => {
    const s = selectSbfas(initialFasState());
    expect(s).toMatchObject({ budget: SBFAS.budget, used: SBFAS.absorbed, remaining: SBFAS.budget - SBFAS.absorbed });
    expect(s.helped).toBe(SBFAS_BY_TIER.reduce((t, x) => t + x.byClass.reduce((a, b) => a + b, 0), 0));
    expect(s.byTier.reduce((t, x) => t + x.value, 0)).toBe(s.helped);
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

  it("an unmapped band falls back to a tier the school offers, not a hard-coded Tier 3", () => {
    const recommend = { [ethan.id]: { level: null, tier: null, fallback: "Tier 2" as const } };
    const s = fasReducer(initialFasState(), { type: "submitFamily", studentIds: [ethan.id], band: { id: "b3", label: "x", tier: "SBFAS" }, at, recommend });
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

describe("a hardcopy application entered at the school (Requirement 5)", () => {
  const [ethan, chloe] = FAMILY_STUDENT_NAMES.map((n) => STUDENTS.find((s) => s.name === n)!);
  const at = "2026-10-20T09:00:00.000Z";
  const band = (tier: "MOEFAS Tier 1" | "MOEFAS Tier 2" | "SBFAS" | null) => ({ id: "b3", label: "$1,001 - $1,500 per person", tier });
  const paper = (tier: "MOEFAS Tier 1" | "MOEFAS Tier 2" | "SBFAS" | null, s = initialFasState(), studentIds = [ethan.id, chloe.id]) =>
    fasReducer(s, { type: "submitHardcopy", studentIds, band: band(tier), school: "Riverbank Primary School", applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "ocr", at });

  it("a MOEFAS band on the paper form grants MOEFAS for every child and records the family application", () => {
    const s = paper("MOEFAS Tier 1");
    expect(s.moefas[ethan.id]).toEqual({ tier: "Tier 1", at });
    expect(s.moefas[chloe.id].tier).toBe("Tier 1");
    expect(s.apps).toHaveLength(initialFasState().apps.length);
    expect(s.familyApps).toHaveLength(1);
    expect(s.familyApps[0]).toMatchObject({ id: "FAS20260011", channel: "Hardcopy", school: "Riverbank Primary School", entryMode: "ocr" });
    expect(s.familyApps[0].children.map((c) => c.outcome)).toEqual(["MOEFAS granted", "MOEFAS granted"]);
  });

  it("a band outside MOEFAS refers every child to the school's SBFAS queue as a MOE referral linked to the form", () => {
    const s = paper("SBFAS");
    const added = s.apps.slice(initialFasState().apps.length);
    expect(added.map((a) => a.studentId)).toEqual([ethan.id, chloe.id]);
    expect(added.every((a) => a.source === "MOE referral" && a.familyAppId === "FAS20260011" && a.enteredBy === "Alicia Tan" && a.status === "Pending")).toBe(true);
    expect(s.familyApps[0].children.every((c) => c.outcome === "MOEFAS not granted")).toBe(true);
  });

  it("consecutive paper records number FAS20260011, FAS20260012 — the year prefix is not folded into the sequence", () => {
    const first = paper("SBFAS", initialFasState(), [ethan.id]);
    const second = paper("SBFAS", first, [chloe.id]);
    expect(second.familyApps.map((f) => f.id)).toEqual(["FAS20260012", "FAS20260011"]);
  });

  it("ASSUMPTION (AC-024-02): a paper form in the band above both schemes still reaches the school queue", () => {
    const s = paper(null);
    expect(s.apps).toHaveLength(initialFasState().apps.length + 2); // both children referred down, nothing vanishes
    expect(s.familyApps[0].children.every((c) => c.outcome === "MOEFAS not granted")).toBe(true);
  });

  it("a student that already has an application — paper or online — is skipped, not duplicated (AC-031)", () => {
    const online = fasReducer(initialFasState(), { type: "submitFamily", studentIds: [ethan.id], band: band("SBFAS"), at });
    const s = paper("SBFAS", online, [ethan.id, chloe.id]);
    expect(s.apps.filter((a) => a.studentId === ethan.id)).toHaveLength(1);
    expect(s.apps.filter((a) => a.studentId === chloe.id)).toHaveLength(1);
    // The school user transcribes the form as the parent filled it: the covered child STAYS on the
    // paper record, marked covered, instead of being silently dropped from the form's content.
    expect(s.familyApps[0].children.map((c) => [c.studentId, c.outcome])).toEqual([
      [ethan.id, "Already covered"],
      [chloe.id, "MOEFAS not granted"],
    ]);
  });

  it("a form whose every child is already covered creates nothing (AC-031)", () => {
    const online = fasReducer(initialFasState(), { type: "submitFamily", studentIds: [ethan.id], band: band("SBFAS"), at });
    const s = paper("SBFAS", online, [ethan.id]);
    expect(s).toBe(online); // no family record, no queue entry — nothing new to submit
  });

  it("submitting the same paper form twice changes nothing the second time", () => {
    expect(paper("SBFAS", paper("SBFAS"))).toEqual(paper("SBFAS"));
  });

  it("records the six-section form detail on the paper application", () => {
    const s = fasReducer(initialFasState(), {
      type: "submitHardcopy", studentIds: [ethan.id], band: band("SBFAS"), school: "Riverbank Primary School",
      applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "ocr", at,
      address: "Blk 315 Ang Mo Kio Ave 3", email: "benson.chua@example.com", transportMode: "Public transport",
      hasAdminIncome: true, household: [{ name: "Benson Chua", nric: "S1234567D", relationship: "Father", age: 44, occupation: "Employed", gross: 2100, other: 150 }],
      declaredAt: "2026-10-24",
    });
    expect(s.familyApps[0]).toMatchObject({
      address: "Blk 315 Ang Mo Kio Ave 3", email: "benson.chua@example.com", transportMode: "Public transport",
      hasAdminIncome: true, declaredAt: "2026-10-24",
    });
    expect(s.familyApps[0].household).toEqual([
      { name: "Benson Chua", nric: "S1234567D", relationship: "Father", age: 44, occupation: "Employed", gross: 2100, other: 150 },
    ]);
  });

  it("keeps the welfare home letter (PDF + its OCR reading) on the record", () => {
    const s = fasReducer(initialFasState(), {
      type: "submitHardcopy", studentIds: [ethan.id], band: band("SBFAS"), school: "Riverbank Primary School",
      applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "manual", at,
      welfareHome: true, welfareLetter: { file: "sunbeam-letter.pdf", home: "Sunbeam Welfare Home", dated: "30 Sep 2026" },
    });
    expect(s.familyApps[0].welfareHome).toBe(true);
    expect(s.familyApps[0].welfareLetter).toEqual({ file: "sunbeam-letter.pdf", home: "Sunbeam Welfare Home", dated: "30 Sep 2026" });
  });

  it("keeps the scanned form the school uploaded, so MOE can open it", () => {
    const s = fasReducer(initialFasState(), {
      type: "submitHardcopy", studentIds: [ethan.id], band: band("SBFAS"), school: "Riverbank Primary School",
      applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "ocr", at, formFile: "MOE-FAS-form-chua-signed.pdf",
    });
    expect(s.familyApps[0].formFile).toBe("MOE-FAS-form-chua-signed.pdf");
  });

  it("records the employment-only declaration — no table, bands from HOMES", () => {
    const s = fasReducer(initialFasState(), {
      type: "submitHardcopy", studentIds: [ethan.id], band: band("SBFAS"), school: "Riverbank Primary School",
      applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "manual", at,
      homesOnly: true,
    });
    expect(s.familyApps[0].homesOnly).toBe(true);
    expect(s.familyApps[0].hasAdminIncome).toBeUndefined();
    expect(s.familyApps[0].household).toBeUndefined();
  });

  it("records Section V's request for an IMDA DigitalAccess@Home hard copy", () => {
    const s = fasReducer(initialFasState(), {
      type: "submitHardcopy", studentIds: [ethan.id], band: band("SBFAS"), school: "Riverbank Primary School",
      applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "manual", at,
      imdaHardcopy: "yes",
    });
    expect(s.familyApps[0].imdaHardcopy).toBe("yes");
  });
});

describe("a parent re-request after a rejection (one application, round log)", () => {
  const [ethan] = FAMILY_STUDENT_NAMES.map((n) => STUDENTS.find((s) => s.name === n)!);
  const at = "2026-10-20T09:00:00.000Z";
  const band: Band = { id: "b3", label: "$751 - $1,000 per person", tier: "SBFAS" };
  const appIdOf = (s: ReturnType<typeof initialFasState>) => s.apps.find((a) => a.studentId === ethan.id)!.id;
  // Start from an online submission, then have the school reject it.
  const rejected = () => {
    const s0 = fasReducer(initialFasState(), { type: "submitFamily", studentIds: [ethan.id], band, at });
    return fasReducer(s0, { type: "decide", id: appIdOf(s0), action: "reject", draft: { justification: "Income above range", tier: "Tier 1" }, at });
  };
  const requeue = (s: ReturnType<typeof initialFasState>, reason = "Parent stopped working", by = "Alicia Tan") =>
    fasReducer(s, { type: "requeueSbfas", studentId: ethan.id, reason, by, at });

  it("a re-request requeues the SAME application — round 2, Pending again, reason logged, no second record", () => {
    const s = requeue(rejected());
    const mine = s.apps.filter((a) => a.studentId === ethan.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ status: "Pending", attemptNo: 2 });
    expect(mine[0].rounds).toHaveLength(2);
    expect(mine[0].rounds![0].decision).toMatchObject({ status: "Rejected", justification: "Income above range" });
    expect(mine[0].rounds![1]).toMatchObject({ note: "Parent stopped working", by: "Alicia Tan" });
  });

  it("is refused while the application is pending, without a reason, and after a grant", () => {
    const pending = fasReducer(initialFasState(), { type: "submitFamily", studentIds: [ethan.id], band, at });
    expect(requeue(pending)).toEqual(pending);
    const s = rejected();
    expect(requeue(s, "   ")).toEqual(s);
    const granted0 = fasReducer(initialFasState(), { type: "submitFamily", studentIds: [ethan.id], band, at });
    const granted = fasReducer(granted0, { type: "decide", id: appIdOf(granted0), action: "approve", draft: { justification: "", tier: "Tier 3" }, at });
    expect(requeue(granted)).toEqual(granted);
  });

  it("after round 2 is rejected, round 3 follows the same rule — the record just counts up", () => {
    let s = requeue(rejected());
    s = fasReducer(s, { type: "decide", id: appIdOf(s), action: "reject", draft: { justification: "Still above range", tier: "Tier 1" }, at });
    s = requeue(s, "Rent went up");
    const a = s.apps.find((x) => x.studentId === ethan.id)!;
    expect(s.apps.filter((x) => x.studentId === ethan.id)).toHaveLength(1);
    expect(a).toMatchObject({ status: "Pending", attemptNo: 3 });
    expect(a.rounds).toHaveLength(3);
    expect(a.rounds![1].decision).toMatchObject({ status: "Rejected", justification: "Still above range" });
  });

  it("the child's outcome reads the live record, so a re-request puts them back to awaiting", () => {
    expect(selectChildFas(rejected(), ethan.id)).toMatchObject({ status: "Not granted" });
    expect(selectChildFas(requeue(rejected()), ethan.id)).toEqual({ scheme: "SBFAS", status: "Awaiting school decision" });
  });

  it("deciding logs the decision on the round that is open", () => {
    const s0 = fasReducer(initialFasState(), { type: "submitFamily", studentIds: [ethan.id], band, at });
    const s = fasReducer(s0, { type: "decide", id: appIdOf(s0), action: "approve", draft: { justification: "", tier: "Tier 3" }, at });
    const a = s.apps.find((x) => x.studentId === ethan.id)!;
    expect(a.rounds).toHaveLength(1);
    expect(a.rounds![0].decision).toMatchObject({ status: "Approved", tier: "Tier 3", at });
    expect(a.decidedAt).toBe(at);
  });
});

describe("applications log per year (FAS runs per year)", () => {
  const [ethan] = FAMILY_STUDENT_NAMES.map((n) => STUDENTS.find((s) => s.name === n)!);
  const y26 = "2026-10-20T09:00:00.000Z";
  const y27 = "2027-03-02T09:00:00.000Z";
  const band: Band = { id: "b3", label: "$751 - $1,000 per person", tier: "SBFAS" };
  const submitAt = (s: ReturnType<typeof initialFasState>, at: string) =>
    fasReducer(s, { type: "submitFamily", studentIds: [ethan.id], band, at });
  const idIn = (s: ReturnType<typeof initialFasState>, yr: number) =>
    s.apps.find((a) => a.studentId === ethan.id && yearOf(a) === yr)!.id;

  it("the same child files a NEW application next year — last year's record does not block it", () => {
    let s = submitAt(initialFasState(), y26);
    s = fasReducer(s, { type: "decide", id: idIn(s, 2026), action: "approve", draft: { justification: "", tier: "Tier 3" }, at: y26 });
    s = submitAt(s, y27);
    const mine = s.apps.filter((a) => a.studentId === ethan.id);
    expect(mine).toHaveLength(2);
    expect(mine.map((a) => yearOf(a)).sort()).toEqual([2026, 2027]);
    // the live outcome reads the NEWEST year's application — this year is awaiting again
    expect(selectChildFas(s, ethan.id)).toMatchObject({ scheme: "SBFAS", status: "Awaiting school decision" });
    expect(latestAppFor(s.apps, ethan.id)!.year).toBe(2027);
  });

  it("within one year the duplicate guard still holds (AC-031, per year)", () => {
    const s = submitAt(initialFasState(), y26);
    const again = fasReducer(s, { type: "submitFamily", studentIds: [ethan.id], band, at: "2026-11-01T09:00:00.000Z" });
    expect(again.apps.filter((a) => a.studentId === ethan.id)).toHaveLength(1);
  });

  it("a decision change never crosses years — only this year's rejection requeues", () => {
    let s = submitAt(initialFasState(), y26);
    s = fasReducer(s, { type: "decide", id: idIn(s, 2026), action: "reject", draft: { justification: "Income above range", tier: "Tier 1" }, at: y26 });
    s = submitAt(s, y27);
    // 2027 has no rejection yet (its application is pending): a re-request is refused
    expect(fasReducer(s, { type: "requeueSbfas", studentId: ethan.id, reason: "x", by: "Alicia Tan", at: y27 })).toBe(s);
    // decide 2027, reject it, requeue: only the 2027 record requeues — 2026 stays rejected as history
    s = fasReducer(s, { type: "decide", id: idIn(s, 2027), action: "reject", draft: { justification: "Still above range", tier: "Tier 1" }, at: y27 });
    s = fasReducer(s, { type: "requeueSbfas", studentId: ethan.id, reason: "Parent stopped working", by: "Alicia Tan", at: y27 });
    expect(s.apps.find((a) => a.id === idIn(s, 2026))).toMatchObject({ status: "Rejected" });
    expect(s.apps.find((a) => a.id === idIn(s, 2027))).toMatchObject({ status: "Pending", attemptNo: 2 });
  });
});

describe("issue-form drafts (Sprint 3: print first, key in the returned copy)", () => {
  const [ethan] = FAMILY_STUDENT_NAMES.map((n) => STUDENTS.find((s) => s.name === n)!);
  const at = "2026-10-26T09:00:00.000Z";
  const draft = (id: string): FamilyDraft => ({
    id, status: "draft", guardianNric: "S1234567D", applicant: "Benson Chua", contact: "+65 8112 9743",
    address: "Blk 315 Ang Mo Kio Ave 3, #07-221, Singapore 560315",
    children: [{ studentId: "S20260009", name: "Ethan Lim Jun Hao", nric: "T1504644E", school: "Riverbank Primary School", level: "P5" }],
    issuedAt: "2026-10-26", issuedBy: "Marcus Ong",
  });
  const band: Band = { id: "b3", label: "$1,001 - $1,500 per person", tier: "SBFAS" };

  it("issuing a form records it as a draft the returned copy is checked against", () => {
    const s = fasReducer(initialFasState(), { type: "issueDraft", draft: draft("DRF-0001") });
    expect(s.drafts).toHaveLength(1);
    expect(s.drafts[0]).toMatchObject({ id: "DRF-0001", status: "draft", applicant: "Benson Chua" });
  });

  it("the same draft id is not recorded twice, but a second family gets its own row", () => {
    let s = initialFasState();
    s = fasReducer(s, { type: "issueDraft", draft: draft("DRF-0001") });
    s = fasReducer(s, { type: "issueDraft", draft: draft("DRF-0001") });
    expect(s.drafts).toHaveLength(1);
    s = fasReducer(s, { type: "issueDraft", draft: draft("DRF-0002") });
    expect(s.drafts).toHaveLength(2);
  });

  it("voiding removes the draft and touches nothing else", () => {
    let s = fasReducer(initialFasState(), { type: "issueDraft", draft: draft("DRF-0001") });
    s = fasReducer(s, { type: "voidDraft", id: "DRF-0001" });
    expect(s.drafts).toHaveLength(0);
    expect(s.apps).toBe(initialFasState().apps);
  });

  it("keying in the returned copy flips its draft to returned and links the application it became", () => {
    let s = initialFasState();
    s = fasReducer(s, { type: "issueDraft", draft: draft("DRF-0001") });
    // The NRIC is keyed differently cased on the way in — the match is tolerant, like the lookup.
    s = fasReducer(s, {
      type: "submitHardcopy", studentIds: [ethan.id], band, school: "Riverbank Primary School",
      applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "manual",
      at, guardianNric: "s1234567d",
    });
    expect(s.drafts[0]).toMatchObject({ status: "returned", returnedAppId: s.familyApps[0].id, returnedAt: "2026-10-26" });
  });

  it("a submission whose family has no draft on file leaves the register untouched", () => {
    let s = initialFasState();
    s = fasReducer(s, { type: "issueDraft", draft: draft("DRF-0001") });
    const before = s.drafts;
    s = fasReducer(s, {
      type: "submitHardcopy", studentIds: [ethan.id], band, school: "Riverbank Primary School",
      applicant: "Someone Else", contact: "+65 9000 0000", note: "", by: "Alicia Tan", entryMode: "manual", at,
    });
    expect(s.drafts).toBe(before);
  });

  it("a family's second issue closes only the latest open draft — the lost first copy stays on the register", () => {
    let s = initialFasState();
    s = fasReducer(s, { type: "issueDraft", draft: draft("DRF-0001") });
    s = fasReducer(s, { type: "issueDraft", draft: { ...draft("DRF-0002"), issuedAt: "2026-10-27" } });
    s = fasReducer(s, {
      type: "submitHardcopy", studentIds: [ethan.id], band, school: "Riverbank Primary School",
      applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "manual",
      at: "2026-10-28T09:00:00.000Z", guardianNric: "S1234567D",
    });
    expect(s.drafts.find((d) => d.id === "DRF-0002")!.status).toBe("returned");
    expect(s.drafts.find((d) => d.id === "DRF-0001")!.status).toBe("draft");
  });

  it("keying in by the printed DRF no. closes exactly that draft, not the newer re-issue", () => {
    let s = initialFasState();
    s = fasReducer(s, { type: "issueDraft", draft: draft("DRF-0001") });
    s = fasReducer(s, { type: "issueDraft", draft: { ...draft("DRF-0002"), issuedAt: "2026-10-27" } });
    // The parent returns the FIRST copy (the second was printed because the first looked lost).
    s = fasReducer(s, {
      type: "submitHardcopy", studentIds: [ethan.id], band, school: "Riverbank Primary School",
      applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "manual",
      at: "2026-10-28T09:00:00.000Z", guardianNric: "S1234567D", draftId: "DRF-0001",
    });
    expect(s.drafts.find((d) => d.id === "DRF-0001")!.status).toBe("returned");
    expect(s.drafts.find((d) => d.id === "DRF-0001")!.returnedAppId).toBe(s.familyApps[0].id);
    expect(s.drafts.find((d) => d.id === "DRF-0002")!.status).toBe("draft");
  });

  it("documents the parent brought in are kept on the family application, each list under its Section II declaration", () => {
    let s = initialFasState();
    s = fasReducer(s, { type: "issueDraft", draft: draft("DRF-0001") });
    s = fasReducer(s, {
      type: "submitHardcopy", studentIds: [ethan.id], band, school: "Riverbank Primary School",
      applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "manual",
      at, guardianNric: "S1234567D", draftId: "DRF-0001",
      extraIncomeDocs: ["Payslip_Sep_2026.pdf"], residentsDocs: ["Tenancy_agreement_Oct2026.pdf"],
    });
    expect(s.familyApps[0].extraIncomeDocs).toEqual(["Payslip_Sep_2026.pdf"]);
    expect(s.familyApps[0].residentsDocs).toEqual(["Tenancy_agreement_Oct2026.pdf"]);
  });

  it("a No on the contact question stores the corrected details and marks them corrected", () => {
    let s = initialFasState();
    s = fasReducer(s, { type: "issueDraft", draft: draft("DRF-0001") });
    s = fasReducer(s, {
      type: "submitHardcopy", studentIds: [ethan.id], band, school: "Riverbank Primary School",
      applicant: "Benson Chua", contact: "+65 9000 1234", note: "", by: "Alicia Tan", entryMode: "manual",
      at, guardianNric: "S1234567D", draftId: "DRF-0001",
      address: "Blk 808 Jurong West Ave 1, #10-101, Singapore 640808", detailsCorrected: true,
    });
    expect(s.familyApps[0].contact).toBe("+65 9000 1234");
    expect(s.familyApps[0].address).toBe("Blk 808 Jurong West Ave 1, #10-101, Singapore 640808");
    expect(s.familyApps[0].contactCorrected).toBe(true);
  });
});
