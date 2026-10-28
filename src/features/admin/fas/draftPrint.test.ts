import { describe, expect, it } from "vitest";
import { nextDraftId, type FamilyApplication, type FamilyDraft } from "../../../data/familyApplications";
import { draftHtml, verificationHtml } from "./draftPrint";

const draft: FamilyDraft = {
  id: "DRF-0001",
  status: "draft",
  guardianNric: "S1234567D",
  applicant: "Benson Chua",
  contact: "+65 8112 9743",
  address: "Blk 315 Ang Mo Kio Ave 3, #07-221, Singapore 560315",
  email: "benson.chua@example.com",
  children: [
    { studentId: "S20260009", name: "Ethan Lim Jun Hao", nric: "T1504644E", school: "Riverbank Primary School", level: "P5" },
    { studentId: "S20260010", name: "Chloe Lim Wen Xin", nric: "T1203822J", school: "Greenfield Secondary School", level: "Sec 2" },
  ],
  issuedAt: "2026-10-26",
  issuedBy: "Marcus Ong",
};

describe("nextDraftId", () => {
  it("runs the DRF-#### sequence from the highest existing draft", () => {
    expect(nextDraftId([])).toBe("DRF-0001");
    expect(nextDraftId([{ id: "DRF-0002" }])).toBe("DRF-0003");
  });
});

describe("the printed pre-filled form", () => {
  const html = draftHtml(draft, "Greenfield Secondary School");

  it("pre-fills the registry's own values for the parent to check", () => {
    expect(html).toContain("Ethan Lim Jun Hao");
    expect(html).toContain("T1203822J");
    expect(html).toContain("Riverbank Primary School");
    expect(html).toContain("Benson Chua");
    expect(html).toContain("DRF-0001");
  });

  it("tells the parent to check, not amend, the pre-filled fields", () => {
    expect(html).toContain("do not amend the pre-filled fields yourself");
  });

  it("leaves the household fields and the signature for the parent to fill by hand", () => {
    expect(html).toContain("Section II — Household income");
    expect(html).toContain("Extra monthly money");
    expect(html).toContain("People currently living in your home");
    expect(html).toContain("Section III — Declaration");
    expect(html).toContain("Signature of applicant");
    expect(html).toContain("Benson Chua</div><div>Date");
  });

  it("asks the parent yes / no whether the printed contact details still stand, with lines for new ones", () => {
    expect(html).toContain("Parent / guardian to fill — are these details still correct?");
    expect(html).toContain("<b>Yes</b> — the contact number and home address printed above are still correct.");
    expect(html).toContain("<b>No</b> — write the current details on the lines below.");
    expect(html).toContain("Tick one box only");
    // Two fill-in lines in Section I: the pre-filled values stay for checking, the blanks carry what the parent writes.
    expect((html.match(/Contact number:<\/b> ___/g) ?? []).length).toBe(1);
    expect((html.match(/Home address:<\/b> ___/g) ?? []).length).toBe(1);
    expect(html.indexOf("Home address:</b> ___")).toBeGreaterThan(html.indexOf("Home address:</b> Blk 315"));
  });
});

describe("the printed verification copy", () => {
  const familyApp: FamilyApplication = {
    id: "FAS20260005", channel: "Hardcopy", school: "Greenfield Secondary School",
    applicant: "Benson Chua", contact: "+65 9000 1234",
    address: "Blk 808 Jurong West Ave 1, #10-101, Singapore 640808",
    contactCorrected: true, bandLabel: "$1,001 - $1,500 per person",
    extraIncome: 350, residents: 5, extraIncomeDocs: ["Payslip_Oct_2026.pdf"],
    declaredAt: "2026-10-27", note: "Writes slowly; office helped by phone.",
    enteredBy: "Marcus Ong", entryMode: "manual", at: "2026-10-27T09:00:00.000Z",
    children: [{ studentId: "S20260010", student: "Chloe Lim Wen Xin", level: "Sec 2", outcome: "MOEFAS not granted" }],
  };
  const html = verificationHtml(familyApp, [], "Greenfield Secondary School");

  it("shows the keyed-in record for the parent to check, field by field", () => {
    expect(html).toContain("Verification copy");
    expect(html).toContain("FAS20260005");
    expect(html).toContain("Chloe Lim Wen Xin");
    expect(html).toContain("SBFAS pending"); // the live per-child status, like the screen's badge
    expect(html).toContain("+65 9000 1234");
    expect(html).toContain("Blk 808 Jurong West Ave 1, #10-101, Singapore 640808");
    expect(html).toContain("<b>Extra monthly money (S$):</b> 350");
    expect(html).toContain("<b>People currently living in your home:</b> 5");
    expect(html).toContain("$1,001 - $1,500 per person");
    expect(html).toContain("Payslip_Oct_2026.pdf");
    expect(html).toContain("Signed and dated by</b> Benson Chua on 27 October 2026");
  });

  it("tells the parent a correction edits THIS application, never a new form", () => {
    expect(html).toContain("Check every field against what you wrote");
    expect(html).toContain("they will correct <b>this same application</b>");
    expect(html).toContain("you never need to fill in a new form");
  });
});
