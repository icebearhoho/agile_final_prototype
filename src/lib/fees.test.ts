import { describe, expect, test } from "vitest";
import { feeReducer, initialFeeState } from "../data/feeStore";
import { FEE_TYPES, type FeeType } from "../data/fees";
import { STUDENTS, type Student } from "../data/students";
import { addDays, aggregate, balanceOf, chargeStatus, fasOf, feeDraftOk, feeOf, fundingOf, makeCharge, MOEFAS_RATE, nextChargeId, paidOf, payableOf, SBFAS_RATE, seedCharges, studentsOfClass, subsidyOf, subsidyRate, validateFeeType } from "./fees";

const draft = (o = {}) => ({ name: "Trip", level: "", components: [{ name: "Bus", amount: "12.50", on: true }], ...o });

describe("charge maths", () => {
  const c = { components: [{ name: "a", amount: 0.1, subsidy: 0.05 }, { name: "b", amount: 0.2 }, { name: "c", amount: 10, subsidy: 99 }], payments: [] };
  test("sums in cents and caps a subsidy at the component amount", () => {
    expect(feeOf(c)).toBe(10.3);
    expect(subsidyOf(c)).toBe(10.05);
    expect(payableOf(c)).toBe(0.25);
  });
});

describe("validateFeeType", () => {
  test("accepts a valid draft", () => {
    const r = validateFeeType(draft(), []);
    expect(feeDraftOk(r.errors)).toBe(true);
    expect(r.components).toEqual([{ name: "Bus", amount: 12.5 }]);
  });
  test("name required and unique per school, ignoring case and spacing", () => {
    expect(validateFeeType(draft({ name: " " }), []).errors.name).toBeTruthy();
    expect(validateFeeType(draft({ name: "school  FEES (primary)" }), FEE_TYPES).errors.name).toBeTruthy();
  });
  test("unticked rows are ignored; ticked rows need a name and an amount above 0 with 2 decimals", () => {
    expect(validateFeeType(draft({ components: [{ name: "", amount: "", on: false }, { name: "Bus", amount: "5", on: true }] }), []).components).toHaveLength(1);
    for (const amount of ["", "0", "-1", "1.234", "abc"]) expect(validateFeeType(draft({ components: [{ name: "Bus", amount, on: true }] }), []).errors.rows[0], amount).toBeTruthy();
    expect(validateFeeType(draft({ components: [{ name: "Bus", amount: "5", on: false }] }), []).errors.components).toBeTruthy();
  });
});

describe("generate (no term: one charge per student per fee type per issue date)", () => {
  const school = "S002";
  const ft = FEE_TYPES.find((f) => f.school === school)!;
  const klass = STUDENTS.find((s) => s.level === "P1")!.class;
  const students = studentsOfClass(school, klass);
  const issued = "2026-10-12", due = "2026-11-11";
  test("creates one outstanding charge per student and skips repeats for the same issue date", () => {
    const s0 = { ...initialFeeState(), charges: [] };
    const s1 = feeReducer(s0, { type: "generate", fee: ft, students, issued, due });
    expect(s1.charges).toHaveLength(students.length);
    expect(s1.charges.every((c) => chargeStatus(c) === "outstanding" && c.components.length === ft.components.length)).toBe(true);
    expect(s1.charges.every((c) => c.issued === issued && c.due === due)).toBe(true);
    expect(feeReducer(s1, { type: "generate", fee: ft, students, issued, due }).charges).toHaveLength(students.length);
    expect(feeReducer(s1, { type: "generate", fee: ft, students, issued: "2026-11-12", due: "2026-12-12" }).charges).toHaveLength(students.length * 2);
  });
  test("editing a fee type does not change issued charges", () => {
    const s1 = feeReducer({ ...initialFeeState(), charges: [] }, { type: "generate", fee: ft, students, issued, due });
    const s2 = feeReducer(s1, { type: "saveType", fee: { ...ft, components: [{ name: "New", amount: 1 }] } });
    expect(s2.charges[0].components).toHaveLength(ft.components.length);
    expect(s2.types.find((f) => f.id === ft.id)!.components).toHaveLength(1);
  });
});

