import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { applyDecision, isGranted, type Action, type Draft } from "../features/admin/fas/review";
import { sbfasUsage } from "../lib/budget";
import { MOEFAS_BY_LEVEL, MOEFAS_BY_TIER, MOEFAS_TIER_AMOUNT, SBFAS, SBFAS_BY_TIER, SBFAS_TIER_AMOUNT, type LevelBudget } from "./budgets";
import type { Band } from "./familyFas";
import { nextSbfasId, SBFAS_APPLICATIONS, type SbfasApplication, type SbfasTier } from "./sbfasApplications";
import { STUDENTS } from "./students";

// ASSUMPTION: FAS decisions and budgets live in memory only and reset on reload (no backend), like the fee store.
export type BudgetScope = "MOEFAS" | "SBFAS";
export type BudgetChange = { id: string; scope: BudgetScope; target: string; from: number; to: number; by: string; at: string };
/** MOEFAS is granted automatically by criteria; one grant per student, by student id. */
export type MoefasGrant = { tier: SbfasTier; at: string };
export type FasState = { apps: SbfasApplication[]; sbfasBudget: number; levels: LevelBudget[]; history: BudgetChange[]; moefas: Record<string, MoefasGrant> };
export type FasAction =
  | { type: "decide"; id: string; action: Action; draft: Draft; at: string }
  | { type: "submitFamily"; studentIds: string[]; band: Band; at: string; start?: Record<string, SbfasTier> }
  | { type: "addHardcopy"; studentId: string; incomeBand: string; householdBand: string; note: string; at: string; by: string; start?: SbfasTier }
  | { type: "setBudget"; scope: BudgetScope; target: string; amount: number; by: string; at: string };

export const initialFasState = (): FasState => ({ apps: SBFAS_APPLICATIONS, sbfasBudget: SBFAS.budget, levels: MOEFAS_BY_LEVEL, history: [], moefas: {} });

// ASSUMPTION: no model scores a family-submitted application yet, so it gets a neutral mock score and the school's
// entry rank — the school reviews the household and decides the rank case by case.
const FAMILY_EXPLANATION = "Submitted by the family through the FAS form and referred by MOE after it fell outside the MOEFAS income bands. The income band was read from the MyInfo (SingPass) API. No fee history is available yet, so the model gives a neutral score; review the household and the student's fees, then decide the rank yourself.";

