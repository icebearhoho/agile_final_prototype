import { describe, expect, test } from "vitest";
import { navFor } from "./nav";
import { STAFF, type StaffAccount, assignPrincipal, createSchoolUser, principalOf, unassignedStaff, updateSchoolUser, usersOfSchool, validateUser } from "./users";

describe("school users", () => {
  test("a school has one Principal and several admins", () => {
    const users = usersOfSchool("S001");
    expect(users[0].title).toBe("Principal");
    expect(users.length).toBeGreaterThan(1);
    expect(users.filter((u) => u.title === "Principal")).toHaveLength(1);
  });

  test("a second Principal for the same school is rejected", () => {
    const e = validateUser({ schoolCode: "S001", name: "New Person", email: "new.person@school.example", position: "Principal", modules: [] });
    expect(e.position).toMatch(/already the Principal/);
  });

  test("school is required and the email must be unique", () => {
    const e = validateUser({ schoolCode: "", name: "X", email: "alicia.tan@school.example", position: "School Admin", modules: [] });
    expect(e).toMatchObject({ schoolCode: expect.any(String), name: expect.any(String), email: "This email already has an account." });
  });

  test("admins get only the modules they were assigned; the Principal gets all", () => {
    const admin = createSchoolUser({ schoolCode: "S002", name: "Test Admin", email: "test.admin@school.example", position: "School Admin", modules: ["Top-up"] });
    expect(admin.modules).toEqual(["Top-up"]);
    updateSchoolUser(admin, { name: "Test Admin", email: admin.email, position: "School Admin", modules: ["FAS", "Top-up"] });
    expect(admin.modules).toEqual(["FAS", "Top-up"]);
    STAFF.splice(STAFF.indexOf(admin), 1);
  });

  test("assigning a Principal reuses the existing account and demotes the old one", () => {
    const mk = (n: string): StaffAccount => ({ role: "school", name: n, initials: "TT", title: "Teacher", email: `${n}@school.example`, password: "x", modules: [], active: false });
    const [first, second] = [mk("tmp.one"), mk("tmp.two")];
    STAFF.push(first, second);
    const before = STAFF.length;
    const p = assignPrincipal("S002", first.email);
    expect(p).toBe(first);
    expect(STAFF).toHaveLength(before);
    expect(p).toMatchObject({ schoolCode: "S002", title: "Principal", modules: ["FAS", "Top-up"], active: true });
    expect(unassignedStaff()).not.toContain(first);
    assignPrincipal("S002", second.email);
    expect(first.title).toBe("School Admin");
    expect(principalOf("S002")).toBe(second);
    for (const a of [first, second]) STAFF.splice(STAFF.indexOf(a), 1);
    expect(STAFF).toHaveLength(before - 2);
  });
});

describe("navigation follows module permissions", () => {
  const labels = (can: (m: "FAS" | "Top-up") => boolean, manage = false) => navFor("school", { can, canManageUsers: manage }).map((n) => n.label);
  test("FAS-only admin sees FAS but not Top-up or User", () => {
    const l = labels((m) => m === "FAS");
    expect(l).toContain("FAS");
    expect(l).not.toContain("Top-up");
    expect(l).not.toContain("User");
  });
  test("Principal sees every module and User", () => {
    expect(labels(() => true, true)).toEqual(expect.arrayContaining(["FAS", "Top-up", "User"]));
  });
  test("Budget is shown to HQ and to school users with the FAS module only", () => {
    expect(navFor("hq").map((n) => n.label)).toContain("Budget");
    expect(labels((m) => m === "FAS")).toContain("Budget");
    expect(labels((m) => m === "Top-up")).not.toContain("Budget");
  });
  test("HQ sees User management", () => {
    expect(navFor("hq").map((n) => n.label)).toContain("User");
  });
});
