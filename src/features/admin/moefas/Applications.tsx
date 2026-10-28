import { useState, type ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import {
  applicationStatus, CATALOGUE, childResult, FAMILIES, matchedCondition, matchRange, OUTCOMES, snapshotFor,
  type Basis, type Family, type Range, type Rule,
} from "../../../data/moefas";
import { useFas } from "../../../data/fasStore";
import { childOutcomeNow, type FamilyApplication } from "../../../data/familyApplications";
import { FamilyApplicationSections } from "../fas/FamilySections";
import { formDocImage } from "../fas/HardcopyEntry";
import { formatSGD } from "../../../lib/format";

const TONE: Record<string, BadgeTone> = {
  "MOEFAS granted": "success", "MOEFAS Granted": "success", Granted: "success", Matched: "success",
  "SBFAS Review": "warning", "SBFAS review": "warning", "Mixed Outcomes": "warning", "Mixed outcomes": "warning", "SBFAS Granted": "success", "SBFAS granted": "success", Rejected: "alert", "Pending SBFAS review": "warning",
  "New SBFAS request": "warning",
  "Not granted": "alert", "MOEFAS not granted": "alert", "Already covered": "neutral",
};
const Pill = ({ s }: { s: string }) => <Badge tone={TONE[s] ?? "neutral"}>{s}</Badge>;

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm last:border-0">
      <dt className="text-on-surface-variant">{k}</dt>
      <dd className="text-right font-semibold text-on-surface">{v}</dd>
    </div>
  );
}

const th = "whitespace-nowrap border-b border-line bg-surface-container-low px-3 py-3 text-left text-[13px] font-medium text-on-surface-variant";
const td = "border-b border-line px-3 py-3 align-top";
const spaced = (r: Range) => `${formatSGD(r[0])} – ${formatSGD(r[1])}`;
const tight = (r: Range) => `${formatSGD(r[0])}–${formatSGD(r[1])}`;

/** Demo fee lines used when the assessed rule is no longer in the rule list. */
const FALLBACK: { id: string; basis: Basis; amounts: number[] }[] = [{ id: "MFC-001", basis: "percent", amounts: [80, 50] }, { id: "MFC-002", basis: "fixed", amounts: [20, 10] }];

const DOCS = ["Income_statement.png", "Supporting_letter.png"];
const docImage = (f: Family, i: number) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="760"><rect width="700" height="760" fill="#faf8f6"/><rect x="40" y="35" width="620" height="690" rx="6" fill="white" stroke="#e4dddd"/><text x="75" y="100" font-family="Arial" font-size="24" fill="#8a2538">Supporting document · SAMPLE</text><text x="75" y="155" font-family="Arial" font-size="17">${f.parent}</text><text x="75" y="190" font-family="Arial" font-size="15">Application: ${f.id}</text><text x="75" y="250" font-family="Arial" font-size="16">${i === 0 ? "Income statement" : "Supporting letter"}</text><text x="75" y="300" font-family="Arial" font-size="14">Mock attachment for reviewing the document viewer.</text><text x="75" y="330" font-family="Arial" font-size="14">This is not an actual document submitted by a parent.</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
};

function Criteria({ f, child, matched }: { f: Family; child: number; matched: number }) {
  const snap = snapshotFor(f, child);
  const rows = (ci: number) => ([["g", "GHI band"], ["p", "PCI band"]] as const).map(([k, label]) => {
    const policy = snap.conditions[ci][k], ok = matchRange(f.income[k], policy);
    return { ci, label, income: f.income[k], policy, ok };
  });
  const list = matched >= 0 ? rows(matched) : snap.conditions.flatMap((_, ci) => rows(ci));
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr>
            {matched < 0 && <th className={th}>Condition</th>}
            <th className={th}>Criterion</th><th className={th}>Income used for assessment</th>
            <th className={th}>Policy rule{matched >= 0 ? ` · Condition ${matched + 1}` : ""}</th><th className={th}>Check</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={`${r.ci}-${r.label}`}>
              {matched < 0 && <td className={td}>Condition {r.ci + 1}</td>}
              <td className={td}>{r.label}</td><td className={td}>{tight(r.income)}</td><td className={td}>{tight(r.policy)}</td>
              <td className={td}><Pill s={r.ok ? "Matched" : "Not matched"} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[13px] text-on-surface-variant">{matched >= 0 ? "Matching either GHI or PCI is enough for this condition." : "No condition matched on GHI or PCI."}</p>
    </div>
  );
}

