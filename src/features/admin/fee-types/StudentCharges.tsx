import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { inputClass } from "../../../components/ui/Field";
import { useFees } from "../../../data/feeStore";
import type { Charge, FasScheme } from "../../../data/fees";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import { formatSGD } from "../../../lib/format";
import { aggregate, balanceOf, chargeStatus, feeOf, payableOf, subsidyOf } from "../../../lib/fees";
import { Badge } from "../../../components/ui/Badge";
import { ChargeModal, Chips, StatusBadge, Tiles, selectClass, studentOf } from "./parts";

type Row = { id: string; charge: Charge; student: string; studentId: string; levelClass: string; level: string; title: string; due: string; fee: number; payable: number; balance: number; status: string };

/** School user: every charge issued to the school's students, with search and filters. */
export default function StudentCharges({ school }: { school: string }) {
  const { state, dispatch } = useFees();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState<"" | "outstanding" | "overdue" | "paid">("");
  const [openId, setOpenId] = useState<string | null>(null);
  // Re-resolve from state so the modal reflects a payment recorded while it is open.
  const open = state.charges.find((c) => c.id === openId) ?? null;

  const mine = useMemo(() => state.charges.filter((c) => { const s = studentOf(c.studentId); return s && schoolOfLevel(s.level) === school; }), [state.charges, school]);
  const levels = [...new Set(mine.map((c) => studentOf(c.studentId)!.level))];
  const rows: Row[] = useMemo(() => mine.flatMap((c) => {
    const s = studentOf(c.studentId)!;
    const st = chargeStatus(c);
    const text = `${s.name} ${s.id} ${s.class} ${c.title} ${c.issued}`.toLowerCase();
    if ((q.trim() && !text.includes(q.trim().toLowerCase())) || (level && s.level !== level) || (status && st !== status)) return [];
    return [{ id: c.id, charge: c, student: s.name, studentId: s.id, levelClass: `${s.level}, ${s.class}`, level: s.level, title: c.title, due: c.due, fee: feeOf(c), payable: payableOf(c), balance: balanceOf(c), status: st }];
  }), [mine, q, level, status]);
  const a = aggregate(rows.map((r) => r.charge));
  const byScheme = (scheme: FasScheme) => rows.filter((r) => r.charge.fas === scheme).reduce((t, r) => t + subsidyOf(r.charge), 0);
  const count = (s: string) => mine.filter((c) => !s || chargeStatus(c) === s).length;
  const filtered = !!(q || level || status);
  const clear = () => { setQ(""); setLevel(""); setStatus(""); };

  const columns: Column<Row>[] = [
    { key: "student", header: "Student", sortable: true, render: (r) => (<><span className="font-semibold">{r.student}</span><span className="block text-[13px] text-on-surface-variant">{r.studentId}</span></>) },
    { key: "levelClass", header: "Level / class", sortable: true },
    { key: "title", header: "Charge", sortable: true, render: (r) => (<>{r.title}<span className="block text-[13px] text-on-surface-variant">issued {r.charge.issued}, due {r.due}</span></>) },
    { key: "fee", header: "Fee", sortable: true, align: "right", render: (r) => formatSGD(r.fee) },
    { key: "fas", header: "FAS", sortable: true, render: (r) => r.charge.fas ? (
      (<Link to="/admin/fas" className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" title="View FAS applications and decisions"><Badge tone="primary">{r.charge.fas}</Badge><span className="block text-[13px] text-success">− {formatSGD(subsidyOf(r.charge))}</span></Link>)
    ) : <span className="text-on-surface-variant">—</span> },
    { key: "balance", header: "Outstanding", sortable: true, align: "right", render: (r) => r.balance ? <span className="font-semibold">{formatSGD(r.balance)}</span> : <span className="text-on-surface-variant">—</span> },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge status={r.charge ? chargeStatus(r.charge) : "outstanding"} /> },
    { key: "view", header: "", render: (r) => <Button size="sm" variant="ghost" onClick={() => setOpenId(r.id)} aria-label={`Components of ${r.id}`}>Payments</Button> },
  ];

  return (
    <div className="space-y-4">
      <Tiles items={[
        { label: "Charges shown", value: rows.length, note: `${a.unpaid} unpaid, ${a.paid} paid${a.overdue ? `, ${a.overdue} overdue` : ""}` },
        { label: "Outstanding", value: formatSGD(a.outstanding), alert: a.outstanding > 0, note: "What parents still owe after subsidy and payments" },
        { label: "FAS subsidies applied", value: formatSGD(a.subsidy), good: true, note: `MOEFAS − ${formatSGD(byScheme("MOEFAS"))} · SBFAS − ${formatSGD(byScheme("SBFAS"))}` },
        { label: "Collected by source", value: formatSGD(a.fromAccount + a.fromGateway), note: `Account ${formatSGD(a.fromAccount)} · Gateway ${formatSGD(a.fromGateway)}` },
      ]} />
      <Card title="Student fees">
        <div className="mb-4 flex flex-wrap gap-3">
          <input aria-label="Search charges" className={inputClass.replace("w-full", "min-w-48 max-w-sm flex-1")} placeholder="Search student, class, charge or issue date..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Filter by level" className={selectClass} value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All levels</option>
            {levels.map((l) => <option key={l}>{l}</option>)}
          </select>
          {filtered && <Button variant="ghost" onClick={clear}>Clear filters</Button>}
        </div>
        <div className="mb-4">
          <Chips label="Status" value={status} onChange={setStatus} options={[
            { value: "", label: "All", count: count("") }, { value: "outstanding", label: "Outstanding", count: count("outstanding") },
            { value: "overdue", label: "Overdue", count: count("overdue") }, { value: "paid", label: "Paid", count: count("paid") },
          ]} />
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} pageSize={10} empty={<EmptyState title="No charges match" hint="Change the filters, or generate charges in Assign and generate." />} />
      </Card>
      <ChargeModal charge={open} feeName={open ? state.types.find((f) => f.id === open.ftId)?.name : undefined} onClose={() => setOpenId(null)}
        onPay={(chargeId, amount, method) => dispatch({ type: "recordPayment", chargeId, amount, method })} />
    </div>
  );
}
