import { useState } from "react";
import { useRegistry } from "../../../data/registryStore";
import { LEVELS } from "../../../data/students";
import { SCHOOLING, type Condition, type FundRule, type RuleSchooling, type RuleStatus, type TargetMode } from "../../../data/topup";
import { conditionText, nextRuleId, targetLabel } from "../../../lib/topup";
import { cash, type DialogSpec } from "./tuUi";

type Props = { rules: FundRule[]; onChange: (next: FundRule[]) => void; notify: (m: string) => void; ask: (d: DialogSpec) => void; closeAsk: () => void };

const badgeClass = (s: RuleStatus) => (s === "Draft" ? "draft" : s === "Deactivated" ? "deactivated" : "");
/** One condition row as typed: range = a (min) / b (max); age = a; level = a. */
type FormCond = { type: Condition["type"]; a: string; b: string };
const toForm = (c: Condition): FormCond => (c.type === "range" ? { type: "range", a: String(c.min), b: String(c.max) } : c.type === "age" ? { type: "age", a: String(c.age), b: "" } : { type: "level", a: c.level, b: "" });
const DEFAULTS: Record<TargetMode, FormCond[]> = {
  range: [{ type: "range", a: "7", b: "16" }],
  ages: [{ type: "age", a: "7", b: "" }, { type: "age", a: "9", b: "" }],
  levels: [{ type: "level", a: "P1", b: "" }, { type: "level", a: "P2", b: "" }],
  mixed: [{ type: "range", a: "7", b: "10" }, { type: "age", a: "12", b: "" }],
};
const NEW_ROW: Record<Condition["type"], FormCond> = { range: { type: "range", a: "7", b: "10" }, age: { type: "age", a: "7", b: "" }, level: { type: "level", a: "P1", b: "" } };
const MODES: [TargetMode, string][] = [["range", "Age range"], ["ages", "Specific ages"], ["levels", "Level"], ["mixed", "Combined criteria (multiple conditions)"]];
const range = (r: FundRule) => `${cash(r.minBalance)} to under ${cash(r.maxBalance)}`;

export default function Rules(props: Props) {
  const [form, setForm] = useState<{ rule: FundRule | null; ro: boolean } | null>(null);
  return form ? <RuleForm {...props} rule={form.rule} ro={form.ro} onBack={() => setForm(null)} /> : <RuleList {...props} onAdd={() => setForm({ rule: null, ro: false })} onOpen={(rule, ro) => setForm({ rule, ro })} />;
}

