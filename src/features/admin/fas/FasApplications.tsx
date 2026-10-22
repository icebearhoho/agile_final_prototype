import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { SBFAS_APPLICATIONS, type SbfasApplication, type SbfasSource, type SbfasStatus } from "../../../data/sbfasApplications";
import { ruleForSchool, rankOf } from "../../../data/sbfasRule";
import { useFasActions } from "../../../data/fasActions";
import { useFas } from "../../../data/fasStore";
import { useFees } from "../../../data/feeStore";
import { useMovements } from "../../../data/movements";
import { useRegistry } from "../../../data/registryStore";
import { useSbfas } from "../../../data/sbfasStore";
import { useSession } from "../../../session";
import { formatSGD } from "../../../lib/format";
import { balanceOf, chargeStatus } from "../../../lib/fees";
import { schoolOfStudent } from "../../../lib/registry";
import { withBalance } from "../../../lib/studentFas";
import { useMockQuery } from "../../../lib/useMockQuery";
import { Tiles } from "../fee-types/parts";
import HqPermissionNote from "../HqPermissionNote";
import { ReviewModal } from "./ReviewModal";
import { isDeclined, isGranted, sortQueue, statusLabel, type Action, type Draft } from "./review";

type Filter = "all" | "pending" | "granted" | "declined";
/** Where an application came from (Req 4): MOE referral (fell out of the MOE assessment) or Hardcopy (paper form the school entered). */
type SourceFilter = "all" | SbfasSource;

const statusTone: Record<SbfasStatus, BadgeTone> = { Pending: "neutral", Approved: "success", Overridden: "success", Rejected: "alert" };

/** What this student's family still owes on issued charges, after any FAS subsidy and payments. */
type Row = SbfasApplication & { payable: number; balance: number; nationality: string };

