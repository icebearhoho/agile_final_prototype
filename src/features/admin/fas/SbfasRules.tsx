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

const th = "whitespace-nowrap border-b border-line bg-surface-container-low px-3 py-2.5 text-left text-[13px] font-medium text-on-surface-variant";
const td = "border-b border-line px-3 py-2 align-top";

type Notify = (m: string, bad?: boolean) => void;
type FeeTypeLite = { id: string; name: string; components: { name: string }[] };

function Editor({ initial, isNew, readOnly, feeTypes, onBack, onSave, notify }: {
  initial: SbfasRule; isNew: boolean; readOnly: boolean; feeTypes: FeeTypeLite[];
  onBack: () => void; onSave: (r: SbfasRule, activate: boolean) => void; notify: Notify;
}) {
  const [name, setName] = useState(initial.name);
  const [d, setD] = useState<SbfasRuleDraft>(() => draftOfSbfasRule(initial));
  const [errors, setErrors] = useState<SbfasRuleErrors>({ rows: {} });
  // Fee-component support rows: each picks a fee type + component; null = auto (first fee type, first component).
  const [rows, setRows] = useState<Array<{ ft: string; comp: string } | null>>([null]);

  const upd = (i: number, patch: Partial<SbfasRuleDraft["tiers"][number]>) =>
    setD((x) => ({ ...x, tiers: x.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  const addTier = () => setD((x) => ({ ...x, tiers: [...x.tiers, { basis: "percent", rate: "" }] }));
  const rmTier = (i: number) => setD((x) => ({ ...x, tiers: x.tiers.filter((_, j) => j !== i) }));

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
          The school&apos;s own SBFAS package: the ranks it offers and each rank&apos;s subsidy — a percentage of the fee
          or a fixed S$ amount. Income bands play no part; every application starts at the school&apos;s starting rank
          and the school decides the rank case by case.
        </p>
        <fieldset disabled={readOnly} className="mt-5 min-w-0 space-y-6 disabled:opacity-90">
          <section>
            <h3 className="text-sm font-bold">1. Set the package ranks</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Rule name" required>
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={th}>Rank</th>
                    <th className={th}>Subsidy</th>
                    <th className={th}><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {d.tiers.map((t, i) => (
                    <tr key={i}>
                      <td className={`${td} py-3 font-semibold`}>Rank {i + 1}</td>
                      <td className={`${td} py-3`}>
                        <div className="flex items-center gap-2">
                          <label className="shrink-0">
                            <span className="sr-only">Rank {i + 1} subsidy basis</span>
                            <select
                              id={`tier-basis-${i}`}
                              className={inputClass}
                              value={t.basis}
                              onChange={(e) => upd(i, { basis: e.target.value as SubsidyBasis })}
                            >
                              <option value="percent">% of fee</option>
                              <option value="fixed">Fixed S$</option>
                            </select>
                          </label>
                          <div className="w-28">
                            <input
                              type="number"
                              min={0}
                              max={t.basis === "fixed" ? undefined : 100}
                              step={0.5}
                              className={`${inputClass} text-right`}
                              aria-label={`Rank ${i + 1} subsidy ${t.basis === "fixed" ? "amount" : "rate"}`}
                              value={t.rate}
                              onChange={(e) => upd(i, { rate: e.target.value })}
                            />
                            {errors.rows[i] && <p role="alert" className="mt-1.5 text-[13px] font-medium text-alert">{errors.rows[i]}</p>}
                          </div>
                        </div>
                      </td>
                      <td className={`${td} py-3`}>
                        <Button variant="ghost" disabled={d.tiers.length <= 1} onClick={() => rmTier(i)}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <span className="mr-auto text-[13px] text-on-surface-variant">{d.tiers.length} {d.tiers.length === 1 ? "rank" : "ranks"}</span>
              <Button size="sm" variant="secondary" onClick={() => addTier()}>Add rank</Button>
            </div>
            {errors.tiers && <p role="alert" className="mt-2 text-[13px] font-medium text-alert">{errors.tiers}</p>}
          </section>

          {feeTypes.length > 0 && (() => {
            const resolve = (r: { ft: string; comp: string } | null) => {
              const ft = feeTypes.find((x) => x.id === r?.ft) ?? feeTypes[0];
              const comp = ft.components.some((c) => c.name === r?.comp) ? r!.comp : ft.components[0].name;
              return { ft, comp };
            };
            const setOv = (ti: number, comp: string, basis: "percent" | "fixed" | "follow", cur?: { basis: "percent" | "fixed"; rate: string }) => {
              const t = d.tiers[ti];
              const rest = { ...(t.components ?? {}) };
              if (basis === "follow") delete rest[comp];
              else rest[comp] = { basis, rate: cur?.rate ?? t.rate };
              upd(ti, { components: rest });
            };
            return (
              <section className="border-t border-line pt-6">
                <h3 className="text-sm font-bold">2. Fee component support</h3>
                <p className="mt-1 text-[13px] text-on-surface-variant">Give a component its own rate, or let it follow its rank. Unset components follow the rank&apos;s flat rate.</p>
                <div className="mt-3 space-y-3">
                  {rows.map((r, ri) => {
                    const { ft, comp } = resolve(r);
                    const usedElsewhere = rows.filter((_, k) => k !== ri).map((x) => resolve(x).comp);
                    const setRow = (patch: Partial<{ ft: string; comp: string }>) =>
                      setRows(rows.map((x, k) => { if (k !== ri) return x; const rx = resolve(x); return { ft: rx.ft.id, comp: rx.comp, ...patch }; }));
                    return (
                      <div key={ri} className="rounded-control border border-line bg-surface-container-lowest p-3 space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 text-[13px] text-on-surface-variant">
                            Fee type
                            <select className={`${inputClass} w-52`} value={ft.id} onChange={(e) => setRow({ ft: e.target.value, comp: "" })}>
                              {feeTypes.map((x) => (
                                <option key={x.id} value={x.id}>{x.name}</option>
                              ))}
                            </select>
                          </label>
                          <label className="flex items-center gap-2 text-[13px] text-on-surface-variant">
                            Fee component
                            <select className={`${inputClass} w-52`} value={comp} onChange={(e) => setRow({ comp: e.target.value })}>
                              {ft.components.filter((c) => c.name === comp || !usedElsewhere.includes(c.name)).map((c) => (
                                <option key={c.name} value={c.name}>{c.name}</option>
                              ))}
                            </select>
                          </label>
                          {rows.length > 1 && (
                            <Button variant="ghost" onClick={() => setRows(rows.filter((_, k) => k !== ri))}>Remove</Button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                          {d.tiers.map((t, ti) => {
                            const ov = t.components?.[comp];
                            return (
                              <div key={ti} className="flex items-center gap-2 text-sm text-on-surface">
                                <span className="font-medium">Rank {ti + 1}</span>
                                <select
                                  className={inputClass}
                                  aria-label={`Rank ${ti + 1} support basis for ${comp}`}
                                  value={ov?.basis ?? "follow"}
                                  onChange={(e) => setOv(ti, comp, e.target.value as "percent" | "fixed" | "follow", ov)}
                                >
                                  <option value="follow">Same as rank ({t.basis === "fixed" ? `S$${t.rate}` : `${t.rate}%`})</option>
                                  <option value="percent">% of component</option>
                                  <option value="fixed">Fixed S$ amount</option>
                                </select>
                                {ov && (
                                  <input
                                    type="number"
                                    min={0}
                                    max={ov.basis === "fixed" ? undefined : 100}
                                    step={0.5}
                                    className={`${inputClass} w-24 text-right`}
                                    aria-label={`Rank ${ti + 1} support for ${comp}`}
                                    value={ov.rate}
                                    onChange={(e) => upd(ti, { components: { ...(t.components ?? {}), [comp]: { basis: ov.basis, rate: e.target.value } } })}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-start">
                    <Button variant="secondary" onClick={() => setRows([...rows, null])}>+ Fee type</Button>
                  </div>
                </div>
              </section>
            );
          })()}
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
  const feeTypes = school ? feeState.types.filter((ft) => ft.school === school) : [];
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
