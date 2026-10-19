import type { Account, Condition, FundRule, Target, Transaction } from "../data/topup";
import { LEVELS } from "../data/students";
import type { Cell, SheetOptions } from "./xlsx";

export type TopUpRule = {
  ageMin: number;
  ageMax: number;
  citizenOnly: boolean;
  enrolledOnly: boolean;
  balanceMin: number;
  balanceMax: number;
};

/** count * amount in integer cents, so 3 x S$0.10 is exactly S$0.30. `amount` must already be at most 2 decimals (see parseAmount). */
export function totalFunds(count: number, amount: number): number {
  return (Math.round(amount * 100) * count) / 100;
}

/** Accounts matching every rule. Age and balance bounds are inclusive; flags only exclude when on. */
export function eligibleAccounts(rule: TopUpRule, accounts: Account[]): Account[] {
  return accounts.filter(
    (a) =>
      a.age >= rule.ageMin &&
      a.age <= rule.ageMax &&
      (!rule.citizenOnly || a.citizen) &&
      (!rule.enrolledOnly || a.enrolled) &&
      a.balance >= rule.balanceMin &&
      a.balance <= rule.balanceMax,
  );
}

/** Restricted view of a balance (HQ never sees the exact figure on this screen). */
export const balanceBand = (n: number) => (n < 100 ? "Below S$100" : n < 300 ? "S$100 to under S$300" : n < 500 ? "S$300 to under S$500" : "S$500 and above");

/** "P5 Respect" -> "P5", "Sec 2 Aspire" -> "Sec 2". */
export const levelOfClass = (cls: string) => LEVELS.find((l) => cls === l || cls.startsWith(`${l} `)) ?? "";

/** Does one recipient condition match this account? Range ends are inclusive. */
export const matchesCondition = (c: Condition, a: Account) => (c.type === "range" ? a.age >= c.min && a.age <= c.max : c.type === "age" ? a.age === c.age : levelOfClass(a.class) === c.level);

export type RuleCriteria = Pick<FundRule, "conditions" | "minBalance" | "maxBalance" | "schooling" | "schools">;

/** Active accounts matching ANY condition (age range / specific age / level) and balance in [min, max), schooling status, school (empty = all). */
export function eligibleForRule(rule: RuleCriteria, accounts: Account[]): Account[] {
  return accounts.filter(
    (a) =>
      a.status === "Active" &&
      rule.conditions.some((c) => matchesCondition(c, a)) &&
      a.balance >= rule.minBalance && a.balance < rule.maxBalance &&
      rule.schooling === a.schooling &&
      (!rule.schools.length || rule.schools.includes(a.school)),
  );
}

/** "TUR" + five digits, continuing from the highest existing rule (first is TUR01001). */
export function nextRuleId(rules: { id: string }[]): string {
  return `TUR${String(rules.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, "")) || 0), 1000) + 1).padStart(5, "0")}`;
}

/** "TUT" + DDMMYY of the execution date. Same-day transactions share a code (as in the team prototype). */
export function transactionCode(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? `TUT${m[3]}${m[2]}${m[1].slice(-2)}` : "TUT000000";
}

const ddmmyy = (date: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date); return m ? m[3] + m[2] + m[1].slice(-2) : "000000"; };

/** Per-account outcomes: stored targets, else demo ones built from `accounts` so counts match `t.accounts`. */
export function allocationsOf(t: Transaction, accounts: Account[]): Target[] {
  if (t.targets) return t.targets;
  return Array.from({ length: t.accounts }, (_, n) => {
    const a = accounts[(n + t.ref.length * 3) % accounts.length];
    const failed = t.status === "Failed" || (t.status === "Partial Success" && n % 5 === 0);
    return { student: a.name, account: a.nric, status: t.status === "Pending" ? "Pending" : failed ? "Failed" : "Success", ...(failed ? { reason: "Education Account inactive at execution" } : {}) } as Target;
  });
}

/** Display IDs, index-aligned with `rows` (newest first). Top-up ID = SPE|BAT + DDMMYY + 3-digit daily seq;
 *  account txid = TUT + DDMMYY + 5-digit daily seq. Prototype only: production allocates these atomically in the backend. */
export function ledgerIds(rows: Transaction[], accounts: Account[]) {
  const seq = new Map<string, number>();
  const next = (prefix: string, date: string, digits: number) => { const k = `${prefix}|${date}`; const n = (seq.get(k) ?? 0) + 1; seq.set(k, n); return prefix + ddmmyy(date) + String(n).padStart(digits, "0"); };
  const out = rows.map(() => ({ id: "", targets: [] as Target[] }));
  for (let i = rows.length - 1; i >= 0; i--) {
    const t = rows[i];
    out[i].id = next(t.type === "Batch" ? "BAT" : "SPE", t.date, 3);
    out[i].targets = allocationsOf(t, accounts).map((a) => (a.status === "Pending" ? a : { ...a, txid: a.txid ?? next("TUT", t.date, 5) }));
  }
  return out;
}

