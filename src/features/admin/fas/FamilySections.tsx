import { useState, type ReactNode } from "react";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Modal } from "../../../components/ui/Modal";
import { childOutcomeNow, type ChildOutcomeNow, type FamilyApplication } from "../../../data/familyApplications";
import { MOEFAS_TIER_AMOUNT, SBFAS_TIER_AMOUNT } from "../../../data/budgets";
import { useFas } from "../../../data/fasStore";
import { useRegistry } from "../../../data/registryStore";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import type { Level } from "../../../data/students";
import { formatSGD } from "../../../lib/format";

/** Tone for the live per-child outcome badge (childOutcomeNow). */
export const KIND_TONE: Record<ChildOutcomeNow["kind"], BadgeTone> = {
  granted: "success", pending: "warning", rejected: "alert", neutral: "neutral",
};

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

/** Mock rendering of the scanned form (or welfare home letter) for the document viewer. */
function paperDocImage(fa: FamilyApplication, what: "form" | "letter") {
  const line3 = what === "form" ? `Income band declared: ${fa.bandLabel}` : `Welfare home: ${fa.welfareLetter?.home ?? "—"}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="760"><rect width="700" height="760" fill="#faf8f6"/><rect x="40" y="35" width="620" height="690" rx="6" fill="white" stroke="#e4dddd"/><text x="75" y="100" font-family="Arial" font-size="24" fill="#8a2538">${what === "form" ? "Scanned MOE FAS form" : "Welfare home letter"} · SAMPLE</text><text x="75" y="155" font-family="Arial" font-size="17">${fa.applicant}</text><text x="75" y="190" font-family="Arial" font-size="15">Application: ${fa.id}</text><text x="75" y="250" font-family="Arial" font-size="16">${line3}</text><text x="75" y="300" font-family="Arial" font-size="14">Mock scan rendering for the document viewer.</text><text x="75" y="330" font-family="Arial" font-size="14">This is not an actual document submitted by a parent.</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

const STEP_OK = "bg-success-container text-success";
const STEP_ERR = "bg-error-container text-on-surface";
const STEP_WAIT = "bg-surface-container-high text-on-surface";

/** The paper family application laid out in the same sections MOE sees an online application in:
 *  household & submitted information, income information, supporting documents, assessment per
 *  child, fee impact / SBFAS handover, and parent-facing progress (step 4 reads the school's
 *  Tell-the-parent records live). Shared by the MOE detail page and the school's review modal —
 *  `initialStudentId` preselects the child a school reviewer is deciding for. */
export function FamilyApplicationSections({ fa, initialStudentId, onlySchoolCode }: { fa: FamilyApplication; initialStudentId?: string; onlySchoolCode?: string }) {
  const { state: fas } = useFas();
  const { state: reg } = useRegistry();
  // BR15: a school only ever sees its own students. On the school's review page the child list is
  // scoped to children attending that school — MOE (no code passed) still sees every child.
  const children = onlySchoolCode ? fa.children.filter((x) => schoolOfLevel(x.level as Level) === onlySchoolCode) : fa.children;
  const [child, setChild] = useState(() => {
    const i = initialStudentId ? children.findIndex((x) => x.studentId === initialStudentId) : -1;
    return i >= 0 ? i : 0;
  });
  const [doc, setDoc] = useState<"form" | "letter" | null>(null);
  if (!children.length) return null; // no child of this school on the form — show nothing rather than another school's students
  const linked = fas.apps.filter((x) => x.familyAppId === fa.id);
  const schoolOf = (level: string) => {
    const code = schoolOfLevel(level as Level);
    return reg.schools.find((x) => x.code === code)?.name ?? code;
  };

  const c = children[Math.min(child, children.length - 1)];
  const co = childOutcomeNow(fa, c, fas.apps);
  const moeOk = c.outcome === "MOEFAS granted";
  const queue = linked.filter((x) => x.studentId === c.studentId).sort((x, y) => (y.attemptNo ?? 1) - (x.attemptNo ?? 1))[0];
  const grantTier = moeOk ? c.tier : co.kind === "granted" ? queue?.sbfasTier : undefined;
  const dateFmt = (at?: string) => (at ? new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
  const totalGhi = (fa.household ?? []).reduce((s, m) => s + m.gross + m.other, 0);

  // Parent-facing progress for the selected child: submission → MOE's instant assessment → the school's
  // SBFAS decision → the telling. Step 4 is live from the school's Tell-the-parent log (no portal).
  const steps: { mark: string; cls: string; title: string; body: string }[] = [
    { mark: "✓", cls: STEP_OK, title: "Application submitted",
      body: `Paper form handed in at ${fa.school} and entered by ${fa.enteredBy}${fa.entryMode === "ocr" ? " (scan + OCR)" : ""} on ${dateFmt(fa.at)}.` },
    { mark: "✓", cls: STEP_OK,
      title: moeOk ? `MOEFAS ${c.tier ?? ""} granted automatically` : c.outcome === "Already covered" ? "Already covered when the form came in" : "Referred for school-based assistance",
      body: `Result shown here is for ${c.student}.` },
  ];
  if (moeOk || c.outcome === "Already covered") {
    steps.push({ mark: "✓", cls: STEP_OK, title: "No school review needed", body: "MOEFAS covers this child — no SBFAS case was created." });
  } else if (!queue || queue.status === "Pending") {
    steps.push({ mark: "3", cls: STEP_WAIT, title: "Waiting for the school's SBFAS decision",
      body: queue ? `In ${schoolOf(c.level)}'s review queue as ${queue.id}.` : `No SBFAS case for ${c.student}.` });
  } else if (queue.status === "Rejected") {
    steps.push({ mark: "✓", cls: STEP_ERR, title: "SBFAS not granted by the school",
      body: `Decided ${dateFmt(queue.decidedAt)} — the parent may hand the school a new request if circumstances change.` });
  } else {
    steps.push({ mark: "✓", cls: STEP_OK, title: `SBFAS granted by the school${queue.sbfasTier ? ` · ${queue.sbfasTier}` : ""}`, body: `Decided ${dateFmt(queue.decidedAt)}.` });
  }
  if (queue && queue.status !== "Pending") {
    steps.push({ mark: "✓", cls: STEP_OK, title: "Outcome sent to the parent by SMS/email",
      body: `Sent automatically on ${dateFmt(queue.decidedAt)} when the school decided.` });
  } else if (!moeOk && c.outcome !== "Already covered") {
    steps.push({ mark: "4", cls: STEP_WAIT, title: "Outcome sent when decided",
      body: "This family has no portal — the decision is sent to the parent automatically by SMS/email." });
  } else {
    steps.push({ mark: "✓", cls: STEP_OK, title: "Outcome sent to the parent by SMS/email",
      body: `Sent automatically on ${dateFmt(fa.at)} when MOE granted the tier.` });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card title="Household & submitted information">
          <dl>
            <KV k="Contact number" v={fa.contact || "—"} />
            <KV k="Mailing address" v={fa.address || "—"} />
            {fa.email && <KV k="Email" v={fa.email} />}
            <KV k="Household" v={
              fa.welfareHome ? `Welfare home resident — letter from ${fa.welfareLetter?.home ?? "the home"}`
                : fa.household?.length ? `${fa.household.length} members on the Section II table · total S$${totalGhi.toLocaleString("en-SG")}/month`
                  : fa.homesOnly ? "Employment and/or trade income only" : "Income band from the form only"
            } />
            <KV k="Additional information" v={fa.note || "No additional information provided"} />
          </dl>
          <p className="mt-3 text-[13px] text-on-surface-variant">Declaration accepted · {fa.applicant} · {dateFmt(fa.declaredAt)}. Income retrieval and school sharing consent recorded on the paper form.</p>
        </Card>
        <Card title="Income information">
          <dl>
            <KV k="Declared band · per person / month" v={fa.bandLabel} />
            {fa.household?.length ? <KV k="GHI · household / month" v={`S$${totalGhi.toLocaleString("en-SG")}`} /> : null}
          </dl>
          <p className="mt-3 text-[13px] text-on-surface-variant">{fa.homesOnly ? "Employment/trade income only — the bands are retrieved from HOMES (IRAS + CPF records)." : "The paper form declares a band only — never an exact income."}</p>
        </Card>
      </div>

      <Card title="Supporting documents">
        <p className="mb-3 text-[13px] text-on-surface-variant">Documents the school scanned in with the paper application.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead><tr><th className={th}>File name</th><th className={th}>Type</th><th className={th}>Submitted on</th><th className={th}>Action</th></tr></thead>
            <tbody>
              <tr>
                <td className={td}>{fa.id}.pdf<span className="block text-[13px] text-on-surface-variant">Uploaded MOE FAS form (PDF){fa.entryMode === "ocr" ? " · read by OCR" : ""}</span></td>
                <td className={td}>PDF</td><td className={td}>{dateFmt(fa.at)}</td>
                <td className="border-b border-line px-3 py-2"><Button size="sm" variant="secondary" onClick={() => setDoc("form")}>View document</Button></td>
              </tr>
              {fa.welfareLetter && (
                <tr>
                  <td className={td}>{fa.welfareLetter.file}<span className="block text-[13px] text-on-surface-variant">Welfare home letter{fa.welfareLetter.home ? ` · ${fa.welfareLetter.home}` : ""}</span></td>
                  <td className={td}>PDF</td><td className={td}>{dateFmt(fa.at)}</td>
                  <td className="border-b border-line px-3 py-2"><Button size="sm" variant="secondary" onClick={() => setDoc("letter")}>View document</Button></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal open={doc !== null} onClose={() => setDoc(null)} title={doc === null ? "Supporting document" : doc === "form" ? `${fa.id}.pdf` : fa.welfareLetter?.file ?? "Letter"}
        footer={<Button variant="secondary" onClick={() => setDoc(null)}>Close</Button>}>
        {doc !== null && <img src={paperDocImage(fa, doc)} alt="Sample scanned document" className="max-h-[70vh] w-full object-contain" />}
      </Modal>

      <Card title="Assessment per child" action={<span className="text-[13px] text-on-surface-variant">One family submission · Separate child outcomes</span>}>
        {/* The selector chip row only earns its place with more than one child to flip between —
            a school user sees the one child of theirs on the form, so no chip is rendered at all. */}
        {children.length > 1 && (
          <div role="group" aria-label="Child" className="flex flex-wrap gap-2">
            {children.map((x, i) => (
              <Button key={x.studentId} size="sm" variant={child === i ? "primary" : "secondary"} aria-pressed={child === i} onClick={() => setChild(i)}>{x.student}</Button>
            ))}
          </div>
        )}
        <div className={`${children.length > 1 ? "mt-4" : ""} grid gap-4 lg:grid-cols-2`}>
          <dl>
            <KV k="Student / level" v={`${c.student} · ${c.level}`} />
            <KV k="School" v={schoolOf(c.level)} />
            <KV k="FAS application result" v={<Badge tone={KIND_TONE[co.kind]}>{co.label}</Badge>} />
            <KV k="MOEFAS result" v={<Badge tone={moeOk ? "success" : c.outcome === "Already covered" ? "neutral" : "alert"}>{moeOk ? "Granted" : c.outcome === "Already covered" ? "Already covered" : "Not granted"}</Badge>} />
            <KV k="Assessment basis" v={`Declared band · ${fa.bandLabel}`} />
          </dl>
          <div className="rounded-control bg-surface-container-low p-4 text-sm leading-relaxed">
            <b>Assessment explanation</b>
            <p className="mt-2">{
              moeOk ? "The declared band is within the MOEFAS bands, so the tier was granted automatically at submission."
                : c.outcome === "Already covered" ? "This child already held an application or grant when the form came in — listed as on the form, nothing duplicated (AC-031)."
                  : c.outcome === "New SBFAS request" ? "A separate request after a rejection — straight to the school's SBFAS review queue; MOEFAS is not re-assessed."
                    : `The declared band is outside the MOEFAS bands, so the case was referred to ${schoolOf(c.level)}'s SBFAS review queue.`}</p>
            <p className="mt-2 text-[13px] text-on-surface-variant">Assessed on the declared band at submission · {dateFmt(fa.at)}</p>
          </div>
        </div>
      </Card>

      {grantTier ? (
        <Card title="Fee impact · Subsidy provision" action={<Badge tone="success">{moeOk ? `MOEFAS · ${grantTier}` : `SBFAS · ${grantTier}`}</Badge>}>
          <p className="mb-3 text-[13px] text-on-surface-variant">Fees for {c.student} · Not an issued charge</p>
          <dl>
            <KV k="Scheme" v={moeOk ? `MOEFAS ${grantTier}` : `SBFAS ${grantTier}`} />
            <KV k="Subsidy provision · per child" v={`Up to ${formatSGD((moeOk ? MOEFAS_TIER_AMOUNT : SBFAS_TIER_AMOUNT)[grantTier] ?? 0)}`} />
            <KV k={moeOk ? "Granted on" : "Granted by"} v={moeOk ? dateFmt(fa.at) : `${schoolOf(c.level)} · ${dateFmt(queue?.decidedAt)}`} />
          </dl>
          <p className="mt-3 text-[13px] text-on-surface-variant">The subsidy applies to eligible school fees. Education Account balance is unchanged: a grant does not create a top-up transaction.</p>
        </Card>
      ) : (
        <Card title="SBFAS handover">
          <dl>
            <KV k="School" v={schoolOf(c.level)} />
            <KV k="Status" v={<Badge tone={KIND_TONE[co.kind]}>{co.label}</Badge>} />
          </dl>
          <p className="mt-3 text-[13px] text-on-surface-variant">{
            co.kind === "pending" ? "School users decide Approve / Override / Reject. No SBFAS subsidy is applied while the case is pending."
              : co.kind === "rejected" ? "The school did not grant SBFAS. The parent may hand the school a separate new request if circumstances change."
                : "No SBFAS case was created for this child."}</p>
        </Card>
      )}

      <Card title="Parent-facing progress" action={<span className="text-[13px] text-on-surface-variant">No portal — outcomes reach the parent by SMS/email</span>}>
        {steps.map((x) => (
          <div key={x.title} className="flex gap-3.5 py-3">
            <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${x.cls}`} aria-hidden="true">{x.mark}</span>
            <div><b className="text-sm">{x.title}</b><p className="mt-1 text-[13px] text-on-surface-variant">{x.body}</p></div>
          </div>
        ))}
      </Card>
    </div>
  );
}