function RuleList({ rules, onChange, onAdd, onOpen, notify, ask, closeAsk }: Props & { onAdd: () => void; onOpen: (r: FundRule, ro: boolean) => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const list = rules.filter((r) => (!q.trim() || `${r.id} ${r.name} ${targetLabel(r)}`.toLowerCase().includes(q.trim().toLowerCase())) && (!status || r.status === status));
  const setStatusOf = (id: string, s: RuleStatus) => onChange(rules.map((r) => (r.id === id ? { ...r, status: s } : r)));
  const toggle = (r: FundRule) => {
    if (r.status === "Active") { setStatusOf(r.id, "Deactivated"); notify(`Rule ${r.id} deactivated.`); return; }
    ask({
      title: "Activate Batch Top-up Rule?", text: "Are you sure you want to activate this rule?",
      details: `Rule: ${r.name}\nOnce activated, this rule will be available for Batch Top-up Execution.`, confirmLabel: "Activate",
      onConfirm: () => { closeAsk(); setStatusOf(r.id, "Active"); notify(`Rule ${r.id} activated.`); },
    });
  };
  return (
    <div id="rules-list" className="card tablecard"><div className="tabletop"><h2>Batch Top-up Rule</h2></div>
      <div className="toolbar filters-toolbar">
        <input className="filter-search" type="search" placeholder="Search rule name or ID..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search rules" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option><option>Active</option><option>Draft</option><option>Deactivated</option></select>
        <button type="button" className="btn reset-filter" onClick={() => { setQ(""); setStatus(""); }}>Reset Filter</button>
        <button type="button" className="btn primary create-action" onClick={onAdd}>＋ Add rule</button>
      </div>
      <div className="tablewrap"><table className="data-table"><thead><tr><th>Rule ID</th><th>Rule name</th><th>Recipient criteria</th><th>Balance range</th><th>Schooling status</th><th>Schools</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {list.length ? list.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td><td><strong>{r.name}</strong></td>
              <td title={r.conditions.map(conditionText).join(" | ")}><span className="rule-target-compact">{targetLabel(r)}</span><span className="rule-target-note">{r.conditions.length} condition{r.conditions.length === 1 ? "" : "s"} · {r.status === "Draft" ? "Edit" : "View"} for details</span></td>
              <td>{range(r)}</td><td>{r.schooling}</td>
              <td>{r.schools.length ? `${r.schools.length} selected` : "All schools"}</td>
              <td><span className={`badge ${badgeClass(r.status)}`}>{r.status}</span></td>
              <td><div className="actiongroup">
                {r.status !== "Draft" && <button type="button" onClick={() => onOpen(r, true)}>View</button>}
                {r.status !== "Active" && <button type="button" onClick={() => onOpen(r, false)}>Edit</button>}
                <button type="button" onClick={() => toggle(r)}>{r.status === "Active" ? "Deactivate" : "Activate"}</button>
              </div></td>
            </tr>
          )) : <tr><td colSpan={8} className="empty">No Batch Top-up Rules found.</td></tr>}
        </tbody></table></div>
    </div>
  );
}

