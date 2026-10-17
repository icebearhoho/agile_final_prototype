import { CLASSES, LEVELS, type Level, type Student, type StudentStatus, type UnassignedAccount } from "../../../data/students";

export type Filters = { level: string; class: string; status: string };
export const NO_FILTERS: Filters = { level: "", class: "", status: "" };

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Empty filter value = "all". */
export function filterStudents(rows: Student[], f: Filters): Student[] {
  return rows.filter(
    (s) => (!f.level || s.level === f.level) && (!f.class || s.class === f.class) && (!f.status || s.status === f.status),
  );
}

/** Next id = highest numeric suffix + 1 (ids look like S20260001, S20260041, S20260042 ...). */
export function nextId(rows: Student[]): string {
  const max = rows.reduce((m, s) => Math.max(m, Number(s.id.slice(1)) || 0), 0);
  return `S${max + 1}`;
}

/** Assign an existing Education Account to this school: keeps the account's id and balance. */
export function assignStudent(a: UnassignedAccount, p: { level: Level; class: string }): Student {
  return { id: a.id, name: a.name, level: p.level, class: p.class, status: "Enrolled", balance: a.balance, sbfas: "Not applied", moefas: "Not applied" };
}

export function newStudent(rows: Student[], p: { name: string; level: Level; class: string }): Student {
  // ASSUMPTION: a newly added student starts Active, with an empty Education Account and no FAS application.
  return { id: nextId(rows), name: p.name.trim(), level: p.level, class: p.class, status: "Enrolled", balance: 0, sbfas: "Not applied", moefas: "Not applied" };
}

/** Shared by the Add form and CSV import. Returns an error message or "" when valid. */
export function nameError(raw: string): string {
  const name = raw.trim();
  if (!name) return "Enter the student's full name.";
  if (name.length < 2 || name.length > 80) return "Name must be 2 to 80 characters.";
  if (!/^[\p{L}\p{M}'’ ,.\-@/]+$/u.test(name)) return "Name can only contain letters, spaces and , - ' . / @";
  if (!/\p{L}/u.test(name)) return "Name must contain at least one letter.";
  return "";
}

/** Parse YYYY-MM-DD as a LOCAL date (new Date("2018-04-09") would be UTC and can shift a day). */
function parseLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}

export type NewStudentInput = { name: string; dob: string; level: string; class: string };
export type NewStudentErrors = Partial<Record<keyof NewStudentInput, string>>;

// ASSUMPTION: school-age students are 6-16 (account is open from 7 until 16; 6 allowed for early P1 intake).
export function validateNewStudent(v: NewStudentInput, today = new Date()): NewStudentErrors {
  const e: NewStudentErrors = {};
  const ne = nameError(v.name);
  if (ne) e.name = ne;

  const dob = parseLocalDate(v.dob);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!dob) e.dob = "Enter a date of birth.";
  else if (dob > t0) e.dob = "Date of birth cannot be in the future.";
  else {
    let age = t0.getFullYear() - dob.getFullYear();
    if (t0.getMonth() < dob.getMonth() || (t0.getMonth() === dob.getMonth() && t0.getDate() < dob.getDate())) age--;
    if (age < 6 || age > 16) e.dob = `Student age must be 6 to 16 (this date gives ${age}).`;
  }

  if (!LEVELS.includes(v.level as Level)) e.level = "Select a level.";
  if (!v.class) e.class = "Select a class.";
  else if (!e.level && !CLASSES[v.level as Level].includes(v.class)) e.class = "Select a class that belongs to the chosen level.";
  return e;
}

/** Quote-aware CSV reader (RFC 4180 style): "a,b" keeps the comma, "" is a literal quote, quoted fields may span lines. */
export function parseCsvRecords(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      out.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  out.push(row);
  return out.filter((r) => r.some((c) => c.trim()));
}

export type CsvRow = { name: string; level: Level; class: string };
export type CsvResult =
  | { error: string }
  | { rows: CsvRow[]; total: number; skipped: number; reasons: Record<string, number> };

// ASSUMPTION: CSV format is a header row with name, level, class; invalid rows are skipped (not rejected as a whole).
export function parseStudentCsv(fileName: string, text: string): CsvResult {
  if (!/\.csv$/i.test(fileName)) return { error: "Please choose a .csv file." };
  const recs = parseCsvRecords(text);
  if (recs.length === 0) return { error: "The file is empty." };
  const head = recs[0].map((h) => h.trim().toLowerCase());
  const [iName, iLevel, iClass] = ["name", "level", "class"].map((c) => head.indexOf(c));
  if (iName < 0 || iLevel < 0 || iClass < 0) return { error: "The header row must contain the columns: name, level, class." };
  const body = recs.slice(1);
  if (body.length === 0) return { error: "The file has a header but no student rows." };

  const rows: CsvRow[] = [];
  const reasons: Record<string, number> = {};
  const skip = (why: string) => (reasons[why] = (reasons[why] ?? 0) + 1);
  for (const c of body) {
    const name = (c[iName] ?? "").trim();
    const cls = (c[iClass] ?? "").trim();
    const level = LEVELS.find((lv) => lv.toLowerCase() === (c[iLevel] ?? "").trim().toLowerCase());
    if (!name) skip("missing name");
    else if (nameError(name)) skip("invalid name");
    else if (!level) skip("unknown level");
    else if (!cls) skip("missing class");
    else {
      const canon = CLASSES[level].find((k) => k.toLowerCase() === cls.toLowerCase());
      if (canon) rows.push({ name, level, class: canon });
      else skip("class not in level");
    }
  }
  return { rows, total: body.length, skipped: body.length - rows.length, reasons };
}

export const statusTone: Record<StudentStatus, "success" | "warning" | "neutral"> = {
  "Enrolled": "success",
  "Not Enrolled": "neutral",
};
