// Sprint 3 refinement (Sherly, 26 Oct 2026): the school user keys in ONLY the parent/guardian NRIC —
// the applicant, contact, address and every child of the family come from the shared MOE registry
// (all MOE schools keep one database), and the registry's child rows are NOT editable: a difference
// between the paper form and the registry means the form was filled in wrongly, not the database.
// A family application covers every child, including children at other schools.
// ASSUMPTION: mock guardian links — the real student record would carry the guardian NRIC.
// Children are matched by name, the same way the rest of the app links families to students.

export type GuardianRecord = {
  /** The NRIC on the paper form's declaration — the lookup key. */
  nric: string;
  name: string;
  relationship: "Father" | "Mother" | "Guardian";
  contact: string;
  address: string;
  email?: string;
  /** Student names, resolved against the registry when the lookup runs. */
  children: string[];
};

// The Chua family mirrors the OCR demo form: one child at Riverbank Primary, one at Greenfield
// Secondary — a cross-school family, so the demo shows both "Your school" and "Other school" rows.
export const GUARDIANS: GuardianRecord[] = [
  {
    nric: "S1234567D", name: "Benson Chua", relationship: "Father",
    contact: "+65 8112 9743", address: "Blk 315 Ang Mo Kio Ave 3, #07-221, Singapore 560315",
    email: "benson.chua@example.com",
    children: ["Ethan Lim Jun Hao", "Chloe Lim Wen Xin"],
  },
  {
    nric: "S9876543B", name: "Jenny Chua", relationship: "Mother",
    contact: "+65 8112 9743", address: "Blk 315 Ang Mo Kio Ave 3, #07-221, Singapore 560315",
    children: ["Ethan Lim Jun Hao", "Chloe Lim Wen Xin"],
  },
  {
    nric: "S6908141C", name: "Catherine Seah", relationship: "Mother",
    contact: "+65 9722 4085", address: "Blk 418 Jurong West St 42, #11-107, Singapore 650418",
    email: "catherine.seah@example.com",
    children: ["Bernice Seah Xin Rong"],
  },
];

/** Case and spacing tolerant NRIC match — the same normalisation the child rows use. */
export const normNric = (v: string) => v.trim().replace(/\s+/g, "").toUpperCase();

export const guardianByNric = (v: string) => GUARDIANS.find((g) => normNric(g.nric) === normNric(v));
