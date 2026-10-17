import { STUDENTS } from "./students";

export type SbfasTier = "Tier 1" | "Tier 2" | "Tier 3" | "Tier 4";
export type SbfasStatus = "Pending" | "Approved" | "Overridden" | "Rejected";

export type SbfasApplication = {
  id: string;
  /** Display name; `studentId` links the application to the student's Education Account, fees and FAS subsidy. */
  student: string;
  studentId: string;
  level: string;
  /** Per-capita household income BAND only; the third-party income API never returns exact income. */
  incomeBand: string;
  /** AI risk score 0-100 (higher = more likely to struggle with fees). Level comes from riskLevel(). */
  riskScore: number;
  recommendedTier: SbfasTier;
  /** Working days left to decide. 0 or below = overdue. */
  slaDays: number;
  explanation: string;
  status: SbfasStatus;
  sbfasTier?: SbfasTier;
  justification?: string;
};

// ASSUMPTION: tier names (Tier 1 = highest subsidy), band edges and SLA length are invented; confirm with MOE.
export const SBFAS_TIERS: SbfasTier[] = ["Tier 1", "Tier 2", "Tier 3", "Tier 4"];

// ASSUMPTION: per-capita monthly income bands (S$) are mock values.
const B1 = "Up to S$450";
const B2 = "S$451 - S$700";
const B3 = "S$701 - S$1,000";
const B4 = "S$1,001 - S$1,500";

// Applications are seeded against real student records so the queue can show each family's fee payable.
const of = (name: string) => STUDENTS.find((s) => s.name === name)!;

const p = (
  id: string, student: string, incomeBand: string, riskScore: number,
  recommendedTier: SbfasTier, slaDays: number, explanation: string,
): SbfasApplication => {
  const s = of(student);
  return { id, student, studentId: s.id, level: s.level, incomeBand, riskScore, recommendedTier, slaDays, explanation, status: "Pending" };
};

// Handoff examples: High 89 / Medium 54 / Low 18.
export const SBFAS_APPLICATIONS: SbfasApplication[] = [
  p("FAS-2041", "Kavitha d/o Raman", B1, 89, "Tier 1", 1,
    "Per-capita income is in the lowest band and the household has 3 school-going children. Two fee payments were late in the last 12 months and the Education Account balance would not cover this term. Predicted difficulty meeting fees without support is high."),
  p("FAS-2042", "Foo Mei Ling", B1, 82, "Tier 1", 2,
    "Single-income household in the lowest band. Account balance covers under one month of fees. No arrears, but the model weighs the income band and household size heavily."),
  p("FAS-2043", "Ethan Teo Kai Ming", B2, 76, "Tier 2", 0,
    "Income band is low and a recent change in employment is flagged. Balance is low but stable. The model recommends Tier 2; Tier 1 would apply if the income change is confirmed."),
  p("FAS-2044", "Ang Li Ying", B2, 71, "Tier 2", 3,
    "Income band is low with 2 dependants. Exam fees are due this term and the Education Account balance is below the expected total."),
  p("FAS-2045", "Yeo Rui En", B3, 54, "Tier 3", 4,
    "Income band is moderate. Fee history is on time, but the household has one non-citizen dependant and a thin account balance. Predicted difficulty is moderate."),
  p("FAS-2046", "Tay Jing Wen", B3, 49, "Tier 3", 5,
    "Moderate income band with stable fee history. Balance covers about two months of fees. Recommended tier reflects partial support only."),
  p("FAS-2047", "Chua Jia Hui", B3, 41, "Tier 3", 6,
    "Income band is on the edge of the moderate range. No arrears. The model sees a small risk because the balance is trending down."),
  p("FAS-2048", "Marcus Heng Zhe Yu", B4, 36, "Tier 4", 7,
    "Income band is above the main support range. Fees have been paid on time every term. Low-moderate risk; Tier 4 gives a small top-up on fee components."),
  p("FAS-2049", "Goh Yu Xuan", B4, 28, "Tier 4", 5,
    "Income band is higher and the Education Account covers the full year of fees. Risk is low; the application may be better suited to a school-level discretionary decision."),
  p("FAS-2050", "Lim Xin Yi", B4, 18, "Tier 4", 8,
    "Income band is the highest in this queue and the account balance exceeds this year's fees. Predicted difficulty meeting fees is low."),
  p("FAS-2051", "Adrian Pereira", B4, 12, "Tier 4", 9,
    "No arrears, healthy balance, and a recent top-up. Very low predicted difficulty; kept in the queue only because the family applied."),
  p("FAS-2052", "Sim Hui Min", B2, 63, "Tier 2", 2,
    "Low income band with a recent medical expense flagged by the family. Balance is low. The model is less confident because the income band was updated this month."),
];
