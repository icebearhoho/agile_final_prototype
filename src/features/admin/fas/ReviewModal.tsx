import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../../../components/ui/Button";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { SBFAS_TIERS, type SbfasApplication, type SbfasTier } from "../../../data/sbfasApplications";
import { rankOf, subsidySummary, type ComponentRates, type SbfasRule, type SubsidyBasis } from "../../../data/sbfasRule";
import { isSbfasEligible } from "../../../data/students";
import { formatSGD } from "../../../lib/format";
import { statusLabel, type Action, type Draft } from "./review";

/** Extra fields carried alongside the application (computed in the queue from real student records and charges). */
export type FeeContext = {
  payable: number;
  balance: number;
  nationality: string;
};

type Props = { app: (SbfasApplication & FeeContext) | null; rule: SbfasRule | null; onClose: () => void; onDecide: (id: string, action: Action, draft: Draft) => void };

function Dt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 font-semibold text-on-surface">{children}</dd>
    </div>
  );
}

function ReviewBody({ app, rule, onDecide }: Omit<Props, "app" | "onClose"> & { app: SbfasApplication & FeeContext }) {
  // The school decides how many tiers exist — list them from its rule, not a fixed national set.
  const tierList: { tier: SbfasTier; basis?: SubsidyBasis; rate?: number; components?: ComponentRates }[] = rule
    ? rule.tiers
    : SBFAS_TIERS.map((t) => ({ tier: t }));
  // The rank the reviewer will grant — defaults to the application's starting rank; the school picks any rank it offers.
  const [tier, setTier] = useState<SbfasTier>(tierList.some((t) => t.tier === app.recommendedTier) ? app.recommendedTier : tierList[0].tier);
  const [justification, setJustification] = useState("");
  const decided = app.status !== "Pending";

  const act = (action: Action) => onDecide(app.id, action, { justification, tier });

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-4">
        <Dt label="Student">
          <Link to={`/admin/students/${app.studentId}/fees`} className="rounded text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {app.student} ({app.level})
          </Link>
        </Dt>
        <Dt label="Nationality">{app.nationality}</Dt>
        <Dt label="Household income band (monthly)">{app.householdBand ?? "—"}</Dt>
        <Dt label="Per-capita income band (monthly)">{app.incomeBand}</Dt>
        <Dt label="Application source">{app.source === "Hardcopy" ? "Hardcopy — paper form entered by the school" : "MOE referral — fell out of the MOE assessment"}</Dt>
        <Dt label="Income sync">{app.incomeSyncedOn ? `MyInfo · ${app.incomeSyncedOn}` : "Not synced — paper form"}</Dt>
      </dl>

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
        <p className="text-[13px] font-semibold text-on-surface">Application context</p>
        <p className="mt-1.5 text-sm text-on-surface">{app.explanation}</p>
      </div>

      {decided ? (
        <div className="rounded-control border border-line p-4 text-sm">
          <p className="font-semibold text-on-surface">Decision recorded: {statusLabel(app.status)}{app.sbfasTier ? ` · ${rankOf(app.sbfasTier)}` : ""}</p>
          {app.justification && <p className="mt-1">Justification: {app.justification}</p>}
        </div>
      ) : (
        <>
          <Field label="Rank">
            <select className={inputClass} value={tier} onChange={(e) => setTier(e.target.value as SbfasTier)}>
              {tierList.map((t) => (
                <option key={t.tier} value={t.tier}>
                  {rankOf(t.tier)}{t.basis ? ` — ${subsidySummary(t, rule?.coveredComponents)} subsidy` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Justification (optional)">
            <textarea rows={3} className={`${inputClass} py-2`} value={justification} onChange={(e) => setJustification(e.target.value)} />
          </Field>
          <div className="flex flex-wrap justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => act("reject")}>Reject</Button>
            <Button onClick={() => act("approve")}>Approve {rankOf(tier)}</Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Modal stays mounted so Modal can restore focus to the opener; the body is keyed per application to reset its draft. */
export function ReviewModal({ app, rule, onClose, onDecide }: Props) {
  return (
    <Modal open={app !== null} onClose={onClose} title={app ? `Review application ${app.id}` : "Review application"}>
      {app && <ReviewBody key={app.id} app={app} rule={rule} onDecide={onDecide} />}
    </Modal>
  );
}