/** SBFAS review queue (Requirement 4, school side): shown to schools with the FAS module and read-only at HQ. */
function SbfasReview() {
  const query = useMockQuery(SBFAS_APPLICATIONS);
  const fees = useFees();
  const { state: fas } = useFas();
  const { state: reg } = useRegistry();
  const movements = useMovements();
  const { decide: decideApp } = useFasActions();
  const { role, staff } = useSession();
  // School-defined SBFAS packages (offered tiers + per-tier subsidy rates) live in their own store.
  const { state: sbfas } = useSbfas();
  // Each school reviews only its own students' applications (BR15); MOE HQ has no school and sees every one.
  // A school account without a school sees nothing rather than everything.
  const mySchool = role === "school" ? staff?.schoolCode ?? "" : null;
  // Shared with the Budgets pages, so a decision moves the school's statistics.
  const apps = useMemo(
    () => fas.apps.filter((a) => {
      if (mySchool === null) return true;
      const s = reg.students.find((x) => x.id === a.studentId);
      return s ? schoolOfStudent(s, reg.classes) === mySchool : false;
    }),
    [fas.apps, mySchool, reg.students, reg.classes],
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  // Where the application came from (Req 4): MOE referral (fell out of the MOE assessment) or Hardcopy
  // (paper form the school entered). Both run through the same rules — the filter only narrows the view.
  const [sourceF, setSourceF] = useState<SourceFilter>("all");
  // No visible banner (the row just moves tab), but the decision is still announced.
  const [announce, setAnnounce] = useState("");

  const enriched: Row[] = useMemo(
    () => sortQueue(apps).map((a) => ({
      ...a,
      nationality: reg.students.find((s) => s.id === a.studentId)?.nationality ?? "Singapore Citizen",
      // What the family still owes (after any FAS subsidy and payments) — separate from the account's top-up balance.
      payable: fees.state.charges.filter((c) => c.studentId === a.studentId && chargeStatus(c) !== "paid").reduce((t, c) => t + balanceOf(c), 0),
      balance: withBalance(reg.students.find((s) => s.id === a.studentId)!, movements).balance,
    })),
    [apps, fees.state.charges, movements, reg.students],
  );
  const rows: Row[] = useMemo(
    () => enriched.filter((a) => (sourceF === "all" || a.source === sourceF)
      && (filter === "all"
        || (filter === "pending" && a.status === "Pending")
        || (filter === "granted" && isGranted(a))
        || (filter === "declined" && isDeclined(a)))),
    [enriched, filter, sourceF],
  );
  const pendingCount = apps.filter((a) => a.status === "Pending").length;
  const grantedCount = apps.filter(isGranted).length;
  const declinedCount = apps.filter(isDeclined).length;

  const decide = (id: string, action: Action, draft: Draft) => {
    decideApp(id, action, draft); // updates the FAS record and re-prices the student's unpaid fees
    setOpenId(null);
    const a = apps.find((x) => x.id === id);
    if (a) setAnnounce(`Application ${id} for ${a.student} ${{ approve: "approved", override: "overridden", reject: "rejected" }[action]}.`);
  };

  // The rule of the school that owns the opened application — SBFAS packages are school-defined.
  const openApp = enriched.find((a) => a.id === openId) ?? null;
  const openStudent = openApp ? reg.students.find((s) => s.id === openApp.studentId) : undefined;
  const openRule = openApp ? ruleForSchool(sbfas.rules, openStudent ? schoolOfStudent(openStudent, reg.classes) : mySchool ?? "S001") : null;

  const columns: Column<Row>[] = [
    { key: "student", header: "Student", sortable: true, render: (a) => (
      <Link to={`/admin/students/${a.studentId}/fees`} className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span className="font-semibold">{a.student}</span>
        <span className="block text-[13px] text-on-surface-variant">{a.level} · {a.id}</span>
      </Link>
    ) },
    { key: "incomeBand", header: "Income per person", sortable: true },
    { key: "source", header: "Source", render: (a) => (
      <Badge tone={a.source === "MOE referral" ? "primary" : "neutral"}>{a.source}</Badge>
    ) },
    { key: "payable", header: "Fee to pay", sortable: true, align: "right", render: (a) => (
      <Link to={`/admin/students/${a.studentId}/fees`} className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        {a.payable ? <span className="font-semibold">{formatSGD(a.payable)}</span> : <span className="text-on-surface-variant">—</span>}
        <span className="block text-[13px] text-on-surface-variant" title="Education Account balance from MOE top-ups, separate from the FAS subsidy">Balance {formatSGD(a.balance)}</span>
      </Link>
    ) },
    { key: "status", header: "Status", render: (a) => <Badge tone={statusTone[a.status]}>{statusLabel(a.status)}{a.sbfasTier ? ` · ${rankOf(a.sbfasTier)}` : ""}</Badge> },
  ];
  const tabs: [Filter, string][] = [
    ["all", `All (${apps.length})`],
    ["pending", `Pending (${pendingCount})`],
    ["granted", `Granted (${grantedCount})`],
    ["declined", `Rejected (${declinedCount})`],
  ];
  const sourceTabs: [SourceFilter, string][] = [
    ["all", `All sources (${apps.length})`],
    ["MOE referral", `MOE referral (${apps.filter((a) => a.source === "MOE referral").length})`],
    ["Hardcopy", `Hardcopy (${apps.filter((a) => a.source === "Hardcopy").length})`],
  ];

  return (
    <div className="space-y-4">
      <HqPermissionNote />
      <Tiles cols={3} items={[
        { label: "Waiting for your review", value: String(pendingCount), note: "Pending applications" },
        { label: "Granted", value: String(grantedCount), note: "Approved or overridden", good: grantedCount > 0 },
        { label: "Declined", value: String(declinedCount), note: "Rejected" },
      ]} />
      <Card
        title="SBFAS review queue"
        action={
          <div className="flex flex-col items-end gap-2">
            <div role="group" aria-label="Filter applications" className="flex flex-wrap gap-2">
              {tabs.map(([k, label]) => (
                <Button key={k} size="sm" variant={filter === k ? "primary" : "secondary"} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                  {label}
                </Button>
              ))}
            </div>
            <div role="group" aria-label="Filter by source" className="flex flex-wrap gap-2">
              {sourceTabs.map(([k, label]) => (
                <Button key={k} size="sm" variant={sourceF === k ? "primary" : "secondary"} aria-pressed={sourceF === k} onClick={() => setSourceF(k)}>
                  {label}
                </Button>
              ))}
            </div>
          </div>
        }
      >
        <p className="mb-4 text-sm text-on-surface-variant">
          Pending before decided. Income is shown as a band only. Applications arrive from MOE
          referrals (families outside the MOEFAS bands) or paper forms entered at the school.
        </p>
        <p role="status" className="sr-only">{announce}</p>
        {query.status === "loading" && <div aria-busy="true" aria-label="Loading applications" className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 motion-safe:animate-pulse rounded-control bg-track" />)}</div>}
        {query.status === "error" && <EmptyState title="Could not load applications" hint="Check your connection and try again." action={<Button onClick={query.retry}>Retry</Button>} />}
        {query.status === "ready" && (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(a) => a.id}
            rowActions={(a) => <RowAction onClick={() => setOpenId(a.id)}>{a.status === "Pending" ? "Open review" : "View decision"}</RowAction>}
            large
            empty={<EmptyState title="No applications in this view" hint={filter === "pending" ? "Every application has been decided." : filter === "granted" ? "Nothing granted yet — approve or override an application from the Pending tab." : filter === "declined" ? "Nothing declined yet — rejected applications appear here with their reason." : "Nothing here yet."} action={<Button variant="secondary" onClick={() => setFilter("all")}>Show all</Button>} />}
          />
        )}
      </Card>
      <ReviewModal app={openApp} rule={openRule} onClose={() => setOpenId(null)} onDecide={decide} />
    </div>
  );
}

export default SbfasReview;
export { SbfasReview };
