import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle, Plus, WarningOctagon } from "@phosphor-icons/react";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { SCHOOLS } from "../../../data/schools";
import {
  draftOfSbfasRule, nextSbfasRuleId, ruleForSchool, sbfasRuleOk, subsidySummary, toSbfasRule, validateSbfasRule,
  type SbfasRule, type SbfasRuleDraft, type SbfasRuleErrors, type SbfasRuleStatus, type SubsidyBasis,
} from "../../../data/sbfasRule";
import { useSbfas } from "../../../data/sbfasStore";
import { useFees } from "../../../data/feeStore";
import { useSession } from "../../../session";
import { formatDate } from "../../../lib/format";

const TONE: Record<SbfasRuleStatus, BadgeTone> = { Active: "success", Draft: "warning", Inactive: "neutral" };

const th = "whitespace-nowrap border-b border-line bg-surface-container-low px-3 py-3 text-left text-[13px] font-medium text-on-surface-variant";
const td = "border-b border-line px-3 py-2 align-top";
const cell = "min-h-10 rounded-control border border-outline bg-surface-container-lowest px-2 text-sm disabled:opacity-70";

type Notify = (m: string, bad?: boolean) => void;
type FeeTypeLite = { id: string; name: string; components: { name: string }[] };
/** One row of the subsidy matrix (step 3): a component of one of the school's fee types, with its own basis. */
type MatrixRow = { ft: string; comp: string; basis: SubsidyBasis };

