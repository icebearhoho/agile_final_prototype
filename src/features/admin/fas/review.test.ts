import { expect, test } from "vitest";
import { applyDecision, isDeclined, isGranted, sortQueue, validateDecision } from "./review";
import { SBFAS_APPLICATIONS, type SbfasApplication } from "../../../data/sbfasApplications";
import { STUDENTS } from "../../../data/students";

const app = (id: string, riskScore: number, status: SbfasApplication["status"] = "Pending"): SbfasApplication => ({
  id, student: id, studentId: "S1", level: "P5", incomeBand: "b", riskScore, recommendedTier: "Tier 2", slaDays: 3, explanation: "x", status,
});

test("sortQueue: pending first, then risk score desc", () => {
  const out = sortQueue([app("a", 20), app("b", 90, "Approved"), app("c", 60), app("d", 85)]);
  expect(out.map((a) => a.id)).toEqual(["d", "c", "a", "b"]);
});

test("override without justification is blocked, with field=justification", () => {
  expect(validateDecision("override", { justification: "", tier: "Tier 3" }, "Tier 2")).toEqual({
    field: "justification", message: expect.any(String),
  });
  expect(validateDecision("override", { justification: "   ", tier: "Tier 3" }, "Tier 2")?.field).toBe("justification");
});

test("override to the recommended tier is blocked on the tier field", () => {
  expect(validateDecision("override", { justification: "Reason", tier: "Tier 2" }, "Tier 2")?.field).toBe("tier");
});

test("valid override, approve and reject pass without justification where not required", () => {
  expect(validateDecision("override", { justification: "Sibling in care", tier: "Tier 1" }, "Tier 2")).toBeNull();
  expect(validateDecision("approve", { justification: "", tier: "Tier 2" }, "Tier 2")).toBeNull();
  expect(validateDecision("reject", { justification: "", tier: "Tier 2" }, "Tier 2")).toBeNull();
});

test("applyDecision sets status, final tier and justification on one app only", () => {
  const list = [app("a", 20), app("b", 90)];
  const out = applyDecision(list, "b", "override", { justification: " why ", tier: "Tier 1" });
  expect(out[1]).toMatchObject({ status: "Overridden", sbfasTier: "Tier 1", justification: "why" });
  expect(out[0].status).toBe("Pending");
  expect(applyDecision(list, "a", "reject", { justification: "", tier: "Tier 2" })[0]).toMatchObject({ status: "Rejected", sbfasTier: undefined });
  expect(applyDecision(list, "a", "approve", { justification: "", tier: "Tier 2" })[0]).toMatchObject({ status: "Approved", sbfasTier: "Tier 2" });
});

test("decision history tabs: approved and overridden are granted, rejected is declined, pending is neither", () => {
  expect(isGranted({ status: "Approved" })).toBe(true);
  expect(isGranted({ status: "Overridden" })).toBe(true);
  expect(isGranted({ status: "Rejected" })).toBe(false);
  expect(isGranted({ status: "Pending" })).toBe(false);
  expect(isDeclined({ status: "Rejected" })).toBe(true);
  expect(isDeclined({ status: "Approved" })).toBe(false);
  expect(isDeclined({ status: "Pending" })).toBe(false);
});

test("every seeded application links to a real student record (name, id and level agree)", () => {
  for (const a of SBFAS_APPLICATIONS) {
    const s = STUDENTS.find((x) => x.id === a.studentId);
    expect(s, a.id).toBeDefined();
    expect(s!.name).toBe(a.student);
    expect(s!.level).toBe(a.level);
  }
});
