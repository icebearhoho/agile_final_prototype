import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Bank, Receipt } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useFees } from "../../../data/feeStore";
import { balanceOf, chargeStatus, payableOf } from "../../../lib/fees";
import { StatusBadge } from "../fee-types/parts";
import { ACCOUNT_CLOSES_AT, ACCOUNT_OPENS_AT, accountStatus, ageForLevel, ledgerFor } from "../../../lib/accounts";
import { SCHOOLS } from "../../../data/schools";
import { schoolCodeFor } from "../../../data/users";
import { formatSGD } from "../../../lib/format";
import { useSession } from "../../../session";
import { statusTone } from "./logic";
import { useStudent } from "./useStudent";

const SBFAS_TONE = { Approved: "success", Pending: "warning", Rejected: "alert", "Not applied": "neutral" } as const;

function Stat({ label, value, note, alert }: { label: string; value: ReactNode; note?: ReactNode; alert?: boolean }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[13px] font-medium text-on-surface-variant">{label}</div>
      <div className={`mt-1 text-[27px] font-bold leading-tight tracking-tight ${alert ? "text-alert" : "text-on-surface"}`}>{value}</div>
      {note && <div className="mt-0.5 text-[13px] text-on-surface-variant">{note}</div>}
    </div>
  );
}

/** Req 1-4: one student's Education Account: summary, fees, ledger, FAS and actions. */
export default function EducationAccountPage() {
  const student = useStudent();
  const allCharges = useFees().state.charges;
  const navigate = useNavigate();
  const { role } = useSession();

  if (!student) {
    return (
      <Card>
        <EmptyState as="h2" title="Account not found" action={<Link to="/admin/students" className="text-primary underline">Back to students</Link>} />
      </Card>
    );
  }

  const charges = allCharges.filter((c) => c.studentId === student.id);
  const unpaid = charges.filter((c) => chargeStatus(c) !== "paid");
  const due = unpaid.reduce((t, c) => t + balanceOf(c), 0);
  const left = student.balance - due;
  const entries = ledgerFor(student);
  const initials = student.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const feesPath = `/admin/students/${student.id}/fees`;

  // ASSUMPTION: mock students carry no DOB or school; DOB is derived from level age and the id, the account opened on the 7th birthday.
  const seq = Number(student.id.replace(/\D/g, "")) || 0;
  const dob = new Date(Date.UTC(2026 - ageForLevel(student.level), seq % 12, (seq % 28) + 1));
  const opened = new Date(Date.UTC(dob.getUTCFullYear() + ACCOUNT_OPENS_AT, dob.getUTCMonth(), dob.getUTCDate(), 6, 12));
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-SG", { timeZone: "Asia/Singapore", ...o });
  const school = SCHOOLS.find((s) => s.code === schoolCodeFor(role)) ?? SCHOOLS.find((s) => s.level === (student.level.startsWith("P") ? "Primary" : "Secondary"));
  const active = accountStatus(student.level) === "Active" && ageForLevel(student.level) < ACCOUNT_CLOSES_AT;
  const closed = new Date(Date.UTC(dob.getUTCFullYear() + ACCOUNT_CLOSES_AT, dob.getUTCMonth(), dob.getUTCDate()));

  const details: [string, ReactNode][] = [
    ["Account status", <Badge key="a" tone={active ? "success" : "neutral"}>{active ? "Active" : "Not active"}</Badge>],
    ["Current enrolment", <Badge key="s" tone={statusTone[student.status]}>{student.status}</Badge>],
    ["Date of birth", fmt(dob, { day: "2-digit", month: "2-digit", year: "numeric" })],
    ["Education account ID", student.id],
    ["Current school", school?.name ?? "—"],
    ["Current level", student.level],
    ["Current class", student.class],
    ["Academic year", "2026"],
    ["Opened", `${fmt(opened, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })} SGT`],
    ["Closed", ageForLevel(student.level) >= ACCOUNT_CLOSES_AT ? fmt(closed, { day: "numeric", month: "short", year: "numeric" }) : "—"],
    ...(role === "school" ? ([
      ["MOEFAS", <Badge key="m" tone={SBFAS_TONE[student.moefas]}>{student.moefas}</Badge>],
      ["SBFAS", <Badge key="f" tone={SBFAS_TONE[student.sbfas]}>{student.sbfas}</Badge>],
    ] as [string, ReactNode][]) : []),
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Link to="/admin/students" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <ArrowLeft size={16} aria-hidden /> Back to students
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <Card className="lg:sticky lg:top-6">
          <div className="flex flex-col items-center text-center">
            <div className="grid size-20 place-items-center rounded-full bg-primary-fixed text-2xl font-bold text-primary" aria-hidden>{initials}</div>
            <h2 className="mt-3 text-xl font-semibold text-on-surface">{student.name}</h2>
            <p className="text-sm text-on-surface-variant">Education account</p>
          </div>
          <dl className="mt-5 divide-y divide-line border-t border-line text-sm">
            {details.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-on-surface-variant">{k}</dt>
                <dd className="text-right font-medium text-on-surface">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 grid gap-2">
            {role !== "hq" && <Button className="w-full" icon={<Receipt size={18} aria-hidden />} onClick={() => navigate(feesPath, { state: { student } })}>View all fees</Button>}
            {role === "hq" && <Button className="w-full" icon={<Bank size={18} aria-hidden />} onClick={() => navigate("/admin/top-up", { state: { student } })}>Top up</Button>}
          </div>
        </Card>

        <div className="grid gap-6">
          <div className="grid divide-y divide-line rounded-card border border-line bg-surface-container-lowest sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Stat label="Account balance" value={formatSGD(student.balance)} />
            <Stat label="Outstanding fees" value={formatSGD(due)} note={`${unpaid.length} unpaid`} />
            <Stat label="Balance after fees" value={formatSGD(left)} alert={left < 0} note={left < 0 ? "Balance does not cover the fees" : "Balance covers the fees"} />
          </div>

          <Card title="Fees" action={role !== "hq" ? <Link to={feesPath} state={{ student }} className="text-[13px] font-medium text-primary">All fees</Link> : undefined}>
            <ul className="divide-y divide-line">
              {charges.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <div className="font-medium text-on-surface">{c.title}</div>
                    <div className="text-[13px] text-on-surface-variant">issued {c.issued}, due {c.due}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-on-surface">{formatSGD(balanceOf(c) || payableOf(c))}</span>
                    <StatusBadge status={chargeStatus(c)} />
                  </div>
                </li>
              ))}
              {!charges.length && <li className="py-3 text-sm text-on-surface-variant">No charges yet.</li>}
            </ul>
          </Card>

          <Card title="Transactions">
            <ul className="divide-y divide-line">
              {entries.map((e) => {
                const credit = e.amount > 0;
                const Icon = credit ? ArrowDownLeft : ArrowUpRight;
                return (
                  <li key={e.description} className="flex items-center gap-3 py-3">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-full ${credit ? "bg-success-container text-success" : "bg-track text-on-surface-variant"}`} aria-hidden>
                      <Icon size={16} weight="bold" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-on-surface">{e.description}</div>
                      <div className="text-[13px] text-on-surface-variant">{e.date}</div>
                    </div>
                    <div className={`text-sm font-semibold ${credit ? "text-success" : "text-on-surface"}`}>
                      {credit ? "+" : "-"}{formatSGD(Math.abs(e.amount))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
