import { useMemo, useState } from "react";
import { FREQUENCIES, type Account, type FundRule, type Transaction } from "../../../data/topup";
import { activeRulesInOrder, conditionText, levelOfClass, overlapCount, stackRules, transactionCode } from "../../../lib/topup";
import { maskNric } from "../../../lib/nric";
import { cash, sgToday, type DialogSpec } from "./tuUi";

/** A failed or partly failed top-up being retried. `pool` = its failed accounts that are still Active and not yet re-credited. */
export type Followup = { id: string; row: Transaction; pool: Account[]; picked: string[]; failed: { student: string; account: string; ready: boolean }[] };

type Props = {
  rules: FundRule[]; accounts: Account[]; presetAccountId?: string; singleOnly?: boolean; followup?: Followup;
  onBack: () => void; onDone: (row: Transaction, creditedIds: string[]) => void;
  notify: (m: string) => void; ask: (d: DialogSpec) => void; closeAsk: () => void;
};

/** Batches this big or bigger are expected to run off-hours; the form suggests a night time. ASSUMPTION: threshold and 02:00 are placeholders until MOE confirms. */
const LARGE_BATCH = 20;
const NIGHT_TIME = "02:00";
/** Batch rule picker value that runs every Active rule, one after another in creation order. */
const ALL = "ALL";
/** Input sanity only, not a business limit (the customer does not want limits on top-up rules). */
const MAX_AMOUNT = 99_999_999;

/** The reason typed on the original top-up (Specific Accounts keep it after the last " · " of the detail). */
const reasonOf = (t: Transaction) => (t.type === "Single" && t.detail.includes(" · ") ? t.detail.slice(t.detail.lastIndexOf(" · ") + 3) : t.detail);

