import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { isGranted, type Action, type Draft } from "../features/admin/fas/review";
import { sbfasUsage } from "../lib/budget";
import { MOEFAS_BY_LEVEL, MOEFAS_BY_TIER, MOEFAS_TIER_AMOUNT, SBFAS, SBFAS_BY_TIER, SBFAS_TIER_AMOUNT, type LevelBudget } from "./budgets";
import type { Band } from "./familyFas";
import { nextFamilyId, type FamilyApplication, type FamilyChild, type FamilyDraft, type HouseholdMember, type TransportMode } from "./familyApplications";
import { normNric } from "./familyRegistry";
import { applyDecision, applyRequeue, attemptOf, nextSbfasId, SBFAS_APPLICATIONS, yearOf, type SbfasApplication, type SbfasTier } from "./sbfasApplications";
import type { RiskLevel } from "./sbfasRule";
import { LEVELS, STUDENTS } from "./students";

// ASSUMPTION: FAS decisions and budgets live in memory only and reset on reload (no backend), like the fee store.
export type BudgetScope = "MOEFAS" | "SBFAS";
export type BudgetChange = { id: string; scope: BudgetScope; target: string; from: number; to: number; by: string; at: string };
/** MOEFAS is granted automatically by criteria; one grant per student, by student id. */
export type MoefasGrant = { tier: SbfasTier; at: string };
/** What the school's grouping suggests for one student, computed at arrival and stored static thereafter. */
export type SbfasSuggestion = { level: RiskLevel | null; tier: SbfasTier | null; fallback?: SbfasTier; subsidy?: string };
export type FasState = { apps: SbfasApplication[]; sbfasBudget: number; levels: LevelBudget[]; history: BudgetChange[]; moefas: Record<string, MoefasGrant>; familyApps: FamilyApplication[]; drafts: FamilyDraft[] };
export type FasAction =
  | { type: "decide"; id: string; action: Action; draft: Draft; at: string }
  | { type: "submitFamily"; studentIds: string[]; band: Band; at: string; recommend?: Record<string, SbfasSuggestion> }
  | { type: "submitHardcopy"; studentIds: string[]; band: Band; school: string; applicant: string; contact: string; note: string; by: string; entryMode: "manual" | "ocr"; at: string; address?: string; email?: string; extraIncome?: number; residents?: number; transportMode?: TransportMode; hasAdminIncome?: boolean; household?: HouseholdMember[]; welfareHome?: boolean; welfareLetter?: FamilyApplication["welfareLetter"]; homesOnly?: boolean; imdaHardcopy?: "yes" | "no"; declaredAt?: string; formFile?: string; guardianNric?: string; draftId?: string; extraIncomeDocs?: string[]; residentsDocs?: string[]; detailsCorrected?: boolean; recommend?: Record<string, SbfasSuggestion> }
  | { type: "requeueSbfas"; studentId: string; reason: string; by?: string; at: string }
  | { type: "issueDraft"; draft: FamilyDraft }
  | { type: "voidDraft"; id: string }
  | { type: "setBudget"; scope: BudgetScope; target: string; amount: number; by: string; at: string };

/** Demo paper forms a School user already scanned in, so MOE sees hardcopy rows (Source + uploaded scan) before anyone submits one. */
const SEED_HARDCOPY: FamilyApplication[] = [
  {
    id: "FAS20260008", channel: "Hardcopy", school: "Riverbank Primary School", applicant: "Benson Chua", contact: "+65 8112 9743",
    address: "Blk 412 Bedok North Ave 2, #08-115, Singapore 460412", bandLabel: "GHI Tier 1 · $0 – $2,000", homesOnly: true,
    transportMode: "Public transport", declaredAt: "2026-10-18", enteredBy: "Marcus Ong", entryMode: "ocr", formFile: "MOE-FAS-form-chua-signed.pdf",
    at: "2026-10-18T02:15:00.000Z", children: [{ studentId: "S20260009", student: "Chua Jia Hui", level: "P2", outcome: "MOEFAS granted", tier: "Tier 1" }],
  },
];

export const initialFasState = (): FasState => ({ apps: SBFAS_APPLICATIONS, sbfasBudget: SBFAS.budget, levels: MOEFAS_BY_LEVEL, history: [], moefas: {}, familyApps: [], drafts: [] });

