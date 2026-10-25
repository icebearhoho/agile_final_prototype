import { STUDENTS } from "./students";

/** Tier names are positional: the school decides HOW MANY tiers it offers, so any "Tier N" is valid. */
export type SbfasTier = `Tier ${number}`;
export type SbfasStatus = "Pending" | "Approved" | "Overridden" | "Rejected";
/**
 * Where the application came from: "MOE referral" = the family applied centrally and MOE referred the case
 * down after it fell outside the MOEFAS income bands; "Hardcopy" = a paper form handed straight to the
 * school, which staff entered into the same queue. Both follow the same review rules.
 */
export type SbfasSource = "MOE referral" | "Hardcopy";

export type SbfasApplication = {
  id: string;
  /** Display name; `studentId` links the application to the student's Education Account, fees and FAS subsidy. */
  student: string;
  studentId: string;
  level: string;
  /** Per-capita household income BAND only; the third-party income API never returns exact income. */
  incomeBand: string;
  /** Gross household income band; a big household can sit in a higher band than its per-capita band. Absent on family-submitted applications. */
  householdBand?: string;
  /** ISO date the third-party income API last synced this application's bands. Absent on paper (hardcopy) applications. */
  incomeSyncedOn?: string;
  source: SbfasSource;
  /** AI risk score 0-100 (higher = more likely to struggle with fees). Level comes from riskLevel(). */
  riskScore: number;
  recommendedTier: SbfasTier;
  /** Working days left to decide. 0 or below = overdue. */
  slaDays: number;
  explanation: string;
  status: SbfasStatus;
  sbfasTier?: SbfasTier;
  justification?: string;
  /** ISO timestamp of the decision; set when the application is decided. */
  decidedAt?: string;
};

/** Income bands are read-only and come from the third-party MyInfo (SingPass) API — never typed in by the school. */
export const INCOME_API_SOURCE = "MyInfo (SingPass) API";

// ASSUMPTION: tier names (Tier 1 = highest subsidy), band edges and SLA length are invented; confirm with MOE.
export const SBFAS_TIERS: SbfasTier[] = ["Tier 1", "Tier 2", "Tier 3", "Tier 4"];

/** R4: subsidy rate per default tier. Real SBFAS is school-managed within 50–75%; Tier 1 is the strongest package. */
export const SBFAS_TIER_RATES: Partial<Record<SbfasTier, number>> = { "Tier 1": 1, "Tier 2": 0.75, "Tier 3": 0.5, "Tier 4": 0.25 };

export type Action = "approve" | "reject";
export type Draft = { justification: string; tier: SbfasTier };
const STATUS: Record<Action, SbfasStatus> = { approve: "Approved", reject: "Rejected" };

/** Pure. Records the reviewer's decision on one application — Approve grants at the rank the reviewer
 * picked in the modal (there is no suggestion to follow); the justification is an optional note. */
export function applyDecision(apps: SbfasApplication[], id: string, action: Action, draft: Draft): SbfasApplication[] {
  return apps.map((a) =>
    a.id !== id
      ? a
      : {
          ...a,
          status: STATUS[action],
          sbfasTier: action === "reject" ? undefined : draft.tier,
          justification: draft.justification.trim() || undefined,
        },
  );
}

/**
 * Next application reference in the SBFASXXXX format: 4-digit zero-padded sequence continuing from the
 * highest existing one (seeds start at 0001, so an empty queue starts at SBFAS0001). Past 9999 the digits
 * simply grow (SBFAS10000) — never validate or parse the reference with a fixed-length pattern, and sort
 * by the numeric sequence, not the string.
 */
export const nextSbfasId = (apps: Pick<SbfasApplication, "id">[]) =>
  `SBFAS${String(apps.reduce((m, a) => Math.max(m, Number(a.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(4, "0")}`;

// ASSUMPTION: per-capita monthly income bands (S$) are mock values.
const B1 = "Up to S$450";
const B2 = "S$451 - S$700";
const B3 = "S$701 - S$1,000";
const B4 = "S$1,001 - S$1,500";

// ASSUMPTION: gross monthly household income bands (S$). A big household can be in a high household band
// while staying in a low per-capita band — reviewers need both, which is why they are shown side by side.
const H1 = "Up to S$1,500";
const H2 = "S$1,501 - S$2,500";
const H3 = "S$2,501 - S$4,000";
const H4 = "Above S$4,000";

/** The bands printed on the paper application form, offered when a school enters a hardcopy application. */
export const PAPER_INCOME_BANDS = { perCapita: [B1, B2, B3, B4], household: [H1, H2, H3, H4] };

// Applications are seeded against real student records so the queue can show each family's fee payable.
const of = (name: string) => STUDENTS.find((s) => s.name === name)!;