/** Pure. A decision is always recorded, even when the budget is already used up (overspend only warns). */
export function fasReducer(state: FasState, a: FasAction): FasState {
  if (a.type === "decide") {
    const apps = applyDecision(state.apps, a.id, a.action, a.draft).map((x) => (x.id === a.id ? { ...x, decidedAt: a.at } : x));
    return { ...state, apps };
  }
  if (a.type === "submitFamily") {
    let apps = state.apps;
    const moefas = { ...state.moefas };
    for (const id of a.studentIds) {
      const student = STUDENTS.find((s) => s.id === id);
      if (!student || moefas[id] || apps.some((x) => x.studentId === id)) continue; // one application and one grant per student
      if (a.band.tier === "MOEFAS Tier 1" || a.band.tier === "MOEFAS Tier 2") moefas[id] = { tier: a.band.tier.replace("MOEFAS ", "") as SbfasTier, at: a.at };
      // ASSUMPTION: the school has 10 working days to decide a new application.
      else if (a.band.tier === "SBFAS") {
        apps = [...apps, {
          id: nextSbfasId(apps), student: student.name, studentId: id, level: student.level,
          incomeBand: a.band.label, incomeSyncedOn: a.at.slice(0, 10), source: "MOE referral", riskScore: 50,
          // The starting rank only — the school decides the final rank case by case.
          recommendedTier: a.start?.[id] ?? "Tier 3", slaDays: 10,
          explanation: FAMILY_EXPLANATION,
          status: "Pending",
        }];
      }
    }
    return { ...state, apps, moefas };
  }
  if (a.type === "addHardcopy") {
    // A paper form the school enters by hand — the same one-application-per-student rule applies.
    const student = STUDENTS.find((s) => s.id === a.studentId);
    if (!student || state.moefas[a.studentId] || state.apps.some((x) => x.studentId === a.studentId)) return state;
    // ASSUMPTION: the school has 10 working days to decide a new application, referred or on paper.
    return {
      ...state,
      apps: [...state.apps, {
        id: nextSbfasId(state.apps), student: student.name, studentId: student.id, level: student.level,
        incomeBand: a.incomeBand, householdBand: a.householdBand, source: "Hardcopy",
        riskScore: 50,
        // The starting rank only — the school decides the final rank case by case.
        recommendedTier: a.start ?? "Tier 3", slaDays: 10,
        explanation: `Paper form entered at the school by ${a.by}${a.note.trim() ? ` — note on the form: ${a.note.trim()}` : ""}. Income bands are read from the paper form (no MyInfo sync), so the model gives a neutral score; review the household and the student's fees, then decide the rank yourself.`,
        status: "Pending",
      }],
    };
  }
  const from = a.scope === "SBFAS" ? state.sbfasBudget : (state.levels.find((l) => l.id === a.target)?.budget ?? 0);
  const entry: BudgetChange = { id: `BC-${state.history.length + 1}`, scope: a.scope, target: a.target, from, to: a.amount, by: a.by, at: a.at };
  return {
    ...state,
    sbfasBudget: a.scope === "SBFAS" ? a.amount : state.sbfasBudget,
    levels: a.scope === "MOEFAS" ? state.levels.map((l) => (l.id === a.target ? { ...l, budget: a.amount } : l)) : state.levels,
    history: [entry, ...state.history],
  };
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** School view. The seeded figures are what was granted before this queue; live decisions add on top. */
export function selectSbfas(s: FasState) {
  const live = sbfasUsage(s.apps);
  const used = SBFAS.absorbed + live.amount;
  return {
    budget: s.sbfasBudget,
    used,
    remaining: s.sbfasBudget - used,
    helped: sum(SBFAS_BY_TIER.map((t) => t.value)) + live.count,
    byTier: SBFAS_BY_TIER.map((t) => ({ label: t.label, value: t.value + (live.byTier[t.label as keyof typeof live.byTier] ?? 0) })),
  };
}

/** HQ view. The seeded spend is what was granted before; MOEFAS granted through parent applications adds on top, by the child's level. */
export function selectMoefas(s: FasState) {
  const grants = Object.entries(s.moefas).flatMap(([id, g]) => {
    const student = STUDENTS.find((x) => x.id === id);
    return student ? [{ g, level: student.level.startsWith("P") ? "Primary" : "Secondary" }] : [];
  });
  const levels = s.levels.map((l) => {
    const mine = grants.filter((x) => x.level === l.id);
    return { ...l, used: l.used + sum(mine.map((x) => MOEFAS_TIER_AMOUNT[x.g.tier] ?? 0)), beneficiaries: l.beneficiaries + mine.length };
  });
  const budget = sum(levels.map((l) => l.budget));
  const used = sum(levels.map((l) => l.used));
  return {
    levels, budget, used, remaining: budget - used, helped: sum(levels.map((l) => l.beneficiaries)),
    byTier: MOEFAS_BY_TIER.map((t) => ({ label: t.label, value: t.value + grants.filter((x) => x.g.tier === t.label).length })),
  };
}

/** What the parent is told about one child: the scheme, whether it is granted yet, and why not if refused. null = no application. */
export type ChildFas = { scheme: "MOEFAS" | "SBFAS"; status: "Granted" | "Awaiting school decision" | "Not granted"; tier?: string; reason?: string };
export function selectChildFas(s: FasState, studentId: string): ChildFas | null {
  const grant = s.moefas[studentId];
  if (grant) return { scheme: "MOEFAS", status: "Granted", tier: grant.tier };
  const a = s.apps.find((x) => x.studentId === studentId);
  if (!a) return null;
  if (a.status === "Approved" || a.status === "Overridden") return { scheme: "SBFAS", status: "Granted", tier: a.sbfasTier };
  if (a.status === "Rejected") return { scheme: "SBFAS", status: "Not granted", reason: a.justification };
  return { scheme: "SBFAS", status: "Awaiting school decision" };
}

/** The school's latest SBFAS grants, newest first. Only decided, granted applications appear. */
export function selectRecentGrants(s: FasState, limit = 5) {
  return s.apps
    .filter((a) => isGranted(a) && a.sbfasTier && a.decidedAt)
    .sort((x, y) => y.decidedAt!.localeCompare(x.decidedAt!))
    .slice(0, limit)
    .map((a) => ({ id: a.id, studentId: a.studentId, student: a.student, level: a.level, tier: a.sbfasTier!, amount: SBFAS_TIER_AMOUNT[a.sbfasTier!] ?? 0, at: a.decidedAt! }));
}

/** Same shape the dashboard Budget Usage card always used. */
export function selectBudgets(s: FasState) {
  const m = selectMoefas(s);
  const b = selectSbfas(s);
  return [
    { name: "MOEFAS", owner: "MOE HQ", used: m.used, budget: m.budget },
    { name: "SBFAS", owner: "School", used: b.used, budget: b.budget },
  ];
}

const Ctx = createContext<{ state: FasState; dispatch: Dispatch<FasAction> } | null>(null);

export function FasProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(fasReducer, undefined, initialFasState);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useFas() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useFas must be used inside FasProvider");
  return c;
}
