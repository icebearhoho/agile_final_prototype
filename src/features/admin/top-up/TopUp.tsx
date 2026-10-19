import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useSession } from "../../../session";
import type { Student } from "../../../data/students";
import { useMovements } from "../../../data/movements";
import { useRegistry } from "../../../data/registryStore";
import { useTopUp } from "../../../data/topupStore";
import { accountsOf } from "../../../lib/accounts";
import type { Account, Target, Transaction } from "../../../data/topup";
import { ledgerIds, retryableAccounts, topUpReport } from "../../../lib/topup";
import { maskNric } from "../../../lib/nric";
import { downloadXlsx, type Cell } from "../../../lib/xlsx";
import Execute, { type Followup } from "./Execute";
import Rules from "./Rules";
import { Dialog, cash, useToast, type DialogSpec } from "./tuUi";
import "./topup.css";

const TABS = [
  { id: "transactions", label: "Top-up History" },
  { id: "rules", label: "Batch Top-up Rule" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// Top-up History badges: Pending amber, Failed grey, the rest green (as in the prototype). Details page: Failed red, Partial Success amber.
const listClass = (s: Transaction["status"]) => (s === "Pending" ? "draft" : s === "Failed" ? "deactivated" : "");
const detailClass = (s: Transaction["status"]) => (s === "Pending" ? "draft" : s === "Failed" ? "failed" : s === "Partial Success" ? "partial" : "");
const targetClass = (s: string) => (s === "Pending" ? "draft" : s === "Failed" ? "deactivated" : "");

const typeLabel = (t: Transaction["type"]) => (t === "Batch" ? "Batch" : "Specific Accounts");

type Ledger = ReturnType<typeof ledgerIds>;

function History({ rows, accounts, ledger, viewingId, setViewingId, onCreate, onFollowup, notify }: { rows: Transaction[]; accounts: Account[]; ledger: Ledger; viewingId: string | null; setViewingId: (id: string | null) => void; onCreate: () => void; onFollowup: (id: string, picked: string[]) => void; notify: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sel, setSel] = useState<string[]>([]); // Top-up IDs ticked for Excel export
  const allRef = useRef<HTMLInputElement>(null);
  const reset = () => { setQ(""); setStatus(""); setType(""); setFrom(""); setTo(""); };
  const list = rows.map((t, i) => ({ t, i })).filter(({ t, i }) => (!status || t.status === status) && (!type || t.type === type) && (!from || t.date >= from) && (!to || t.date <= to) && (!q.trim() || `${ledger[i].id} ${t.recipient} ${typeLabel(t.type)}`.toLowerCase().includes(q.trim().toLowerCase())));
  // Pending top-ups have nothing to report yet, so they cannot be ticked.
  const shown = list.filter(({ t }) => t.status !== "Pending").map(({ i }) => ledger[i].id);
  const allOn = shown.length > 0 && shown.every((id) => sel.includes(id));
  const someOn = shown.some((id) => sel.includes(id));
  useEffect(() => { if (allRef.current) allRef.current.indeterminate = someOn && !allOn; });
  const toggle = (id: string, on: boolean) => setSel(on ? [...sel, id] : sel.filter((x) => x !== id));
  const toggleAll = (on: boolean) => setSel(on ? [...new Set([...sel, ...shown])] : sel.filter((x) => !shown.includes(x)));
  const exportSelected = () => {
    // One sheet; each selected top-up's Student Finance System report is stacked under the previous one.
    const out: Cell[][] = [], merges: string[] = [];
    let cols: number[] | undefined;
    rows.forEach((t, i) => {
      if (t.status === "Pending" || !sel.includes(ledger[i].id)) return;
      const r = topUpReport(t, ledger[i].id, ledger[i].targets, accounts);
      merges.push(`A${out.length + 1}:B${out.length + 1}`);
      cols ??= r.opts.cols;
      out.push(...r.rows, [], []);
    });
    if (!out.length) return notify("Select a completed top-up to export.");
    downloadXlsx(merges.length === 1 ? `${sel[0]}-top-up-report.xlsx` : "top-up-reports.xlsx", "Top-up report", out, { cols, merges });
  };
  const viewing = viewingId === null ? -1 : ledger.findIndex((l) => l.id === viewingId);
  if (viewing >= 0 && rows[viewing]) return <Details key={viewingId} t={rows[viewing]} id={ledger[viewing].id} items={ledger[viewing].targets} accounts={accounts} rows={rows} ledger={ledger} onOpen={setViewingId} onBack={() => setViewingId(null)} onFollowup={onFollowup} />;
  return (
    <div id="transactions-list" className="card tablecard">
      <div className="tabletop"></div>
      <div className="toolbar filters-toolbar">
        <input className="filter-search" placeholder="Search ID or recipient..." aria-label="Search top-ups" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="Single">Specific Accounts</option><option value="Batch">Batch</option></select>
        <input type="date" aria-label="From date" title="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" aria-label="To date" title="To date" value={to} onChange={(e) => setTo(e.target.value)} />
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option>Success</option><option>Partial Success</option><option>Pending</option><option>Failed</option></select>
        <button type="button" className="btn reset-filter" onClick={reset}>Reset Filter</button>
        <button type="button" className="btn primary create-action" onClick={onCreate}>＋ Create top-up execution</button>
        <button type="button" className="btn primary history-export-btn" disabled={!sel.length} onClick={exportSelected}>Export Excel</button>
      </div>
      <div className="tablewrap"><table className="data-table"><thead><tr>
        <th><input ref={allRef} type="checkbox" className="history-select" aria-label="Select all eligible top-ups on this page" title="Select all completed top-ups shown" checked={allOn} disabled={!shown.length} onChange={(e) => toggleAll(e.target.checked)} /></th>
        <th>Top-up ID</th><th>Top-up Type</th><th>Recipient / rule</th><th>Date</th><th>Schedule</th><th>Accounts</th><th>Per account</th><th>Total</th><th>Status</th><th>Executed by</th><th>Action</th></tr></thead>
        <tbody>
          {list.length ? list.map(({ t, i }) => {
            const id = ledger[i].id, pending = t.status === "Pending";
            const credited = ledger[i].targets.filter((a) => a.status === "Success").length * t.amount;
            return (
              <tr key={`${t.ref}-${i}`}>
                <td><input type="checkbox" className="history-select" aria-label={`Select ${id}`} title={pending ? "Pending top-ups cannot be exported before execution" : "Select for Excel export"} checked={sel.includes(id)} disabled={pending} onChange={(e) => toggle(id, e.target.checked)} /></td>
                <td><strong>{id}</strong></td>
                <td>{typeLabel(t.type)}</td>
                <td><strong>{t.recipient}</strong><small>{t.detail}</small></td>
                <td>{t.date}</td>
                <td>{t.schedule}</td>
                <td style={{ textAlign: "right" }}>{t.accounts}</td>
                <td>{cash(t.amount)}</td>
                <td>{cash(credited)}<small>{pending ? `Expected: ${cash(t.amount * t.accounts)}` : t.status === "Failed" ? "Not credited" : "Credited"}</small></td>
                <td><span className={`badge ${listClass(t.status)}`}>{t.status}</span></td>
                <td>{t.by}</td>
                <td><div className="actiongroup"><button type="button" onClick={() => setViewingId(id)}>View</button></div></td>
              </tr>
            );
          }) : <tr><td colSpan={12} className="empty">No top-ups found.</td></tr>}
        </tbody></table></div>
    </div>
  );
}

function Details({ t, id, items, accounts, rows, ledger, onOpen, onBack, onFollowup }: { t: Transaction; id: string; items: Target[]; accounts: Account[]; rows: Transaction[]; ledger: Ledger; onOpen: (id: string) => void; onBack: () => void; onFollowup: (id: string, picked: string[]) => void }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  // A Failed / Partial Success top-up can be retried: tick its failed accounts and open a NEW Specific Accounts top-up (this record never changes).
  const retry = useMemo(() => (t.status === "Failed" || t.status === "Partial Success" ? retryableAccounts(t, id, rows, accounts) : []), [t, id, rows, accounts]);
  const canRetry = t.status === "Failed" || t.status === "Partial Success";
  const [pick, setPick] = useState<string[]>(() => retry.map((a) => a.nric));
  const origin = t.followupOf ? ledger.find((l) => l.id === t.followupOf) : undefined;
  const followups = rows.map((r, i) => ({ r, id: ledger[i].id })).filter((x) => x.r.followupOf === id);
  const pending = t.status === "Pending", batch = t.type === "Batch";
  const count = (s: string) => items.filter((a) => a.status === s).length;
  const credited = count("Success");
  const failed = count("Failed");
  const hasReport = credited + failed > 0;
  const download = () => { const r = topUpReport(t, id, items, accounts); downloadXlsx(`${id}-top-up-report.xlsx`, "Top-up report", r.rows, r.opts); };
  const shown = items.filter((a) => (!st || a.status === st) && (!q.trim() || `${a.txid ?? ""} ${a.student} ${a.account} ${maskNric(a.account)} ${a.reason ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));
  const row = (k: string, v: string) => <div className="summaryrow"><span>{k}</span><strong>{v}</strong></div>;
  return (
    <div id="topup-details">
      <button type="button" className="backline" onClick={onBack}>← Back to Top-up History</button>
      <div id="topup-details-content" className="card tablecard">
        <div className="tabletop"><h2>Top-up Details · {id}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" className="btn small" disabled={!hasReport} onClick={download} title={hasReport ? "Successful and failed records, in the Student Finance System format." : "Available once the top-up has run."}>Download Excel report</button>
            <span className={`badge ${detailClass(t.status)}`}>{t.status}</span></div></div>
        {t.followupOf && <div className="followup-link-row"><span>Created from failed Top-up</span><strong>{origin ? <button type="button" className="inline-link" onClick={() => onOpen(t.followupOf!)}>{t.followupOf} ↗</button> : t.followupOf}</strong></div>}
        {row("Type", typeLabel(t.type))}
        {row("Recipient / rule", t.recipient)}
        {row(pending ? "Scheduled date" : "Execution date", t.date)}
        {row("Schedule", t.schedule)}
        {batch && row("Eligible account(s)", String(t.accounts))}
        {row(batch ? "Amount per account" : "Amount", cash(t.amount))}
        {batch && row(pending ? "Estimated total" : "Planned total", cash(t.amount * t.accounts))}
        {batch && row("Successfully credited", pending ? "—" : cash(credited * t.amount))}
        {batch && row("Failed amount", pending ? "—" : cash(failed * t.amount))}
        <h2 style={{ marginTop: 24 }}>{pending ? "Eligible Account(s) (Pending)" : "Account Transaction History"}</h2>
        <p className="small" style={{ marginBottom: 12 }}>{pending ? "Eligible accounts were fixed when the schedule was created. No ledger transactions exist yet." : `Success: ${credited} · Failed: ${failed} · Failure reasons are shown for failed accounts.`}</p>
        {batch && (
          <div className="toolbar" style={{ marginTop: 12 }}>
            <input placeholder="Search student, account or transaction ID..." aria-label="Search accounts" value={q} onChange={(e) => setQ(e.target.value)} />
            <select aria-label="Filter by account status" value={st} onChange={(e) => setSt(e.target.value)}><option value="">All account statuses</option><option>Pending</option><option>Success</option><option>Failed</option></select>
            <button type="button" className="btn reset-filter" onClick={() => { setQ(""); setSt(""); }}>Reset Filter</button>
          </div>
        )}
        <div className={`tablewrap${batch ? " transaction-scroll" : ""}`} {...(batch ? { role: "region", "aria-label": "Account transaction list", tabIndex: 0 } : {})}>
          <table className="data-table" style={{ minWidth: 850 }}><thead><tr><th>Transaction ID</th><th>Student</th><th>NRIC</th><th>Amount</th><th>Status</th><th>Failure Reason</th></tr></thead>
            <tbody>{shown.length ? shown.map((a) => (
              <tr key={a.account + (a.txid ?? "")}>
                <td>{canRetry && a.status === "Failed" && (() => { const ok = retry.some((x) => x.nric === a.account); return <input type="checkbox" className="failed-pick" disabled={!ok} checked={ok && pick.includes(a.account)} onChange={(e) => setPick(e.target.checked ? [...pick, a.account] : pick.filter((x) => x !== a.account))} aria-label={`Select failed account ${a.student}`} title={ok ? "Include in a new Specific Accounts top-up" : "Account is inactive, unknown, or already successfully followed up"} />; })()}{a.txid ?? "—"}</td>
                <td>{a.student}</td><td>{maskNric(a.account)}</td><td>{cash(t.amount)}</td><td><span className={`badge ${targetClass(a.status)}`}>{a.status}</span></td><td>{a.reason ?? "—"}</td>
              </tr>
            )) : <tr><td colSpan={6} className="empty">No account transactions found.</td></tr>}</tbody></table>
        </div>
        {canRetry && (
          <section className="recovery-panel">
            <h2>Create a new Specific Accounts Top-up</h2>
            <p className="small" style={{ margin: "10px 0" }}>Tick the <strong>Failed</strong> accounts above, then continue to a <strong>new Specific Accounts</strong> Top-up. The accounts, original Amount and Reason will be pre-filled. You can review them before confirming. The original transaction remains unchanged.</p>
            <div className="followup-failed-summary">{retry.length} Failed account(s) available for follow-up. Accounts already credited successfully cannot be selected.</div>
            <div className="buttons"><button type="button" className="btn primary" disabled={!pick.some((x) => retry.some((a) => a.nric === x))} onClick={() => onFollowup(id, pick.filter((x) => retry.some((a) => a.nric === x)))}>＋ Continue with selected Failed accounts</button></div>
          </section>
        )}
        {followups.length > 0 && (
          <div className="followup-list"><h2>Follow-up Top-up(s)</h2>
            {followups.map((f) => <div className="followup-link-row" key={f.id}><span>{typeLabel(f.r.type)} · {f.r.status}</span><strong><button type="button" className="inline-link" onClick={() => onOpen(f.id)}>{f.id} ↗</button></strong></div>)}
          </div>
        )}
      </div>
    </div>
  );
}
export default function TopUp() {
  const preset = (useLocation().state as { student?: Student } | null)?.student;
  // A School user with the Top-up module sees only their own school's accounts, single top-ups, and no rule tab.
  const { role, staff } = useSession();
  const { state: reg } = useRegistry();
  const movements = useMovements();
  const { state: tu, dispatch } = useTopUp();
  const ownSchool = role === "school" ? reg.schools.find((s) => s.code === staff?.schoolCode)?.name ?? "" : undefined;
  const tabs = ownSchool === undefined ? TABS : TABS.filter((t) => t.id === "transactions");
  // Every account is a real student, with the balance after top-ups paid in and fees paid out.
  const accounts = useMemo(
    () => accountsOf(reg.students, reg.classes, reg.schools, movements).filter((a) => ownSchool === undefined || a.school === ownSchool),
    [reg, movements, ownSchool],
  );
  const history = ownSchool === undefined ? tu.history : tu.history.filter((h) => h.school === ownSchool);
  const [tab, setTab] = useState<TabId>("transactions");
  const [creating, setCreating] = useState(Boolean(preset)); // a preset student opens the create form directly
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<{ id: string; picked: string[] } | null>(null); // a follow-up of a failed top-up (picked = NRICs)
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const { notify, toast } = useToast();

  // The credit goes to the Education Account itself, so the student's page, the school and the parent all show it.
  const done = (row: Transaction, creditedIds: string[]) => dispatch({ type: "topUp", row: ownSchool === undefined ? row : { ...row, school: ownSchool }, creditedIds });
  const closeAsk = () => setDialog(null);
  const ledger = useMemo(() => ledgerIds(history, accounts), [history, accounts]);
  const followup = useMemo<Followup | undefined>(() => {
    const i = retrying ? ledger.findIndex((l) => l.id === retrying.id) : -1;
    if (!retrying || i < 0) return undefined;
    const row = history[i], pool = retryableAccounts(row, retrying.id, history, accounts);
    return {
      id: retrying.id, row, pool,
      picked: pool.filter((a) => retrying.picked.includes(a.nric)).map((a) => a.id),
      failed: ledger[i].targets.filter((x) => x.status === "Failed").map((x) => ({ student: x.student, account: x.account, ready: pool.some((a) => a.nric === x.account) })),
    };
  }, [retrying, ledger, history, accounts]);

  return (
    <div className="tu">
      <nav className="tabs" role="tablist" aria-label="Top-up workspace">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => { setTab(t.id); setCreating(false); setRetrying(null); }}>{t.label}</button>
        ))}
      </nav>
      {tab === "transactions" && (creating || followup
        ? <Execute key={followup?.id ?? "new"} rules={tu.rules} accounts={accounts} presetAccountId={followup ? undefined : preset?.id} singleOnly={ownSchool !== undefined} followup={followup} onBack={() => { setCreating(false); setRetrying(null); }} onDone={done} notify={notify} ask={setDialog} closeAsk={closeAsk} />
        : <History rows={history} accounts={accounts} ledger={ledger} viewingId={viewingId} setViewingId={setViewingId} onCreate={() => setCreating(true)} onFollowup={(id, picked) => setRetrying({ id, picked })} notify={notify} />)}
      {tab === "rules" && <Rules rules={tu.rules} onChange={(rules) => dispatch({ type: "setRules", rules })} notify={notify} ask={setDialog} closeAsk={closeAsk} />}
      <Dialog spec={dialog} onClose={closeAsk} />
      {toast}
    </div>
  );
}
