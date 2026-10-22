import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { nextSbfasId, PAPER_INCOME_BANDS, type SbfasStatus } from "../../../data/sbfasApplications";
import { rankOf } from "../../../data/sbfasRule";
import { useFasActions } from "../../../data/fasActions";
import { useFas } from "../../../data/fasStore";
import { useRegistry } from "../../../data/registryStore";
import { isSbfasEligible } from "../../../data/students";
import { schoolOfStudent } from "../../../lib/registry";
import { useSession } from "../../../session";
import { statusLabel } from "./review";

const statusTone: Record<SbfasStatus, BadgeTone> = { Pending: "neutral", Approved: "success", Overridden: "success", Rejected: "alert" };

/**
 * School tab (Req 4): entering paper (hardcopy) applications — the second arrival channel of the SBFAS queue,
 * beside MOE referrals. The entered form joins the same queue and follows the same rules.
 */
export default function HardcopyEntry() {
  const { state: fas } = useFas();
  const { state: reg } = useRegistry();
  const { addHardcopy } = useFasActions();
  const { staff } = useSession();
  const mySchool = staff?.schoolCode ?? "";

  const [studentId, setStudentId] = useState("");
  const [incomeBand, setIncomeBand] = useState(PAPER_INCOME_BANDS.perCapita[2]);
  const [householdBand, setHouseholdBand] = useState(PAPER_INCOME_BANDS.household[2]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState("");

  // Students this school can still enter on paper: its own, Singapore Citizens, no application yet and no MOEFAS grant.
  const enterable = useMemo(
    () => reg.students
      .filter((s) => schoolOfStudent(s, reg.classes) === mySchool
        && isSbfasEligible(s.nationality ?? "Singapore Citizen")
        && !fas.apps.some((a) => a.studentId === s.id)
        && !fas.moefas[s.id])
      .map((s) => ({ id: s.id, name: s.name, level: s.level })),
    [reg.students, reg.classes, mySchool, fas.apps, fas.moefas],
  );

  // What this school has on paper so far — seeded history plus everything entered here, pending or decided.
  const mine = useMemo(
    () => fas.apps.filter((a) => {
      if (a.source !== "Hardcopy") return false;
      const s = reg.students.find((x) => x.id === a.studentId);
      return s ? schoolOfStudent(s, reg.classes) === mySchool : false;
    }),
    [fas.apps, reg.students, reg.classes, mySchool],
  );

  const add = () => {
    if (!studentId) {
      setError("Pick the student the paper form belongs to.");
      return;
    }
    const id = nextSbfasId(fas.apps);
    addHardcopy({ studentId, incomeBand, householdBand, note, by: staff?.name ?? "School staff" });
    const s = reg.students.find((x) => x.id === studentId);
    setAnnounce(`Hardcopy application ${id} for ${s?.name ?? "the student"} entered into the SBFAS queue.`);
    setStudentId("");
    setIncomeBand(PAPER_INCOME_BANDS.perCapita[2]);
    setHouseholdBand(PAPER_INCOME_BANDS.household[2]);
    setNote("");
    setError("");
  };

  return (
    <div className="space-y-4">
      <Card title="Enter hardcopy application">
        <p className="mb-4 text-sm text-on-surface-variant">
          A paper application the family handed straight to the school — the second way applications arrive, beside
          MOE referrals. It enters the same SBFAS queue and follows the same rules; income bands are read from the
          paper form (no MyInfo sync).
        </p>
        {enterable.length === 0 ? (
          <p className="rounded-control border border-line px-3 py-2.5 text-[13px] text-on-surface-variant">
            No student of this school can be entered right now — each already has an application or a MOEFAS grant.
          </p>
        ) : (
          <div className="space-y-4">
            <Field label="Student" error={error}>
              <select
                className={inputClass}
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value);
                  setError("");
                }}
              >
                <option value="">Select a student…</option>
                {enterable.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.level})</option>)}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Per-capita income band (monthly)">
                <select className={inputClass} value={incomeBand} onChange={(e) => setIncomeBand(e.target.value)}>
                  {PAPER_INCOME_BANDS.perCapita.map((b) => <option key={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Household income band (monthly)">
                <select className={inputClass} value={householdBand} onChange={(e) => setHouseholdBand(e.target.value)}>
                  {PAPER_INCOME_BANDS.household.map((b) => <option key={b}>{b}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Note from the paper form (optional)">
              <textarea rows={2} className={`${inputClass} py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="flex justify-end">
              <Button onClick={add}>Add to queue</Button>
            </div>
          </div>
        )}
        <p role="status" className={`mt-3 text-[13px] font-semibold text-success ${announce ? "" : "sr-only"}`}>{announce}</p>
      </Card>

      <Card title="Hardcopy applications from this school">
        <p className="mb-4 text-sm text-on-surface-variant">
          Everything this school has on paper, newest last — pending ones wait in the SBFAS review queue with MOE referrals.
        </p>
        {mine.length === 0 ? (
          <EmptyState title="Nothing on paper yet" hint="Hardcopy applications entered here appear in this list." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Student</th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Income bands (monthly)</th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Suggested rank</th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Status</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2.5">
                      <Link to={`/admin/students/${a.studentId}/fees`} className="rounded font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        {a.student}
                      </Link>
                      <span className="block text-[13px] text-on-surface-variant">{a.level} · {a.id}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {a.incomeBand}
                      <span className="block text-[13px] text-on-surface-variant">{a.householdBand ?? "—"} household</span>
                    </td>
                    <td className="px-3 py-2.5">{rankOf(a.recommendedTier)}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={statusTone[a.status]}>{statusLabel(a.status)}{a.sbfasTier ? ` · ${rankOf(a.sbfasTier)}` : ""}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
