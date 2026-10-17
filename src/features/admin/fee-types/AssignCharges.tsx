import { Fragment, useState } from "react";
import { CaretRight, CheckCircle, X } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { useFees } from "../../../data/feeStore";
import { MASTER, type Charge, type FeeType } from "../../../data/fees";
import { SCHOOLS } from "../../../data/schools";
import { CLASS_RECORDS } from "../../../data/schoolMgmt";
import { formatSGD } from "../../../lib/format";
import { addDays, alreadyCharged, chargeStatus, fasOf, feeOf, studentsOfClass, TODAY } from "../../../lib/fees";
import { selectClass, studentOf } from "./parts";

type Result = { created: number; skipped: number; level: string; issued: string; due: string };
const total = (f: FeeType) => f.components.reduce((t, c) => t + c.amount, 0);
const scopeOf = (f: FeeType) => f.scope ?? f.level ?? "All levels";

/** School user: assign one or more MOE / school fee types to a whole level and issue one unpaid charge per student for a term (US-014). Duplicates are skipped. */
export default function AssignCharges({ school, presetFee }: { school: string; presetFee: string }) {
  const [tab, setTab] = useState<"assign" | "history">("assign");
  const tabs = [["assign", "Assign & generate charges"], ["history", "Charge history"]] as const;
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Assign fees" className="grid grid-cols-2 overflow-hidden rounded-card border border-line bg-surface-container-lowest">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`min-h-11 px-4 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${tab === id ? "bg-primary-fixed text-primary" : "text-on-surface hover:bg-surface-container-low"}`}>{label}</button>
        ))}
      </div>
      {tab === "assign" ? <Assign school={school} presetFee={presetFee} /> : <History school={school} />}
    </div>
  );
}

