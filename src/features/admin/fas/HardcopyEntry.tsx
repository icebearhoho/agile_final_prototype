import { useMemo, useRef, useState, type RefObject } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, CaretRight, FilePlus, FileText, MagnifyingGlass, Paperclip, Plus, Printer, X } from "@phosphor-icons/react";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Modal } from "../../../components/ui/Modal";
import { Field, inputClass } from "../../../components/ui/Field";
import { childOutcomeNow, nextDraftId, outcomeNote, type ChildOutcomeNow, type FamilyApplication, type FamilyChild, type FamilyDraft } from "../../../data/familyApplications";
import { openDraftPrint } from "./draftPrint";
import { guardianByNric, normNric, type GuardianRecord } from "../../../data/familyRegistry";
import { useFasActions } from "../../../data/fasActions";
import { latestAppFor, useFas } from "../../../data/fasStore";
import { BANDS, type Band } from "../../../data/familyFas";
import { attemptOf, type SbfasApplication } from "../../../data/sbfasApplications";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import { useRegistry } from "../../../data/registryStore";
import type { Level, Student } from "../../../data/students";
import { schoolOfStudent } from "../../../lib/registry";
import { useSession } from "../../../session";
import { statusLabel } from "./review";

// Requirement 5: parents who cannot use the e-Service Portal hand a paper MOE FAS form to the school.
// Sprint 3 refinement (Sherly, 26 Oct 2026): the form starts from the parent/guardian NRIC — the
// applicant, contact, address and EVERY child of the family come from the shared MOE registry, and
// those registry rows are locked (a difference between the paper form and the registry means the
// form was filled in wrongly, not the database). OCR and the separate entry tab were dropped with
// the same refinement: every paper form is ISSUED by the system (a pre-filled draft), and the
// returned copy is keyed in by CLICKING THAT DRAFT'S ROW — there is no hand-keyed path at all.
// Sections III (benefits), IV (transport) and V (IMDA device) were cut from the scope; the form
// keeps the paper form's own numbering for what remains.
// The key-in always goes straight to MOE (the same assessment as an online one): MOEFAS first, then
// the SBFAS queue on referral — the staff never picks a route. Section I lists every child the form
// names — this school's children are tagged "Your school", a child at another school shows their
// school, and their own school receives any SBFAS referral. School scope holds structurally: the
// staff only ever keys in a form the system issued from the registry, so other-school siblings ride
// on the family form through the registry.
// The edge case lives in the history instead (Sprint 3): after the school REJECTS the SBFAS request,
// the parent may come back — the school opens the application in the Applications tab and files a
// NEW request (attempt 2, 3, ...) from there, straight into the school's SBFAS queue without a MOE
// re-assessment (see HardcopyDetailPage).
//
// The entry form follows the online family application (Sprint 3 parity — the same fields, the same
// assessment): I Child particulars · II Household income (extra money + residents; the band itself
// comes from HOMES) · III Declaration. Submitting sends the form straight to MOE — the staff never
// picks a route; the record page later shows where the form went and how each child fared.
//
// The print-first flow keeps a MANDATORY draft record: every generated form is stored as "Draft —
// awaiting return" with the children it was issued for, so the school always knows exactly which
// students hold a form. Keying in the returned copy requires cross-checking it against that draft
// (a required confirmation), and on submit the draft flips to "Returned", linked to the FAS2026####
// application the copy became — both flows, MOE and the SBFAS queue.

/** Mock rendering of a scanned form for a record that still carries one (HQ applications screen). */
export const formDocImage = (file: string, applicant: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="760"><rect width="700" height="760" fill="#faf8f6"/><rect x="40" y="35" width="620" height="690" rx="6" fill="white" stroke="#e4dddd"/><text x="75" y="100" font-family="Arial" font-size="24" fill="#8a2538">Scanned MOE FAS form · SAMPLE</text><text x="75" y="155" font-family="Arial" font-size="15">File: ${file}</text><text x="75" y="200" font-family="Arial" font-size="17">Applicant: ${applicant || "—"}</text><text x="75" y="260" font-family="Arial" font-size="16">Sections I–VI as filled in by the parent</text><text x="75" y="310" font-family="Arial" font-size="14">Mock scan rendering — the OCR pre-filled the entry fields from it.</text><text x="75" y="340" font-family="Arial" font-size="14">Verify every field against this scan before submitting.</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
};
/** One Section I row — the paper form's child table columns. `db` marks a row that came from the
 *  registry (the issued draft): every field on it is locked. */
type ChildDraft = { nric: string; name: string; school: string; level: string; db?: boolean };

/** Tone for the live per-child outcome (childOutcomeNow): follows the school's SBFAS decision. */
const LIVE_TONE: Record<ChildOutcomeNow["kind"], BadgeTone> = { granted: "success", pending: "warning", rejected: "alert", neutral: "neutral" };

/** Section IV's one-line MOE verdict for a flow-1 form: the assessment ran at submission and is
 *  final, so it is told here once instead of repeating a badge on every child row. */
function moeVerdict(fa: FamilyApplication): string {
  const granted = fa.children.filter((c) => c.outcome === "MOEFAS granted");
  const referred = fa.children.filter((c) => c.outcome === "MOEFAS not granted");
  const covered = fa.children.filter((c) => c.outcome === "Already covered");
  const names = (xs: FamilyChild[]) => xs.map((c) => c.student).join(", ");
  if (granted.length && !referred.length) return `MOE assessed at submission: MOEFAS granted — ${names(granted)}.`;
  if (referred.length && !granted.length)
    return `MOE assessed at submission: MOEFAS not granted for ${names(referred)} — outside the MOEFAS bands, referred to each school's SBFAS review queue.`;
  const parts: string[] = [];
  if (granted.length) parts.push(`MOEFAS granted for ${names(granted)}`);
  if (referred.length) parts.push(`not granted for ${names(referred)} — referred to SBFAS`);
  if (covered.length) parts.push(`${names(covered)} already covered`);
  return parts.length ? `MOE assessed at submission: ${parts.join("; ")}.` : "MOE assessed at submission.";
}
const statusTone: Record<SbfasApplication["status"], BadgeTone> = { Pending: "neutral", Approved: "success", Overridden: "success", Rejected: "alert" };

/** Small numbered section heading, mirroring the paper form's sections. */
function SectionTitle({ n, title, note }: { n: string; title: string; note?: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-on-surface">Section {n} — {title}</h3>
      {note && <p className="mt-0.5 text-[13px] text-on-surface-variant">{note}</p>}
    </div>
  );
}

/** One paper family application as a row — click anywhere on it to read the form as submitted.
 *  Child badges read the linked queue application live, so a later school decision shows here. */
