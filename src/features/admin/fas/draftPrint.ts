import { childOutcomeNow, type FamilyApplication, type FamilyDraft } from "../../../data/familyApplications";
import type { SbfasApplication } from "../../../data/sbfasApplications";

// The printable pre-filled MOE FAS form (Sprint 3 refinement — Sherly's print-first flow): everything
// the registry knows is printed for the parent to CHECK; the household table and the declaration are
// left blank for the parent to fill and sign. Printed through a popup window so the app shell (sidebar,
// header, tabs) never lands on paper. Mock: real paper forms are PDF-generated; this renders the same
// content as HTML.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1512; margin: 32px auto; max-width: 760px; font-size: 13px; line-height: 1.45; }
  h1 { font-size: 17px; margin: 0; }
  .crest { width: 34px; height: 34px; border-radius: 50%; background: #8a2538; color: #fff; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; }
  header { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid #8a2538; padding-bottom: 10px; }
  header .sub { font-size: 12px; color: #5e5658; margin-top: 2px; }
  .notice { background: #f8f6f6; border: 1px solid #e4dddd; border-radius: 6px; padding: 10px 12px; margin: 14px 0; }
  .notice b { color: #8a2538; }
  h2 { font-size: 13px; margin: 20px 0 8px; color: #8a2538; text-transform: uppercase; letter-spacing: 0.4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #c9bfbf; padding: 6px 8px; text-align: left; vertical-align: top; font-size: 12px; }
  th { background: #f3eceb; font-weight: bold; }
  .blank td { height: 26px; }
  .kv { margin: 6px 0; }
  .kv b { display: inline-block; min-width: 130px; font-weight: bold; }
  .fillbox { border: 1px solid #c9bfbf; border-radius: 6px; background: #fcfbfb; padding: 8px 12px; margin: 12px 0; }
  .fillbox .fillhead { font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #8a2538; margin: 0 0 4px; }
  .fillbox .note { font-size: 11px; color: #5e5658; margin: 4px 0 0; }
  .check { margin: 6px 0 2px; }
  .box { display: inline-block; width: 13px; height: 13px; border: 1.5px solid #1a1512; margin-right: 8px; vertical-align: -2px; }
  ul { margin: 6px 0; padding-left: 18px; }
  .sign { margin-top: 26px; display: flex; gap: 40px; }
  .sign div { flex: 1; border-top: 1.5px solid #1a1512; padding-top: 5px; font-size: 12px; color: #5e5658; }
  footer { margin-top: 26px; border-top: 1px solid #e4dddd; padding-top: 8px; font-size: 11px; color: #5e5658; }
  @media print { body { margin: 0; } }
`;

/** The form as handed to the parent: registry fields pre-filled, the household table empty. */
export function draftHtml(d: FamilyDraft, schoolName: string): string {
  const rows = d.children
    .map((c) => `<tr><td>${esc(c.nric)}</td><td>${esc(c.name)}</td><td>${esc(c.school)}</td><td>${esc(c.level)}</td></tr>`)
    .join("");
  const issued = new Date(d.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return `<!doctype html><html><head><meta charset="utf-8"><title>MOE FAS form · ${esc(d.id)}</title><style>${STYLE}</style></head><body>
<header><span class="crest">MOE</span><div><h1>Ministry of Education — Financial Assistance Scheme (FAS)</h1>
<div class="sub">Application form, pre-filled for the family · issued by ${esc(schoolName)} · ${esc(d.id)} · ${issued}</div></div></header>

<div class="notice"><b>For the parent / guardian:</b> this form was pre-filled by ${esc(schoolName)} from the MOE registry on ${issued}.
Check every pre-filled field. If anything is wrong, tell the school office — <b>do not amend the pre-filled fields yourself</b>.
Then answer the contact-details question in Section I (Yes / No), fill in Section II (household income), read the declaration and sign.</div>

<h2>Section I — Particulars of the child</h2>
<table><tr><th>BC/NRIC No.</th><th>Name (Underline Surname)</th><th>Name of Current School</th><th>Current Level</th></tr>${rows}</table>
<p class="kv"><b>Parent / guardian:</b> ${esc(d.applicant)}</p>
<p class="kv"><b>Contact number:</b> ${esc(d.contact)}</p>
<p class="kv"><b>Home address:</b> ${esc(d.address)}</p>
${d.email ? `<p class="kv"><b>Email:</b> ${esc(d.email)}</p>` : ""}
<div class="fillbox">
  <p class="fillhead">Parent / guardian to fill — are these details still correct?</p>
  <p class="check"><span class="box"></span><b>Yes</b> — the contact number and home address printed above are still correct.</p>
  <p class="check"><span class="box"></span><b>No</b> — write the current details on the lines below.</p>
  <p class="kv"><b>Contact number:</b> _________________________________________</p>
  <p class="kv"><b>Home address:</b> _____________________________________________________________</p>
  <p class="note">Tick one box only. If anything changed, tick No and write your current number and address on the
lines — the school keys the returned form in from what you write here.</p>
</div>

<h2>Section II — Household income</h2>
<p class="kv"><b>Extra monthly money (S$):</b> ____________</p>
<p style="font-size:11px; color:#5e5658; margin: 2px 0 10px;">Income not in HOMES, e.g. rental, allowance or family support. Enter 0 if none.</p>
<p class="kv"><b>People currently living in your home:</b> ____________</p>
<p style="font-size:11px; color:#5e5658; margin: 2px 0 0;">Everyone who lives with you now, including you.</p>
<p style="font-size:12px; color:#5e5658; margin-top:10px;">The income band itself is retrieved from HOMES (IRAS + CPF) — you never need to state your exact income here.</p>

<h2>Section III — Declaration and agreement by the applicant</h2>
<ul>
<li>No child on this form receives financial assistance from more than one MOE-funded school or institution.</li>
<li>The applicant authorises monthly withdrawals from the child's Edusave account for school fees and approved expenses while on MOE FAS.</li>
<li>MOE and the schools may verify the information, reassess the household, and share the data needed to administer the scheme.</li>
<li>The information given is true — false information is an offence under Section 182 of the Penal Code 1871.</li>
</ul>
<div class="sign"><div>Signature of applicant</div><div>Name: ${esc(d.applicant)}</div><div>Date</div></div>

<footer>School use only — form issued under ${esc(d.id)} by ${esc(d.issuedBy)}. When the signed form is returned, hand it to the school
office: the staff keys it in against this draft and checks every field.</footer>
</body></html>`;
}

/** Opens the form in a print window. Returns false when the browser blocked the popup. */
export function openDraftPrint(d: FamilyDraft, schoolName: string): boolean {
  const w = window.open("", "_blank", "width=880,height=1000");
  if (!w) return false;
  w.document.write(draftHtml(d, schoolName));
  w.document.close();
  w.focus();
  w.print();
  return true;
}

/** The keyed-in application as a VERIFICATION COPY for the parent: the school prints it after
 *  key-in, the parent checks every field against what they wrote on the returned form — and if
 *  something is still wrong the school corrects THIS record in place, never a new application. */
export function verificationHtml(fa: FamilyApplication, linked: SbfasApplication[], schoolName: string): string {
  const flow2 = fa.children.length > 0 && fa.children.every((c) => c.outcome === "New SBFAS request");
  const rows = fa.children
    .map((c) => `<tr><td>${esc(c.student)}</td><td>${esc(c.level)}</td><td>${esc(childOutcomeNow(fa, c, linked).label)}</td></tr>`)
    .join("");
  const entered = new Date(fa.at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const docs = [...(fa.extraIncomeDocs ?? []), ...(fa.residentsDocs ?? [])];
  const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return `<!doctype html><html><head><meta charset="utf-8"><title>MOE FAS verification copy · ${esc(fa.id)}</title><style>${STYLE}</style></head><body>
<header><span class="crest">MOE</span><div><h1>Ministry of Education — Financial Assistance Scheme (FAS)</h1>
<div class="sub">Verification copy — what the school keyed in from your returned form · ${esc(fa.id)} · ${esc(schoolName)} · ${entered}</div></div></header>

<div class="notice"><b>For the parent / guardian:</b> this is the record the school keyed in from the form you returned. Check every field against what you wrote. If anything is still wrong, tell the school office — they will correct <b>this same application</b>; you never need to fill in a new form.</div>

<h2>Section I — Particulars of the child</h2>
<table><tr><th>Name</th><th>Current Level</th><th>Status now</th></tr>${rows}</table>
<p class="kv"><b>Parent / guardian:</b> ${esc(fa.applicant)}</p>
<p class="kv"><b>Contact number:</b> ${esc(fa.contact)}</p>
${fa.address ? `<p class="kv"><b>Home address:</b> ${esc(fa.address)}</p>` : ""}
${fa.email ? `<p class="kv"><b>Email:</b> ${esc(fa.email)}</p>` : ""}

<h2>Section II — Household income</h2>
<p class="kv"><b>Extra monthly money (S$):</b> ${fa.extraIncome !== undefined ? fa.extraIncome.toLocaleString("en-SG") : "—"}</p>
<p class="kv"><b>People currently living in your home:</b> ${fa.residents ?? "—"}</p>
<p class="kv"><b>Income band:</b> ${esc(fa.bandLabel)}</p>
${docs.length ? `<p class="kv"><b>Documents you handed in:</b> ${docs.map(esc).join(", ")}</p>` : ""}

<h2>Section III — Declaration and agreement by the applicant</h2>
<p class="kv"><b>Signed and dated by</b> ${esc(fa.applicant)}${fa.declaredAt ? ` on ${longDate(fa.declaredAt)}` : ""}.</p>
${fa.note ? `<p class="kv"><b>Anything else on the form:</b> ${esc(fa.note)}</p>` : ""}

<h2>Section IV — Where this form went</h2>
<p class="kv">${flow2 ? "To the school's SBFAS review queue — a separate request after an earlier rejection." : "To MOE for assessment at submission — children outside the MOEFAS bands were referred to their own school's SBFAS review queue."}</p>

<footer>School use only — application ${esc(fa.id)}, keyed in by ${esc(fa.enteredBy)}. Printed for the parent to check;
any correction after this check is made on this same application.</footer>
</body></html>`;
}

/** Opens the verification copy in a print window. Returns false when the browser blocked the popup. */
export function openVerificationPrint(fa: FamilyApplication, linked: SbfasApplication[], schoolName: string): boolean {
  const w = window.open("", "_blank", "width=880,height=1000");
  if (!w) return false;
  w.document.write(verificationHtml(fa, linked, schoolName));
  w.document.close();
  w.focus();
  w.print();
  return true;
}
