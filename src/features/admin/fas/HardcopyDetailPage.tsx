import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Printer } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useFas } from "../../../data/fasStore";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import { useRegistry } from "../../../data/registryStore";
import type { Level } from "../../../data/students";
import { useSession } from "../../../session";
import { PaperDetail } from "./HardcopyEntry";
import { openVerificationPrint } from "./draftPrint";

/** A submitted paper form as its own page: clicking a history row navigates here instead of
 *  expanding the list, so the list stays scannable no matter how many applications there are.
 *
 *  The page closes the checking loop after key-in: "Print for the parent to check" hands the
 *  parent a printed verification copy of the keyed-in record to check field by field.
 *
 *  After this school REJECTS a child's SBFAS request, everything happens on the review page
 *  instead: the parent's re-request returns the same application to the queue as its next round,
 *  reason logged — a recorded decision is never changed in place (one application per child per
 *  year; see ReviewPage). */

export default function HardcopyDetailPage() {
  const { faId = "" } = useParams();
  const navigate = useNavigate();
  const { state: fas } = useFas();
  const { state: reg } = useRegistry();
  const { staff } = useSession();
  const mySchool = staff?.schoolCode ?? "";
  const schoolName = reg.schools.find((s) => s.code === mySchool)?.name ?? mySchool;
  // The print popup was blocked — the record is still shown; "Print" recovers it.
  const [printMiss, setPrintMiss] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [faId]);

  const fa = fas.familyApps.find((f) => f.id === faId && (f.school === schoolName || f.school === mySchool));
  const linked = fa ? fas.apps.filter((x) => x.familyAppId === fa.id) : [];
  const back = () => navigate("/admin/fas", { state: { fasTab: "hardcopy", hardcopyView: "apps" } });
  const schoolOf = (level: string) => {
    const code = schoolOfLevel(level as Level);
    return reg.schools.find((x) => x.code === code)?.name ?? code;
  };

  const backLink = (
    <button
      type="button"
      onClick={back}
      className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <ArrowLeft size={16} weight="bold" aria-hidden="true" /> Back to all applications
    </button>
  );

  if (!fa) {
    return (
      <div className="space-y-4">
        {backLink}
        <Card title={`Paper application ${faId}`}>
          <EmptyState
            title="This paper application is not in the current session"
            hint="Demo data lives in memory and resets on reload — issue a fresh form on the Issue form tab to bring the family back."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {backLink}
      <Card
        title={`${fa.id} · ${fa.applicant}`}
        action={
          <Button
            size="sm"
            variant="secondary"
            icon={<Printer size={14} weight="bold" aria-hidden="true" />}
            onClick={() => setPrintMiss(!openVerificationPrint(fa, linked, fa.school))}
          >
            Print for the parent to check
          </Button>
        }
      >
        {printMiss && (
          <p role="alert" className="mb-3 text-[13px] font-medium text-alert">
            The print window was blocked — allow popups for this site, then press Print again.
          </p>
        )}
        <PaperDetail fa={fa} linked={linked} schoolOf={schoolOf} />
      </Card>
    </div>
  );
}