export default function Execute({ rules, accounts, presetAccountId, singleOnly, followup, onBack, onDone, notify, ask, closeAsk }: Props) {
  const locked = Boolean(singleOnly || followup);
  const startIds = followup ? followup.picked : presetAccountId ? [presetAccountId] : [];
  const startAmount = followup ? String(followup.row.amount) : "";
  const startReason = followup ? reasonOf(followup.row) : "";
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [ids, setIds] = useState<string[]>(startIds);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [ruleId, setRuleId] = useState("");
  const [amount, setAmount] = useState(startAmount);
  const [reason, setReason] = useState(startReason);
  const [timing, setTiming] = useState<"now" | "later">("now");
  const [date, setDate] = useState("");
  const [freq, setFreq] = useState<string>("Once");
  const [time, setTime] = useState(NIGHT_TIME);

  const pool = followup ? followup.pool : accounts;
  const chosen = useMemo(() => ids.map((id) => accounts.find((a) => a.id === id)).filter((a): a is Account => Boolean(a)), [ids, accounts]);
  const active = useMemo(() => activeRulesInOrder(rules), [rules]);
  const all = ruleId === ALL;
  const rule = active.find((r) => r.id === ruleId) ?? null;
  const picked = useMemo(() => (all ? active : rule ? [rule] : []), [all, active, rule]);
  const found = useMemo(() => { const q = query.trim().toLowerCase(); return pool.filter((a) => a.status === "Active" && (!q || `${a.nric} ${maskNric(a.nric)} ${a.name}`.toLowerCase().includes(q))); }, [pool, query]);
  const stack = useMemo(() => stackRules(picked, accounts), [picked, accounts]);
  const eligible = useMemo(() => stack.flatMap((s) => s.accounts), [stack]);
  const stacked = overlapCount(stack);
  const single = mode === "single";
  const amt = Number(amount) || 0;
  const n = single ? chosen.length : eligible.length;
  const total = n * amt;
  const large = !single && n >= LARGE_BATCH;

  const changeMode = (m: "single" | "batch") => { setMode(m); setIds([]); setQuery(""); setOpen(false); setRuleId(""); setAmount(""); };
  const reset = () => { setReason(startReason); setDate(""); setFreq("Once"); setTiming("now"); changeMode("single"); setIds(startIds); setAmount(startAmount); };
  const toggle = (a: Account) => setIds(ids.includes(a.id) ? ids.filter((x) => x !== a.id) : [...ids, a.id]);

  const review = () => {
    const later = timing === "later";
    if (single && !chosen.length) return notify("Select at least one Active Education Account.");
    if (single && chosen.some((a) => a.status !== "Active")) return notify("Inactive Education Accounts cannot receive top-ups.");
    if (single && followup && chosen.some((a) => !followup.pool.some((p) => p.id === a.id))) return notify("Follow-ups can only include original Failed accounts that have not already been credited.");
    if (!single && !picked.length) return notify("Please select an active Batch Top-up Rule.");
    if (!Number.isSafeInteger(amt) || amt <= 0 || amt > MAX_AMOUNT) return notify(`Enter a whole-dollar top-up amount from S$1 to ${cash(MAX_AMOUNT)}.`);
    if (!reason.trim()) return notify("Please enter a reason.");
    if (later && !date) return notify("Please select the execution date.");
    if (later && !time) return notify("Please select the execution time.");
    const runs = single
      ? [{ name: chosen.length === 1 ? chosen[0].name : `${chosen.length} selected accounts`, targets: chosen }]
      : stack.map((s) => ({ name: s.rule.name, targets: s.accounts }));
    if (!single && runs.every((r) => !r.targets.length)) return notify("No eligible accounts found.");
    const grand = runs.reduce((t, r) => t + r.targets.length * amt, 0);
    const when = later ? `${date} at ${time}` : "Execute now";
    ask({
      title: "Review and confirm",
      text: (later ? "Review the scheduled top-up details." : "Review the top-up details before confirming.") + (followup ? ` This creates a NEW top-up linked to ${followup.id}; the original stays unchanged.` : ""),
      details: `Top-up Type: ${single ? "Specific Accounts" : "Batch"}\n${single ? `Recipients: ${chosen.map((a) => `${a.name} (${maskNric(a.nric)})`).join(", ")}` : `Rule: ${all ? `All active rules (${runs.length}), in creation order` : runs[0].name}`}\nEligible accounts: ${n}${!single && stacked ? ` (${stacked} qualify for more than one rule and receive each top-up)` : ""}\nAmount per account: ${cash(amt)}\nEstimated total: ${cash(grand)}\nReason: ${reason.trim()}\nExecution: ${later ? `${when} · ${freq}` : when}${followup ? `\nFollow-up to: ${followup.id}` : ""}`,
      confirmLabel: "Confirm",
      onConfirm: () => {
        const d = later ? date : sgToday();
        // One history row per rule, oldest rule first, so overlapping rules stack in creation order.
        for (const r of runs) {
          if (!single && !r.targets.length) continue;
          const one = r.targets.length === 1 ? r.targets[0] : null;
          onDone({
            ref: transactionCode(d), type: single ? "Single" : "Batch",
            recipient: single ? (one ? `${one.name} (${maskNric(one.nric)})` : r.name) : r.name,
            detail: single ? `${one ? `Education Account ${maskNric(one.nric)}` : `${r.targets.length} Education Accounts`} · ${reason.trim()}` : reason.trim(),
            date: d, schedule: later ? `${freq} · ${time}` : "Run now (ad-hoc)", targets: r.targets.map((a) => ({ student: a.name, account: a.nric, status: later ? ("Pending" as const) : ("Success" as const) })), accounts: r.targets.length, amount: amt, status: later ? "Pending" : "Success", by: "Daniel Lee",
            ...(followup ? { followupOf: followup.id } : {}),
          }, later ? [] : r.targets.map((a) => a.id));
        }
        closeAsk(); notify(later ? "Schedule recorded in demo." : followup ? "New top-up created; the original failed record is unchanged." : "Top-up simulated successfully."); onBack();
      },
    });
  };

  const row = (k: string, v: string) => <div className="summaryrow"><span>{k}</span><strong>{v}</strong></div>;

  return (
    <div id="transactions-editor">
      {followup && (
        <div id="new-topup-source-note" className="recovery-note" role="note">
          <div className="source-head simple"><div><strong>Follow-up to {followup.id}</strong><div className="small" style={{ marginTop: 5 }}>Original top-up type: {followup.row.type === "Batch" ? "Batch" : "Specific Accounts"} · Status: {followup.row.status}</div></div></div>
          <div className="followup-metrics">
            <div className="metric"><span className="small">Failed recipients</span><strong>{followup.failed.length}</strong></div>
            <div className="metric"><span className="small">Available to retry</span><strong>{followup.pool.length}</strong></div>
            <div className="metric"><span className="small">Top-up type</span><strong>Specific Accounts</strong></div>
          </div>
          <div className="source-desc">A new Specific Accounts top-up will be created. The original amount and reason are pre-filled. The original top-up execution remains unchanged and is kept for reference.</div>
          <div className="followup-list"><strong>Original failed accounts</strong><ul>{followup.failed.map((f) => <li key={f.account}><span>{f.student} · {maskNric(f.account)}</span><strong>{f.ready ? "Ready to select" : "Unavailable"}</strong></li>)}</ul></div>
          {followup.failed.some((f) => !f.ready) && <div className="source-warning">{followup.failed.filter((f) => !f.ready).length} failed account(s) are not currently Active and cannot be selected for follow-up.</div>}
        </div>
      )}
      <button type="button" className="backline" id="execution-back-btn" onClick={onBack}>{followup ? "← Back to original top-up execution" : "← Back to top-up transactions"}</button>
      <div className="two">
        <div className="card leftcard"><h2>{followup ? "Create Specific Accounts Top-up" : "Create top-up"}</h2>
          {!locked && <div className="field" id="topup-type-field"><label>Top-up Type</label><div className="switch">
            <button type="button" className={single ? "selected" : ""} onClick={() => changeMode("single")}>Specific Accounts</button>
            <button type="button" className={!single ? "selected" : ""} onClick={() => changeMode("batch")}>Batch</button></div></div>}

          {single ? (
            <div>
              <div className="field"><label htmlFor="student-input">Select specific accounts by name or NRIC <span className="required">*</span></label>
                <div className="combo" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
                  <input id="student-input" type="text" autoComplete="off" role="combobox" aria-expanded={open} aria-controls="student-dropdown" placeholder="Search and tick accounts by student name / NRIC..."
                    value={query} onFocus={() => setOpen(true)}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter") { e.preventDefault(); if (found[0]) toggle(found[0]); } }} />
                  {open && (
                    <div className="combo-pop" id="student-dropdown">
                      {found.length ? found.map((a) => (
                        <label key={a.id} className="studentitem account-check">
                          <span className="check-name"><input type="checkbox" checked={ids.includes(a.id)} onChange={() => toggle(a)} aria-label={`Select ${a.name}`} />
                            <span><strong>{a.name}</strong><small>{maskNric(a.nric)} · {a.school || "No current school"}</small></span></span>
                          <span className="studentaccount"><strong>{cash(a.balance)}</strong><small>Account: {a.status}</small></span>
                        </label>
                      )) : <div className="empty">{followup ? "No matching failed account that can be retried." : "No matching Active Education Accounts found."}</div>}
                    </div>
                  )}
                </div>
                <div className="help">Tick one or more Active accounts. One Amount applies to each selected account. Exact balances are shown to MOE HQ.</div></div>
              {chosen.length > 0 && (
                <div className="selected-accounts-multi" aria-live="polite">
                  <div className="selected-accounts-head"><strong>Selected accounts ({chosen.length})</strong><button type="button" className="btn small" onClick={() => setIds([])}>Clear selection</button></div>
                  {chosen.map((a) => (
                    <div className="single-account-row" key={a.id}>
                      <div className="account-details"><strong>{a.name}</strong><small>NRIC: {maskNric(a.nric)} · {a.status}</small></div>
                      <div className="account-right"><div className="studentaccount"><strong>{cash(a.balance)}</strong><small>Account balance</small></div>
                        <button type="button" className="remove-account" onClick={() => setIds(ids.filter((x) => x !== a.id))} aria-label={`Remove ${a.name}`}>Remove</button></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="field"><label htmlFor="selected-rule">Batch Top-up Rule <span className="required">*</span></label>
                <select id="selected-rule" value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
                  <option value="">Select an active rule...</option>
                  {active.length > 1 && <option value={ALL}>All active rules ({active.length}), in creation order</option>}
                  {active.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}
                </select>
                <div className="help">Rules are created in the Batch Top-up Rule tab. Only Active rules appear here. Rules may overlap: a student who matches several rules receives each top-up, in the order the rules were created.</div></div>
              {all && <div className="rule-summary">{active.map((r) => `${r.id} ${r.name}`).join(" → ")}</div>}
              {rule && <div className="rule-summary">{`${rule.conditions.map(conditionText).join(" | ")} · ${cash(rule.minBalance)} to under ${cash(rule.maxBalance)} · ${rule.schooling} · ${rule.schools.length ? `${rule.schools.length} schools` : "All schools"}`}</div>}
            </div>
          )}

          <div className="field" id="amount-field"><label htmlFor="amount">Amount (S$) <span className="required">*</span></label>
            <input id="amount" type="number" min={1} step={1} placeholder="e.g. 200" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="field"><label htmlFor="reason">Reason <span className="required">*</span></label>
            <textarea id="reason" maxLength={500} placeholder="e.g. ad-hoc student assistance" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="help">Required for Specific Accounts and Batch top-ups. Max 500 characters. Kept in transaction history.</div></div>
          <div className="field"><label>Execution timing</label><div className="switch">
            <button type="button" className={timing === "now" ? "selected" : ""} onClick={() => setTiming("now")}>Execute now</button>
            <button type="button" className={timing === "later" ? "selected" : ""} onClick={() => setTiming("later")}>Schedule for later</button></div></div>
          {timing === "now" && large && <div className="help" role="note" style={{ marginBottom: 12 }}>This batch has {n} top-ups. Large batches are best scheduled for off-hours (for example {NIGHT_TIME}) to keep the system responsive.</div>}
          {timing === "later" && (<>
            <div className="field"><label htmlFor="schedule-date">Execution date <span className="required">*</span></label><input type="date" id="schedule-date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field"><label htmlFor="schedule-frequency">Frequency <span className="required">*</span></label>
              <select id="schedule-frequency" value={freq} onChange={(e) => setFreq(e.target.value)}>{FREQUENCIES.map((f) => <option key={f}>{f}</option>)}</select></div>
            <div className="field"><label htmlFor="schedule-time">Execution time (SGT) <span className="required">*</span></label><input type="time" id="schedule-time" value={time} onChange={(e) => setTime(e.target.value)} />
              {!single && <div className="help">Large batches should run off-hours. Night time {NIGHT_TIME} is suggested.</div>}</div>
          </>)}
          <div className="buttons"><button type="button" className="btn" onClick={reset}>Reset</button><button type="button" className="btn primary" onClick={review}>Review and confirm</button></div>
        </div>

        <div className="card rightcard"><h2>Top-up summary</h2>
          {row("Type", single ? "Specific Accounts" : "Batch")}
          {row(single ? (chosen.length > 1 ? "Recipients" : "Recipient") : "Target", single ? (chosen.length === 0 ? "Not selected" : chosen.length === 1 ? chosen[0].name : `${chosen.length} accounts selected`) : all ? `All active rules (${active.length})` : rule?.name ?? "Not selected")}
          {!single && row("Eligible accounts", picked.length ? `${eligible.length}${stacked ? ` (${stacked} account(s) stack more than one rule)` : ""}` : "-")}
          {row("Amount / account", cash(amt))}
          {row("Reason", reason.trim() || "Not entered")}
          {row("Execution", timing === "now" ? "Execute now" : `Schedule for later · ${[date || "Date not set", freq, time && `${time} SGT`].filter(Boolean).join(" · ")}`)}
          {!single && row("Estimated total", total ? cash(total) : "-")}
          {!single && picked.length > 0 && (
            <div id="batch-eligible-preview" className="eligible-preview"><h3>Eligible accounts</h3>
              <div id="batch-eligible-list" className="eligible-preview-list" role="region" aria-label="Eligible accounts for selected batch rule" tabIndex={0}>
                {eligible.length ? stack.flatMap((s) => s.accounts.map((a) => <div className="eligible-preview-item" key={`${s.rule.id}-${a.id}`}><div><strong>{a.name}</strong><small>{maskNric(a.nric)} · {levelOfClass(a.class)} · Age {a.age}{all ? ` · ${s.rule.id}` : ""}</small></div><span className="account-ref">{amt > 0 ? cash(amt) : "Amount not entered"}</span></div>))
                  : <div className="empty">No eligible accounts for this rule.</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