function Assign({ school, presetFee }: { school: string; presetFee: string }) {
  const { state, dispatch } = useFees();
  const [picked, setPicked] = useState<string[]>(presetFee ? [presetFee] : []);
  const [level, setLevel] = useState("");
  const [issued, setIssued] = useState(TODAY);
  const [due, setDue] = useState(addDays(TODAY, 30));
  const [result, setResult] = useState<Result | null>(null);

  const kind = SCHOOLS.find((s) => s.code === school)?.level;
  const master = state.types.filter((f) => f.school === MASTER && (!f.scope || f.scope === kind));
  const own = state.types.filter((f) => f.school === school);
  const chosen = [...master, ...own].filter((f) => picked.includes(f.id));
  const levels = [...new Set(CLASS_RECORDS.filter((c) => c.school === school).map((c) => c.level))];
  const perStudent = chosen.reduce((t, f) => t + total(f), 0);

  // Each fee applies to the chosen level only when its own level (if any) matches.
  const students = level ? CLASS_RECORDS.filter((c) => c.school === school && c.level === level).flatMap((c) => studentsOfClass(school, c.name)) : [];
  const plan = chosen.filter((f) => !f.level || f.level === level).flatMap((fee) => students.map((s) => ({ fee, s, dup: alreadyCharged(state.charges, s.id, fee, issued) })));
  const todo = plan.filter((p) => !p.dup);
  const withFas = students.map((s) => fasOf(s)).filter((f): f is NonNullable<typeof f> => f !== null);
  const fasSummary = ["MOEFAS", "SBFAS"].map((k) => `${withFas.filter((f) => f.scheme === k).length} ${k}`).filter((x) => !x.startsWith("0")).join(" + ") || "FAS";

  const add = (id: string) => { if (id && !picked.includes(id)) { setPicked([...picked, id]); setResult(null); } };
  const generate = () => {
    for (const fee of chosen) {
      const s = todo.filter((p) => p.fee.id === fee.id).map((p) => p.s);
      if (s.length) dispatch({ type: "generate", fee, students: s, issued, due });
    }
    setResult({ created: todo.length, skipped: plan.length - todo.length, level, issued, due });
  };
  const label = (f: FeeType) => `${f.name}${f.school === MASTER ? ` · ${scopeOf(f)}` : f.level ? ` · ${f.level}` : ""} (${formatSGD(total(f))})`;

  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="MOE fee type">
          <select className={inputClass} value="" onChange={(e) => add(e.target.value)}>
            <option value="">＋ Add MOE fee type…</option>
            {master.filter((f) => !picked.includes(f.id)).map((f) => <option key={f.id} value={f.id}>{label(f)}</option>)}
          </select>
        </Field>
        <Field label="School fee">
          <select className={inputClass} value="" onChange={(e) => add(e.target.value)}>
            <option value="">＋ Add school fee…</option>
            {own.filter((f) => !picked.includes(f.id)).map((f) => <option key={f.id} value={f.id}>{label(f)}</option>)}
          </select>
        </Field>
      </div>

      <h3 className="mt-6 border-b border-line pb-2 text-[13px] font-semibold uppercase tracking-wide text-on-surface-variant">Selected fee types &amp; total</h3>
      {chosen.length ? (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low text-left text-[13px] uppercase tracking-wide text-on-surface-variant">
              <th className="px-3 py-2 font-semibold">Source</th>
              <th className="px-3 font-semibold">Fee type &amp; components to assign</th>
              <th className="px-3 text-right font-semibold">Amount per student</th>
              <th className="w-10"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {chosen.map((f) => (
              <tr key={f.id} className="border-b border-line align-top">
                <td className="px-3 py-3"><Badge tone={f.school === MASTER ? "primary" : "neutral"}>{f.school === MASTER ? "MOE" : "School"}</Badge></td>
                <td className="px-3 py-3">
                  <b>{f.name}</b> <code className="text-[13px] text-on-surface-variant">{f.id}</code> · {f.level ?? "all levels of this school"}
                  <div className="mt-0.5 text-[13px] text-on-surface-variant">{f.components.map((c) => `${c.name} (${formatSGD(c.amount)})`).join(" · ")}</div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{formatSGD(total(f))}</td>
                <td><Button size="sm" variant="ghost" aria-label={`Remove ${f.name}`} onClick={() => { setPicked(picked.filter((x) => x !== f.id)); setResult(null); }}><X size={16} aria-hidden="true" /></Button></td>
              </tr>
            ))}
            <tr className="bg-surface-container-low font-semibold">
              <td className="px-3 py-2.5" colSpan={2}>Total fee per student</td>
              <td className="px-3 text-right tabular-nums text-primary">{formatSGD(perStudent)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="py-8 text-center text-sm text-on-surface-variant">Add one or more MOE fee types (assigned whole) and/or school fees above.</p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field required label="Level / cohort">
          <select className={inputClass} value={level} onChange={(e) => { setLevel(e.target.value); setResult(null); }}>
            <option value="">— select level —</option>
            {levels.map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="Issue date" hint="Charges for the same fee type and date are skipped.">
          <input type="date" className={inputClass} value={issued} onChange={(e) => { setIssued(e.target.value); setResult(null); }} />
        </Field>
        <Field label="Due date" hint="Unpaid after this date shows as overdue.">
          <input type="date" className={inputClass} value={due} min={issued} onChange={(e) => { setDue(e.target.value); setResult(null); }} />
        </Field>
      </div>

      {level && chosen.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={generate} disabled={!todo.length}>Generate {todo.length} {todo.length === 1 ? "charge" : "charges"} ({chosen.length} fee type{chosen.length === 1 ? "" : "s"} · {formatSGD(perStudent)} per student)</Button>
          <span className="text-[13px] text-on-surface-variant">{todo.length} to create · {plan.length - todo.length} already charged (skipped)</span>
        </div>
      ) : (
        <div className="mt-2"><EmptyState title={chosen.length ? "Select a level to generate the charges." : "Nothing to generate yet"} /></div>
      )}
      {level && chosen.length && withFas.length ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-on-surface-variant">
          <Badge tone="primary">FAS</Badge>
          <span>
            {withFas.length} of {students.length} students receive {fasSummary} — for them the subsidy is deducted from the fee when the charge is generated, so their payable is lower than {formatSGD(perStudent)}. A student never receives both schemes: MOEFAS takes precedence over SBFAS.
          </span>
        </p>
      ) : null}
      {result && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-card border border-line bg-success-container px-4 py-3 text-sm font-medium text-success">
          <CheckCircle size={18} weight="bold" aria-hidden="true" />
          Created {result.created}, skipped {result.skipped}: {result.level}, issued {result.issued}, due {result.due}. Charges are outstanding and appear under Student fees.
        </p>
      )}
    </Card>
  );
}

