import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { SBFAS_APPLICATIONS, applyDecision, type Action, type Draft, type SbfasApplication } from "./sbfasApplications";
import { SEED_RULES, activateSbfasRule, type SbfasRule } from "./sbfasRule";

// ASSUMPTION: decision state lives in memory only and resets on reload (no backend), like the fee store.
// It lives at the provider level so decisions survive navigating between admin features.
export type SbfasState = { apps: SbfasApplication[]; rules: Record<string, SbfasRule[]> };
export type SbfasAction =
  | { type: "decide"; id: string; action: Action; draft: Draft }
  | { type: "save-rule"; rule: SbfasRule }
  | { type: "activate-rule"; school: string; id: string };

export const initialSbfasState = (): SbfasState => ({ apps: SBFAS_APPLICATIONS, rules: SEED_RULES });

/**
 * Pure. decide records an approve/override/reject on one application (validation happens in the review modal).
 * save-rule upserts one version of a school's package (by id). activate-rule makes exactly one version Active —
 * the previous Active version becomes Inactive, the same lifecycle as HQ's FAS rules. Schools that never
 * activated anything fall back to the default package.
 */
export function sbfasReducer(state: SbfasState, a: SbfasAction): SbfasState {
  if (a.type === "decide") return { ...state, apps: applyDecision(state.apps, a.id, a.action, a.draft) };
  if (a.type === "save-rule") {
    const mine = state.rules[a.rule.school] ?? [];
    const upsert = mine.some((r) => r.id === a.rule.id) ? mine.map((r) => (r.id === a.rule.id ? a.rule : r)) : [...mine, a.rule];
    return { ...state, rules: { ...state.rules, [a.rule.school]: upsert } };
  }
  if (a.type === "activate-rule") {
    const mine = state.rules[a.school] ?? [];
    if (!mine.some((r) => r.id === a.id)) return state;
    return { ...state, rules: { ...state.rules, [a.school]: activateSbfasRule(mine, a.id) } };
  }
  return state;
}

const Ctx = createContext<{ state: SbfasState; dispatch: Dispatch<SbfasAction> } | null>(null);

export function SbfasProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sbfasReducer, undefined, initialSbfasState);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useSbfas() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSbfas must be used inside SbfasProvider");
  return c;
}
