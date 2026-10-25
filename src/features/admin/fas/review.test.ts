import { expect, test } from "vitest";
import { applyDecision, isDeclined, isGranted, sortQueue, statusLabel } from "./review";
import { nextSbfasId, SBFAS_APPLICATIONS, type SbfasApplication } from "../../../data/sbfasApplications";
import { STUDENTS } from "../../../data/students";

const app = (id: string, riskScore: number, status: SbfasApplication["status"] = "Pending"): SbfasApplication => ({
  id, student: id, studentId: "S1", level: "P5", incomeBand: "b", riskScore, recommendedTier: "Tier 2", slaDays: 3, explanation: "x", status, source: "MOE referral",
});

test("sortQueue: pending first, then risk score desc", () => {
  const out = sortQueue([app("a", 20), app("b", 90, "Approved"), app("c", 60), app("d", 85)]);
  expect(out.map((a) => a.id)).toEqual(["d", "c", "a", "b"]);
});

test("applyDecision grants at the rank the reviewer picked and records the decision on one app only", () => {
  const list = [app("a", 20), app("b", 90)]; // both recommend Tier 2
  const out = applyDecision(list, "b", "approve", { justification: " why ", tier: "Tier 1" });
  expect(out[1]).toMatchObject({ status: "Approved", sbfasTier: "Tier 1", justification: "why" }); // Tier 1 picked, not the Tier 2 start
  expect(out[0].status).toBe("Pending");
  expect(applyDecision(list, "a", "approve", { justification: "", tier: "Tier 2" })[0]).toMatchObject({ status: "Approved", sbfasTier: "Tier 2", justification: undefined });
  expect(applyDecision(list, "a", "reject", { justification: "", tier: "Tier 2" })[0]).toMatchObject({ status: "Rejected", sbfasTier: undefined });
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

test("every seed carries a source and both arrival channels are represented (MOE referral + Hardcopy)", () => {
  for (const a of SBFAS_APPLICATIONS) {
    expect(["MOE referral", "Hardcopy"], a.id).toContain(a.source);
  }
  expect(SBFAS_APPLICATIONS.some((a) => a.source === "MOE referral")).toBe(true);
  expect(SBFAS_APPLICATIONS.some((a) => a.source === "Hardcopy")).toBe(true);
  // Only referred applications carry a MyInfo sync date — a paper form carries its own bands.
  for (const a of SBFAS_APPLICATIONS) {
    expect(a.incomeSyncedOn, a.id).toBe(a.source === "MOE referral" ? a.incomeSyncedOn : undefined);
  }
});

test("nextSbfasId: SBFASXXXX format, 4-digit padded, continues from the highest sequence", () => {
  expect(nextSbfasId(SBFAS_APPLICATIONS)).toBe("SBFAS0019");    // highest seed is SBFAS0018
  expect(nextSbfasId([])).toBe("SBFAS0001");                     // empty queue starts the 0001 series
  expect(nextSbfasId([{ id: "SBFAS0999" }])).toBe("SBFAS1000"); // continues from the highest, no artificial floor
  expect(nextSbfasId([{ id: "SBFAS9999" }])).toBe("SBFAS10000"); // past 9999 the digits grow, nothing breaks
});

test("statusLabel: Approved reads Granted, Rejected reads Declined, the rest stay", () => {
  expect(statusLabel("Approved")).toBe("Granted");
  expect(statusLabel("Rejected")).toBe("Declined");
  expect(statusLabel("Pending")).toBe("Pending");
  expect(statusLabel("Not applied")).toBe("Not applied");
});
