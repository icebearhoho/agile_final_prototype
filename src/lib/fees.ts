import { schoolOfLevel } from "../data/schoolMgmt";
import { DEFAULT_DUE_DAYS, FEE_TYPES, type Charge, type ChargeComponent, type ChargeStatus, type FasScheme, type FeeComponent, type FeeType, type Payment } from "../data/fees";
import { STUDENTS, type Student } from "../data/students";

/** Mock "today" for issue and paid dates. */
export const TODAY = "2026-10-12";

const cents = (n: number) => Math.round(n * 100);
const sum = (xs: number[]) => xs.reduce((t, x) => t + cents(x), 0) / 100;

export const feeOf = (c: { components: FeeComponent[] }) => sum(c.components.map((x) => x.amount));
export const subsidyOf = (c: { components: ChargeComponent[] }) => sum(c.components.map((x) => Math.min(x.subsidy ?? 0, x.amount)));
export const payableOf = (c: { components: ChargeComponent[] }) => sum(c.components.map((x) => x.amount - Math.min(x.subsidy ?? 0, x.amount)));

/** Total the parent has paid against the charge so far. */
export const paidOf = (c: Pick<Charge, "payments">) => sum(c.payments.map((p) => p.amount));
/** What the parent still owes after subsidy and payments. */
export const balanceOf = (c: Charge) => Math.max(0, Math.round((payableOf(c) - paidOf(c)) * 100) / 100);
/** Last payment date (shown as "paid on"), or undefined when nothing is paid. */
export const paidOnOf = (c: Pick<Charge, "payments">) => c.payments.length ? c.payments.map((p) => p.on).sort().at(-1) : undefined;

/** Derived status — the single source of truth, never stored: paid when covered, overdue when past due and unpaid. */
export function chargeStatus(c: Charge, today = TODAY): ChargeStatus {
  if (balanceOf(c) <= 0.005) return "paid";
  return c.due < today ? "overdue" : "outstanding";
}

/** Where the money for one charge comes from: FAS budget first, then parent payments by method, and what is still owed. */
export function fundingOf(c: Charge) {
  const fromAccount = sum(c.payments.filter((p) => p.method === "Education account").map((p) => p.amount));
  const fromGateway = sum(c.payments.filter((p) => p.method === "Card / PayNow").map((p) => p.amount));
  return { fee: feeOf(c), subsidy: subsidyOf(c), scheme: c.fas, fromAccount, fromGateway, remaining: balanceOf(c) };
}

// ASSUMPTION: flat rates per scheme (real per-component tiers are Sprint 2). MOEFAS subsidises more than SBFAS.
export const MOEFAS_RATE = 0.5;
export const SBFAS_RATE = 0.2;

/** The single scheme whose subsidy applies to this student's charges: MOEFAS takes precedence over SBFAS — a student never receives both. */
export function fasOf(s: Pick<Student, "moefas" | "sbfas">): { scheme: FasScheme; rate: number } | null {
  if (s.moefas === "Approved") return { scheme: "MOEFAS", rate: MOEFAS_RATE };
  if (s.sbfas === "Approved") return { scheme: "SBFAS", rate: SBFAS_RATE };
  return null;
}

export const subsidyRate = (s: Pick<Student, "moefas" | "sbfas">) => fasOf(s)?.rate ?? 0;

export const nextChargeId = (rows: { id: string }[]) => `CH-${rows.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, "")) || 0), 1000) + 1}`;
export const nextFeeTypeId = (rows: { id: string }[]) => `FT-${String(rows.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(2, "0")}`;

export const makeCharge = (id: string, ft: FeeType, s: Student, opts?: { issued?: string; due?: string }): Charge => {
  const fas = fasOf(s);
  const issued = opts?.issued ?? TODAY;
  const due = opts?.due ?? addDays(issued, DEFAULT_DUE_DAYS);
  return {
    id, studentId: s.id, ftId: ft.id, title: ft.name, issued, due,
    fas: fas?.scheme, payments: [],
    components: ft.components.map((c) => ({ name: c.name, amount: c.amount, subsidy: Math.round(c.amount * (fas?.rate ?? 0) * 100) / 100 })),
  };
};

/** A student already holds a charge of this fee type issued on the same date (re-running the same issuance skips). */
export const alreadyCharged = (charges: Charge[], studentId: string, ft: FeeType, issued: string) =>
  charges.some((c) => c.studentId === studentId && c.ftId === ft.id && c.issued === issued);