function FeeImpact({ f, child, rules, snapId, matched }: { f: Family; child: number; rules: Rule[]; snapId: string; matched: number }) {
  const rule = rules.find((r) => r.id === snapId);
  const comps = rule ? rule.components.filter((c) => c.id) : FALLBACK;
  const rows = comps.flatMap((c) => {
    const m = CATALOGUE.find((x) => x.id === c.id);
    if (!m) return [];
    const v = Number(c.amounts[matched] ?? 0), sub = Math.min(m.fee, c.basis === "percent" ? Math.round(m.fee * v) / 100 : v);
    return [{ m, c, v, sub, pay: m.fee - sub }];
  });
  const total = rows.reduce((t, r) => ({ fee: t.fee + r.m.fee, sub: t.sub + r.sub, pay: t.pay + r.pay }), { fee: 0, sub: 0, pay: 0 });
  const sub = (v: number) => (v > 0 ? `− ${formatSGD(v)}` : formatSGD(v));
  return (
    <Card title="Fee impact · New charge preview" action={<Badge tone="success">MOEFAS · Condition {matched + 1}</Badge>}>
      <p className="mb-3 text-[13px] text-on-surface-variant">Fees for {f.children[child]} · Not an issued charge</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead><tr><th className={th}>Fee component</th><th className={`${th} text-right`}>Fee</th><th className={`${th} text-right`}>Subsidy</th><th className={`${th} text-right`}>Payable</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.m.id}>
                <td className={td}>{r.m.name}<span className="block text-[13px] text-on-surface-variant">{r.m.id} · {r.c.basis === "percent" ? `${r.v}%` : `${formatSGD(r.v)} fixed`}</span></td>
                <td className={`${td} text-right tabular-nums`}>{formatSGD(r.m.fee)}</td>
                <td className={`${td} text-right tabular-nums`}>{sub(r.sub)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatSGD(r.pay)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className={td}>Total</td>
              <td className={`${td} text-right tabular-nums`}>{formatSGD(total.fee)}</td>
              <td className={`${td} text-right tabular-nums`}>{sub(total.sub)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatSGD(total.pay)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[13px] text-on-surface-variant">Education Account balance is unchanged: granting MOEFAS does not create a top-up transaction.</p>
    </Card>
  );
}

function Detail({ f, rules, onBack }: { f: Family; rules: Rule[]; onBack: () => void }) {
  const [child, setChild] = useState(0);
  const [doc, setDoc] = useState<number | null>(null);
  const snap = snapshotFor(f, child);
  const matched = matchedCondition(f, child);
  const ok = matched >= 0;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <ArrowLeft size={16} weight="bold" aria-hidden="true" /> All applications
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-on-surface-variant">Family application / {f.id}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{f.parent}’s application</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Submitted 18 Oct 2026 · All linked children included</p>
        </div>
        <Pill s={applicationStatus(f)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card title="Household & submitted information">
          <dl>
            <KV k="Applicant" v={f.parent} />
            <KV k="Spouse" v={f.spouse} />
            <KV k="Contact number" v={f.contact} />
            <KV k="Mailing address" v={f.address} />
            <KV k="Additional information" v="No additional information provided" />
          </dl>
          <p className="mt-3 text-[13px] text-on-surface-variant">Declaration accepted · {f.parent} · 18 Oct 2026. Income retrieval and school sharing consent recorded.</p>
        </Card>
        <Card title="Income information">
          <dl>
            <KV k="GHI · household / month" v={spaced(f.income.g)} />
            <KV k="PCI · person / month" v={spaced(f.income.p)} />
          </dl>
        </Card>
      </div>

      <Card title="Supporting documents">
        <p className="mb-3 text-[13px] text-on-surface-variant">Documents submitted with the family application.</p>
        {f.noDocs ? <p className="py-6 text-center text-sm text-on-surface-variant">No supporting documents submitted.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead><tr><th className={th}>File name</th><th className={th}>Type</th><th className={th}>Submitted on</th><th className={th}>Action</th></tr></thead>
              <tbody>
                {DOCS.map((n, i) => (
                  <tr key={n}>
                    <td className={td}>{n}<span className="block text-[13px] text-on-surface-variant">Sample attachment</span></td>
                    <td className={td}>PNG</td><td className={td}>18 Oct 2026</td>
                    <td className="border-b border-line px-3 py-2"><Button size="sm" variant="secondary" onClick={() => setDoc(i)}>View document</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={doc !== null} onClose={() => setDoc(null)} title={doc === null ? "Supporting document" : DOCS[doc]}
        footer={<Button variant="secondary" onClick={() => setDoc(null)}>Close</Button>}>
        {doc !== null && <img src={docImage(f, doc)} alt="Sample supporting document" className="max-h-[70vh] w-full object-contain" />}
      </Modal>

      <Card title="Assessment per child" action={<span className="text-[13px] text-on-surface-variant">One family submission · Separate child outcomes</span>}>
        <div role="group" aria-label="Child" className="flex flex-wrap gap-2">
          {f.children.map((n, i) => (
            <Button key={n} size="sm" variant={child === i ? "primary" : "secondary"} aria-pressed={child === i} onClick={() => setChild(i)}>{n}</Button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <dl>
            <KV k="Student / level" v={`${f.children[child]} · ${f.levels[child]}`} />
            <KV k="School" v={f.schools[child]} />
            <KV k="FAS application result" v={<Pill s={childResult(f, child)} />} />
            <KV k="MOEFAS result" v={<Pill s={ok ? "Granted" : "Not granted"} />} />
            <KV k="Matched condition" v={ok ? `Condition ${matched + 1}` : "None"} />
          </dl>
          <div className="rounded-control bg-surface-container-low p-4 text-sm leading-relaxed">
            <b>Assessment explanation</b>
            <p className="mt-2">{ok ? `Condition ${matched + 1} matched. GHI OR PCI is sufficient for MOEFAS.` : "No condition matched GHI or PCI. The application has been referred to the school for SBFAS review."}</p>
            <p className="mt-2 text-[13px] text-on-surface-variant">Rule at assessment: {snap.id}<br />Assessed automatically · 18 Oct 2026</p>
          </div>
        </div>
        <Criteria f={f} child={child} matched={matched} />
      </Card>

      {ok ? <FeeImpact f={f} child={child} rules={rules} snapId={snap.id} matched={matched} /> : (
        <Card title="SBFAS handover">
          <dl>
            <KV k="School" v={f.schools[child]} />
            <KV k="Status" v={<Pill s={childResult(f, child)} />} />
          </dl>
          <p className="mt-3 text-[13px] text-on-surface-variant">School users decide Approve / Override / Reject. No SBFAS subsidy is applied while the case is pending.</p>
        </Card>
      )}

      <Card title="Parent-facing progress preview">
        {[
          { mark: "✓", title: "Application submitted", body: `One application for ${f.children.length} ${f.children.length === 1 ? "child" : "children"}.` },
          { mark: "✓", title: ok ? "MOEFAS granted automatically" : "Referred for school-based assistance", body: `Result shown here is for ${f.children[child]}.` },
          { mark: "3", title: ok ? "Subsidy ready for eligible fees" : "Subsidy not applied", body: ok ? "See the fee breakdown when a charge is issued." : "No subsidy is applied before a grant decision." },
        ].map((x) => (
          <div key={x.title} className="flex gap-3.5 py-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success-container text-sm font-bold text-success" aria-hidden="true">{x.mark}</span>
            <div><b className="text-sm">{x.title}</b><p className="mt-1 text-[13px] text-on-surface-variant">{x.body}</p></div>
          </div>
        ))}
      </Card>
    </div>
  );
}

/** One list for MOE: seeded e-Service arrivals plus the paper forms schools scanned in this session. */
type Row = Family | FamilyApplication;
const isHardcopy = (f: Row): f is FamilyApplication => "channel" in f;
/** Schools of the children on the application (a paper form names the one school it was handed in to). */
const schoolsOf = (f: Row) => (isHardcopy(f) ? [f.school] : [...new Set(f.schools)]);

/** Application-level rollup for a hardcopy row, using the live school decisions — the strings match
 *  the status filter so both channels filter together. */
function hardcopyStatus(fa: FamilyApplication, apps: Parameters<typeof childOutcomeNow>[2]): string {
  const kinds = fa.children.map((c) => childOutcomeNow(fa, c, apps).kind);
  if (kinds.includes("pending")) return "SBFAS Review";
  const granted = kinds.includes("granted") || kinds.includes("neutral");
  const rejected = kinds.includes("rejected");
  if (granted && rejected) return "Mixed Outcomes";
  if (rejected) return "MOEFAS not granted";
  if (granted) return "MOEFAS Granted";
  return "Already covered";
}

/** A scanned-in paper form, opened from the merged list — laid out exactly like an online application
 *  (FamilyApplicationSections), because for MOE it is one. */
function HardcopyApplicationDetail({ fa, onBack }: { fa: FamilyApplication; onBack: () => void }) {
  const { state: fas } = useFas();
  const dateFmt = (at?: string) => (at ? new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <ArrowLeft size={16} weight="bold" aria-hidden="true" /> All applications
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-on-surface-variant">Family application / {fa.id}{" "}<Badge tone="primary">Hardcopy</Badge></p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{fa.applicant}&apos;s application</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Submitted {dateFmt(fa.at)} · Paper form entered by {fa.enteredBy}{fa.entryMode === "ocr" ? " (PDF + OCR)" : ""} · All linked children included</p>
        </div>
        <Pill s={hardcopyStatus(fa, fas.apps)} />
      </div>
      <Card title="Uploaded by school" action={<span className="text-[13px] text-on-surface-variant">{fa.school}</span>}>
        {fa.formFile ? (
          <>
            <p className="mb-3 text-sm text-on-surface-variant">Scanned paper form uploaded by {fa.enteredBy} on {dateFmt(fa.at)}: <span className="font-medium text-on-surface">{fa.formFile}</span></p>
            <img src={formDocImage(fa.formFile, fa.applicant)} alt={`Scanned MOE FAS form ${fa.formFile}`} className="w-full max-w-xl rounded-control border border-line" />
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">No scan uploaded: {fa.enteredBy} keyed this paper form in by hand. The original form is kept at the school.</p>
        )}
      </Card>
      <FamilyApplicationSections fa={fa} />
    </div>
  );
}

export default function Applications({ rules }: { rules: Rule[] }) {
  const { state: fas } = useFas();
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("");
  const [outcome, setOutcome] = useState("");
  const [school, setSchool] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const openPortal = FAMILIES.find((f) => f.id === openId);
  const openHardcopy = openPortal ? undefined : fas.familyApps.find((f) => f.id === openId);

  if (openPortal) return <Detail key={openPortal.id} f={openPortal} rules={rules} onBack={() => setOpenId(null)} />;
  if (openHardcopy) return <HardcopyApplicationDetail key={openHardcopy.id} fa={openHardcopy} onBack={() => setOpenId(null)} />;

  const all: Row[] = [...FAMILIES, ...fas.familyApps].sort((a, b) => a.id.localeCompare(b.id));
  const statusOf = (f: Row) => (isHardcopy(f) ? hardcopyStatus(f, fas.apps) : applicationStatus(f));
  const schools = [...new Set(all.flatMap(schoolsOf))].sort();
  const rows = all.filter((f) => (!school || schoolsOf(f).includes(school)) && (!channel || (isHardcopy(f) ? "Hardcopy" : "e-Service") === channel)
    && (!outcome || statusOf(f) === outcome) && (isHardcopy(f)
    ? [f.id, f.applicant, ...f.children.map((c) => c.student)]
    : [f.id, f.parent, ...f.children]).join(" ").toLowerCase().includes(q.trim().toLowerCase()));
  const columns: Column<Row>[] = [
    {
      key: "id", header: "Application / submitted", sortable: true,
      render: (f) => isHardcopy(f) ? (
        <>
          <span className="font-semibold">{f.id}</span>
          <span className="block text-[13px] text-on-surface-variant">{new Date(f.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · AY 2026</span>
        </>
      ) : (
        <><span className="font-semibold">{f.id}</span><span className="block text-[13px] text-on-surface-variant">18 Oct 2026 · AY 2026</span></>
      ),
    },
    {
      key: "applicant", header: "Applicant",
      render: (f) => <>{isHardcopy(f) ? f.applicant : f.parent}<span className="block text-[13px] text-on-surface-variant">Parent / guardian</span></>,
    },
    {
      key: "children", header: "Children",
      render: (f) => {
        const names = isHardcopy(f) ? f.children.map((c) => c.student) : f.children;
        return <>{names.length} {names.length > 1 ? "children" : "child"}<span className="block text-[13px] text-on-surface-variant">{names.join(", ")}</span></>;
      },
    },
    { key: "school", header: "School", render: (f) => schoolsOf(f).map((s) => <span key={s} className="block">{s}</span>) },
    {
      key: "source", header: "Source",
      render: (f) => isHardcopy(f)
        ? <>School upload<span className="block text-[13px] text-on-surface-variant">{f.enteredBy}</span></>
        : <>Parent portal<span className="block text-[13px] text-on-surface-variant">e-Service (online)</span></>,
    },
    { key: "outcome", header: "Application status", render: (f) => <Pill s={statusOf(f)} /> },
  ];

  return (
    <Card
      title="Family applications"
      action={<span className="text-[13px] text-on-surface-variant">Academic year 2026</span>}
    >
      <p className="mb-4 text-sm text-on-surface-variant">
        Parent portal and school-uploaded hard copies. MOEFAS is assessed automatically at household level.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className={`${inputClass} max-w-sm`} aria-label="Search applications" placeholder="Search application, parent or child" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`${inputClass} max-w-52`} aria-label="Filter application status" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="">All statuses</option>
          {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select className={`${inputClass} max-w-60`} aria-label="Filter school" value={school} onChange={(e) => setSchool(e.target.value)}>
          <option value="">All schools</option>
          {schools.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={`${inputClass} max-w-52`} aria-label="Filter source" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">All sources</option>
          <option value="e-Service">Parent portal</option>
          <option value="Hardcopy">School upload</option>
        </select>
        <Button variant="secondary" onClick={() => { setQ(""); setChannel(""); setOutcome(""); setSchool(""); }}>Reset</Button>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(f) => f.id}
        rowActions={(f) => <RowAction onClick={() => setOpenId(f.id)}>View details</RowAction>}
        large
        empty={<EmptyState title="No matching applications" hint="Try another search or reset the filters." action={<Button variant="secondary" onClick={() => { setQ(""); setChannel(""); setOutcome(""); setSchool(""); }}>Reset</Button>} />}
      />
      <p className="mt-3 text-[13px] text-on-surface-variant">Showing {rows.length} of {all.length} family applications</p>
    </Card>
  );
}
