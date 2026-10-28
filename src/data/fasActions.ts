import { fasOf } from "../lib/fees";
import { withFas } from "../lib/studentFas";
import { fasReducer, useFas, type FasAction, type SbfasSuggestion } from "./fasStore";
import { useFees } from "./feeStore";
import type { Band } from "./familyFas";
import type { FamilyApplication, FamilyDraft, HouseholdMember, TransportMode } from "./familyApplications";
import { useRegistry } from "./registryStore";
import { useSbfas } from "./sbfasStore";
import { levelForBands, ruleForSchool, suggestedTierOf, subsidySummary, type SbfasRule } from "./sbfasRule";
import { schoolOfLevel } from "./schoolMgmt";
import type { Action, Draft } from "../features/admin/fas/review";

/** The parent form's per-person band mapped onto HQ's default per-capita income tiers (0-based). b3 spans tiers 4-5 (S$1,001-S$1,500); only its SBFAS tier (5) reaches a school. */
const PCI_OF_BAND: Record<string, number> = { b1: 1, b2: 2, b3: 4, b4: 5 };

/** What the school's grouping suggests for a per-capita band, with the fallback tier the school actually offers. */
export const suggestionOf = (rule: SbfasRule, pci: number): SbfasSuggestion => {
  const level = levelForBands(rule, null, pci);
  const tier = level ? suggestedTierOf(rule.levelTiers[level]) : null;
  // The explanation tells the reviewer what the suggested tier is worth — % of the fee or a fixed amount,
  // as a range across fee components when the school customises them differently.
  const tt = tier ? rule.tiers.find((x) => x.tier === tier) : undefined;
  // Nothing mapped for this band: suggest Tier 3 if the school offers it, else its last tier — never a tier it does not have.
  const fallback = (rule.tiers.find((t) => t.tier === "Tier 3") ?? rule.tiers[rule.tiers.length - 1]).tier;
  return { level, tier, fallback, subsidy: tt ? ` (${subsidySummary(tt, rule.coveredComponents)} subsidy)` : undefined };
};

/**
 * The things that change a student's FAS: the school deciding an SBFAS application, the parent submitting
 * the family application, the school entering a paper (hardcopy) application, and a parent re-request
 * after a rejection (the same application requeued). All go through here so the FAS store and the
 * student's unpaid charges always change together.
 */
export function useFasActions() {
  const fas = useFas();
  const fees = useFees();
  const sbfas = useSbfas();
  const { state: reg } = useRegistry();

  // Only actions that change a student's FAS (and carry `at`) go through here; draft issuing does not.
  const run = (action: Extract<FasAction, { at: string }>, studentIds: string[]) => {
    const after = fasReducer(fas.state, action);
    fas.dispatch(action);
    for (const id of studentIds) {
      const student = reg.students.find((s) => s.id === id);
      if (!student) continue;
      const was = fasOf(withFas(student, fas.state));
      const now = fasOf(withFas(student, after));
      if (was?.scheme !== now?.scheme || was?.rate !== now?.rate) fees.dispatch({ type: "applyFas", studentId: id, fas: now, on: action.at.slice(0, 10) });
    }
  };

  const suggest = (studentIds: string[], band: Band): Record<string, SbfasSuggestion> => {
    // Each child is assessed against their OWN school's grouping — children may attend different schools.
    const pci = PCI_OF_BAND[band.id] ?? 4;
    const recommend: Record<string, SbfasSuggestion> = {};
    for (const id of studentIds) {
      const student = reg.students.find((s) => s.id === id);
      if (!student) continue;
      recommend[id] = suggestionOf(ruleForSchool(sbfas.state.rules, schoolOfLevel(student.level)), pci);
    }
    return recommend;
  };

  return {
    decide(id: string, action: Action, draft: Draft) {
      const app = fas.state.apps.find((a) => a.id === id);
      if (app) run({ type: "decide", id, action, draft, at: new Date().toISOString() }, [app.studentId]);
    },
    submitFamily(studentIds: string[], band: Band) {
      run({ type: "submitFamily", studentIds, band, at: new Date().toISOString(), recommend: suggest(studentIds, band) }, studentIds);
    },
    submitHardcopy(input: {
      studentIds: string[]; band: Band; school: string; applicant: string; contact: string; note: string; by: string; entryMode: "manual" | "ocr";
      address?: string; email?: string; extraIncome?: number; residents?: number; transportMode?: TransportMode;
      hasAdminIncome?: boolean; household?: HouseholdMember[];
      welfareHome?: boolean; welfareLetter?: FamilyApplication["welfareLetter"]; homesOnly?: boolean; imdaHardcopy?: "yes" | "no"; declaredAt?: string; formFile?: string;
      /** The guardian NRIC the form was issued under — closes the family's open draft on submit. */
      guardianNric?: string;
      /** The DRF no. printed on the returned paper — closes exactly that draft (several can be open
       *  for one family after a re-issue). */
      draftId?: string;
      /** Section II evidence handed in with the returned form — one list per declaration (mock: file names). */
      extraIncomeDocs?: string[];
      residentsDocs?: string[];
      /** True when the parent ticked No on the contact-details question — contact/address are the
       *  corrected values they wrote on the returned form. */
      detailsCorrected?: boolean;
    }) {
      run({
        type: "submitHardcopy", ...input, at: new Date().toISOString(), recommend: suggest(input.studentIds, input.band),
      }, input.studentIds);
    },
    // The parent asked again after a rejection: the SAME application returns to the queue with the
    // reason logged as its next round — the child goes back to "awaiting", so fees re-check too.
    requeueSbfas(input: { studentId: string; reason: string; by?: string }) {
      run({ type: "requeueSbfas", ...input, at: new Date().toISOString() }, [input.studentId]);
    },
    // Issuing a form touches no student's FAS, so it goes straight to the store — no fee sync.
    issueDraft(draft: FamilyDraft) {
      fas.dispatch({ type: "issueDraft", draft });
    },
    voidDraft(id: string) {
      fas.dispatch({ type: "voidDraft", id });
    },
  };
}