/** ISO date `days` after `iso` (local arithmetic, kept as yyyy-mm-dd). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Next payment id inside a charge: CH-1021-P1, -P2 … */
export const nextPaymentId = (c: Charge) => `${c.id}-P${c.payments.length + 1}`;
export const makePayment = (c: Charge, amount: number, method: Payment["method"]): Payment => ({ id: nextPaymentId(c), on: TODAY, amount: Math.round(amount * 100) / 100, method });

/** Students of one class in one school. */
export const studentsOfClass = (school: string, klass: string) => STUDENTS.filter((s) => s.class === klass && schoolOfLevel(s.level) === school);

/**
 * Mock history without terms — three issuance waves per school fee type:
 *  · Aug 20 (due Sep 18): paid in full on Sep 5; every 7th student never paid → overdue
 *  · Oct 1 (due Oct 31): outstanding
 *  · supplementary (level fee, issued Oct 6): odd students paid half from the Education account
 */
export function seedCharges(): Charge[] {
  const out: Charge[] = [];
  STUDENTS.forEach((s, i) => {
    const ft = FEE_TYPES.find((f) => f.school === schoolOfLevel(s.level) && !f.level);
    if (!ft) return;
    const past = makeCharge(nextChargeId(out), ft, s, { issued: "2026-08-20", due: "2026-09-18" });
    if (i % 7 === 3) out.push(past);   // unpaid and past due → chargeStatus gives "overdue"
    else {
      const method: Payment["method"] = i % 2 ? "Education account" : "Card / PayNow";
      out.push({ ...past, payments: [{ id: `${past.id}-P1`, on: "2026-09-05", amount: payableOf(past), method }] });
    }
    out.push(makeCharge(nextChargeId(out), ft, s, { issued: "2026-10-01", due: "2026-10-31" }));
    const sup = FEE_TYPES.find((f) => f.school === ft.school && f.level === s.level);   // level-specific supplementary fee
    if (sup) {
      const c = makeCharge(nextChargeId(out), sup, s, { issued: "2026-10-06", due: "2026-11-05" });
      out.push(i % 2 ? { ...c, payments: [{ id: `${c.id}-P1`, on: "2026-10-10", amount: Math.round(payableOf(c) / 2 * 100) / 100, method: "Education account" }] } : c);
    }
  });
  return out;
}

export type Agg = { fee: number; subsidy: number; payable: number; collected: number; outstanding: number; overdue: number; unpaid: number; paid: number; fromAccount: number; fromGateway: number };
export function aggregate(rows: Charge[]): Agg {
  const paid = rows.filter((c) => chargeStatus(c) === "paid"), open = rows.filter((c) => chargeStatus(c) !== "paid");
  const f = rows.map(fundingOf);
  return {
    fee: sum(rows.map(feeOf)), subsidy: sum(rows.map(subsidyOf)), payable: sum(rows.map(payableOf)),
    // Collected = money actually received (partial payments included); outstanding = what unpaid charges still owe.
    collected: sum(rows.map(paidOf)), outstanding: sum(open.map(balanceOf)),
    overdue: rows.filter((c) => chargeStatus(c) === "overdue").length, unpaid: open.length, paid: paid.length,
    fromAccount: sum(f.map((x) => x.fromAccount)), fromGateway: sum(f.map((x) => x.fromGateway)),
  };
}

export type FeeDraft = { name: string; level: string; components: { name: string; amount: string; on: boolean }[] };
export type FeeErrors = { name?: string; components?: string; rows: Record<number, string> };

/** Unticked rows are ignored; each included row needs a name and an amount above 0 (max 2 decimals). `others` = the school's other fee types. */
export function validateFeeType(d: FeeDraft, others: FeeType[]): { errors: FeeErrors; components: FeeComponent[] } {
  const errors: FeeErrors = { rows: {} };
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  if (!norm(d.name)) errors.name = "Enter a fee type name.";
  else if (others.some((f) => norm(f.name) === norm(d.name))) errors.name = "This school already has a fee type with this name.";
  const components: FeeComponent[] = [];
  d.components.forEach((c, i) => {
    if (!c.on) return;
    const nm = c.name.trim();
    if (!nm || !/^\d{1,9}(\.\d{1,2})?$/.test(c.amount.trim()) || Number(c.amount) <= 0) errors.rows[i] = "Enter a name and an amount above 0 (max 2 decimals).";
    else components.push({ name: nm, amount: Number(c.amount) });
  });
  if (!components.length && !Object.keys(errors.rows).length) errors.components = "Include at least one component.";
  return { errors, components };
}
export const feeDraftOk = (e: FeeErrors) => !e.name && !e.components && !Object.keys(e.rows).length;
