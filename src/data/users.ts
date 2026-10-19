import type { Role } from "../session";

export type User = { name: string; initials: string };
export type ParentAccount = User & {
  role: "parent";
  singpassId: string;
  email: string;
};

/** Modules a school user can be given. MOE HQ can always use everything. */
export const MODULES = ["FAS", "Top-up"] as const;
export type Module = (typeof MODULES)[number];
/** One Principal per school; the Principal assigns modules to the School Admins. */
export const POSITIONS = ["Principal", "School Admin"] as const;
export type Position = (typeof POSITIONS)[number];

export type StaffAccount = User & {
  role: "hq" | "school";
  title: string;
  email: string;
  password: string;
  schoolCode?: string;
  /** School users only. */
  modules: Module[];
  active: boolean;
};

// ASSUMPTION: mock identities and test-only credentials; real auth is out of scope (SingPass and staff SSO are simulated).
export const PARENT: ParentAccount = {
  role: "parent",
  name: "Rachel Lim",
  initials: "RL",
  singpassId: "S****567A",
  email: "rachel.lim@example.com",
};

export const STAFF: StaffAccount[] = [
  { role: "school", name: "Alicia Tan", initials: "AT", title: "Principal", email: "alicia.tan@school.example", password: "Sch00l-Demo-26", schoolCode: "S001", modules: [...MODULES], active: true },
  { role: "school", name: "Marcus Ong", initials: "MO", title: "School Admin", email: "marcus.ong@school.example", password: "Sch00l-Admin-26", schoolCode: "S001", modules: ["FAS"], active: true },
  { role: "school", name: "Priya Nair", initials: "PN", title: "School Admin", email: "priya.nair@school.example", password: "Sch00l-Top-26", schoolCode: "S001", modules: ["Top-up"], active: true },
  // S002 (Riverbank Primary) account: each school reviews only its own students' FAS applications.
  { role: "school", name: "Geraldine Rajaratnam", initials: "GR", title: "School Admin", email: "geraldine.rajaratnam@school.example", password: "Sch00l-Demo-26", schoolCode: "S002", modules: ["FAS"], active: true },
  { role: "hq", name: "Daniel Lim", initials: "DL", title: "MOE HQ Officer", email: "daniel.lim@moe.example", password: "HqOfficer-Demo-26", modules: [...MODULES], active: true },
];

export const initialsOf = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** Fallback identity per role (first account), used when the session holds no explicit sign-in. */
export const userFor = (role: Role): User => (role === "parent" ? PARENT : STAFF.find((s) => s.role === role)!);

export const findStaff = (email: string, password: string) =>
  STAFF.find((s) => s.active && s.email === email.trim().toLowerCase() && s.password === password);

export const staffByEmail = (email: string | null | undefined) => (email ? STAFF.find((s) => s.email === email.toLowerCase()) : undefined);

/** All users of a school, Principal first. */
export const usersOfSchool = (code: string) =>
  STAFF.filter((s) => s.role === "school" && s.schoolCode === code).sort((a, b) => Number(b.title === "Principal") - Number(a.title === "Principal"));

export const principalOf = (code: string) => usersOfSchool(code).find((s) => s.title === "Principal");

export type UserInput = { schoolCode: string; name: string; email: string; position: Position; modules: Module[] };
export type UserErrors = Partial<Record<keyof UserInput, string>>;

/** `editing` = the account being edited (excluded from the duplicate and one-Principal checks). */
export function validateUser(v: UserInput, editing?: StaffAccount): UserErrors {
  const e: UserErrors = {};
  if (!v.schoolCode) e.schoolCode = "Select a school.";
  if (v.name.trim().length < 2) e.name = "Enter the user's name.";
  const email = v.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email address.";
  else if (STAFF.some((s) => s !== editing && s.email === email)) e.email = "This email already has an account.";
  if (v.schoolCode && v.position === "Principal") {
    const p = principalOf(v.schoolCode);
    if (p && p !== editing) e.position = `${p.name} is already the Principal. Change them to School Admin first.`;
  }
  return e;
}

/** Creates a school user (MOE HQ or the Principal); the app generates a one-time password. */
export function createSchoolUser(v: UserInput): StaffAccount {
  const acct: StaffAccount = {
    role: "school", name: v.name.trim(), initials: initialsOf(v.name), title: v.position, email: v.email.trim().toLowerCase(),
    password: `Tmp-${crypto.randomUUID().slice(0, 8)}`, schoolCode: v.schoolCode,
    modules: v.position === "Principal" ? [...MODULES] : MODULES.filter((m) => v.modules.includes(m)), active: true,
  };
  STAFF.push(acct);
  return acct;
}

/** Updates name, email, position and modules. The Principal always has every module. */
export function updateSchoolUser(acct: StaffAccount, v: Omit<UserInput, "schoolCode">, resetPassword = false): StaffAccount {
  acct.name = v.name.trim();
  acct.initials = initialsOf(v.name);
  acct.email = v.email.trim().toLowerCase();
  acct.title = v.position;
  acct.modules = v.position === "Principal" ? [...MODULES] : MODULES.filter((m) => v.modules.includes(m));
  if (resetPassword) acct.password = `Tmp-${crypto.randomUUID().slice(0, 8)}`;
  return acct;
}

/** School users from the third-party feed that no school has claimed yet. */
export const unassignedStaff = () => STAFF.filter((s) => s.role === "school" && !s.schoolCode);

/** Req 3 (assumed): HQ assigns an existing (third-party) account as the school's Principal. No account is created; a Principal replaced here stays on as School Admin. */
export function assignPrincipal(schoolCode: string, email: string): StaffAccount {
  const acct = staffByEmail(email);
  if (!acct || acct.role !== "school") throw new Error(`No school user with email ${email}`);
  const old = principalOf(schoolCode);
  if (old && old !== acct) old.title = "School Admin";
  acct.schoolCode = schoolCode;
  acct.title = "Principal";
  acct.modules = [...MODULES];
  acct.active = true;
  return acct;
}

/** School of the first (mock) school user; undefined for HQ. Screens that know the signed-in user should use the session instead. */
export const schoolCodeFor = (role: Role | null) => STAFF.find((s) => s.role === role)?.schoolCode;