/** Keying in a returned form closes the loop on its draft record: the family's open draft flips to
 *  "returned" and links to the application the copy became. The returned paper names its own DRF no.
 *  (it is printed in the form header), so an explicit `draftId` closes exactly that draft; without
 *  one the match falls back to the guardian NRIC (tolerant of case/spacing) and only the LATEST open
 *  draft closes — a re-issued form (first copy lost) leaves the older prints open. */
const markReturned = (drafts: FamilyDraft[], guardianNric: string | undefined, appId: string, at: string, draftId?: string): FamilyDraft[] => {
  const close = (d: FamilyDraft): FamilyDraft => ({ ...d, status: "returned", returnedAppId: appId, returnedAt: at.slice(0, 10) });
  if (draftId) {
    const exact = drafts.find((d) => d.id === draftId && d.status === "draft");
    return exact ? drafts.map((d) => (d === exact ? close(d) : d)) : drafts;
  }
  if (!guardianNric) return drafts;
  const key = normNric(guardianNric);
  let done = false; // drafts are stored newest-first, so the first match is the latest print
  return drafts.map((d) => {
    if (done || d.status !== "draft" || normNric(d.guardianNric) !== key) return d;
    done = true;
    return close(d);
  });
};

// ASSUMPTION: no model scores a family-submitted application yet, so it gets a neutral mock score and tier for the school to review.
const FAMILY_EXPLANATION = "Submitted by the family through the FAS form. The income band was read from the MyInfo (SingPass) API. No fee history is available yet, so the model gives a neutral score; review the household and the student's fees before deciding.";