function RuleForm({ rules, onChange, onBack, rule: v, ro, notify, ask, closeAsk }: Props & { onBack: () => void; rule: FundRule | null; ro: boolean }) {
  const [name, setName] = useState(v?.name ?? "");
  const [mode, setMode] = useState<TargetMode>(v?.mode ?? "range");
  const [conds, setConds] = useState<FormCond[]>(v ? v.conditions.map(toForm) : DEFAULTS.range);
  const changeMode = (m: TargetMode) => { setMode(m); setConds(DEFAULTS[m]); setError(""); };
  const setCond = (i: number, patch: Partial<FormCond>) => setConds(conds.map((c, n) => (n === i ? { ...c, ...patch } : c)));
  const changeType = (i: number, type: Condition["type"]) => setConds(conds.map((c, n) => (n === i ? NEW_ROW[type] : c)));
  const [balMin, setBalMin] = useState(String(v?.minBalance ?? 0));
  const [balMax, setBalMax] = useState(String(v?.maxBalance ?? 500));
  const [schooling, setSchooling] = useState<string>(v?.schooling ?? "");
  const { state: reg } = useRegistry();
  const [find, setFind] = useState("");
  const [schools, setSchools] = useState<string[]>(v?.schools ?? []);
  const [error, setError] = useState("");

  const shown = reg.schools.filter((s) => `${s.name} ${s.level}`.toLowerCase().includes(find.trim().toLowerCase()));

  const save = (status: RuleStatus) => {
    const bmin = Number(balMin), bmax = Number(balMax);
    const parsed: Condition[] = conds.map((c) => (c.type === "range" ? { type: "range", min: Number(c.a), max: Number(c.b) } : c.type === "age" ? { type: "age", age: Number(c.a) } : { type: "level", level: c.a }));
    const bad = (c: Condition) => (c.type === "range" ? !Number.isInteger(c.min) || !Number.isInteger(c.max) || c.min < 0 || c.min > c.max : c.type === "age" ? !Number.isInteger(c.age) || c.age < 0 : !(LEVELS as readonly string[]).includes(c.level));
    const keys = parsed.map((c) => (c.type === "range" ? `r${c.min}-${c.max}` : c.type === "age" ? `a${c.age}` : `l${c.level}`));
    const err = !name.trim() ? "Rule name is required."
      : !parsed.length ? "Add at least one recipient condition."
      : parsed.some(bad) ? (mode === "range" ? "Minimum and maximum age are invalid." : "Enter valid ages, age ranges or levels.")
      : new Set(keys).size !== keys.length ? "Each age, age range or level can only be listed once."
      : !Number.isFinite(bmin) || !Number.isFinite(bmax) || bmin < 0 || bmax <= bmin ? "Balance range is invalid."
      : !schooling ? "Schooling status is required." : "";
    if (err) { setError(err); return; }
    const next: FundRule = { id: v?.id ?? nextRuleId(rules), name: name.trim(), mode, conditions: parsed, minBalance: bmin, maxBalance: bmax, schooling: schooling as RuleSchooling, schools, status: v?.status === "Deactivated" && status === "Draft" ? "Deactivated" : status };
    onChange(v ? rules.map((r) => (r.id === v.id ? next : r)) : [...rules, next]);
    onBack(); notify("Batch Top-up Rule saved.");
  };
  const activate = () => ask({
    title: "Activate Batch Top-up Rule?", text: "Are you sure you want to activate this rule?",
    details: `Rule: ${name.trim() || "New Top-up Rule"}\nOnce activated, this rule will be available for Batch Top-up Execution.`, confirmLabel: "Activate",
    onConfirm: () => { closeAsk(); save("Active"); },
  });

  const req = <span className="required">*</span>;
  return (
    <div>
      <button type="button" className="backline" onClick={onBack}>← Back to Batch Top-up Rule</button>
      <div className={`card ruleformcard${ro ? " rule-view-mode" : ""}`}><fieldset disabled={ro} className="rule-fieldset">
        <div className="ruletitle">{ro ? "View Batch Top-up Rule" : v ? "Edit Batch Top-up Rule" : "Create Batch Top-up Rule"}</div>
        <div className="sectionlabel">1. RULE DETAILS</div>
        <div className="formgrid">
          <div className="field full-row"><label htmlFor="rule-name">Rule name {req}</label><input id="rule-name" placeholder="e.g. Primary Student Support" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></div>
        </div>
        <div className="sectionlabel">2. RECIPIENT CRITERIA</div>
        <div className="field"><label htmlFor="target-mode">Targeting method {req}</label>
          <select id="target-mode" value={mode} onChange={(e) => changeMode(e.target.value as TargetMode)}>{MODES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <div className="help">Specific Ages can include 7 and 9 without 8. Combined criteria supports Age Range, Specific Age and Level in one rule.</div></div>
        {mode === "range" ? (
          <div id="age-range-wrap" className="formgrid">
            <div className="field"><label htmlFor="age-min">Minimum age (inclusive) {req}</label><input type="number" id="age-min" min={0} step={1} value={conds[0]?.a ?? ""} onChange={(e) => setCond(0, { a: e.target.value })} /></div>
            <div className="field"><label htmlFor="age-max">Maximum age (inclusive) {req}</label><input type="number" id="age-max" min={0} step={1} value={conds[0]?.b ?? ""} onChange={(e) => setCond(0, { b: e.target.value })} /></div>
          </div>
        ) : (
          <div id="bands-wrap">
            <div id="band-list" className="band-list">
              {conds.map((c, i) => (
                <div className="rule-condition-row" key={i}>
                  <div className="field"><label>Condition {i + 1}</label>
                    {mode === "mixed"
                      ? <select aria-label="Condition type" value={c.type} onChange={(e) => changeType(i, e.target.value as Condition["type"])}><option value="range">Age Range</option><option value="age">Specific Age</option><option value="level">Level</option></select>
                      : <strong>{mode === "ages" ? "Specific Age" : "Level"}</strong>}</div>
                  <div className="field"><label>{mode === "mixed" ? "Eligibility condition" : c.type === "age" ? "Age" : "Level"}</label>
                    <div className="rule-condition-values">
                      {c.type === "range" ? <><input aria-label="Minimum age" type="number" min={0} step={1} placeholder="Minimum Age" value={c.a} onChange={(e) => setCond(i, { a: e.target.value })} /><input aria-label="Maximum age" type="number" min={0} step={1} placeholder="Maximum Age" value={c.b} onChange={(e) => setCond(i, { b: e.target.value })} /></>
                        : c.type === "age" ? <input aria-label="Specific age" type="number" min={0} step={1} value={c.a} onChange={(e) => setCond(i, { a: e.target.value })} />
                        : <select aria-label="Level" value={c.a} onChange={(e) => setCond(i, { a: e.target.value })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>}
                    </div></div>
                  <button type="button" className="btn small" onClick={() => setConds(conds.filter((_, n) => n !== i))}>Remove</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn small" onClick={() => setConds([...conds, NEW_ROW[mode === "ages" ? "age" : mode === "levels" ? "level" : "range"]])}>{mode === "mixed" ? "＋ Add condition" : mode === "ages" ? "＋ Add age" : "＋ Add level"}</button>
            <div className="help">Balance, Schooling Status and School List must match; targeting conditions can be alternatives in Combined mode.</div>
            {mode === "mixed" && <div id="mixed-hint" className="mixed-note">An account matching any condition is eligible. An account matching multiple conditions within the same rule is included only once.</div>}
          </div>
        )}
        <div className="formgrid">
          <div className="field"><label htmlFor="bal-min">Minimum balance, inclusive (S$) {req}</label><input type="number" id="bal-min" min={0} step={0.01} value={balMin} onChange={(e) => setBalMin(e.target.value)} /></div>
          <div className="field"><label htmlFor="bal-max">Maximum balance, exclusive (S$) {req}</label><input type="number" id="bal-max" min={0} step={0.01} value={balMax} onChange={(e) => setBalMax(e.target.value)} />
            <div className="rule-form-help">Min &lt;= balance &lt; Max, so S$0–300 and S$300–500 never overlap at S$300.</div></div>
        </div>
        <div className="field"><label htmlFor="schooling">Schooling status {req}</label>
          <select id="schooling" value={schooling} onChange={(e) => setSchooling(e.target.value)}><option value="">Select schooling status...</option>{SCHOOLING.map((o) => <option key={o}>{o}</option>)}</select>
          <div className="rule-form-help">Schooling status is separate from Education Account status.</div></div>
        <div className="sectionlabel">3. SCHOOLS (OPTIONAL)</div>
        <div className="schools-row">
          <input placeholder="Search school name..." aria-label="Search schools" value={find} onChange={(e) => setFind(e.target.value)} />
          <button type="button" className="btn small" onClick={() => setSchools([...new Set([...schools, ...shown.map((s) => s.name)])])}>Select shown</button>
          <button type="button" className="btn small" style={{ border: 0 }} onClick={() => setSchools([])}>Clear all</button>
        </div>
        <div className="schools-list">
          {shown.length ? shown.map((s) => (
            <label className="schoolitem" key={s.code}>
              <input type="checkbox" checked={schools.includes(s.name)} onChange={(e) => setSchools(e.target.checked ? [...schools, s.name] : schools.filter((x) => x !== s.name))} />
              <span>{s.name}</span><small>{s.level}</small>
            </label>
          )) : <div className="empty">No schools found.</div>}
        </div>
        <div className="rule-form-help">{schools.length ? `${schools.length} selected` : "None selected: applies to all schools."}</div>
        {error && <div className="alert" role="alert">{error}</div>}
        </fieldset>
        {!ro && <div className="formfoot">
          <button type="button" className="btn small" onClick={onBack}>Cancel</button>
          <button type="button" className="btn small" onClick={() => save("Draft")}>Save draft</button>
          <button type="button" className="btn small primary" onClick={activate}>Activate</button>
        </div>}
      </div>
    </div>
  );
}
