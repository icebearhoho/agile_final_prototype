import { useMemo, useState } from "react";
import { HeaderActions } from "../../../components/layout/HeaderActions";
import { Plus, Wallet } from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { STATUSES, STUDENTS, UNASSIGNED_ACCOUNTS, type SbfasStatus, type Student } from "../../../data/students";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import { schoolCodeFor } from "../../../data/users";
import { useSession } from "../../../session";
import AssignStudentModal from "./AddStudentModal";
import { assignStudent, filterStudents, statusTone } from "./logic";

const sbfasTone: Record<SbfasStatus, BadgeTone> = { Approved: "success", Pending: "warning", Rejected: "alert", "Not applied": "neutral" };

export default function Students() {
  const [students, setStudents] = useState(STUDENTS);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const { role } = useSession();
  const mySchool = schoolCodeFor(role);
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");

  // Memoised: DataTable resets to page 1 whenever the rows reference changes.
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return filterStudents(students, { level: "", class: "", status }).filter((s) => (!mySchool || schoolOfLevel(s.level) === mySchool) && (!needle || `${s.id} ${s.name}`.toLowerCase().includes(needle)));
  }, [students, q, mySchool, status]);
  const reset = () => { setQ(""); setStatus(""); };

  const columns: Column<Student>[] = [
    { key: "id", header: "Education Account ID", sortable: true },
    { key: "name", header: "Name", sortable: true, render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "status", header: "Schooling status", sortable: true, render: (s) => <Badge tone={statusTone[s.status]}>{s.status}</Badge> },
    ...(role === "school" ? [
      { key: "moefas", header: "MOEFAS", sortable: true, render: (s: Student) => <Badge tone={sbfasTone[s.moefas]}>{s.moefas}</Badge> } as Column<Student>,
      { key: "sbfas", header: "SBFAS", sortable: true, render: (s: Student) => <Badge tone={sbfasTone[s.sbfas]}>{s.sbfas}</Badge> } as Column<Student>,
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
        <div role="group" aria-label="Filters" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_auto] lg:items-end">
          <Field label="Search by Education Account ID or name">
            <input type="search" className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          <Field label="Status">
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Button variant="secondary" disabled={!q && !status} onClick={reset}>Reset filters</Button>
        </div>
        <div className="mt-2">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(s) => s.id}
            rowActions={(s) => <RowAction icon={<Wallet size={16} aria-hidden />} onClick={() => navigate(`/admin/students/${s.id}/account`, { state: { student: s } })}>View Education Account</RowAction>}
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
        available={UNASSIGNED_ACCOUNTS.filter((a) => !students.some((s) => s.id === a.id))}
        onClose={() => setAdding(false)}
        onAssign={(a, p) => {
          setStudents((all) => [assignStudent(a, p), ...all]);
          setNotice(`${a.name} was assigned to ${p.class}.`);
        }}
      />
    </div>
  );
}
