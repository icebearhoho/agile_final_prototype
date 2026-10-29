import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { CLASS_RECORDS, SCHOOL_RECORDS, type ClassRecord, type SchoolRecord } from "./schoolMgmt";
import { STUDENTS, type Student } from "./students";

// ASSUMPTION: the school records live in memory only and reset on reload (no backend).
// One list each for students, classes and schools, shared by every screen, so a change made on one page shows on all the others.
export type Registry = { students: Student[]; classes: ClassRecord[]; schools: SchoolRecord[] };
export type RegistryAction =
  | { type: "assignStudent"; student: Student }
  | { type: "moveStudent"; id: string; level: Student["level"]; class: string }
  | { type: "saveClass"; editing: string | null; record: ClassRecord }
  | { type: "saveSchool"; record: SchoolRecord };

export const initialRegistry = (): Registry => ({ students: STUDENTS, classes: CLASS_RECORDS, schools: SCHOOL_RECORDS });

/**
 * Pure. assignStudent adds a student once. saveClass adds a class (or replaces the one named `editing`); when the name or level changes,
 * the students in that class follow it. saveSchool adds a school or replaces the one with the same code.
 */
export function registryReducer(state: Registry, a: RegistryAction): Registry {
  switch (a.type) {
    case "assignStudent":
      return state.students.some((s) => s.id === a.student.id) ? state : { ...state, students: [a.student, ...state.students] };
    case "moveStudent":
      return { ...state, students: state.students.map((s) => (s.id === a.id ? { ...s, level: a.level, class: a.class } : s)) };
    case "saveClass": {
      const exists = a.editing !== null;
      const classes = exists ? state.classes.map((c) => (c.name === a.editing ? a.record : c)) : [a.record, ...state.classes];
      const students = exists ? state.students.map((s) => (s.class === a.editing && (s.class !== a.record.name || s.level !== a.record.level) ? { ...s, class: a.record.name, level: a.record.level } : s)) : state.students;
      return { ...state, classes, students: students.every((s, i) => s === state.students[i]) ? state.students : students };
    }
    case "saveSchool": {
      const exists = state.schools.some((s) => s.code === a.record.code);
      return { ...state, schools: exists ? state.schools.map((s) => (s.code === a.record.code ? a.record : s)) : [a.record, ...state.schools] };
    }
  }
}

const Ctx = createContext<{ state: Registry; dispatch: Dispatch<RegistryAction> } | null>(null);

export function RegistryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(registryReducer, undefined, initialRegistry);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useRegistry() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useRegistry must be used inside RegistryProvider");
  return c;
}