/** Pure. A decision is always recorded, even when the budget is already used up (overspend only warns). */
export function fasReducer(state: FasState, a: FasAction): FasState {
  if (a.type === "issueDraft") {
    // Every printed form is remembered (Sherly: "the system should put as draft") — one draft per id,
    // so printing the same form twice does not create a second record.
    return state.drafts.some((d) => d.id === a.draft.id) ? state : { ...state, drafts: [a.draft, ...state.drafts] };
  }
  if (a.type === "voidDraft") {
    return { ...state, drafts: state.drafts.filter((d) => d.id !== a.id) };
  }
  if (a.type === "decide") {
    return { ...state, apps: applyDecision(state.apps, a.id, a.action, a.draft, a.at) };
  }
  if (a.type === "submitFamily") {
    let apps = state.apps;
    const moefas = { ...state.moefas };
    const yr = Number(a.at.slice(0, 4));
    for (const id of a.studentIds) {
      const student = STUDENTS.find((s) => s.id === id);
      // One application and one grant per student PER YEAR (FAS runs per year): last year's record
      // does not block this year's — the new year files its own application.
      if (!student || moefas[id] || apps.some((x) => x.studentId === id && yearOf(x) === yr)) continue;
      if (a.band.tier === "MOEFAS Tier 1" || a.band.tier === "MOEFAS Tier 2") moefas[id] = { tier: a.band.tier.replace("MOEFAS ", "") as SbfasTier, at: a.at };
      // ASSUMPTION: the school has 10 working days to decide a new application.
      else if (a.band.tier === "SBFAS") {
        const rec = a.recommend?.[id];
        apps = [...apps, {
          id: nextSbfasId(apps), student: student.name, studentId: id, level: student.level, year: yr,
          incomeBand: a.band.label, incomeSyncedOn: a.at.slice(0, 10), source: "MOE referral", riskScore: 50,
          recommendedTier: rec?.tier ?? rec?.fallback ?? "Tier 3", slaDays: 10,
          rounds: [{ at: a.at, note: "First request" }],
          explanation: rec?.level
            ? `Submitted by the family through the FAS form. ${a.band.label} is grouped ${rec.level} by the school's SBFAS rules${rec.tier ? `, suggesting ${rec.tier}${rec.subsidy ?? ""}` : " but no tier is mapped to that level"} — review the household and the student's fees before deciding.`
            : FAMILY_EXPLANATION,
          status: "Pending",
        }];
      }
    }
    return { ...state, apps, moefas };
  }
  if (a.type === "submitHardcopy") {
    // A paper form a School user scanned in for a parent who cannot use the e-Service portal.
    // It goes through the SAME assessment as an online application (US-029 / AC-029): MOEFAS first,
    // and every child outside the MOEFAS bands is referred down to the school's own SBFAS queue.
    const faId = nextFamilyId(state.familyApps);
    let apps = state.apps;
    const moefas = { ...state.moefas };
    const children: FamilyChild[] = [];
    const yr = Number(a.at.slice(0, 4));
    for (const id of a.studentIds) {
      const student = STUDENTS.find((s) => s.id === id);
      if (!student) continue;
      if (moefas[id] || apps.some((x) => x.studentId === id && yearOf(x) === yr)) {
        // Cross-channel duplicate guard (AC-031, per year): one application per student THIS year,
        // paper or online — last year's record does not block this year's form. The school user
        // transcribes the form as the parent filled it, so the child STAYS on the family record —
        // marked covered — instead of a second application being created.
        children.push({ studentId: id, student: student.name, level: student.level, outcome: "Already covered" });
        continue;
      }
      if (a.band.tier === "MOEFAS Tier 1" || a.band.tier === "MOEFAS Tier 2") {
        const tier = a.band.tier.replace("MOEFAS ", "") as SbfasTier;
        moefas[id] = { tier, at: a.at };
        children.push({ studentId: id, student: student.name, level: student.level, outcome: "MOEFAS granted", tier });
        continue;
      }
      // ASSUMPTION (AC-024-02): a paper form outside the MOEFAS bands — including the band above both
      // schemes — is still a submitted application, so it is referred down instead of vanishing.
      const rec = a.recommend?.[id];
      apps = [...apps, {
        id: nextSbfasId(apps), student: student.name, studentId: id, level: student.level, year: yr,
        incomeBand: a.band.label, source: "MOE referral", familyAppId: faId, enteredBy: a.by, riskScore: 50,
        recommendedTier: rec?.tier ?? rec?.fallback ?? "Tier 3", slaDays: 10,
        rounds: [{ at: a.at, note: "First request" }],
        explanation: `Paper form ${a.entryMode === "ocr" ? "scanned and read by OCR, then checked" : "keyed in"} by ${a.by} for ${a.applicant}${a.note.trim() ? ` — note on the form: ${a.note.trim()}` : ""}. MOEFAS was assessed first and not granted for this band, so the case is referred to the school. The income band comes from the paper form (no MyInfo sync); review the household and the student's fees before deciding.`,
        status: "Pending",
      }];
      children.push({ studentId: id, student: student.name, level: student.level, outcome: "MOEFAS not granted" });
    }
    if (!children.some((c) => c.outcome !== "Already covered")) return state; // nothing new: every child already had an application or a grant
    const familyApp: FamilyApplication = {
      id: faId, channel: "Hardcopy", school: a.school, applicant: a.applicant, contact: a.contact, bandLabel: a.band.label,
      address: a.address || undefined, email: a.email || undefined, contactCorrected: a.detailsCorrected || undefined,
      extraIncome: a.extraIncome, residents: a.residents, transportMode: a.transportMode,
      hasAdminIncome: a.hasAdminIncome, household: a.hasAdminIncome ? a.household : undefined,
      welfareHome: a.welfareHome, welfareLetter: a.welfareHome ? a.welfareLetter : undefined,
      homesOnly: a.homesOnly || undefined,
      imdaHardcopy: a.imdaHardcopy, declaredAt: a.declaredAt, note: a.note.trim() || undefined,
      extraIncomeDocs: a.extraIncomeDocs?.length ? a.extraIncomeDocs : undefined,
      residentsDocs: a.residentsDocs?.length ? a.residentsDocs : undefined,
      enteredBy: a.by, entryMode: a.entryMode, formFile: a.formFile, at: a.at, children,
    };
    return { ...state, apps, moefas, familyApps: [familyApp, ...state.familyApps], drafts: markReturned(state.drafts, a.guardianNric, faId, a.at, a.draftId) };
  }
  if (a.type === "requeueSbfas") {
    // The parent asked again after a rejection (Sprint 3): the SAME application returns to the
    // school's queue with the reason logged as its next round — one record per child PER YEAR,
    // never a second record, and no MOE re-assessment. A decision change never crosses years:
    // only THIS year's rejection can be requeued (a new year files a new application).
    const yr = Number(a.at.slice(0, 4));
    const mine = state.apps.filter((x) => x.studentId === a.studentId && yearOf(x) === yr);
    if (state.moefas[a.studentId] || mine.some((x) => x.status === "Pending") || !a.reason.trim()) return state;
    const rejected = mine.filter((x) => x.status === "Rejected").sort((x, y) => attemptOf(y) - attemptOf(x))[0];
    if (!rejected) return state;
    return { ...state, apps: applyRequeue(state.apps, rejected.id, a.reason.trim(), a.by ?? "School user", a.at) };
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

/** Seeded plus live SBFAS grants per tier and class (P1 ... Sec 4), including tiers the school added beyond the seeded four. */
function sbfasByTier(apps: SbfasApplication[]) {
  const live = Object.fromEntries(LEVELS.map((c) => [c, sbfasUsage(apps.filter((a) => a.level === c)).byTier]));
  const labels = [...new Set([...SBFAS_BY_TIER.map((t) => t.label), ...LEVELS.flatMap((c) => Object.keys(live[c]))])];
  return labels.map((label) => {
    const seed = SBFAS_BY_TIER.find((t) => t.label === label);
    const by = Object.fromEntries(LEVELS.map((c, i) => [c, (seed?.byClass[i] ?? 0) + (live[c][label] ?? 0)]));
    return { label, by, value: sum(Object.values(by)) };
  });
}

/** School view. The seeded figures are what was granted before this queue; live decisions add on top. */
export function selectSbfas(s: FasState) {
  const live = sbfasUsage(s.apps);
  const used = SBFAS.absorbed + live.amount;
  return {
    budget: s.sbfasBudget,
    used,
    remaining: s.sbfasBudget - used,
    helped: sum(SBFAS_BY_TIER.flatMap((t) => t.byClass)) + live.count,
    byTier: sbfasByTier(s.apps),
  };
}

/** HQ view. The seeded spend is what was granted before; MOEFAS granted through parent applications adds on top, by the child's level. */
export function selectMoefas(s: FasState) {
  const grants = Object.entries(s.moefas).flatMap(([id, g]) => {
    const student = STUDENTS.find((x) => x.id === id);
    return student ? [{ g, cls: student.level as string, level: student.level.startsWith("P") ? "Primary" : "Secondary" }] : [];
  });
  const levels = s.levels.map((l) => {
    const mine = grants.filter((x) => x.level === l.id);
    return { ...l, used: l.used + sum(mine.map((x) => MOEFAS_TIER_AMOUNT[x.g.tier] ?? 0)), beneficiaries: l.beneficiaries + mine.length };
  });
  const budget = sum(levels.map((l) => l.budget));
  const used = sum(levels.map((l) => l.used));
  return {
    levels, budget, used, remaining: budget - used, helped: sum(levels.map((l) => l.beneficiaries)),
    byTier: MOEFAS_BY_TIER.map((t) => {
      const by = Object.fromEntries(LEVELS.map((c, i) => [c, t.byClass[i] + grants.filter((x) => x.cls === c && x.g.tier === t.label).length]));
      return { label: t.label, by, value: sum(Object.values(by)) };
    }),
  };
}

/** The student's most recent SBFAS application — newest year first, then the latest round in that
 *  year: the one every live outcome (fees, child status) reads from. */
export const latestAppFor = (apps: SbfasApplication[], studentId: string): SbfasApplication | undefined =>
  apps.filter((x) => x.studentId === studentId).sort((x, y) => yearOf(y) - yearOf(x) || attemptOf(y) - attemptOf(x))[0];

/** What the parent is told about one child: the scheme, whether it is granted yet, and why not if refused. null = no application. */
export type ChildFas = { scheme: "MOEFAS" | "SBFAS"; status: "Granted" | "Awaiting school decision" | "Not granted"; tier?: string; reason?: string };
export function selectChildFas(s: FasState, studentId: string): ChildFas | null {
  const grant = s.moefas[studentId];
  if (grant) return { scheme: "MOEFAS", status: "Granted", tier: grant.tier };
  const a = latestAppFor(s.apps, studentId);
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
  const [state, dispatch] = useReducer(fasReducer, undefined, () => ({ ...initialFasState(), familyApps: SEED_HARDCOPY }));
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useFas() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useFas must be used inside FasProvider");
  return c;
}