function Editor({ initial, isNew, readOnly, feeTypes, onBack, onSave, notify }: {
  initial: SbfasRule; isNew: boolean; readOnly: boolean; feeTypes: FeeTypeLite[];
  onBack: () => void; onSave: (r: SbfasRule, activate: boolean) => void; notify: Notify;
}) {
  const [name, setName] = useState(initial.name);
  const [d, setD] = useState<SbfasRuleDraft>(() => {
    const draft = draftOfSbfasRule(initial);
    // Drop overrides for components the school no longer has — they could never be picked in the matrix again.
    const known = new Set(feeTypes.flatMap((f) => f.components.map((c) => c.name)));
    return {
      ...draft,
      tiers: draft.tiers.map((t) => ({ ...t, components: Object.fromEntries(Object.entries(t.components ?? {}).filter(([n]) => known.has(n))) })),
    };
  });
  const [errors, setErrors] = useState<SbfasRuleErrors>({ rows: {} });
  const [picker, setPicker] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  // Matrix rows mirror HQ's subsidy table: one row per subsidised component, one column per rank.
  const [rows, setRows] = useState<MatrixRow[]>(() =>
    feeTypes.flatMap((ft) =>
      ft.components
        .filter((c) => initial.tiers.some((t) => t.components && c.name in t.components))
        .map((c) => ({ ft: ft.id, comp: c.name, basis: initial.tiers.find((t) => t.components?.[c.name])?.components?.[c.name]?.basis ?? "percent" })),
    ),
  );

  const upd = (i: number, patch: Partial<SbfasRuleDraft["tiers"][number]>) =>
    setD((x) => ({ ...x, tiers: x.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  const addRank = () => setD((x) => ({ ...x, tiers: [...x.tiers, { basis: "percent", rate: "" }] }));
  const rmLastRank = () => {
    if (d.tiers.length <= 1 || !window.confirm("Remove the last rank and its subsidy values?")) return;
    setD((x) => ({ ...x, tiers: x.tiers.slice(0, -1) }));
  };

  const ftOf = (id: string) => feeTypes.find((x) => x.id === id);
  const freeComp = (ftId: string) => ftOf(ftId)?.components.find((c) => !rows.some((r) => r.ft === ftId && r.comp === c.name))?.name;
  const kinds = [...new Set(rows.map((r) => r.ft))];

  const setCell = (ti: number, comp: string, basis: SubsidyBasis, val: string) =>
    setD((x) => ({
      ...x,
      tiers: x.tiers.map((t, j) => {
        if (j !== ti) return t;
        const comps = { ...(t.components ?? {}) };
        if (val === "") delete comps[comp]; // empty cell = follow the rank's flat rate
        else comps[comp] = { basis, rate: val };
        return { ...t, components: comps };
      }),
    }));
  const setRowBasis = (ri: number, basis: SubsidyBasis) => {
    const { comp } = rows[ri];
    setRows(rows.map((x, k) => (k === ri ? { ...x, basis } : x)));
    setD((x) => ({ ...x, tiers: x.tiers.map((t) => (t.components?.[comp] ? { ...t, components: { ...t.components, [comp]: { basis, rate: t.components[comp].rate } } } : t)) }));
  };
  const setRowComp = (ri: number, comp: string) => {
    const { comp: old } = rows[ri];
    setRows(rows.map((x, k) => (k === ri ? { ...x, comp } : x)));
    setD((x) => ({ ...x, tiers: x.tiers.map((t) => {
      const prev = t.components?.[old];
      if (!prev) return t;
      const comps = { ...t.components };
      delete comps[old];
      comps[comp] = prev;
      return { ...t, components: comps };
    }) }));
  };
  const rmRow = (ri: number) => {
    const { comp } = rows[ri];
    setRows(rows.filter((_, k) => k !== ri));
    setD((x) => ({ ...x, tiers: x.tiers.map((t) => {
      if (!(comp in (t.components ?? {}))) return t;
      const comps = { ...t.components };
      delete comps[comp];
      return { ...t, components: comps };
    }) }));
  };
  const addRowFor = (ftId: string) => {
    const comp = freeComp(ftId);
    if (comp === undefined) return;
    setRows([...rows, { ft: ftId, comp, basis: "percent" }]);
  };
  const addPicked = () => {
    const add = picked
      .map((ftId) => ({ ft: ftId, comp: freeComp(ftId), basis: "percent" as SubsidyBasis }))
      .filter((r): r is MatrixRow => r.comp !== undefined);
    if (add.length) setRows([...rows, ...add]);
    setPicked([]);
    setPicker(false);
  };

  const save = (activate: boolean) => {
    if (!name.trim()) return notify("Enter a rule name.", true);
    const e = validateSbfasRule(d);
    setErrors(e);
    if (!sbfasRuleOk(e)) return notify("Fix the highlighted fields before saving.", true);
    onSave({ ...toSbfasRule(d, initial.school, initial.id, name.trim()), status: "Draft" }, activate);
  };

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <ArrowLeft size={16} weight="bold" aria-hidden="true" /> SBFAS rules
      </button>
      <h2 className="text-2xl font-bold tracking-tight">{readOnly ? "View rule" : isNew ? "Create rule" : "Edit rule"}</h2>
      <Card title="SBFAS · School package" action={<Badge tone={TONE[initial.status]}>{initial.status === "Draft" && !readOnly ? "Editable draft" : initial.status}</Badge>}>
        <p className="text-sm text-on-surface-variant">
          Select the school&apos;s fee types, give individual components their own subsidy rates, then set the ranks
          and their flat subsidies.
        </p>
        <fieldset disabled={readOnly} className="mt-5 min-w-0 space-y-6 disabled:opacity-90">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">1. Select fee types</h3>
                <p className="mt-1 text-[13px] text-on-surface-variant">Select the school&apos;s fee types. Choose their components in the subsidy table below.</p>
              </div>
              {feeTypes.length > 0 && (
                <Button variant="secondary" icon={<Plus size={16} weight="bold" aria-hidden="true" />} onClick={() => setPicker((o) => !o)}>Add fee types</Button>
              )}
            </div>
            {feeTypes.length === 0 ? (
              <p className="mt-4 text-[13px] text-on-surface-variant">No fee types set up for your school yet. Manage them under Fee structure, then come back to subsidise components.</p>
            ) : (
              <>
                {picker && (
                  <div className="mt-4 rounded-control bg-surface-container-low p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <b className="text-sm">Fee types</b>
                      <Button size="sm" variant="secondary" onClick={() => setPicker(false)}>Close</Button>
                    </div>
                    <div className="mt-2">
                      {feeTypes.map((k) => {
                        const exists = rows.some((r) => r.ft === k.id);
                        return (
                          <label key={k.id} className="flex items-center gap-3 border-b border-line py-3 text-sm last:border-0">
                            <input type="checkbox" className="size-4 accent-primary" checked={exists || picked.includes(k.id)} disabled={exists}
                              onChange={(e) => setPicked(e.target.checked ? [...picked, k.id] : picked.filter((x) => x !== k.id))} />
                            <span><b>{k.name}</b>{exists && <span className="block text-[13px] text-on-surface-variant">Already selected</span>}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-[13px] text-on-surface-variant">Only fee types set up for your school appear here — manage them under Fee structure.</p>
                      <Button size="sm" disabled={!picked.length} onClick={addPicked}>Add selected fee types</Button>
                    </div>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {kinds.length ? kinds.map((id) => <span key={id} className="rounded-full bg-track px-3 py-1 text-xs font-semibold text-on-surface-variant">{ftOf(id)?.name ?? id}</span>)
                    : <span className="text-[13px] text-on-surface-variant">No fee types selected. Choose one or more school fee types above.</span>}
                </div>
              </>
            )}
          </section>

          <section className="border-t border-line pt-6">
            <h3 className="text-sm font-bold">2. Subsidy by fee component</h3>
            <p className="mt-1 text-[13px] text-on-surface-variant">Give a component its own subsidy for a rank. Leave a cell empty to follow that rank&apos;s flat rate in step 3.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={th}>Fee type</th>
                    <th className={th}>Fee component</th>
                    <th className={th}>Basis</th>
                    {d.tiers.map((_, i) => <th key={i} className={th}>Rank {i + 1}</th>)}
                    <th className={th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => {
                    const ft = ftOf(r.ft);
                    if (!ft) return null;
                    return (
                      <tr key={`${r.ft}:${r.comp}`}>
                        <td className={td}>
                          <b>{ft.name}</b>
                          <Button size="sm" variant="secondary" className="mt-2" disabled={freeComp(ft.id) === undefined} onClick={() => addRowFor(ft.id)}>+ Component</Button>
                        </td>
                        <td className={td}>
                          <select required className={`${cell} min-w-40`} aria-label={`${ft.name} component`} value={r.comp} onChange={(e) => setRowComp(ri, e.target.value)}>
                            {ft.components.map((c) => (
                              <option key={c.name} value={c.name} disabled={rows.some((z, k) => k !== ri && z.ft === r.ft && z.comp === c.name)}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className={td}>
                          <select className={cell} aria-label={`${r.comp} subsidy basis`} value={r.basis} onChange={(e) => setRowBasis(ri, e.target.value as SubsidyBasis)}>
                            <option value="percent">Percentage (%)</option>
                            <option value="fixed">Fixed amount (SGD)</option>
                          </select>
                        </td>
                        {d.tiers.map((t, ti) => (
                          <td key={ti} className={td}>
                            <input
                              type="number"
                              min={0}
                              max={r.basis === "fixed" ? undefined : 100}
                              step={0.5}
                              className={`${cell} w-24 text-right`}
                              aria-label={`${r.comp} Rank ${ti + 1} subsidy`}
                              placeholder={t.basis === "fixed" ? (t.rate ? `S$${t.rate}` : "") : (t.rate ? `${t.rate}%` : "")}
                              value={t.components?.[r.comp]?.rate ?? ""}
                              onChange={(e) => setCell(ti, r.comp, r.basis, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className={td}><Button size="sm" variant="ghost" onClick={() => rmRow(ri)}>Remove</Button></td>
                      </tr>
                    );
                  })}
                  {!rows.length && <tr><td colSpan={d.tiers.length + 4} className="px-3 py-8 text-center text-on-surface-variant">No components selected. Add school fee types above to give components their own rates.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[13px] text-on-surface-variant">Only the components added here get their own rates. Every other component — and any empty cell — follows its rank&apos;s flat rate from step 3.</p>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <span className="mr-auto text-[13px] text-on-surface-variant">{d.tiers.length} {d.tiers.length === 1 ? "rank" : "ranks"}</span>
              <Button size="sm" variant="secondary" icon={<Plus size={16} weight="bold" aria-hidden="true" />} onClick={addRank}>Add rank</Button>
              <Button size="sm" variant="secondary" disabled={d.tiers.length <= 1} onClick={rmLastRank}>Remove last rank</Button>
            </div>
          </section>

          <section className="border-t border-line pt-6">
            <h3 className="text-sm font-bold">3. Configure ranks</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Rule name" required>
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            </div>
            <p className="mt-4 rounded-control bg-surface-container-low p-3 text-sm">Ranks are the school&apos;s own support levels — income bands play no part in SBFAS. The school sets each applicant&apos;s rank at review.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={th}>Rank</th>
                    <th className={th}>Subsidy</th>
                  </tr>
                </thead>
                <tbody>
                  {d.tiers.map((t, i) => (
                    <tr key={i}>
                      <td className={`${td} py-3 font-semibold`}>Rank {i + 1}</td>
                      <td className={`${td} py-3`}>
                        <div className="flex items-center gap-2">
                          <select
                            className={`${cell} min-h-9`}
                            aria-label={`Rank ${i + 1} subsidy basis`}
                            value={t.basis}
                            onChange={(e) => upd(i, { basis: e.target.value as SubsidyBasis })}
                          >
                            <option value="percent">% of fee</option>
                            <option value="fixed">Fixed S$</option>
                          </select>
                          <div className="w-28">
                            <input
                              type="number"
                              min={0}
                              max={t.basis === "fixed" ? undefined : 100}
                              step={0.5}
                              className={`${cell} w-full text-right`}
                              aria-label={`Rank ${i + 1} subsidy ${t.basis === "fixed" ? "amount" : "rate"}`}
                              value={t.rate}
                              onChange={(e) => upd(i, { rate: e.target.value })}
                            />
                            {errors.rows[i] && <p role="alert" className="mt-1.5 text-[13px] font-medium text-alert">{errors.rows[i]}</p>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[13px] text-on-surface-variant">A rank is one support level of the package. Its flat subsidy applies to every fee component; step 2 can give a single component its own rate for a rank. Each rank added in step 2 adds a column to the subsidy table.</p>
            {errors.tiers && <p role="alert" className="mt-2 text-[13px] font-medium text-alert">{errors.tiers}</p>}
          </section>
        </fieldset>
        {!readOnly && (
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={onBack}>Cancel</Button>
            <Button variant="secondary" onClick={() => save(false)}>Save draft</Button>
            <Button onClick={() => save(true)}>Activate</Button>
          </div>
        )}
      </Card>
    </form>
  );
}

function ActivateModal({ rule, current, onClose, onConfirm }: { rule: SbfasRule | null; current?: SbfasRule; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={!!rule} onClose={onClose} title="Activate rule?"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={onConfirm}>Activate</Button></>}>
      <p>
        Activate <b>{rule?.name}</b>?
        {current && current.id !== rule?.id
          ? <> The currently active rule {current.id} ({current.name}) will become Inactive.</>
          : " This will become the school's active SBFAS rule."} Existing application outcomes stay unchanged.
      </p>
    </Modal>
  );
}

/**
 * School-side SBFAS rules (Req 4), the same version lifecycle as HQ's FAS Rules: a list of versions where
 * only one is Active at a time, an editor for drafts, and an Activate confirmation. The Active version (or
 * the default package, until the school activates one) is what the review queue and new arrivals use.
 */
export default function SbfasRules() {
  const { role, staff } = useSession();
  const school = role === "school" ? staff?.schoolCode ?? null : null;
  const { state, dispatch } = useSbfas();
  const { state: feeState } = useFees();
  const feeTypes = school
    ? feeState.types.filter((ft) => ft.school === school).map((ft) => ({ id: ft.id, name: ft.name, components: ft.components.map((c) => ({ name: c.name })) }))
    : [];
  const [editing, setEditing] = useState<{ rule: SbfasRule; isNew: boolean; readOnly: boolean } | null>(null);
  const [activating, setActivating] = useState<SbfasRule | null>(null);
  const [msg, setMsg] = useState({ text: "", bad: false });
  const notify = (text: string, bad = false) => setMsg({ text, bad });
  const msgRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (msg.text) msgRef.current?.focus(); }, [msg.text]);

  if (!school) {
    return (
      <Card title="SBFAS rules">
        <EmptyState title="SBFAS rules are set by each school" hint="Sign in as a school user to configure your school's package." />
      </Card>
    );
  }

  const versions = state.rules[school] ?? [];
  const active = versions.find((r) => r.status === "Active");
  const schoolName = SCHOOLS.find((s) => s.code === school)?.name ?? school;

  const create = () => {
    notify("");
    // A new rule starts as a copy of the package in effect — schools tweak from what they already run.
    const seed = ruleForSchool(state.rules, school);
    setEditing({ rule: { ...seed, id: nextSbfasRuleId(versions), name: "", status: "Draft" }, isNew: true, readOnly: false });
  };

  const save = (r: SbfasRule, wantActive: boolean) => {
    if (!editing) return;
    // Editing an Inactive version never rewrites history — it starts a new version, like HQ's rules.
    const id = editing.rule.status === "Inactive" ? nextSbfasRuleId(versions) : editing.rule.id;
    const record: SbfasRule = { ...r, id };
    if (wantActive) return setActivating(record);
    dispatch({ type: "save-rule", rule: record });
    setEditing(null);
    notify("Draft saved.");
  };

  const activate = () => {
    if (!activating) return;
    dispatch({ type: "save-rule", rule: activating });
    dispatch({ type: "activate-rule", school, id: activating.id });
    setActivating(null);
    setEditing(null);
    notify("Rule activated. The previous active rule is now Inactive. Previous application outcomes remain unchanged.");
  };

  const banner = (
    <div ref={msgRef} tabIndex={-1} aria-live="polite" className="outline-none empty:hidden">
      {msg.text && (
        <p className={`mb-4 flex items-center gap-2 rounded-control border border-line px-3 py-2 text-sm font-medium ${msg.bad ? "bg-error-container text-alert" : "bg-success-container text-success"}`}>
          {msg.bad ? <WarningOctagon size={18} weight="bold" aria-hidden="true" /> : <CheckCircle size={18} weight="bold" aria-hidden="true" />} {msg.text}
        </p>
      )}
    </div>
  );

  if (editing) {
    return (
      <>
        {banner}
        <Editor key={editing.rule.id} initial={editing.rule} isNew={editing.isNew} readOnly={editing.readOnly} feeTypes={feeTypes} onBack={() => setEditing(null)} onSave={save} notify={notify} />
        <ActivateModal rule={activating} current={active} onClose={() => setActivating(null)} onConfirm={activate} />
      </>
    );
  }

  const columns: Column<SbfasRule>[] = [
    { key: "name", header: "Rule ID / name", sortable: true, render: (r) => <><span className="font-semibold">{r.name}</span><span className="block text-[13px] text-on-surface-variant">{r.id}</span></> },
    { key: "tiers", header: "Ranks", render: (r) => `${r.tiers.length} ${r.tiers.length === 1 ? "rank" : "ranks"}` },
    { key: "subsidy", header: "Subsidy", render: (r) => r.tiers.map((t) => subsidySummary(t)).join(", ") },
    { key: "updated", header: "Updated", sortable: true, render: (r) => formatDate(r.updated) },
    { key: "status", header: "Status", render: (r) => <Badge tone={TONE[r.status]}>{r.status}</Badge> },
  ];

  return (
    <>
      {banner}
      <Card
        title={`SBFAS rules — ${schoolName}`}
        action={<Button icon={<Plus size={16} weight="bold" aria-hidden="true" />} onClick={create}>Create rule</Button>}
      >
        <p className="mb-4 text-sm text-on-surface-variant">
          The school&apos;s SBFAS package versions. The Active version decides the subsidies the review queue
          applies; until the school activates its own, the default package (100%, 75%, 50%, 25%) applies.
        </p>
        <DataTable
          columns={columns}
          rows={versions}
          rowKey={(r) => r.id}
          large
          rowActions={(r) => (
            <>
              <RowAction onClick={() => { notify(""); setEditing({ rule: r, isNew: false, readOnly: true }); }}>View</RowAction>
              {r.status !== "Active" && <RowAction onClick={() => { notify(""); setEditing({ rule: r, isNew: false, readOnly: false }); }}>Edit</RowAction>}
              {r.status !== "Active" && <RowAction onClick={() => setActivating(r)}>Activate</RowAction>}
            </>
          )}
          empty={<EmptyState title="No rules yet" hint="Create a rule to configure your school's SBFAS package." />}
        />
        <p className="mt-3 text-[13px] text-on-surface-variant">Only one rule can be Active at a time. Activating a rule makes the previous Active rule Inactive. Draft rules have never been activated.</p>
      </Card>
      <ActivateModal rule={activating} current={active} onClose={() => setActivating(null)} onConfirm={activate} />
    </>
  );
}
