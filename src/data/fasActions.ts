import { fasOf } from "../lib/fees";
import { withFas } from "../lib/studentFas";
import { fasReducer, useFas, type FasAction } from "./fasStore";
import { useFees } from "./feeStore";
import type { Band } from "./familyFas";
import { useRegistry } from "./registryStore";
import { useSbfas } from "./sbfasStore";
import { entryTierOf, ruleForSchool } from "./sbfasRule";
import { schoolOfLevel } from "./schoolMgmt";
import type { SbfasTier } from "./sbfasApplications";
import type { Action, Draft } from "../features/admin/fas/review";

/**
 * The three things that change a student's FAS: the school deciding an SBFAS application, the parent submitting
 * the family application, and the school entering a paper (hardcopy) application. All go through here so the
 * FAS store and the student's unpaid charges always change together.
 */
export function useFasActions() {
  const fas = useFas();
  const fees = useFees();
  const sbfas = useSbfas();
  const { state: reg } = useRegistry();

  const run = (action: FasAction, studentIds: string[]) => {
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

  return {
    decide(id: string, action: Action, draft: Draft) {
      const app = fas.state.apps.find((a) => a.id === id);
      if (app) run({ type: "decide", id, action, draft, at: new Date().toISOString() }, [app.studentId]);
    },
    submitFamily(studentIds: string[], band: Band) {
      // No band-to-rank mapping: every child starts at the school's entry rank and the school decides from there.
      const start: Record<string, SbfasTier> = {};
      for (const id of studentIds) {
        const student = reg.students.find((s) => s.id === id);
        if (!student) continue;
        const rule = ruleForSchool(sbfas.state.rules, schoolOfLevel(student.level));
        start[id] = entryTierOf(rule);
      }
      run({ type: "submitFamily", studentIds, band, at: new Date().toISOString(), start }, studentIds);
    },
    addHardcopy(input: { studentId: string; incomeBand: string; householdBand: string; note: string; by: string }) {
      const student = reg.students.find((s) => s.id === input.studentId);
      if (!student) return;
      const rule = ruleForSchool(sbfas.state.rules, schoolOfLevel(student.level));
      run({
        type: "addHardcopy", studentId: input.studentId, incomeBand: input.incomeBand, householdBand: input.householdBand,
        note: input.note, by: input.by, at: new Date().toISOString(), start: entryTierOf(rule),
      }, [input.studentId]);
    },
  };
}