// ASSUMPTION: risk scores, recommended tiers and explanations are mock AI output.
// The two arrival channels are both seeded: the low per-capita / high-household cases came as MOE referrals
// (they fell out of the MOE assessment); higher-band families applied on paper and the school entered them.
const p = (
  id: string, student: string, incomeBand: string, householdBand: string, incomeSyncedOn: string,
  riskScore: number, recommendedTier: SbfasTier, slaDays: number, explanation: string,
): SbfasApplication => {
  const s = of(student);
  const source: SbfasSource = incomeBand === B1 || incomeBand === B2 ? "MOE referral" : "Hardcopy";
  return {
    id, student, studentId: s.id, level: s.level, incomeBand, householdBand, source,
    // Only referred applications are synced by the income API — a paper form carries its own bands.
    incomeSyncedOn: source === "MOE referral" ? incomeSyncedOn : undefined,
    riskScore, recommendedTier, slaDays, explanation, status: "Pending",
  };
};

// Foreign nationals cannot apply for either scheme, so none is seeded. Daniel Koh is the dual-citizen (Singapore + British) case.
// Handoff examples: High 89 / Medium 54 / Low 18.
export const SBFAS_APPLICATIONS: SbfasApplication[] = [
  p("SBFAS0001", "Kavitha d/o Raman", B1, H2, "2026-10-05", 89, "Tier 1", 1,
    "Per-capita income is in the lowest band and the household has 3 school-going children. Two fee payments were late in the last 12 months and the Education Account balance would not cover this term. Predicted difficulty meeting fees without support is high."),
  p("SBFAS0002", "Foo Mei Ling", B1, H1, "2026-10-05", 82, "Tier 1", 2,
    "Single-income household in the lowest band. Account balance covers under one month of fees. No arrears, but the model weighs the income band and household size heavily."),
  p("SBFAS0003", "Ethan Teo Kai Ming", B2, H2, "2026-10-08", 76, "Tier 2", 0,
    "Income band is low and a recent change in employment is flagged. Balance is low but stable. The model recommends Tier 2; Tier 1 would apply if the income change is confirmed."),
  p("SBFAS0005", "Yeo Rui En", B3, H3, "2026-10-10", 54, "Tier 3", 4,
    "Income band is moderate. Fee history is on time, but the household has one non-citizen dependant and a thin account balance. Predicted difficulty is moderate."),
  p("SBFAS0007", "Marcus Heng Zhe Yu", B4, H4, "2026-10-12", 36, "Tier 4", 7,
    "Income band is above the main support range. Fees have been paid on time every term. Low-moderate risk; Tier 4 gives a small top-up on fee components."),
  p("SBFAS0008", "Goh Yu Xuan", B4, H4, "2026-10-12", 28, "Tier 4", 5,
    "Income band is higher and the Education Account covers the full year of fees. Risk is low; the application may be better suited to a school-level discretionary decision."),
  p("SBFAS0009", "Lim Xin Yi", B4, H4, "2026-10-12", 18, "Tier 4", 8,
    "Income band is the highest in this queue and the account balance exceeds this year's fees. Predicted difficulty meeting fees is low."),
  p("SBFAS0010", "Adrian Pereira", B4, H4, "2026-10-11", 12, "Tier 4", 9,
    "No arrears, healthy balance, and a recent top-up. Very low predicted difficulty; kept in the queue only because the family applied."),
  p("SBFAS0011", "Sim Hui Min", B2, H3, "2026-10-11", 63, "Tier 2", 2,
    "Low income band with a recent medical expense flagged by the family. Balance is low. The model is less confident because the income band was updated this month."),
  p("SBFAS0012", "Arjun s/o Krishnan", B2, H2, "2026-10-06", 68, "Tier 2", 4,
    "Low income band and two school-going children. Balance covers about one term of fees. One late payment in the last 12 months."),
  p("SBFAS0013", "Meera d/o Ramasamy", B1, H1, "2026-10-06", 85, "Tier 1", 3,
    "Lowest income band in a single-income household. Balance would not cover this term and the application includes a flagged income drop."),
  p("SBFAS0014", "Siti Nurhaliza binte Osman", B3, H3, "2026-10-09", 47, "Tier 3", 6,
    "Moderate income band with on-time fee history. Balance is adequate for this term but trending down."),
  p("SBFAS0015", "Aqil Zafran bin Salleh", B2, H2, "2026-10-07", 72, "Tier 2", 1,
    "Low income band with 3 dependants. Exam fees fall due this term and the balance is below the expected total."),
  p("SBFAS0016", "Mohamed Danish bin Yusof", B3, H3, "2026-10-09", 45, "Tier 3", 7,
    "Moderate income band and stable fee history. Balance covers about two months of fees; partial support recommended."),
  p("SBFAS0017", "Deepa d/o Govindasamy", B2, H2, "2026-10-07", 66, "Tier 2", 5,
    "Low income band. No arrears, but the balance is thin and a CCA camp fee is due next month."),
  // Dual-citizen test case (Singapore + British) for the R4 nationality field on the review screen.
  p("SBFAS0018", "Daniel Koh Jun Wei", B3, H3, "2026-10-12", 52, "Tier 3", 3,
    "Moderate income band. Dual citizenship does not affect SBFAS eligibility. Fee history is on time and the balance is adequate."),
];