function PaperRow({ fa, apps, schoolOf, onOpen }: { fa: FamilyApplication; apps: SbfasApplication[]; schoolOf: (level: string) => string; onOpen: () => void }) {
  return (
    <li className="relative cursor-pointer rounded-control border border-line px-4 py-3 transition-colors hover:border-outline hover:bg-surface-container-low">
      <button className="absolute inset-0 rounded-control" aria-label={`View ${fa.id} — ${fa.applicant}`} onClick={onOpen} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{fa.id} · {fa.applicant}</p>
          <p className="text-[13px] text-on-surface-variant">
            {new Date(fa.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {fa.bandLabel} · entered by {fa.enteredBy}
            {fa.entryMode === "ocr" ? " (PDF upload + OCR)" : ""}
          </p>
        </div>
        <span className="flex items-center gap-1.5">
          <Badge tone="neutral">{fa.children.length} {fa.children.length > 1 ? "children" : "child"}</Badge>
          <CaretRight size={16} weight="bold" aria-hidden="true" className="text-on-surface-variant" />
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {fa.children.map((c) => {
          const co = childOutcomeNow(fa, c, apps);
          return (
            <li key={c.studentId} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <span className="font-medium text-on-surface">
                {c.student} <span className="font-normal text-on-surface-variant">({c.level}{schoolOf(c.level) !== fa.school ? ` · ${schoolOf(c.level)}` : ""})</span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {/* Single live badge; MOE's instant verdict is told once, in Section IV of the detail page. */}
                <Badge tone={LIVE_TONE[co.kind]}>{co.label}</Badge>
              </span>
            </li>
          );
        })}
      </ul>
      {(fa.welfareLetter || fa.note || fa.imdaHardcopy === "yes") && (
        <div className="mt-2 space-y-1 border-t border-line pt-2">
          {fa.welfareLetter && (
            <p className="text-[12px] text-on-surface-variant">
              Welfare home letter: {fa.welfareLetter.home ? `${fa.welfareLetter.home} · ` : ""}{fa.welfareLetter.file}
            </p>
          )}
          {fa.note && <p className="text-[12px] text-on-surface-variant">Note on the form: {fa.note}</p>}
          {fa.imdaHardcopy === "yes" && (
            <p className="text-[12px] text-on-surface-variant">IMDA DigitalAccess@Home — hard copy of the application form requested.</p>
          )}
        </div>
      )}
    </li>
  );
}

/** The submitted paper form behind a history row: every field the school keyed in, frozen read-only,
 *  plus where the form went — the child outcomes and any request now sitting in the review queue. */
export function PaperDetail({ fa, linked, schoolOf }: { fa: FamilyApplication; linked: SbfasApplication[]; schoolOf: (level: string) => string }) {
  const flow2 = fa.children.length > 0 && fa.children.every((c) => c.outcome === "New SBFAS request");
  const totalGhi = (fa.household ?? []).reduce((s, m) => s + m.gross + m.other, 0);
  return (
    <div className="space-y-5">
      <p className="text-[13px] text-on-surface-variant">
        {new Date(fa.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {fa.school} · entered by {fa.enteredBy}
        {fa.entryMode === "ocr" ? " (PDF upload + OCR)" : " (keyed in)"}
      </p>
      <section className="space-y-2">
        <SectionTitle n="I" title="Particulars of the child" />
        <ul className="space-y-1.5">
          {fa.children.map((c) => {
            const co = childOutcomeNow(fa, c, linked);
            const note =
              co.kind === "granted" && c.outcome !== "MOEFAS granted"
                ? "MOEFAS was not granted, but the school granted SBFAS — the subsidy is applied to the eligible fees."
                : co.kind === "rejected"
                  ? "SBFAS not granted — the parent may hand the school a separate new request if circumstances change."
                  : co.kind === "pending" && c.outcome === "MOEFAS not granted"
                    ? `Referred to ${schoolOf(c.level) === fa.school ? "this school's" : `${schoolOf(c.level)}'s`} SBFAS review queue — awaiting the decision.`
                    : outcomeNote(c);
            return (
              <li key={c.studentId} className="space-y-0.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-on-surface">
                    {c.student} <span className="font-normal text-[13px] text-on-surface-variant">({c.level}{schoolOf(c.level) !== fa.school ? ` · ${schoolOf(c.level)}` : ""})</span>
                  </span>
                  <Badge tone={LIVE_TONE[co.kind]}>{co.label}</Badge>
                </div>
                <p className="text-[13px] text-on-surface-variant">{note}</p>
              </li>
            );
          })}
        </ul>
        <p className="text-sm"><span className="text-on-surface-variant">Contact: </span><span className="font-medium">{fa.contact || "—"}</span></p>
        {fa.address && <p className="text-sm"><span className="text-on-surface-variant">Home address: </span><span className="font-medium">{fa.address}</span></p>}
        {fa.contactCorrected && (
          <p className="text-[13px] text-on-surface-variant">
            Updated from what the parent wrote on the returned form — they ticked that the printed details were no longer correct.
          </p>
        )}
        {fa.email && <p className="text-sm"><span className="text-on-surface-variant">Email: </span><span className="font-medium">{fa.email}</span></p>}
      </section>
      <section className="space-y-2 border-t border-line pt-4">
        <SectionTitle n="II" title="Household income" />
        {(fa.extraIncome !== undefined || fa.residents !== undefined) && (
          <p className="text-sm">
            <span className="text-on-surface-variant">Extra monthly money (not in HOMES): </span>
            <span className="font-medium">S${fa.extraIncome?.toLocaleString("en-SG") ?? 0}</span>
            <span className="text-on-surface-variant"> · People currently living in the home: </span>
            <span className="font-medium">{fa.residents ?? "—"}</span>
          </p>
        )}
        {fa.extraIncomeDocs?.length ? (
          <div className="space-y-1">
            <p className="text-[13px] font-semibold text-on-surface">Documents for the extra money declared</p>
            <ul className="space-y-1">
              {fa.extraIncomeDocs.map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm">
                  <FileText size={16} aria-hidden="true" className="text-on-surface-variant" /> {d}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {fa.residentsDocs?.length ? (
          <div className="space-y-1">
            <p className="text-[13px] font-semibold text-on-surface">Documents for the people living in the home</p>
            <ul className="space-y-1">
              {fa.residentsDocs.map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm">
                  <FileText size={16} aria-hidden="true" className="text-on-surface-variant" /> {d}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {(fa.extraIncomeDocs?.length || fa.residentsDocs?.length) ? (
          <p className="text-[12px] text-on-surface-variant">
            Handed to the school with the returned form, kept against the Section II answer each one backs (mock: file names only).
          </p>
        ) : null}
        {fa.welfareHome ? (
          <p className="text-sm">
            <span className="text-on-surface-variant">Welfare home resident — letter: </span>
            <span className="font-medium">{fa.welfareLetter?.file ?? "not attached"}</span>
            {fa.welfareLetter?.home && (
              <span className="text-[13px] text-on-surface-variant"> · {fa.welfareLetter.home}{fa.welfareLetter.dated ? `, dated ${fa.welfareLetter.dated}` : ""}</span>
            )}
          </p>
        ) : fa.household?.length ? (
          <ul className="space-y-1">
            {fa.household.map((m, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{m.name}</span>
                <span className="text-[13px] text-on-surface-variant"> · {m.nric ?? "—"} · {m.relationship} · {m.age} · {m.occupation} · gross S${m.gross.toLocaleString("en-SG")} · other S${m.other.toLocaleString("en-SG")}</span>
              </li>
            ))}
            <li className="text-sm"><span className="text-on-surface-variant">Total GHI: </span><span className="font-medium">S${totalGhi.toLocaleString("en-SG")} / month</span></li>
          </ul>
        ) : fa.homesOnly ? (
          <p className="text-sm text-on-surface-variant">
            Only employment and/or trade income — Section II was not required; the bands were retrieved from HOMES (IRAS + CPF).
          </p>
        ) : null}
        <p className="text-sm"><span className="text-on-surface-variant">Income band: </span><span className="font-medium">{fa.bandLabel}</span></p>
      </section>
      {/* Sections IV (transport) and V (IMDA device) were cut from the scope — a record can no longer
          carry them, so the paper detail jumps from Section II to the Section III declaration. */}
      <section className="space-y-2 border-t border-line pt-4">
        <SectionTitle n="III" title="Declaration and agreement by the applicant" />
        {fa.declaredAt && (
          <p className="text-sm">
            <span className="text-on-surface-variant">Signed and dated by </span>
            <span className="font-medium">{fa.applicant}</span>
            <span className="text-on-surface-variant"> on </span>
            <span className="font-medium">{new Date(fa.declaredAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          </p>
        )}
        {fa.note && <p className="text-[13px] text-on-surface-variant">{flow2 ? "What changed: " : "Note on the form: "}{fa.note}</p>}
      </section>
      <section className="space-y-2 border-t border-line pt-4">
        <SectionTitle n="IV" title="Where this form goes" />
        <p className="text-sm font-medium">
          {flow2 ? "To this school's SBFAS review queue — a separate request after a rejection" : "To MOE for assessment — the first application"}
        </p>
        {/* The MOE verdict is instant and final at submission — it is told here, once, not repeated
            as a second badge on every child row above. */}
        {!flow2 && <p className="text-[13px] text-on-surface-variant">{moeVerdict(fa)}</p>}
        {/* MOE route: every child's pass/fail is known at submission, so the rows carry the verdict
            itself (the school's live SBFAS status stays on each child in Section I). Flow 2 never
            reaches MOE — its rows keep the school queue status. */}
        {flow2 ? (
          linked.length > 0 && (
            <ul className="space-y-1.5">
              {linked.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-medium">{a.id}</span> · {a.student}
                    <span className="text-[13px] text-on-surface-variant">{attemptOf(a) > 1 ? ` · attempt ${attemptOf(a)}` : ""}{a.sbfasTier ? ` · ${a.sbfasTier}` : ""}</span>
                  </span>
                  <Badge tone={statusTone[a.status]}>{statusLabel(a.status)}</Badge>
                </li>
              ))}
            </ul>
          )
        ) : (
          <ul className="space-y-1.5">
            {fa.children.map((c) => {
              const a = linked.filter((x) => x.studentId === c.studentId).sort((x, y) => (y.attemptNo ?? 1) - (x.attemptNo ?? 1))[0];
              return (
                <li key={c.studentId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {c.student}
                    {a && <span className="text-[13px] text-on-surface-variant"> · {a.id}</span>}
                  </span>
                  <Badge tone={c.outcome === "MOEFAS granted" ? "success" : c.outcome === "Already covered" ? "neutral" : "alert"}>
                    {c.outcome === "MOEFAS granted" ? `MOEFAS granted${c.tier ? ` · ${c.tier}` : ""}` : c.outcome === "Already covered" ? "Already covered" : "MOEFAS not granted"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** One Section II declaration's own upload slot: the parent's evidence for THAT answer, named per
 *  slot, in the optional "Supporting documents" block at the end of the key-in form (mock: file
 *  names only, nothing is uploaded anywhere). */
function DocSlot({ name, docs, onChange }: { name: string; docs: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="mt-2 space-y-1.5">
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-control border border-outline bg-surface-container-lowest px-3 py-1.5 text-[13px] font-semibold text-on-surface hover:bg-surface-container-low focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-primary">
        <Paperclip size={14} aria-hidden="true" /> Add a document
        <input
          type="file"
          multiple
          className="sr-only"
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
          aria-label={`Add a document for the ${name}`}
          onChange={(e) => {
            const names = Array.from(e.target.files ?? []).map((f) => f.name);
            onChange([...docs, ...names.filter((n) => !docs.includes(n))]);
            e.target.value = "";
          }}
        />
      </label>
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {docs.map((d, i) => (
            <span key={d} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-container-lowest px-2.5 py-1 text-[13px]">
              <FileText size={14} aria-hidden="true" /> {d}
              <button
                type="button"
                onClick={() => onChange(docs.filter((_, j) => j !== i))}
                aria-label={`Remove ${d}`}
                className="rounded text-on-surface-variant hover:text-alert focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Keying in a draft's returned copy, opened by clicking the draft's row in the register (Sprint 3).
 *  Everything the form was PRINTED with is carried over from the draft and locked — the staff fills
 *  in only what the parent wrote by hand: the Section II household declarations and the Section III
 *  signature. Submitting sends the form straight to MOE (the same assessment as an online one) and
 *  flips the draft to "Returned", linked to the FAS2026#### application the copy became; the staff
 *  lands on the Applications list. */
function DraftKeyIn({ draft, roster, schoolName, by, onBack, onSubmitted }: {
  draft: FamilyDraft;
  roster: { student: Student; school: string; mineSchool: boolean; blocked: boolean }[];
  schoolName: string;
  by: string;
  onBack: () => void;
  onSubmitted: () => void;
}) {
  const actions = useFasActions();
  // Section I is the draft's own child table — the same rows the printed form carried, locked. The
  // registry match only badges each row (own school / other school / already covered).
  const rows = useMemo<ChildDraft[]>(() => draft.children.map((c) => ({ nric: c.nric, name: c.name, school: c.school, level: c.level, db: true })), [draft]);
  const byNric = useMemo(() => new Map(roster.map((r) => [normNric(r.student.nric), r])), [roster]);
  const matchOf = (row: ChildDraft) => (row.nric.trim() ? byNric.get(normNric(row.nric)) : undefined);
  const chosen = rows.flatMap((row) => { const m = matchOf(row); return m ? [m] : []; });
  const [applicant, setApplicant] = useState(draft.applicant);
  const [note, setNote] = useState("");
  // The Section I contact question the PARENT answered on the paper with Yes / No: Yes keeps the
  // values the form was printed with; No means the staff keys in the corrected number and address
  // the parent wrote on the lines (draftPrint's fillbox).
  const [detailsOk, setDetailsOk] = useState<"yes" | "no" | null>(null);
  const [contact, setContact] = useState(draft.contact);
  const [address, setAddress] = useState(draft.address);
  // Section II mirrors the online family application exactly (Sprint 3 parity): the two fields the
  // parent declares on the paper form — money not in HOMES, and everyone living at home.
  const [extraIncome, setExtraIncome] = useState("");
  const [residents, setResidents] = useState("");
  const [declared, setDeclared] = useState(false);
  // The returned-copy cross-check (mandatory): the staff confirms they compared this entry against
  // the signed paper before submitting.
  const [checkedAgainst, setCheckedAgainst] = useState(false);
  // Optional evidence handed in with the returned form, one named slot per Section II declaration —
  // recorded in the "Supporting documents (optional)" block at the end of the form (mock: file
  // names only, nothing is uploaded anywhere).
  const [extraDocs, setExtraDocs] = useState<string[]>([]);
  const [resDocs, setResDocs] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Each error names the part of the form it belongs to, so the warning renders AT that section
  // (and focus lands on the offending control) instead of being pushed to the bottom of the page.
  const [error, setError] = useState<{ where: "crosscheck" | "children" | "details" | "contact" | "address" | "extra" | "residents" | "applicant" | "declared"; message: string } | null>(null);
  const crossRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const extraRef = useRef<HTMLInputElement>(null);
  const resRef = useRef<HTMLInputElement>(null);
  const applicantRef = useRef<HTMLInputElement>(null);
  const declaredRef = useRef<HTMLInputElement>(null);
  const focusOf = (e: { where: "crosscheck" | "children" | "details" | "contact" | "address" | "extra" | "residents" | "applicant" | "declared" }): RefObject<HTMLInputElement | null> | null =>
    e.where === "crosscheck" ? crossRef
      : e.where === "details" ? detailsRef
      : e.where === "contact" ? contactRef
      : e.where === "address" ? addressRef
      : e.where === "extra" ? extraRef
      : e.where === "residents" ? resRef
      : e.where === "applicant" ? applicantRef
      : e.where === "declared" ? declaredRef
      : null;

  // Sprint 3 parity with the online application: the two declared fields are recorded with the form,
  // but the band itself is never keyed — it comes from HOMES (IRAS + CPF), a band only.
  const bandFromForm = (): { band: Band; source: string } => ({
    band: BANDS[2],
    source: "retrieved from HOMES (IRAS + CPF) — the extra money and household size declared on the form are recorded with the application",
  });

  const validate = (): { where: "crosscheck" | "children" | "details" | "contact" | "address" | "extra" | "residents" | "applicant" | "declared"; message: string } | null => {
    const unmatched = rows.find((r) => !matchOf(r));
    if (unmatched) return { where: "children", message: `${unmatched.name} no longer matches a child in the registry — the registry changed since the form was issued; void this draft and issue a fresh form.` };
    // Section I's contact question, as the parent ticked it on the returned paper.
    if (!detailsOk) return { where: "details", message: "Tick the parent's answer — are the printed contact details still correct?" };
    if (detailsOk === "no" && !contact.trim()) return { where: "contact", message: "Enter the current contact number the parent wrote on the returned form." };
    if (detailsOk === "no" && !address.trim()) return { where: "address", message: "Enter the current home address the parent wrote on the returned form." };
    // Section II: the two declared fields, validated exactly like the online application.
    if (!/^\d+(\.\d{1,2})?$/.test(extraIncome.trim())) return { where: "extra", message: "Enter the extra monthly money in dollars, or 0 if none." };
    const people = Number(residents.trim());
    if (!Number.isInteger(people) || people < 1 || people > 20)
      return { where: "residents", message: "Enter the number of people currently living in the home (a whole number from 1 to 20)." };
    if (!applicant.trim()) return { where: "applicant", message: "Enter the parent / guardian name as signed on the declaration." };
    if (!declared) return { where: "declared", message: "Tick the confirmation — the declaration must be signed and dated on the paper form." };
    const fresh = chosen.filter((r) => !r.blocked);
    if (!fresh.length) return { where: "children", message: "Every child on this form already holds an application or a MOEFAS grant — there is nothing new to submit (AC-031)." };
    // The cross-check box closes the form, so it validates last — errors surface top-to-bottom.
    if (!checkedAgainst) return { where: "crosscheck", message: `Cross-check required: compare this entry against the signed form and draft ${draft.id}, then tick this confirmation.` };
    return null;
  };

  const startReview = () => {
    const err = validate();
    if (err) { setError(err); focusOf(err)?.current?.focus(); return; }
    setError(null);
    setReviewing(true);
  };

  // Submit closes the loop: the form goes straight to MOE for the same assessment as an online one,
  // the draft flips to "Returned" (the store links it to the new application by the draft id) and
  // the staff lands on the Applications list with the new record on top.
  const submit = () => {
    const err = validate();
    if (err) { setError(err); setReviewing(false); focusOf(err)?.current?.focus(); return; }
    setError(null);
    setReviewing(false);
    setConfirming(false);
    const { band } = bandFromForm();
    actions.submitHardcopy({
      studentIds: chosen.map((r) => r.student.id), band, school: schoolName, applicant: applicant.trim(), contact: contact.trim(), note,
      by, entryMode: "manual",
      address: address.trim(), email: draft.email,
      detailsCorrected: detailsOk === "no" ? true : undefined,
      extraIncome: Number(extraIncome) || 0,
      residents: Number(residents) || 0,
      declaredAt: declared ? new Date().toISOString().slice(0, 10) : undefined,
      guardianNric: draft.guardianNric, draftId: draft.id,
      extraIncomeDocs: extraDocs, residentsDocs: resDocs,
    });
    onSubmitted();
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ArrowLeft size={16} weight="bold" aria-hidden="true" /> Back to the register
      </button>
      <Card title={`Key in the returned form — ${draft.id}`}>
        {reviewing ? (
        <div className="space-y-5">
          <div className="space-y-1 rounded-control border border-line bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-on-surface">Check every field against the paper form</p>
            <p className="text-[13px] text-on-surface-variant">The fields are frozen on this page — go back to fix anything, then submit.</p>
          </div>
          <section className="space-y-2">
            <SectionTitle n="I" title="Particulars of the child" />
            <ul className="space-y-1.5">
              {rows.map((row, i) => {
                const match = matchOf(row);
                return (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-on-surface">{i + 1}. {row.name}</span>
                    <span className="text-[13px] text-on-surface-variant">{row.nric} · {row.school} · {row.level}</span>
                    {match && (match.mineSchool
                      ? <Badge tone="primary">Your school</Badge>
                      : <Badge tone="neutral">Other school</Badge>)}
                    {match?.blocked && <Badge tone="neutral">Already has an application</Badge>}
                  </li>
                );
              })}
            </ul>
            <p className="text-sm"><span className="text-on-surface-variant">Contact: </span><span className="font-medium">{contact.trim() || "—"}</span></p>
            <p className="text-sm"><span className="text-on-surface-variant">Home address: </span><span className="font-medium">{address.trim() || "—"}</span></p>
            <p className="text-sm"><span className="text-on-surface-variant">Email: </span><span className="font-medium">{draft.email || "—"}</span></p>
            <p className="text-[13px] text-on-surface-variant">
              {detailsOk === "no"
                ? "Parent ticked No — the number and address above are what they wrote on the returned form."
                : "Parent ticked Yes — the printed contact details are still correct."}
            </p>
            <p className="text-[13px] text-on-surface-variant">
              Returned copy of <span className="font-medium text-on-surface">{draft.id}</span>, issued{" "}
              {new Date(draft.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} — cross-checked against the draft.
            </p>
          </section>
          <section className="space-y-2 border-t border-line pt-4">
            <SectionTitle n="II" title="Household income" />
            <p className="text-sm">
              <span className="text-on-surface-variant">Extra monthly money (not in HOMES): </span>
              <span className="font-medium">S${extraIncome.trim() || "—"}</span>
            </p>
            <p className="text-sm">
              <span className="text-on-surface-variant">People currently living in the home: </span>
              <span className="font-medium">{residents.trim() || "—"}</span>
            </p>
            <p className="text-sm">
              <span className="text-on-surface-variant">Income band: </span>
              <span className="font-medium">{bandFromForm().band.label}</span>
              <span className="text-[13px] text-on-surface-variant"> — {bandFromForm().source}</span>
            </p>
          </section>
          <section className="space-y-2 border-t border-line pt-4">
            <SectionTitle n="III" title="Declaration and agreement by the applicant" />
            <p className="text-sm font-medium">{declared ? `Signed and dated by ${applicant.trim() || "the applicant"}` : "Not confirmed"}</p>
            {note.trim() && <p className="text-[13px] text-on-surface-variant">Note on the form: {note.trim()}</p>}
          </section>
          {(extraDocs.length > 0 || resDocs.length > 0) && (
            <div className="space-y-2 border-t border-line pt-4">
              <p className="text-sm font-bold text-on-surface">Supporting documents (optional)</p>
              {extraDocs.length > 0 && (
                <p className="text-[13px] text-on-surface-variant">For the extra money declared: {extraDocs.join(", ")}</p>
              )}
              {resDocs.length > 0 && (
                <p className="text-[13px] text-on-surface-variant">For the people living in the home: {resDocs.join(", ")}</p>
              )}
            </div>
          )}
          {error && <p className="text-[13px] font-medium text-alert" role="alert">{error.message}</p>}
          <div className="flex justify-between gap-3">
            <Button variant="secondary" onClick={() => setReviewing(false)}>Back to edit</Button>
            <Button onClick={() => setConfirming(true)}>Submit</Button>
          </div>
        </div>
        ) : (
        <div className="space-y-5">
          <div className="space-y-2 rounded-control border border-line bg-surface-container-low p-3">
            <p className="text-sm font-semibold text-on-surface">{draft.id} · {draft.applicant}</p>
            <p className="text-[13px] text-on-surface-variant">
              Issued {new Date(draft.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} by {draft.issuedBy}
              {" "}· {draft.children.length} {draft.children.length > 1 ? "children" : "child"}
            </p>
          </div>
          <section className="space-y-3">
            <SectionTitle n="I" title="Particulars of the child" />
            <ul className="space-y-1.5">
              {rows.map((row, i) => {
                const match = matchOf(row);
                return (
                  <li key={i} className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-on-surface">{i + 1}. {row.name}</span>
                      <span className="text-[13px] text-on-surface-variant">{row.nric} · {row.school} · {row.level}</span>
                      {match && (match.mineSchool
                        ? <Badge tone="primary">Your school</Badge>
                        : <Badge tone="neutral">Other school</Badge>)}
                      {match?.blocked && <Badge tone="neutral">Already has an application</Badge>}
                    </div>
                  </li>
                );
              })}
            </ul>
            {error?.where === "children" && <p role="alert" className="text-[13px] font-medium text-alert">{error.message}</p>}
            <p className="text-sm"><span className="text-on-surface-variant">Contact (as printed): </span><span className="font-medium">{draft.contact || "—"}</span></p>
            <p className="text-sm"><span className="text-on-surface-variant">Home address (as printed): </span><span className="font-medium">{draft.address || "—"}</span></p>
            {draft.email && <p className="text-sm"><span className="text-on-surface-variant">Email: </span><span className="font-medium">{draft.email}</span></p>}
            <div className={`rounded-control border px-3 py-2 text-[13px] ${error?.where === "details" ? "border-alert" : "border-line"} bg-surface-container-low`}>
              <p className="font-semibold text-on-surface">
                Are the printed contact details still correct? <span className="text-alert" aria-hidden>*</span>
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                <label className="flex items-start gap-2.5">
                  <input
                    ref={detailsRef}
                    type="checkbox"
                    className="mt-0.5 size-4 accent-[#8A2538]"
                    checked={detailsOk === "yes"}
                    onChange={(e) => { setDetailsOk(e.target.checked ? "yes" : null); if (error?.where === "details") setError(null); }}
                  />
                  <span>Yes — the contact number and home address printed above are still correct.</span>
                </label>
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-[#8A2538]"
                    checked={detailsOk === "no"}
                    onChange={(e) => { setDetailsOk(e.target.checked ? "no" : null); if (error?.where === "details") setError(null); }}
                  />
                  <span>No — the parent wrote their current number and address on the form; key them in below.</span>
                </label>
              </div>
              {error?.where === "details" && <p role="alert" className="mt-2 font-medium text-alert">{error.message}</p>}
            </div>
            {detailsOk === "no" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field required label="Current contact number" error={error?.where === "contact" ? error.message : undefined}>
                  <input
                    ref={contactRef}
                    className={inputClass}
                    aria-label="Current contact number"
                    value={contact}
                    onChange={(e) => { setContact(e.target.value); if (error?.where === "contact") setError(null); }}
                  />
                </Field>
                <Field required label="Current home address" error={error?.where === "address" ? error.message : undefined}>
                  <input
                    ref={addressRef}
                    className={inputClass}
                    aria-label="Current home address"
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); if (error?.where === "address") setError(null); }}
                  />
                </Field>
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-line pt-4">
            <SectionTitle n="II" title="Household income" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field required label="Extra monthly money (S$)" error={error?.where === "extra" ? error.message : undefined}>
                <input
                  ref={extraRef}
                  className={inputClass}
                  aria-label="Extra monthly money"
                  placeholder="e.g. 0"
                  inputMode="decimal"
                  value={extraIncome}
                  onChange={(e) => { setExtraIncome(e.target.value); if (error?.where === "extra") setError(null); }}
                />
              </Field>
              <Field required label="People currently living in your home" error={error?.where === "residents" ? error.message : undefined}>
                <input
                  ref={resRef}
                  className={inputClass}
                  aria-label="People currently living in the home"
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  inputMode="numeric"
                  value={residents}
                  onChange={(e) => { setResidents(e.target.value); if (error?.where === "residents") setError(null); }}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3 border-t border-line pt-4">
            <SectionTitle n="III" title="Declaration and agreement by the applicant" />
            <ul className="list-disc space-y-1 pl-5 text-sm text-on-surface-variant">
              <li>No child on this form receives financial assistance from more than one MOE-funded school or institution.</li>
              <li>The applicant authorises monthly withdrawals from the child&apos;s Edusave account for school fees and approved expenses while on MOE FAS.</li>
              <li>MOE and the schools may verify the information, reassess the household, and share the data needed to administer the scheme.</li>
              <li>The information given is true — false information is an offence under Section 182 of the Penal Code 1871.</li>
            </ul>
            {/* The paper form collects the parent/guardian name only here — at the declaration the applicant signs. */}
            <Field label="Parent / guardian name (as signed on the declaration)" required error={error?.where === "applicant" ? error.message : undefined}>
              <input ref={applicantRef} className={inputClass} value={applicant} onChange={(e) => { setApplicant(e.target.value); if (error?.where === "applicant") setError(null); }} placeholder="Name as written on the form" />
            </Field>
            <label className={`flex items-start gap-2.5 rounded-control border px-3 py-2 text-sm ${error?.where === "declared" ? "border-alert" : "border-line"}`}>
              <input ref={declaredRef} type="checkbox" className="mt-0.5 size-4 accent-[#8A2538]" checked={declared} onChange={(e) => { setDeclared(e.target.checked); if (error?.where === "declared") setError(null); }} />
              <span>
                The declaration is signed and dated on the paper form by <span className="font-semibold">{applicant.trim() || "the applicant"}</span>
              </span>
            </label>
            {error?.where === "declared" && <p role="alert" className="text-[13px] font-medium text-alert">{error.message}</p>}
            <Field label="Anything else on the form (optional)">
              <textarea rows={2} className={`${inputClass} py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </section>

          {/* Optional evidence, not a numbered section of the paper form: it is recorded last, after
              the answers it backs are keyed in, just before the cross-check closes the form. */}
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-sm font-bold text-on-surface">Supporting documents (optional)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[13px] font-semibold text-on-surface">For the extra money declared</p>
                <DocSlot name="extra money" docs={extraDocs} onChange={setExtraDocs} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-on-surface">For the people living in the home</p>
                <DocSlot name="people living in the home" docs={resDocs} onChange={setResDocs} />
              </div>
            </div>
          </div>

          {/* The cross-check closes the form: the staff reads the whole keyed-in entry first, then
              confirms against the signed paper — so it sits at the very end, above the button. */}
          <div className={`rounded-control border px-3 py-2 text-[13px] ${error?.where === "crosscheck" ? "border-alert" : "border-line"} bg-surface-container-low`}>
            <label className="flex items-start gap-2.5">
              <input ref={crossRef} type="checkbox" className="mt-0.5 size-4 accent-[#8A2538]" checked={checkedAgainst} onChange={(e) => { setCheckedAgainst(e.target.checked); if (error?.where === "crosscheck") setError(null); }} />
              <span>
                I have compared this entry with the signed form and draft {draft.id} — the children match and Section II is as the parent declared.{" "}
                <span className="text-alert" aria-hidden>*</span>
              </span>
            </label>
            {error?.where === "crosscheck" && <p role="alert" className="mt-2 font-medium text-alert">{error.message}</p>}
          </div>

          <div className="flex justify-end">
            <Button onClick={startReview}>Review the form</Button>
          </div>
        </div>
        )}
      </Card>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Submit this application?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button onClick={submit}>Submit</Button>
          </>
        }
      >
        <p className="text-sm text-on-surface">
          One application for {rows.map((r) => r.name).join(", ")} — it goes straight to MOE for assessment: MOEFAS is decided
          instantly, and children outside the bands are referred to their school&apos;s SBFAS review queue.
        </p>
        <p className="mt-2 text-[13px] text-on-surface-variant">
          The draft {draft.id} flips to Returned, and the outcome is sent to the parent by SMS/email automatically once decided.
        </p>
      </Modal>
    </div>
  );
}

export default function HardcopyEntry() {
  const { state: fas } = useFas();
  const { state: reg } = useRegistry();
  const actions = useFasActions();
  const { staff } = useSession();
  const by = staff?.name ?? "School user";
  const mySchool = staff?.schoolCode ?? "";
  const schoolName = reg.schools.find((s) => s.code === mySchool)?.name ?? mySchool;

  const schoolNameOf = (code: string) => reg.schools.find((x) => x.code === code)?.name ?? code;
  const schoolOfLevelName = (level: string) => schoolNameOf(schoolOfLevel(level as Level));
  // Section I lists every child the paper form names, across schools: this school's children are
  // highlighted, and a child at another school shows their school — their own school runs any SBFAS
  // review, because the review queue follows the child's school. Scope (Sprint 3): the school user's
  // own searching/keying covers only their school — other-school siblings reach the form solely
  // through the shared registry (family lookup or issued draft), which pulls the whole family.
  const roster = useMemo(() => reg.students.map((s) => {
    const code = schoolOfStudent(s, reg.classes);
    const grant = fas.moefas[s.id];
    const app = latestAppFor(fas.apps, s.id);
    return { student: s, school: schoolNameOf(code), mineSchool: code === mySchool, grant, app, blocked: !!(grant || app) };
  }), [reg.students, reg.classes, reg.schools, fas.moefas, fas.apps, mySchool]);

  const paperApps = useMemo(
    () => fas.familyApps.filter((f) => f.school === schoolName || f.school === mySchool),
    [fas.familyApps, schoolName, mySchool],
  );
  // History drill-down: each row navigates to its own page (see HardcopyDetailPage), so the list
  // stays scannable however long it gets.
  const navigate = useNavigate();
  // One register: the staff creates the form (a draft), prints it, and when the signed copy comes
  // back they CLICK THE DRAFT'S ROW to key in what the parent filled in. The old "New form" tab is
  // gone (Sprint 3 refinement): entry happens directly on the issued draft, so nothing is ever keyed
  // in without its issued record — and the form's pre-printed fields carry over locked.
  type View = "issue" | "apps";
  // Returning from a paper-application page reopens the list the staff member came from.
  const initialView = (useLocation().state as { hardcopyView?: View } | null)?.hardcopyView;
  const [view, setView] = useState<View>(initialView ?? "issue");
  const views: [View, string][] = [
    ["issue", "Issue form"],
    ["apps", "Applications"],
  ];
  // The draft whose returned copy is being keyed in — set by clicking a row in the register below.
  const [keyingId, setKeyingId] = useState<string | null>(null);
  const keyingDraft = keyingId ? fas.drafts.find((d) => d.id === keyingId) ?? null : null;

  // "Find a draft" (next to the NRIC box on the issue card): matches a draft by its code, the
  // parent's name, the guardian NRIC or any child's name — filters the register below.
  const [draftQuery, setDraftQuery] = useState("");
  const shownDrafts = useMemo(() => {
    const q = draftQuery.trim().toLowerCase();
    if (!q) return fas.drafts;
    return fas.drafts.filter((d) =>
      d.id.toLowerCase().includes(q) ||
      d.applicant.toLowerCase().includes(q) ||
      d.guardianNric.toLowerCase().includes(q) ||
      d.children.some((c) => c.name.toLowerCase().includes(q)),
    );
  }, [fas.drafts, draftQuery]);

  // Issue-form tab (Sprint 3: print the form first, key in the returned copy): same registry, same
  // lookup — but creating the form only RECORDS THE DRAFT; the staff prints it from the draft's row
  // in the register below, then hands the paper to the parent, who checks the pre-filled fields,
  // declares the household (Section II) and signs (Section III).
  const [issueNric, setIssueNric] = useState("");
  const [issueLooking, setIssueLooking] = useState(false);
  const [issueFound, setIssueFound] = useState<GuardianRecord | null>(null);
  const [issueMiss, setIssueMiss] = useState(false);
  // The print popup was blocked — the draft is still recorded; "Print" on its row recovers it.
  const [printMiss, setPrintMiss] = useState(false);
  const issueRows = useMemo(
    () => (issueFound ? issueFound.children.flatMap((name) => {
      const r = roster.find((x) => x.student.name === name);
      return r ? [r] : [];
    }) : []),
    [issueFound, roster],
  );
  const findForIssue = () => {
    const rec = guardianByNric(issueNric);
    setIssueLooking(true);
    setIssueFound(null);
    setIssueMiss(false);
    // Mock registry call: a short pause, then the family lands (or does not).
    window.setTimeout(() => {
      setIssueLooking(false);
      if (!rec) {
        setIssueMiss(true);
        return;
      }
      setIssueFound(rec);
    }, 500);
  };
  const issueForm = () => {
    if (!issueFound || !issueRows.length) return;
    // The draft record is mandatory (Sherly): the system records the draft the moment the form is
    // created, before anything is printed — a form can never leave the school without the system
    // remembering who holds it. Printing happens separately, from the draft's row in the register.
    const draft: FamilyDraft = {
      id: nextDraftId(fas.drafts),
      status: "draft",
      guardianNric: issueFound.nric,
      applicant: issueFound.name,
      contact: issueFound.contact,
      address: issueFound.address,
      email: issueFound.email,
      children: issueRows.map((r) => ({ studentId: r.student.id, name: r.student.name, nric: r.student.nric, school: r.school, level: r.student.level })),
      issuedAt: new Date().toISOString().slice(0, 10),
      issuedBy: by,
    };
    actions.issueDraft(draft);
    setIssueFound(null);
    setIssueNric("");
  };

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Hardcopy applications views" className="flex flex-wrap gap-2">
        {views.map(([k, label]) => (
          <Button key={k} size="sm" variant={view === k ? "primary" : "secondary"} aria-pressed={view === k} onClick={() => setView(k)}>
            {label}
          </Button>
        ))}
      </div>

      {view === "issue" && keyingDraft && (
        <DraftKeyIn
          draft={keyingDraft}
          roster={roster}
          schoolName={schoolName}
          by={by}
          onBack={() => setKeyingId(null)}
          onSubmitted={() => { setKeyingId(null); setView("apps"); }}
        />
      )}

      {view === "issue" && !keyingDraft && (
      <>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <Card.Header>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-on-surface">
                <MagnifyingGlass size={18} aria-hidden="true" /> Find an existing draft
              </h2>
            </Card.Header>
            <Card.Body>
              <div className="space-y-3">
                <div className="relative">
                  <MagnifyingGlass size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    id="draft-search"
                    type="search"
                    autoComplete="off"
                    aria-label="Search drafts"
                    className={`${inputClass} pl-9`}
                    placeholder="Search drafts..."
                    value={draftQuery}
                    onChange={(e) => setDraftQuery(e.target.value)}
                  />
                </div>
                <p className="text-[13px] text-on-surface-variant">
                  Enter the draft code, the parent NRIC or a child&apos;s name — the register below narrows as you type.
                </p>
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-on-surface">
                <FilePlus size={18} aria-hidden="true" /> Issue a new form
              </h2>
            </Card.Header>
            <Card.Body>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    id="issue-nric"
                    className={inputClass}
                    aria-label="Parent or guardian NRIC"
                    placeholder="Enter parent NRIC"
                    value={issueNric}
                    onChange={(e) => setIssueNric(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && issueNric.trim() && !issueLooking) findForIssue(); }}
                  />
                  <Button size="sm" onClick={findForIssue} disabled={issueLooking || !issueNric.trim()}>
                    {issueLooking ? "Searching…" : "Find the family"}
                  </Button>
                </div>
                <p className="text-[13px] text-on-surface-variant">
                  Creates a pre-filled draft for the family — print it from its row in the register below and hand it to the parent.
                </p>
                {issueFound && (
                  <div className="space-y-2 rounded-control border border-line p-3">
                    <p className="text-sm font-semibold text-on-surface">
                      {issueFound.name} <span className="font-normal text-on-surface-variant">({issueFound.relationship})</span>
                    </p>
                    <p className="text-[13px] text-on-surface-variant">
                      {issueFound.contact} · {issueFound.address}{issueFound.email ? ` · ${issueFound.email}` : ""}
                    </p>
                    <ul className="space-y-1.5">
                      {issueRows.map((r) => (
                        <li key={r.student.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                          <span className="font-medium text-on-surface">
                            {r.student.name} <span className="font-normal text-on-surface-variant">({r.student.level} · {r.school})</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            {r.mineSchool ? <Badge tone="primary">Your school</Badge> : <Badge tone="neutral">Other school</Badge>}
                            {r.blocked && <Badge tone="neutral">Already has an application</Badge>}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {(() => {
                      const existing = fas.drafts.find((d) => d.status === "draft" && normNric(d.guardianNric) === normNric(issueFound.nric));
                      return existing ? (
                        <p className="text-[13px] text-on-surface-variant">
                          A form is already out with this family — {existing.id}, issued{" "}
                          {new Date(existing.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} and still awaiting the signed copy.
                          Print it again from the register below, or issue a fresh copy if the first was lost.
                        </p>
                      ) : null;
                    })()}
                    <div className="flex justify-end">
                      <Button onClick={issueForm} disabled={!issueRows.length}>
                        <Plus size={16} weight="bold" aria-hidden="true" /> Create the draft form
                      </Button>
                    </div>
                  </div>
                )}
                {issueMiss && (
                  <p className="text-[13px] font-medium text-alert" role="alert">
                    No family in the registry matches this NRIC — check the NRIC with the parent. Forms are issued only to families
                    on the shared registry.
                  </p>
                )}
                {printMiss && (
                  <p className="text-[13px] font-medium text-alert" role="alert">
                    The print window was blocked by the browser — the draft is still recorded; allow pop-ups and press
                    &ldquo;Print&rdquo; on its row.
                  </p>
                )}
              </div>
            </Card.Body>
          </Card>
        </div>

        <Card title="Draft register — forms issued and awaiting return">
          {fas.drafts.length ? (
            <div className="space-y-3">
              {shownDrafts.length ? (
                <ul className="space-y-3">
                  {shownDrafts.map((d) => (
                    <li
                      key={d.id}
                      className={`rounded-control border border-line px-4 py-3${d.status === "draft" ? " relative cursor-pointer transition-colors hover:border-outline hover:bg-surface-container-low" : ""}`}
                    >
                      {/* Clicking an open draft opens its returned-copy key-in — the row IS the entry point
                          (the old New form tab is gone). Buttons stay above the overlay (relative). */}
                      {d.status === "draft" && (
                        <button
                          className="absolute inset-0 rounded-control"
                          aria-label={`Key in the returned copy of ${d.id} — ${d.applicant}`}
                          onClick={() => setKeyingId(d.id)}
                        />
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{d.id} · {d.applicant}</p>
                          <p className="text-[13px] text-on-surface-variant">
                            Issued {new Date(d.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} by {d.issuedBy}
                            {" "}· {d.children.length} {d.children.length > 1 ? "children" : "child"}
                            {d.status === "returned" && d.returnedAt
                              ? ` · returned ${new Date(d.returnedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                              : ""}
                          </p>
                        </div>
                        <span className="relative flex flex-wrap items-center gap-2">
                          {d.status === "draft"
                            ? <Badge tone="warning">Draft — awaiting return</Badge>
                            : <Badge tone="success">Returned — keyed in as {d.returnedAppId}</Badge>}
                          {/* The staff prints the form from its row — the draft is recorded before anything
                              is printed, and this row is where it is printed from, again if a copy is lost. */}
                          {d.status === "draft" ? (
                            <Button size="sm" onClick={() => { if (!openDraftPrint(d, schoolName)) setPrintMiss(true); }}>
                              <Printer size={16} weight="bold" aria-hidden="true" /> Print
                            </Button>
                          ) : (
                            <Button size="sm" variant="secondary" onClick={() => { if (!openDraftPrint(d, schoolName)) setPrintMiss(true); }}>
                              <Printer size={16} weight="bold" aria-hidden="true" /> Print again
                            </Button>
                          )}
                          {/* X removes an unprinted/unwanted draft row. A returned draft is the audit
                              trail of a live application — it cannot be removed. */}
                          {d.status === "draft" && (
                            <Button size="sm" variant="secondary" aria-label={`Remove draft ${d.id}`} onClick={() => actions.voidDraft(d.id)}>
                              <X size={16} weight="bold" aria-hidden="true" />
                            </Button>
                          )}
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1.5">
                        {d.children.map((c) => (
                          <li key={c.studentId} className="text-[13px]">
                            <span className="font-medium text-on-surface">{c.name}</span>
                            <span className="text-on-surface-variant"> ({c.level} · {c.school})</span>
                          </li>
                        ))}
                      </ul>
                      {d.status === "draft" ? (
                        <p className="mt-2 text-[12px] text-on-surface-variant">
                          Print the form and hand it to the parent — when the signed copy comes back, click this row to key it in against the draft.
                        </p>
                      ) : (
                        <p className="mt-2 text-[12px] text-on-surface-variant">
                          The signed copy came back and was keyed in as {d.returnedAppId} — see the Applications tab for the outcome.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-on-surface-variant">No draft matches this search — try the draft code, the parent&apos;s name or a child&apos;s name.</p>
              )}
            </div>
          ) : (
            <EmptyState
              title="No forms issued yet"
              hint="Look up a family above and create the form — every form is recorded here as a draft before it is printed, so the school always knows which children hold one."
            />
          )}
        </Card>
      </>
      )}

      {view === "apps" && (
      <>
        <Card title={`Paper applications at ${schoolName}`}>
          {paperApps.length ? (
            <ul className="space-y-3">
              {paperApps.map((fa) => <PaperRow key={fa.id} fa={fa} apps={fas.apps} schoolOf={schoolOfLevelName} onOpen={() => navigate(`/admin/fas/hardcopy/${fa.id}`)} />)}
            </ul>
          ) : (
            <EmptyState title="No paper applications yet" hint="Issue a form on the Issue form tab and key in the returned copy from its draft row — the application lands here with the outcome." />
          )}
        </Card>
      </>
      )}
    </div>
  );
}
