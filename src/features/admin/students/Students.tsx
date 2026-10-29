import { useFas } from "../../../data/fasStore";
import { useMovements } from "../../../data/movements";
import { withBalance, withFas } from "../../../lib/studentFas";
import { useMemo, useState } from "react";
import { HeaderActions } from "../../../components/layout/HeaderActions";
import { PencilSimple, Plus, Wallet } from "@phosphor-icons/react";
import { useNavigate, useSearchParams } from "react-router";
import { maskNric } from "../../../lib/nric";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { STATUSES, UNASSIGNED_ACCOUNTS, type SbfasStatus, type Student } from "../../../data/students";
import { useRegistry } from "../../../data/registryStore";
import { schoolOfStudent } from "../../../lib/registry";
import { schoolCodeFor } from "../../../data/users";
import { useSession } from "../../../session";
import AssignStudentModal from "./AddStudentModal";
import MoveClassModal from "./MoveClassModal";
import { statusLabel } from "../fas/review";
import { assignStudent, filterStudents, statusTone } from "./logic";

const sbfasTone: Record<SbfasStatus, BadgeTone> = { Approved: "success", Pending: "warning", Rejected: "alert", "Not applied": "neutral" };

export default function Students() {
  const { state: reg, dispatch: regDispatch } = useRegistry();
  const { state: fas } = useFas();
  const movements = useMovements();
  const students = useMemo(() => reg.students.map((s) => withBalance(withFas(s, fas), movements)), [reg.students, fas, movements]); // SBFAS status follows the FAS queue
  const [params] = useSearchParams(); // "View students" on the Classes page arrives as ?class=<name>
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [cls, setCls] = useState(params.get("class") ?? "");
  const [school, setSchool] = useState("");
  const { role } = useSession();
  const mySchool = schoolCodeFor(role);
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState<Student | null>(null);
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  const schoolOf = (s: Student) => schoolOfStudent(s, reg.classes);
  const schoolName = (s: Student) => reg.schools.find((x) => x.code === schoolOf(s))?.name ?? "";
  const classOptions = useMemo(() => [...new Set(students.filter((s) => (!mySchool || schoolOf(s) === mySchool) && (!school || schoolOf(s) === school)).map((s) => s.class))], [students, mySchool, school, reg.classes]);

  // Memoised: DataTable resets to page 1 whenever the rows reference changes.
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return filterStudents(students, { level: "", class: cls, status }).filter((s) => (!mySchool || schoolOf(s) === mySchool) && (!school || schoolOf(s) === school) && (!needle || `${s.nric} ${s.name}`.toLowerCase().includes(needle)));
  }, [students, q, mySchool, status, cls, school, reg.classes]);
  const reset = () => { setQ(""); setStatus(""); setCls(""); setSchool(""); };

  const columns: Column<Student>[] = [
    { key: "name", header: "Student", sortable: true, render: (s) => (<><span className="font-medium">{s.name}</span><span className="block text-[13px] text-on-surface-variant">{maskNric(s.nric)}</span></>) },
    ...(role === "hq" ? [{ key: "school", header: "School", sortable: true, render: (s: Student) => schoolName(s) } as Column<Student>] : []),
    { key: "class", header: "Class", sortable: true, render: (s) => s.class },    { key: "status", header: "Schooling status", sortable: true, render: (s) => <Badge tone={statusTone[s.status]}>{s.status}</Badge> },
    ...(role === "school" ? [
      { key: "moefas", header: "MOEFAS", sortable: true, render: (s: Student) => <Badge tone={sbfasTone[s.moefas]}>{statusLabel(s.moefas)}</Badge> } as Column<Student>,
      { key: "sbfas", header: "SBFAS", sortable: true, render: (s: Student) => <Badge tone={sbfasTone[s.sbfas]}>{statusLabel(s.sbfas)}{s.sbfasTier ? ` · ${s.sbfasTier}` : ""}</Badge> } as Column<Student>,
    ] : []),
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <HeaderActions>
        <Button icon={<Plus size={18} aria-hidden />} onClick={() => setAdding(true)}>Assign student</Button>
      </HeaderActions>

      {/* Always mounted (empty first) so screen readers announce the text when it appears; -mt-6 cancels the grid gap while empty. */}
      <div role="status" className="empty:hidden">
        {notice && (
          <p className="rounded-control border border-line bg-surface-container-lowest px-4 py-3 text-sm font-medium text-on-surface">
            {notice}
          </p>
        )}
      </div>

      <Card>
        <div role="group" aria-label="Filters" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)_auto] lg:items-end">
          <Field label="Search by NRIC or name">
            <input type="search" className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          {role === "hq" && (
            <Field label="School">
              <select className={inputClass} value={school} onChange={(e) => { setSchool(e.target.value); setCls(""); }}>
                <option value="">All schools</option>
                {[...new Set(students.map(schoolOf))].map((c) => <option key={c} value={c}>{reg.schools.find((x) => x.code === c)?.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Class">
            <select className={inputClass} value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="">All classes</option>
              {classOptions.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Schooling status">
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Button variant="secondary" disabled={!q && !status && !cls && !school} onClick={reset}>Reset filters</Button>
        </div>
        <div className="mt-2">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(s) => s.id}
            rowActions={(s) => (
              <>
                {role === "school" && <RowAction icon={<PencilSimple size={16} aria-hidden />} onClick={() => setMoving(s)}>Move class</RowAction>}
                <RowAction icon={<Wallet size={16} aria-hidden />} onClick={() => navigate(`/admin/students/${s.id}/account`)}>View account</RowAction>
              </>
            )}
            pageSize={20}
            large
            empty={
              <EmptyState
                title="No students match these filters"
                hint="Check the search, or reset the filters to see everyone."
                action={<Button variant="secondary" onClick={reset}>Reset filters</Button>}
              />
            }
          />
        </div>
      </Card>

      <AssignStudentModal
        open={adding}
        classes={reg.classes}
        school={mySchool}
        available={UNASSIGNED_ACCOUNTS.filter((a) => !students.some((s) => s.id === a.id))}
        onClose={() => setAdding(false)}
        onAssign={(a, p) => {
          regDispatch({ type: "assignStudent", student: assignStudent(a, p) });
          setNotice(`${a.name} was assigned to ${p.class}.`);
        }}
      />

      <MoveClassModal
        student={moving}
        classes={reg.classes}
        school={mySchool}
        onClose={() => setMoving(null)}
        onMove={(s, p) => {
          regDispatch({ type: "moveStudent", id: s.id, ...p });
          setNotice(`${s.name} was moved to ${p.class}.`);
        }}
      />
    </div>
  );
}
