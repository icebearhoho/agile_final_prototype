# SBFAS — Functional Specification (for QA)

**Scope:** School-based FAS (SBFAS) as implemented in the Admin Portal (`/admin/fas`, role: School user), including its integration with fees.
**Source of truth:** this documents the *current build* — every rule below is testable on the deployed app. Mock data only; nothing is persisted (reload resets state).
**Related spec:** MOEFAS follows the same screen rules; see "MOEFAS precedence" below. This document focuses on SBFAS.

---

## 1. Functional overview

| # | Function | Where |
|---|---|---|
| F1 | SBFAS review queue with AI risk rating and SLA countdown | FAS → *SBFAS review queue* table |
| F2 | Decision workflow: Approve / Override / Reject with validation | Review modal |
| F3 | Decision history: Granted and Declined tabs | Filter buttons above the table |
| F4 | Fee context per application: Fee payable vs Account balance (top-ups) | Two columns + review modal block |
| F5 | SBFAS outcome reflected in fees payable (subsidy on issued charges) | Fee → Student fees; charge modal |
| F6 | Payment recording against subsidised charges | Charge modal → *Record a payment* |

---

## 2. Data fields

### 2.1 SBFAS application (`SbfasApplication`)

| Field | Type | Values / format | Notes |
|---|---|---|---|
| `id` | string | `FAS-20xx` | Displayed under the student name |
| `student` | string | full name | Must match the student record exactly (test: seeded rows all link) |
| `studentId` | string | `S2026xxxx` | Links the application to the student's account & charges |
| `level` | string | e.g. `P5`, `Sec 2` | Comes from the student record |
| `incomeBand` | string | `Up to S$450` / `S$451 - S$700` / `S$701 - S$1,000` / `S$1,001 - S$1,500` | Per-capita household income **band only** — exact income never appears anywhere |
| `riskScore` | number | 0–100 | Higher = more likely to struggle |
| `recommendedTier` | enum | `Tier 1..4` | Tier 1 = highest subsidy. AI recommendation |
| `slaDays` | number | integer | Working days **left** to decide |
| `explanation` | string | free text | AI explanation shown in the review modal |
| `status` | enum | `Pending` / `Approved` / `Overridden` / `Rejected` | Set only via a decision |
| `sbfasTier` | enum? | `Tier 1..4` / absent | The SBFAS tier granted; absent when Rejected or still Pending |
| `justification` | string? | free text | Mandatory for Override; stored with the decision |

### 2.2 Student record (SBFAS-relevant fields)

| Field | Type | Values | Notes |
|---|---|---|---|
| `sbfas` | enum | `Approved` / `Pending` / `Rejected` / `Not applied` | School-level scheme status |
| `moefas` | enum | same | MOE-level scheme; see precedence rule BR1 |
| `balance` | number | SGD | Education Account balance — **top-up money**, not FAS money |

### 2.3 Charge (fee integration)

| Field | Type | Notes |
|---|---|---|
| `fas` | enum? | `MOEFAS` / `SBFAS` / absent — the scheme **stamped at issue time** whose subsidy was applied |
| `components[].subsidy` | number | Per-component subsidy in SGD, computed at issue time |
| `payments[]` | array | `{ id, on, amount, method: "Education account" \| "Card / PayNow" }` |

---

## 3. Business rules

### Decisions & history

- **BR1 — Mutual exclusion, MOEFAS first.** A student never receives both schemes. Effective scheme = `moefas === "Approved" ? MOEFAS : sbfas === "Approved" ? SBFAS : none`. If a record somehow holds both `Approved`, **MOEFAS wins and SBFAS is ignored** (never stacked).
- **BR2 — Approve.** Sets `status = Approved`, `sbfasTier = recommendedTier`. No justification required.
- **BR3 — Override.** Requires (a) a non-blank justification and (b) a tier **different** from the recommendation — otherwise the action is blocked with a field error. Sets `status = Overridden`, `sbfasTier = chosen tier`.
- **BR4 — Reject.** Sets `status = Rejected`, clears `sbfasTier`. Justification optional.
- **BR5 — History tabs.** Granted = `Approved ∪ Overridden`. Declined = `Rejected`. Pending appears in neither. Counts on the tab labels must match the table contents.
- **BR6 — Queue order.** Pending applications first, then highest `riskScore` first. Decided rows keep their risk order after the pending block.
- **BR7 — SLA.** `slaDays ≤ 0` renders a red **Overdue** badge; `slaDays ≤ 2` highlights the count in warning colour. Decided rows show *Closed* (SLA no longer applies).

### AI

- **BR8 — Risk levels.** `score < 35 → Low`, `35 ≤ score < 70 → Medium`, `≥ 70 → High` (badge `Low|Medium|High - score`).
- **BR9 — AI is advisory.** The officer can always Approve the recommendation, Override to any other tier (BR3), or Reject. Nothing is auto-decided.

### Fees & money

- **BR10 — Subsidy rates (current build).** MOEFAS = **50%**, SBFAS = **20%** of each component, applied **when the charge is generated** (`ASSUMPTION` in code: flat rates; per-component tiers are a later sprint). A charge keeps the subsidy it was issued with even if statuses change later.
- **BR11 — Subsidy ≠ top-up.** The FAS subsidy **reduces the fee** the family owes. MOE top-ups **credit the Education Account balance**. They are computed, stored and displayed separately: *Fee payable* column = Σ remaining balance of the student's unpaid charges; *Account balance* column = the student's top-up balance. One never alters the other.
- **BR12 — Derived charge status.** `paid` when payments cover the payable (`≤ S$0.005` remaining); else `overdue` when `due < today`; else `outstanding`. Status is never stored — recording a payment can flip a row to *paid* live.
- **BR13 — Payment methods.** A payment is recorded against one charge only, amount > 0 with ≤ 2 decimals, and cannot exceed the remaining balance. Method is either *Education account* (draws the top-up balance conceptually) or *Card / PayNow* (gateway). Partial payments are allowed; each gets a reference `CH-xxxx-Pn`.

---

## 4. QA checklist (smoke)

1. Queue loads 12 seeded applications; every student name links to that student's fees page.
2. Open review → block shows **Fee payable** (red) + **Account balance (top-ups)** + the "two different things" note.
3. Approve a High-risk app → tab **Granted** +1, row badge `Approved - Tier n`; Pending −1.
4. Override without justification → blocked, focus jumps to justification. Override to the same tier → blocked. Valid override → `Overridden - Tier n`.
5. Reject an app → tab **Declined** +1, badge `Rejected`.
6. Find an SBFAS-approved student in Fee → Student fees: FAS column shows `SBFAS − S$x`; charge modal shows the subsidy block and the subsidy ≠ top-up note.
7. Record a payment on that charge (try an amount above the remaining → rejected; exact amount → status flips to *paid*, reference `CH-…-P1` appears).
8. Reload the page — everything resets (in-memory mock): queue back to 12 Pending.

**Known gaps (not bugs):** the tier chosen (Tier 1–4) does not yet change the subsidy rate (flat 20% — BR10); decisions do not write back to the student's `sbfas` field on the fly; MOEFAS auto-grant and the income-band API are separate stories.
