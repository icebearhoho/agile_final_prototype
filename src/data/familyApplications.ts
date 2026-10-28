import type { SbfasApplication, SbfasTier } from "./sbfasApplications";

// ASSUMPTION: paper family applications entered by School users live in memory only and reset on
// reload, like the rest of the FAS store. The seeded FAMILIES on the HQ screen (moefas.ts) are the
// e-Service arrivals from before this session; hardcopy submissions start the sequence after them.

/** How the family reached MOE: the parent portal, or a paper form the school scanned in. */
export type FamilyChannel = "e-Service" | "Hardcopy";
/** Per-child MOE assessment result. "not granted" cases are referred down to the school's SBFAS queue;
 * "New SBFAS request" is flow 2 — a separate request handed in after a rejection, straight to the queue. */
export type FamilyOutcome = "MOEFAS granted" | "MOEFAS not granted" | "Already covered" | "New SBFAS request";
/** Section IV of the MOE form. School bus is only offered at the primary level. */
export type TransportMode = "Public transport" | "School bus" | "Own transport or walks";
/** Section II row: one household member and their income, as declared on the paper form. */
export type HouseholdMember = { name: string; nric?: string; relationship: string; age: number; occupation: string; gross: number; other: number };

export type FamilyChild = {
  studentId: string;
  student: string;
  level: string;
  outcome: FamilyOutcome;
  /** Set when MOEFAS was granted; the tier the child received. */
  tier?: SbfasTier;
};

export type FamilyApplication = {
  /** FAS2026#### — continues after the seeded e-Service applications (0001–0004). */
  id: string;
  channel: FamilyChannel;
  /** Name of the school the paper form was submitted to ("Form submitted to" on the MOE form). */
  school: string;
  applicant: string;
  contact: string;
  /** Section I of the MOE form. */
  address?: string;
  email?: string;
  /** True when the parent ticked No on the returned form's contact-details question — `contact` and
   *  `address` are the values they wrote by hand, replacing what the issued form was printed with. */
  contactCorrected?: boolean;
  /** Income band read off the paper form — a band only, never an exact income. */
  bandLabel: string;
  /** Sprint 3 parity with the online form: the two household fields the parent declares — money not
   *  in HOMES and everyone living at home. The band itself still comes from HOMES. */
  extraIncome?: number;
  residents?: number;
  /** Section II: true when the household declared other administrative income (table keyed in); false = HOMES-only. */
  hasAdminIncome?: boolean;
  /** Section II table, present only when hasAdminIncome. */
  household?: HouseholdMember[];
  /** Section II exception: a letter from an approved welfare home replaces the household table. */
  welfareHome?: boolean;
  /** The welfare home letter scanned in with the form (PDF); home/dated are the OCR reading of it. */
  welfareLetter?: { file: string; home?: string; dated?: string };
  /** Section II: true when the household declared employment/trade income only — no other
   *  administrative income — so no table was keyed and the bands come from HOMES (IRAS + CPF). */
  homesOnly?: boolean;
  /** Section V: whether the parent asked the school for a hard copy of the IMDA DigitalAccess@Home form. */
  imdaHardcopy?: "yes" | "no";
  /** Section IV. */
  transportMode?: TransportMode;
  /** "Anything else on the form" (flow 1) or what changed since the rejected request (flow 2). */
  note?: string;
  /** Section II evidence handed in with the returned form — one upload slot per declaration, keeping
   *  what the parent brought in attached to the answer it backs (mock demo: file names only, nothing
   *  is uploaded anywhere). */
  extraIncomeDocs?: string[];
  residentsDocs?: string[];
  /** Section III: the paper declaration was signed by the applicant on this date (ISO). */
  declaredAt?: string;
  /** Staff member who keyed the form in. */
  enteredBy: string;
  /** The scanned form PDF the School user uploaded (OCR entry only); MOE can open it from the application. */
  formFile?: string;
  /** "ocr" = the form was scanned and the fields pre-filled, then verified by `enteredBy`. */
  entryMode: "manual" | "ocr";
  at: string;
  children: FamilyChild[];
};