/** Active rules in creation order (rule ids are issued in sequence, so id order = creation order). Overlaps are allowed and stack. */
export const activeRulesInOrder = (rules: FundRule[]): FundRule[] => rules.filter((r) => r.status === "Active").sort((a, b) => a.id.localeCompare(b.id));

/** Per-rule eligible accounts, in rule order. An account matching several rules appears under each and is topped up by each. */
export function stackRules(rules: FundRule[], accounts: Account[]) {
  return rules.map((rule) => ({ rule, accounts: eligibleForRule(rule, accounts) }));
}

/** Accounts that match more than one of the given rules. */
export function overlapCount(stack: { accounts: Account[] }[]): number {
  const seen = new Map<string, number>();
  for (const s of stack) for (const a of s.accounts) seen.set(a.id, (seen.get(a.id) ?? 0) + 1);
  return [...seen.values()].filter((n) => n > 1).length;
}

/** Short text for one condition: "Age 7–12", "Age 9", "P1". */
export const conditionText = (c: Condition) => (c.type === "range" ? `Age ${c.min}–${c.max}` : c.type === "age" ? `Age ${c.age}` : c.level);

/** Label for a rule's targeting method. */
export const targetLabel = (r: Pick<FundRule, "mode" | "conditions">) =>
  r.mode === "mixed" ? [...new Set(r.conditions.map((c) => (c.type === "range" ? "Age Range" : c.type === "age" ? "Specific Age" : "Level")))].join(" + ") : r.mode === "ages" ? "Specific Ages" : r.mode === "levels" ? "Level" : "Age Range";

/**
 * Accounts of a failed / partly failed top-up that can still be retried: the account failed in `origin`, is Active now,
 * and no follow-up of `originId` (a row with `followupOf` = that ID) has already credited it.
 */
export function retryableAccounts(origin: Transaction, originId: string, rows: Transaction[], accounts: Account[]): Account[] {
  const done = new Set(rows.filter((t) => t.followupOf === originId).flatMap((t) => (t.targets ?? []).filter((x) => x.status === "Success").map((x) => x.account)));
  const failed = new Set(allocationsOf(origin, accounts).filter((x) => x.status === "Failed").map((x) => x.account));
  return accounts.filter((a) => a.status === "Active" && failed.has(a.nric) && !done.has(a.nric));
}

const REPORT_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Excel report in the customer's "Student Finance System" layout: a header block (report title, job ID/title/date, rule name),
 * a successful/failed summary, the failed records with their reasons, then the successful records with level, class and amount.
 * Pending accounts are not part of a report; it is produced once the job has run. UIN = the account's NRIC.
 */
export function topUpReport(t: Transaction, topUpId: string, targets: Target[], accounts: Account[], reportDate: Date = new Date()): { rows: Cell[][]; opts: SheetOptions } {
  const byNric = new Map(accounts.map((a) => [a.nric, a]));
  const ok = targets.filter((x) => x.status === "Success");
  const bad = targets.filter((x) => x.status === "Failed");
  const title = t.type === "Single" && t.detail.includes(" · ") ? t.detail.slice(t.detail.lastIndexOf(" · ") + 3) : t.detail;
  const rule = t.type === "Batch" ? t.recipient : "Specific Accounts (no rule)";
  const bold = (v: string): Cell => ({ v, s: "bold" });
  const money = (v: number): Cell => ({ v, s: "money" });
  const rows: Cell[][] = [
    [{ v: "MINISTRY OF EDUCATION STUDENT FINANCE SYSTEM", s: "title" }],
    [bold("Report Title"), "Top-up Report"],
    [bold("Job ID"), topUpId],
    [bold("Job Title"), title],
    [bold("Report Date"), REPORT_DATE.format(reportDate)],
    [bold("Rule Name"), rule],
    [],
    [],
    [bold("Education Account Top-Up"), bold("No. of Accounts"), bold("Amount Credited ($)")],
    ["Successful Records", ok.length, money(ok.length * t.amount)],
    ["Failed Records", bad.length, money(bad.length * t.amount)],
    [],
    [],
    [bold("Failed Records")],
    [bold("S/N"), bold("Stakeholder UIN"), bold("Stakeholder Name"), bold("Reason")],
    ...bad.map((x, i): Cell[] => [i + 1, x.account, x.student, x.reason ?? ""]),
    [],
    [bold("Successful Records")],
    [bold("S/N"), bold("Stakeholder UIN"), bold("Stakeholder Name"), bold("Level"), bold("Class"), bold("Amount Credited ($)")],
    ...ok.map((x, i): Cell[] => {
      const cls = byNric.get(x.account)?.class ?? "";
      return [i + 1, x.account, x.student, levelOfClass(cls), cls, money(t.amount)];
    }),
  ];
  return { rows, opts: { cols: [34, 36, 30, 40, 22, 26], merges: ["A1:B1"] } };
}