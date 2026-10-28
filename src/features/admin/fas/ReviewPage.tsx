import { useEffect, useRef, useState, type RefObject } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Sparkle } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { SBFAS_TIERS, attemptOf, sourceOf, yearOf, type SbfasApplication, type SbfasTier } from "../../../data/sbfasApplications";
import { useFas } from "../../../data/fasStore";
import { useFasActions } from "../../../data/fasActions";
import { useFees } from "../../../data/feeStore";
import { useMovements } from "../../../data/movements";
import { useRegistry } from "../../../data/registryStore";
import { useSbfas } from "../../../data/sbfasStore";
import { rankOf, ruleForSchool, subsidySummary, type ComponentRates, type SbfasRule, type SubsidyBasis } from "../../../data/sbfasRule";
import { isSbfasEligible } from "../../../data/students";
import { formatSGD } from "../../../lib/format";
import { balanceOf, chargeStatus } from "../../../lib/fees";
import { riskLevel } from "../../../lib/fas";
import { schoolOfStudent } from "../../../lib/registry";
import { withBalance } from "../../../lib/studentFas";
import { useSession } from "../../../session";
import { statusLabel, validateDecision, type Action, type DecisionError, type Draft } from "./review";
import { FamilyApplicationSections } from "./FamilySections";

export const riskTone = { Low: "success", Medium: "warning", High: "alert" } as const;

export function RiskBadge({ score }: { score: number }) {
  const level = riskLevel(score);
  return <Badge tone={riskTone[level]}>{level} - {score}</Badge>;
}

/** Extra fields carried alongside the application (computed from real student records and charges). */
export type FeeContext = {
  payable: number;
  balance: number;
  nationality: string;
};

type Enriched = SbfasApplication & FeeContext;

function Dt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 font-semibold text-on-surface">{children}</dd>
    </div>
  );
}

/** The review body, shared by nothing else anymore but kept as its own component so the page can key
 *  it per application (resets the decision draft when the reviewer opens another one). */