describe("derived status — outstanding/overdue/paid without terms", () => {
  const fasStudent = (moefas: Student["moefas"], sbfas: Student["sbfas"]): Student => ({
    id: "S1", name: "Test", level: "P1", class: "P1 Courage", status: "Enrolled", balance: 0, moefas, sbfas,
  });
  const fasFee: FeeType = { id: "FT-1", school: "S001", name: "Test fee", updated: "2026-10-12", components: [{ name: "Tuition", amount: 100 }, { name: "Materials", amount: 50 }] };
  const yesterday = "2026-10-11", nextMonth = "2026-11-11";

  test("fresh charge with a future due date is outstanding", () => {
    const c = makeCharge("CH-1", fasFee, fasStudent("Not applied", "Not applied"), { issued: "2026-10-01", due: nextMonth });
    expect(chargeStatus(c)).toBe("outstanding");
  });
  test("unpaid past its due date is overdue — no term needed", () => {
    const c = makeCharge("CH-1", fasFee, fasStudent("Not applied", "Not applied"), { issued: "2026-09-01", due: yesterday });
    expect(chargeStatus(c)).toBe("overdue");
  });
  test("payments cover the payable → paid; partial payment stays overdue/outstanding with the rest owed", () => {
    const c = makeCharge("CH-1", fasFee, fasStudent("Not applied", "Not applied"), { issued: "2026-09-01", due: yesterday });
    const half = feeReducer({ ...initialFeeState(), charges: [c] }, { type: "recordPayment", chargeId: "CH-1", amount: payableOf(c) / 2, method: "Education account" }).charges[0];
    expect(paidOf(half)).toBe(payableOf(c) / 2);
    expect(balanceOf(half)).toBe(payableOf(c) / 2);
    expect(chargeStatus(half)).toBe("overdue");
    const full = feeReducer({ ...initialFeeState(), charges: [half] }, { type: "recordPayment", chargeId: "CH-1", amount: balanceOf(half), method: "Card / PayNow" }).charges[0];
    expect(chargeStatus(full)).toBe("paid");
    expect(fundingOf(full).fromAccount + fundingOf(full).fromGateway).toBe(payableOf(c));
  });
  test("default due date is 30 days after issue", () => {
    const c = makeCharge("CH-1", fasFee, fasStudent("Not applied", "Not applied"));
    expect(c.due).toBe(addDays(c.issued, 30));
  });
});

describe("fasOf — MOEFAS takes precedence over SBFAS (a student never receives both)", () => {
  const fasStudent = (moefas: Student["moefas"], sbfas: Student["sbfas"]): Student => ({
    id: "S1", name: "Test", level: "P1", class: "P1 Courage", status: "Enrolled", balance: 0, moefas, sbfas,
  });
  test("MOEFAS when only MOEFAS is approved", () => {
    expect(fasOf(fasStudent("Approved", "Not applied"))).toEqual({ scheme: "MOEFAS", rate: MOEFAS_RATE });
  });
  test("MOEFAS wins even if both are approved — SBFAS is ignored", () => {
    expect(fasOf(fasStudent("Approved", "Approved"))?.scheme).toBe("MOEFAS");
  });
  test("SBFAS only when MOEFAS is not approved", () => {
    expect(fasOf(fasStudent("Not applied", "Approved"))).toEqual({ scheme: "SBFAS", rate: SBFAS_RATE });
    expect(fasOf(fasStudent("Rejected", "Approved"))?.scheme).toBe("SBFAS");
  });
  test("null when neither is approved", () => {
    expect(fasOf(fasStudent("Pending", "Pending"))).toBeNull();
    expect(fasOf(fasStudent("Not applied", "Not applied"))).toBeNull();
  });
});

describe("makeCharge — stamps the scheme and deducts its subsidy", () => {
  const fasStudent = (moefas: Student["moefas"], sbfas: Student["sbfas"]): Student => ({
    id: "S1", name: "Test", level: "P1", class: "P1 Courage", status: "Enrolled", balance: 0, moefas, sbfas,
  });
  const fasFee: FeeType = { id: "FT-1", school: "S001", name: "Test fee", updated: "2026-10-12", components: [{ name: "Tuition", amount: 100 }, { name: "Materials", amount: 50 }] };
  test("records fas and the per-component subsidy for MOEFAS", () => {
    const c = makeCharge("CH-1", fasFee, fasStudent("Approved", "Not applied"));
    expect(c.fas).toBe("MOEFAS");
    expect(subsidyOf(c)).toBe(75);            // 50% of 150
    expect(payableOf(c)).toBe(75);
  });
  test("SBFAS subsidises less than MOEFAS on the same fee", () => {
    const moefas = makeCharge("CH-1", fasFee, fasStudent("Approved", "Not applied"));
    const sbfas = makeCharge("CH-2", fasFee, fasStudent("Not applied", "Approved"));
    expect(sbfas.fas).toBe("SBFAS");
    expect(subsidyOf(sbfas)).toBeLessThan(subsidyOf(moefas));
  });
  test("no fas and no subsidy without FAS", () => {
    const c = makeCharge("CH-1", fasFee, fasStudent("Not applied", "Not applied"));
    expect(c.fas).toBeUndefined();
    expect(subsidyOf(c)).toBe(0);
    expect(subsidyRate(fasStudent("Not applied", "Not applied"))).toBe(0);
  });
});

describe("seed invariants", () => {
  test("no student has both schemes Approved at once", () => {
    expect(STUDENTS.filter((s) => s.moefas === "Approved" && s.sbfas === "Approved")).toEqual([]);
  });
  test("the mock data has both MOEFAS and SBFAS recipients", () => {
    expect(STUDENTS.some((s) => s.moefas === "Approved")).toBe(true);
    expect(STUDENTS.some((s) => s.sbfas === "Approved")).toBe(true);
  });
});

test("seed charges: unique ids, no term, aggregate splits collected and outstanding by derived status", () => {
  const rows = seedCharges();
  expect(new Set(rows.map((c) => c.id)).size).toBe(rows.length);
  const a = aggregate(rows);
  expect(a.collected + a.outstanding).toBeCloseTo(a.payable, 2);
  expect(a.overdue).toBeGreaterThan(0);
  expect(a.paid).toBeGreaterThan(0);
  expect(a.fromAccount).toBeGreaterThan(0);
  expect(nextChargeId(rows)).toBe(`CH-${1000 + rows.length + 1}`);
});