type Round = { key: string; issued: string; due: string; title: string; ftId: string; rows: Charge[] };

function History({ school }: { school: string }) {
  const { state } = useFees();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const mine = state.charges.filter((c) => state.types.find((f) => f.id === c.ftId)?.school === school);
  const rounds = new Map<string, Round>();
  for (const c of mine) {
    const key = `${c.issued}|${c.ftId}`;
    rounds.set(key, rounds.get(key) ?? { key, issued: c.issued, due: c.due, title: c.title, ftId: c.ftId, rows: [] });
    rounds.get(key)!.rows.push(c);
  }
  const lvl = (r: Round) => [...new Set(r.rows.map((c) => studentOf(c.studentId)?.level ?? ""))].filter(Boolean);
  const list = [...rounds.values()]
    .filter((r) => (!from || r.issued >= from) && (!to || r.issued <= to) && (!q || `${r.title} ${r.issued} ${lvl(r).join(" ")}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.issued.localeCompare(a.issued));
  const all = list.flatMap((r) => r.rows);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <input aria-label="Search charge history" className={`${inputClass.replace("w-full", "min-w-48 flex-1")}`} placeholder="Search fee type, charge, level…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input type="date" aria-label="Issued from" className={selectClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        <span aria-hidden>→</span>
        <input type="date" aria-label="Issued to" className={selectClass} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <p className="my-4 text-sm">{all.length} charges in {list.length} issuance rounds · total fee value {formatSGD(all.reduce((t, c) => t + feeOf(c), 0))}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-container-low text-left text-[13px] uppercase tracking-wide text-on-surface-variant">
            <th className="w-8" /><th className="px-3 py-2 font-semibold">Issued</th><th className="font-semibold">Charge</th><th className="font-semibold">Due</th><th className="px-3 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const on = open === r.key, n = new Set(r.rows.map((c) => c.studentId)).size;
            return (
              <Fragment key={r.key}>
                <tr className="border-b border-line align-top">
                  <td className="py-3 pl-2"><button type="button" aria-expanded={on} aria-label={`${on ? "Hide" : "Show"} students for ${r.title}`} onClick={() => setOpen(on ? null : r.key)} className="grid size-6 place-items-center rounded focus-visible:outline-2 focus-visible:outline-primary"><CaretRight size={14} weight="fill" className={on ? "rotate-90" : ""} aria-hidden="true" /></button></td>
                  <td className="py-3 pr-3 whitespace-nowrap">{r.issued}</td>
                  <td className="py-3 pr-3"><b>{r.title}</b><div className="text-[13px] text-on-surface-variant">{lvl(r).join(", ")} · 1 fee type · {n} student{n === 1 ? "" : "s"} · {r.rows.length} charge{r.rows.length === 1 ? "" : "s"}</div></td>
                  <td className="py-3 pr-3">{r.due}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums">{formatSGD(r.rows.reduce((t, c) => t + feeOf(c), 0))}</td>
                </tr>
                {on && r.rows.map((c) => (
                  <tr key={c.id} className="border-b border-line bg-surface-container-low text-[13px]">
                    <td /><td className="py-2 pr-3" colSpan={2}>{studentOf(c.studentId)?.name ?? c.studentId} <span className="text-on-surface-variant">({c.studentId}, {studentOf(c.studentId)?.class})</span></td>
                    <td className="capitalize">{chargeStatus(c)}</td><td className="px-3 text-right tabular-nums">{formatSGD(feeOf(c))}</td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
          {!list.length && <tr><td colSpan={5} className="py-6 text-center text-on-surface-variant">No charges match.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}
