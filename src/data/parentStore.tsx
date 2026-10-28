import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import type { ProfileForm } from "../features/eservice/overview/summary";
import { familyChildren, familyInvoices, familyTransactions, payActions } from "../lib/family";
import { useFasActions } from "./fasActions";
import { selectChildFas, useFas, type ChildFas } from "./fasStore";
import { useFees } from "./feeStore";
import type { Band } from "./familyFas";
import { profile, type Child, type Invoice, type Profile, type Transaction } from "./parent";
import { useMovements } from "./movements";
import { useRegistry } from "./registryStore";
import { useTopUp } from "./topupStore";

// ASSUMPTION: the parent's own state (profile edits and where the family FAS application stands) lives in memory only and resets on reload.
// Everything else the parent sees is derived from the school side (fees, Education Accounts, FAS decisions), so both portals always agree.
/** Where the family's FAS application stands: nothing started, being prepared, or submitted (then under review). */
export type FasStage = "not-started" | "preparing" | "submitted";
/** Extra monthly money and current residents, kept for the GHI / PCI calculation later. */
export type FasDetails = { extraIncome: number; residents: number };
export type FasProgress = { stage: FasStage; submittedOn?: string; details?: FasDetails };
type Local = { profile: Profile; fas: FasProgress };
export type ParentState = Local & { invoices: Invoice[]; children: Child[]; transactions: Transaction[]; outcomes: Record<string, ChildFas | null> };

type LocalAction =
  | { type: "saveProfile"; form: ProfileForm }
  | { type: "startFas" }
  | { type: "submitFas"; date: string; band: Band; details?: FasDetails };
export type ParentAction = LocalAction | { type: "pay"; ids: string[]; date: string } | { type: "reapplyFas"; reason: string };

export const initialParentState: Local = { profile, fas: { stage: "not-started" } };

/** Pure: saveProfile merges the editable fields; startFas and submitFas move the application forward one stage. */
export function parentReducer(state: Local, action: LocalAction): Local {
  switch (action.type) {
    case "saveProfile":
      return { ...state, profile: { ...state.profile, ...action.form } };
    case "startFas":
      return state.fas.stage === "not-started" ? { ...state, fas: { stage: "preparing" } } : state;
    case "submitFas":
      return state.fas.stage === "preparing" ? { ...state, fas: { stage: "submitted", submittedOn: action.date, details: action.details } } : state;
  }
}

const Ctx = createContext<{ state: ParentState; dispatch: Dispatch<ParentAction> } | null>(null);

export function ParentProvider({ children: kids }: { children: ReactNode }) {
  const [local, dispatchLocal] = useReducer(parentReducer, initialParentState);
  const fees = useFees();
  const fas = useFas();
  const { state: reg } = useRegistry();
  const movements = useMovements();
  const topUps = useTopUp().state.entries;
  const actions = useFasActions();

  const state = useMemo<ParentState>(() => {
    const children = familyChildren(reg.students, movements, reg.schools, reg.classes);
    const ids = children.map((c) => c.id);
    return {
      ...local,
      children,
      invoices: familyInvoices(fees.state.charges, ids),
      transactions: familyTransactions(fees.state.charges, reg.students.filter((s) => ids.includes(s.id)), topUps),
      outcomes: Object.fromEntries(ids.map((id) => [id, selectChildFas(fas.state, id)])),
    };
  }, [local, fees.state, fas.state, reg, movements, topUps]);

  const dispatch: Dispatch<ParentAction> = (a) => {
    if (a.type === "pay") {
      // Paying writes to the school's fee records and the student's Education Account, so the school side sees it too.
      for (const act of payActions(state.invoices, state.children, new Set(a.ids))) fees.dispatch(act);
      return;
    }
    if (a.type === "reapplyFas") {
      // ASSUMPTION (client pending): after an SBFAS rejection the family may ask again — same right as a
      // paper family walking the form back to the school. Each rejected child's application is
      // requeued with the reason logged; the store's own guards skip any child not actually rejected.
      for (const c of state.children) {
        if (state.outcomes[c.id]?.status === "Not granted") actions.requeueSbfas({ studentId: c.id, reason: a.reason });
      }
      return;
    }
    dispatchLocal(a);
    if (a.type === "submitFas" && state.fas.stage === "preparing") actions.submitFamily(state.children.map((c) => c.id), a.band);
  };

  return <Ctx.Provider value={{ state, dispatch }}>{kids}</Ctx.Provider>;
}

export function useParent() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useParent must be used inside ParentProvider");
  return c;
}