// The seeded FAMILIES use FAS20260001–0010, so live hardcopy submissions continue from 0011.
// The sequence is the digits minus the FAS-2026 year prefix — parsing the whole id would fold the
// year into the number and double it on the second record (FAS202620260006).
const BASE = 10;
const seqOf = (id: string) => Math.max(0, (Number(id.replace(/\D/g, "")) || 0) - 20260000);
export const nextFamilyId = (apps: Pick<FamilyApplication, "id">[]) =>
  `FAS2026${String(apps.reduce((m, a) => Math.max(m, seqOf(a.id)), BASE) + 1).padStart(4, "0")}`;

// ---- Issued-form drafts (Sprint 3 refinement: print the form first, key in the returned copy) ----

/** One child as printed on the pre-filled form — the registry's own values, verbatim. */
export type DraftChild = { studentId: string; name: string; nric: string; school: string; level: string };

/** A pre-filled form the school generated and printed for the parent BEFORE any data entry. The
 *  parent checks the pre-filled fields, declares the household income and signs; when the signed
 *  paper comes back, the staff keys it in on the New form tab and checks it against this draft —
 *  the draft is the system's memory of exactly what was issued (Sherly, Sprint 3 refinement).
 *  The record is MANDATORY: every issued form is stored so the school always knows which children
 *  hold a form, and it stays "draft" until the signed copy is keyed in against it. */
export type FamilyDraft = {
  /** DRF-#### sequence. */
  id: string;
  /** "draft" = printed and with the parent, awaiting the signed copy; "returned" = the signed copy
   *  came back and was keyed in as `returnedAppId` — the register keeps it for the audit trail. */
  status: "draft" | "returned";
  /** The parent/guardian NRIC the form was issued under — the key the returned form is matched by. */
  guardianNric: string;
  applicant: string;
  contact: string;
  address: string;
  email?: string;
  children: DraftChild[];
  /** ISO date the form was printed and handed to the parent. */
  issuedAt: string;
  issuedBy: string;
  /** The FAS2026#### application the returned copy became — set when the status flips to "returned". */
  returnedAppId?: string;
  /** ISO date the signed copy was keyed in against the draft. */
  returnedAt?: string;
};

export const nextDraftId = (drafts: Pick<FamilyDraft, "id">[]) =>
  `DRF-${String(drafts.reduce((m, d) => Math.max(m, Number(d.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(4, "0")}`;

/** Plain-English sentence for a child's outcome row, shared by the school tab and the HQ card. */
export const outcomeNote = (c: FamilyChild): string =>
  c.outcome === "MOEFAS granted"
    ? `MOEFAS ${c.tier} granted automatically — full subsidy applied to eligible fees.`
    : c.outcome === "Already covered"
      ? "Already covered — this child held an application or grant when the form came in; listed as on the form, nothing duplicated (AC-031)."
      : c.outcome === "New SBFAS request"
        ? "A separate request after a rejection — straight to the school's SBFAS review queue (MOEFAS not re-assessed)."
        : "MOEFAS not granted — referred to the school's SBFAS review queue.";

/** Live per-child outcome for the history lists. The stored `outcome` is the MOE assessment snapshot
 *  from submit time; the school's later SBFAS decision lands on the linked queue application, so a
 *  referred child reads its current status from there (pending → granted / not granted). */
export type ChildOutcomeNow = { label: string; kind: "granted" | "pending" | "rejected" | "neutral" };
export function childOutcomeNow(
  fa: FamilyApplication,
  c: FamilyChild,
  apps: Pick<SbfasApplication, "studentId" | "familyAppId" | "status" | "sbfasTier" | "attemptNo">[],
): ChildOutcomeNow {
  if (c.outcome === "MOEFAS granted") return { label: `MOEFAS granted${c.tier ? ` · ${c.tier}` : ""}`, kind: "granted" };
  if (c.outcome === "Already covered") return { label: "Already covered", kind: "neutral" };
  // "MOEFAS not granted" (referred down) and "New SBFAS request" (flow 2) both sit in the school's queue.
  const linked = apps
    .filter((a) => a.studentId === c.studentId && a.familyAppId === fa.id)
    .sort((a, b) => (b.attemptNo ?? 1) - (a.attemptNo ?? 1))[0];
  if (!linked || linked.status === "Pending") return { label: "SBFAS pending", kind: "pending" };
  if (linked.status === "Rejected") return { label: "SBFAS not granted", kind: "rejected" };
  return { label: `SBFAS granted${linked.sbfasTier ? ` · ${linked.sbfasTier}` : ""}`, kind: "granted" };
}