function ReviewBody({ app, rule, onDecide, onRequeue }: { app: Enriched; rule: SbfasRule | null; onDecide: (id: string, action: Action, draft: Draft) => void; onRequeue: (studentId: string, reason: string) => void }) {
  // The school decides how many tiers exist — list them from its rule, not a fixed national set.
  const tierList: { tier: SbfasTier; basis?: SubsidyBasis; rate?: number; components?: ComponentRates }[] = rule
    ? rule.tiers
    : SBFAS_TIERS.map((t) => ({ tier: t }));
  const [tier, setTier] = useState<SbfasTier>(tierList.some((t) => t.tier === app.recommendedTier) ? app.recommendedTier : tierList[0].tier);
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<DecisionError | null>(null);
  // The parent's re-request: the only way a rejection moves now (the school never edits a recorded
  // decision in place) — the SAME application returns to the queue as its next round, with the
  // what-changed reason logged on it.
  const [reasking, setReasking] = useState(false);
  const [reaskReason, setReaskReason] = useState("");
  const reaskRef = useRef<HTMLTextAreaElement>(null);
  // BR15: a school reviewer only sees their own students in the family sections; MOE sees all.
  const { role, staff } = useSession();
  const tierRef = useRef<HTMLSelectElement>(null);
  const justRef = useRef<HTMLTextAreaElement>(null);
  const decided = app.status !== "Pending";
  const { state: fas } = useFas();
  // A hardcopy case carries the paper family application it came from — shown in full, by section,
  // the same way MOE sees it, so the reviewer reads the household off the actual form.
  const familyApp = app.familyAppId ? fas.familyApps.find((f) => f.id === app.familyAppId) : undefined;

  const act = (action: Action) => {
    const draft = { justification, tier };
    const err = validateDecision(action, draft, app.recommendedTier);
    if (err) {
      setError(err);
      // Move focus to the offending field so keyboard and screen-reader users land on the error.
      ((err.field === "tier" ? tierRef : justRef) as RefObject<HTMLElement | null>).current?.focus();
      return;
    }
    onDecide(app.id, action, draft);
  };

  const fileReask = () => {
    if (!reaskReason.trim()) {
      setError({ field: "justification", message: "Say what changed since the rejected request — the reason is logged as the next round." });
      reaskRef.current?.focus();
      return;
    }
    setError(null);
    setReasking(false);
    onRequeue(app.studentId, reaskReason.trim());
    setReaskReason("");
  };

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-4">
        <Dt label="Student">
          <Link to={`/admin/students/${app.studentId}/fees`} className="rounded text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {app.student} ({app.level})
          </Link>
        </Dt>
        <Dt label="Nationality">{app.nationality}</Dt>
        <Dt label="Application source">
          {sourceOf(app)} · {yearOf(app)} application{attemptOf(app) > 1 ? ` · round ${attemptOf(app)}` : ""}
          {app.enteredBy && <span className="block text-[13px] font-normal text-on-surface-variant">Entered by {app.enteredBy}</span>}
        </Dt>
        <Dt label="Income sync">{app.incomeSyncedOn ?? "Paper form — no MyInfo sync"}</Dt>
        <Dt label="Household income band (monthly)">{app.householdBand ?? "—"}</Dt>
        <Dt label="Per-capita income band (monthly)">{app.incomeBand}</Dt>
        <Dt label="Risk rating"><RiskBadge score={app.riskScore} /></Dt>
        <Dt label="Suggested rank">{rankOf(app.recommendedTier)}</Dt>
      </dl>

      {attemptOf(app) >= 3 && (
        <p className="rounded-control border border-line bg-surface-container-low px-3 py-2.5 text-[13px] text-on-surface-variant">
          This is the family&apos;s request no. {attemptOf(app)} for this child. Nothing blocks the school from deciding it,
          but consider whether the situation has really changed or whether other help fits better.
        </p>
      )}

      {(app.rounds?.length ?? 0) > 1 && (
        <div className="rounded-control border border-line bg-surface-container-low p-4">
          <p className="text-[13px] font-semibold text-on-surface">Request history — {app.rounds!.length} rounds on this application</p>
          {/* One record per child: every parent re-request requeued THIS application; each round ends
              with the decision that closed it, told here once. */}
          <ol className="mt-2 space-y-1.5">
            {app.rounds!.map((r, i) => (
              <li key={i} className="text-[13px]">
                <span className="font-semibold text-on-surface">Round {i + 1}</span>{" "}
                {r.at ? new Date(r.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                {r.note && r.note !== "First request" ? ` — ${r.note}` : ""}
                {r.by ? ` (filed by ${r.by})` : ""}
                {r.decision && (
                  <span className="text-on-surface-variant">
                    {" "}→ {statusLabel(r.decision.status)}
                    {r.decision.tier ? ` · ${rankOf(r.decision.tier)}` : ""}
                    {r.decision.justification ? ` — “${r.decision.justification}”` : ""}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {!isSbfasEligible(app.nationality) && (
        <p className="rounded-control border border-line px-3 py-2.5 text-[13px] text-alert">
          {app.nationality} — not eligible for MOE FAS or SBFAS (Singapore Citizens only). Reject this application.
        </p>
      )}

      <div className="rounded-control border border-line bg-surface-container-low p-4">
        <dl className="grid grid-cols-2 gap-4">
          <Dt label="Fee payable">
            <span className="text-alert">{formatSGD(app.payable)}</span>
            <Link to={`/admin/students/${app.studentId}/fees`} className="ml-1.5 text-[13px] font-normal text-primary underline-offset-2 hover:underline">view fees</Link>
          </Dt>
          <Dt label="Account balance (top-ups)">{formatSGD(app.balance)}</Dt>
        </dl>
      </div>

      <div className="rounded-control border border-line bg-surface-container-low p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-on-surface">
          <Sparkle size={16} aria-hidden="true" className="text-primary" /> Why this suggestion
        </p>
        <p className="mt-1.5 text-sm text-on-surface">{app.explanation}</p>
      </div>

      {familyApp && (
        <div className="space-y-4">
          <p className="text-[13px] font-semibold text-on-surface">
            The paper family application ({familyApp.id}) — by section, as MOE sees it
          </p>
          <FamilyApplicationSections fa={familyApp} initialStudentId={app.studentId} onlySchoolCode={role === "school" ? staff?.schoolCode : undefined} />
        </div>
      )}

      {decided ? (
        <div className="rounded-control border border-line p-4 text-sm">
          <p className="font-semibold text-on-surface">Decision recorded: {statusLabel(app.status)}{app.sbfasTier ? ` · ${rankOf(app.sbfasTier)}` : ""}</p>
          {app.justification && <p className="mt-1">Justification: {app.justification}</p>}
          <p className="mt-1 text-[13px] text-on-surface-variant">
            Outcome sent to the parent by SMS/email automatically on the decision date.
          </p>
          {app.status === "Rejected" && !reasking && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-[13px] text-on-surface-variant">
                A recorded decision is never changed in place. If the parent asked again, file a re-request —
                the same application returns to the queue as its next round, with what changed logged.
              </p>
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setReasking(true)}>File a re-request</Button>
              </div>
            </div>
          )}
          {reasking && (
            <div className="mt-3 space-y-3 border-t border-line pt-3">
              <p className="text-[13px] font-semibold text-on-surface">File a re-request — the parent asked again</p>
              <Field
                label="What changed since the rejected request"
                required
                hint="e.g. a parent stopped working in August — logged as this application's next round."
                error={error?.field === "justification" ? error.message : undefined}
              >
                <textarea
                  ref={reaskRef}
                  rows={3}
                  className={`${inputClass} py-2`}
                  value={reaskReason}
                  onChange={(e) => {
                    setReaskReason(e.target.value);
                    if (error?.field === "justification") setError(null);
                  }}
                />
              </Field>
              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="secondary" onClick={() => { setReasking(false); setReaskReason(""); setError(null); }}>Cancel</Button>
                <Button onClick={fileReask}>File the re-request</Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <Field
            label="Override rank"
            error={error?.field === "tier" ? error.message : undefined}
          >
            <select ref={tierRef} className={inputClass} value={tier} onChange={(e) => setTier(e.target.value as SbfasTier)}>
              {tierList.map((t) => (
                <option key={t.tier} value={t.tier}>
                  {rankOf(t.tier)}{t.basis ? ` — ${subsidySummary(t, rule?.coveredComponents)} subsidy` : ""}{t.tier === app.recommendedTier ? " (suggested)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Justification (required to override)"
            error={error?.field === "justification" ? error.message : undefined}
          >
            <textarea
              ref={justRef}
              rows={3}
              className={`${inputClass} py-2`}
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value);
                if (error?.field === "justification") setError(null);
              }}
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => act("reject")}>Reject</Button>
            <Button variant="secondary" onClick={() => act("override")}>Override</Button>
            <Button onClick={() => act("approve")}>Approve {rankOf(app.recommendedTier)}</Button>
          </div>
        </>
      )}
    </div>
  );
}

/** The SBFAS review as its own page (like the MOE application detail) — the queue's "Open review"
 *  navigates here instead of opening a popup, so the full application, including a hardcopy form's
 *  sections, has room and a shareable URL. */
export default function ReviewPage() {
  const { appId = "" } = useParams();
  const navigate = useNavigate();
  const { state: fas } = useFas();
  const { state: reg } = useRegistry();
  const { state: sbfas } = useSbfas();
  const fees = useFees();
  const movements = useMovements();
  const { decide, requeueSbfas } = useFasActions();
  const { staff } = useSession();
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [appId]);

  const app = fas.apps.find((a) => a.id === appId);
  const student = app ? reg.students.find((s) => s.id === app.studentId) : undefined;
  const enriched: Enriched | null = app && student ? {
    ...app,
    nationality: student.nationality ?? "Singapore Citizen",
    // What the family still owes (after any FAS subsidy and payments) — separate from the account's top-up balance.
    payable: fees.state.charges.filter((c) => c.studentId === app.studentId && chargeStatus(c) !== "paid").reduce((t, c) => t + balanceOf(c), 0),
    balance: withBalance(student, movements).balance,
  } : null;
  // The rule of the school that owns the application — SBFAS packages are school-defined.
  const school = student ? schoolOfStudent(student, reg.classes) : staff?.schoolCode ?? "S001";
  const rule = enriched ? ruleForSchool(sbfas.rules, school) : null;
  const back = () => navigate("/admin/fas", { state: { fasTab: "sbfas" } });

  const onDecide = (id: string, action: Action, draft: Draft) => {
    decide(id, action, draft); // updates the FAS record and re-prices the student's unpaid fees
    const a = fas.apps.find((x) => x.id === id);
    if (a) setAnnounce(`Application ${id} for ${a.student} ${{ approve: "approved", override: "overridden", reject: "rejected" }[action]}.`);
  };

  // The parent's re-request: the same application returns to the queue as its next round, the
  // what-changed reason logged — the page flips back to the live decision form for the new round.
  const onRequeue = (studentId: string, reason: string) => {
    requeueSbfas({ studentId, reason, by: staff?.name ?? "School user" });
    const a = enriched;
    if (a) setAnnounce(`Re-request filed for ${a.student} — application ${a.id} returned to the queue as its next round.`);
  };

  const backLink = (
    <button
      type="button"
      onClick={back}
      className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <ArrowLeft size={16} weight="bold" aria-hidden="true" /> Back to SBFAS review
    </button>
  );

  if (!enriched) {
    return (
      <div className="space-y-4">
        {backLink}
        <Card title={`Review application ${appId}`}>
          <EmptyState
            title="This application is not in the current session"
            hint="Demo data lives in memory and resets on reload — the seeded queue returns when you reopen this page from the SBFAS review tab."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {backLink}
      <p role="status" className="sr-only">{announce}</p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-on-surface-variant">SBFAS review / {enriched.id}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{enriched.student}&apos;s application</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            {sourceOf(enriched)} · {enriched.level} · {reg.schools.find((s) => s.code === school)?.name ?? school}
          </p>
        </div>
        <Badge tone={enriched.status === "Pending" ? "neutral" : enriched.status === "Rejected" ? "alert" : "success"}>
          {statusLabel(enriched.status)}{enriched.sbfasTier ? ` · ${rankOf(enriched.sbfasTier)}` : ""}
        </Badge>
      </div>
      <Card title="Review the application">
        <ReviewBody key={enriched.id} app={enriched} rule={rule} onDecide={onDecide} onRequeue={onRequeue} />
      </Card>
    </div>
  );
}
