import { expect, test } from "vitest";
import { initialSbfasState, sbfasReducer } from "./sbfasStore";
import { SEED_RULES, toSbfasRule } from "./sbfasRule";

// The bug this guards: decisions used to live in the queue component's useState and reset when the
// user navigated away. The store keeps them for the whole session (reload still resets — no backend).
test("decisions live in the store: state carries over, the seed is never re-applied", () => {
  const s0 = initialSbfasState();
  const target = s0.apps.find((a) => a.status === "Pending")!;
  const s1 = sbfasReducer(s0, { type: "decide", id: target.id, action: "approve", draft: { justification: "", tier: target.recommendedTier } });
  expect(s1.apps.find((a) => a.id === target.id)?.status).toBe("Approved");

  // A later action (e.g. after "navigating" elsewhere) continues from the decided state.
  const s2 = sbfasReducer(s1, { type: "decide", id: target.id, action: "reject", draft: { justification: "not eligible", tier: target.recommendedTier } });
  expect(s2.apps.find((a) => a.id === target.id)?.status).toBe("Rejected");
  expect(s2.apps.find((a) => a.id === target.id)?.justification).toBe("not eligible");

  // Pure: the seed snapshot is untouched.
  expect(s0.apps.find((a) => a.id === target.id)?.status).toBe("Pending");
});

test("rules seed the demo school with its versions; other schools start empty", () => {
  const s0 = initialSbfasState();
  expect(s0.rules.S001).toEqual(SEED_RULES.S001);
  expect(s0.rules.S999).toBeUndefined();
});

test("save-rule upserts one version by id without touching apps or other schools", () => {
  const s0 = initialSbfasState();
  const rule = toSbfasRule({ tiers: [{ basis: "percent", rate: "90" }, { basis: "percent", rate: "60" }] }, "S009", "SBFASR26100001", "Mine");
  const s1 = sbfasReducer(s0, { type: "save-rule", rule });
  expect(s1.rules.S009).toEqual([rule]);
  const again = { ...rule, updated: "2026-10-22" };
  const s2 = sbfasReducer(s1, { type: "save-rule", rule: again });
  expect(s2.rules.S009).toEqual([again]);
  expect(s2.apps).toBe(s1.apps);
  expect(s2.rules.S001).toBe(s1.rules.S001);
});

test("activate-rule swaps the Active version — exactly one stays Active, the old one goes Inactive", () => {
  let s = initialSbfasState();
  const draft = toSbfasRule({ tiers: [{ basis: "percent", rate: "100" }, { basis: "percent", rate: "80" }, { basis: "percent", rate: "60" }, { basis: "percent", rate: "40" }, { basis: "percent", rate: "20" }] }, "S001", "SBFASR26100002", "SBFAS 2027 — Proposed package");
  s = sbfasReducer(s, { type: "save-rule", rule: draft });
  const out = sbfasReducer(s, { type: "activate-rule", school: "S001", id: "SBFASR26100002" });
  const versions = out.rules.S001;
  expect(versions.filter((r) => r.status === "Active").map((r) => r.id)).toEqual(["SBFASR26100002"]);
  expect(versions.find((r) => r.id === "SBFASR26100001")!.status).toBe("Inactive");
  // Pure: the state it started from is untouched.
  expect(s.rules.S001.find((r) => r.id === "SBFASR26100001")!.status).toBe("Active");
});

test("activate-rule on an unknown id changes nothing", () => {
  const s0 = initialSbfasState();
  expect(sbfasReducer(s0, { type: "activate-rule", school: "S001", id: "SBFASR99999999" })).toBe(s0);
});
