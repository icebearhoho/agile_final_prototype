import { expect, test } from "vitest";
import { GUARDIANS, guardianByNric } from "./familyRegistry";
import { STUDENTS } from "./students";

// The lookup feeds Section I straight from the registry, so a guardian pointing at a name the
// registry does not hold would break the hardcopy entry the moment it runs.
test("every guardian links to real registry students", () => {
  for (const g of GUARDIANS) {
    expect(g.nric).toMatch(/^[STFG]\d{7}[A-Z]$/);
    for (const name of g.children) {
      expect(STUDENTS.some((s) => s.name === name), `${name} (${g.name})`).toBe(true);
    }
  }
});

test("guardianByNric tolerates case and spacing", () => {
  expect(guardianByNric(" s1234567d ")?.name).toBe("Benson Chua");
  expect(guardianByNric("S9876543B")?.name).toBe("Jenny Chua");
});

test("an unknown NRIC finds nothing — the staff falls back to typing the children in", () => {
  expect(guardianByNric("S0000000X")).toBeUndefined();
});

// The refinement walked through exactly this family: two children at two different schools.
test("the demo family spans two schools", () => {
  const chua = guardianByNric("S1234567D")!;
  expect(chua.children).toHaveLength(2);
  const levels = chua.children.map((n) => STUDENTS.find((s) => s.name === n)!.level);
  expect(levels.some((l) => l.startsWith("P"))).toBe(true);
  expect(levels.some((l) => l.startsWith("Sec"))).toBe(true);
});
