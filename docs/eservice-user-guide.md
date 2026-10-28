# MOE e-Service: Parent User Guide

## Part A — Parent guide

### [GEN-01] What the e-Service is

The e-Service is the parent and guardian portal for MOE school fees. In it you can:

- see what you owe for each child and pay it (in full or in part),
- see each child's Education Account balance and every transaction,
- look up paid invoices and their details,
- apply for Financial Assistance (FAS) for the whole family and follow its result,
- keep your contact details up to date.

### [GEN-02] Your children

Children appear automatically once their Education Account is opened (at age 7). You do not add them yourself. Each child's name, level and school come from the school's records. If a child is missing, the portal shows "No children linked" — contact the school or MOE (see [HELP-01]).

### [GEN-03] The layout of every page

| Part | Where | What it means / does |
|---|---|---|
| **Sidebar** | Left | The menu. Icons, top to bottom: **Overview** (house), **Payments** (card), **Transactions** (receipt), **Financial Assistance Scheme** (hand with heart), **Settings** (gear). The highlighted icon is the page you are on. Hover an icon to see its name. |
| Expand / collapse button | Bottom of the sidebar | Shows the menu with names, or back to icons only. |
| **Sign out** button | Very bottom of the sidebar | Ends your session and returns to the sign-in page. |
| **Page title** | Top left | The name of the page you are on. |
| **Bell** | Top right | Notifications. The red dot means there is something unread. *(assumption: notifications are not built yet)* |
| **Circle with initials** | Top right | You, the signed-in parent. Hover it to see your full name. |
| **Ask MOE Assistant** | Bottom right | Opens the chatbot (see [AI-01]). |

### [GEN-04] Colours and badges used everywhere

| You see | Meaning |
|---|---|
| Red amount or red **Overdue** badge | Past its due date and not paid. |
| Grey **Unpaid** badge | Not paid yet, but not late. |
| Amber **Payment due** badge | A child has something to pay, none of it late. |
| Green **Paid** / **Paid up** badge | Nothing left to pay. |
| Green amount with **+** and a down arrow | Money **into** an Education Account (top-up or refund). |
| Amount with **−** and an up arrow | Money **out** (a payment). |
| Pulsing grey blocks | The page is loading. |
| "Could not load …" with **Retry** | Loading failed. Check your connection and press **Retry**. |

---

### [OV-01] Overview page

The first page after sign-in. It answers "what do I owe, and how are my children's accounts?".

**Left column, top to bottom**

| Part | What it means |
|---|---|
| **Amount to pay** | The total still owed on all unpaid and overdue invoices, for all children. The number turns **red** if anything is overdue. Below it: how many invoices are unpaid and how many are overdue. When nothing is owed it reads **You are all paid up**. |
| **Pay now** button | Pays **all** open invoices at once (see [PAY-02]). Only shown when something is owed. |
| Education Account note (shaded box) | How much of the total the children's Education Accounts will cover **automatically**, and what is left for you to pay by card or bank. If the accounts are empty, the whole amount goes by card or bank. |
| **Next payment due** | The earliest upcoming due date (not counting overdue invoices) and the total due that day. "Only overdue invoices are left" or "Nothing coming up" when there is no upcoming date. |
| **Paid this year** | The total of all invoices already paid. |
| **Invoices to pay** | Up to 5 open invoices, overdue first then by due date. Each shows fee name, child, due date, status badge, amount and a **Pay** button for just that invoice. "Showing 5 of N" means there are more — see **Payments**. |
| **Your children** | One row per child: name, level · school, **Education Account** balance, **To pay** (that child's open invoices), and a badge — *Paid up*, *Payment due* or *Overdue*. |

**Right column**

| Part | What it means |
|---|---|
| **Financial assistance (FAS)** | Your family application. Badge: *Not started*, *In progress* (draft), *Pending* (a school is still deciding), *Granted* (at least one child got assistance) or *Declined*. After submitting, it lists the reference number, submit date and each child's result. The button takes you to the FAS page. |
| **Recent transactions** | The last 5 movements on the Education Accounts and card payments. **Transactions** opens the full list. |
| **Your details** | Your name, contact number and mailing address. **Settings** lets you change them. |

---

### [PAY-01] How paying works (the rules)

1. **One way to pay.** You never choose a method. The system:
   - uses each child's **Education Account first**, and only for **that child's own** invoices (never a sibling's),
   - sends **whatever is left** to **card or bank** through the payment gateway.
2. **Part payment is possible**, in two ways:
   - pay only **some invoices** (tick only those), or
   - pay only **some fee items inside an invoice** (tick the items you want, see [PAY-03]).
3. If a child's balance covers only part of what you picked, the account pays that part and the rest goes by card or bank. If the account covers everything, no card or bank payment is needed.
4. Amounts shown are what you still owe **after any FAS subsidy**.

**Behind the scenes:** when a payment succeeds, each fee item you paid gets a payment record on the school's fee record — one from the Education Account and, if needed, one by Card / PayNow. The account share is taken off the child's balance straight away, so the school, MOE and you all see the same numbers.

### [PAY-02] Paying fees, step by step

1. Open **Payments**.
2. Choose what to pay:
   - tick **Select all unpaid and overdue** to pay everything, or
   - tick an invoice to pay all of it, or
   - tick single fee items under an invoice to pay only those.
3. Check the **Payment summary** (right side; on a phone, the total and button stay in a bar at the bottom).
4. Press **Pay $X** (or **Pay now** on a phone).
5. The **Confirm your payment** window shows the total and the split. Press **Pay $X** (the card or bank part) or **Confirm payment** if the account covers it all. **Cancel** goes back without paying.
6. *Processing payment, please wait…* — don't close the window.
7. **Payment successful** shows the amount. Press **Done**. A green message at the top says "Payment of $X received for N invoice(s)". The invoices update, the balances drop, and the payment appears in **Transactions**.

From the Overview you can also press **Pay now** (all open invoices) or **Pay** on one invoice; you go straight to step 5.

### [PAY-03] The Payments page, part by part

| Part | What it means |
|---|---|
| **Education Account balances** | One card per child with the current balance. Once you tick something, it also shows "Using $X for this payment" — how much will come out of that child's account. |
| "You have to pay $X across N invoices" | The total still owed, with the number of overdue invoices in red. |
| **Outstanding invoices** | Only invoices with something left to pay (paid ones are under **Transactions → Invoices**). Overdue first, then by due date. |
| **Select all unpaid and overdue (N)** | Ticks or unticks every invoice. Shows a dash when only some are ticked. |
| Invoice row | Checkbox, child's initial, fee name, child's name and a due line, the invoice number, the amount still owed and a status badge. |
| Due line | "Due in 19 days – 31 Oct 2026", "Due today", or "Overdue by 12 days – was due …" (red). |
| Invoice checkbox | Ticked = the whole invoice is being paid. A **dash** = only some of its fee items are ticked. |
| Fee items (indented list under an invoice) | Each fee item still owed on that invoice with its amount. Tick an item to pay just that item. |
| **Payment summary** | **Total to pay** for what you ticked and which children it's for; a line per child; then **From Education Account** and **By card or bank**. "Tick an invoice to get started" when nothing is ticked. |
| Pay button | Disabled ("Choose invoices to pay") until something is ticked. |
| "You'll review everything before any money moves." | Nothing is charged until you confirm in the next window. |
| **All invoices are paid** | Nothing is owed right now. |

### [PAY-04] When a payment fails

You see **Payment not completed — The gateway declined this payment**.

- **Nothing was charged** and your invoices are unchanged (no account money is taken either).
- Press **Try again** to go back to the confirmation, or **Close**.

*The checkbox "Demo only: simulate a failed payment" in the confirmation window exists only in this prototype.*

### [PAY-05] Overdue invoices

An invoice is **overdue** when its due date has passed and something is still owed. It shows in red on the Overview and Payments pages and is listed first. Pay it like any other invoice ([PAY-02]). Its status is worked out each time from the due date and the payments, so as soon as it is fully paid it shows **Paid**.

### [PAY-06] The payment window, stage by stage

| Stage | What you see | What you can do |
|---|---|---|
| **Review** | *Confirm your payment*: total, From Education Account, By card or bank. "Fully covered by the Education Account…" if nothing goes by card. | **Pay $X** / **Confirm payment**, or **Cancel**. |
| **Cancelled** | The window closes. | Nothing was paid or changed. |
| **Processing** | *Processing payment, please wait…* (about 1.5 seconds). | Nothing — the window can't be closed. A payment fully covered by the account also passes through this stage. |
| **Successful** | *Payment successful* and the amount paid. | **Done**. The payment is recorded and balances update. |
| **Failed** | *Payment not completed — The gateway declined this payment.* | **Try again** (back to Review) or **Close**. Nothing was charged. |

---

### [ACC-01] Education Account

Each child has their own Education Account, opened at age 7. *(assumption: it closes at 16 and any balance moves to CPF)*

- **Where to see it:** Overview (**Your children**) and the top of **Payments**.
- **Goes up** when MOE tops it up or a refund is made (shown as **MOE top-up**, green **+**).
- **Goes down** when it pays that child's fees (shown as **Education account**, **−**).
- **Card payments don't change it** — they are listed in Transactions but are paid from your card or bank.
- A child's balance is **never** used for a sibling's fees.

### [INV-01] How an invoice works

An invoice is one fee the school charges one child (for example "School Fees (Secondary)").

| Part of an invoice | Meaning |
|---|---|
| **Invoice number** | The reference, e.g. CH-1013. |
| **Bill date** | When the school issued it. |
| **Due date** | When it must be paid. *(assumption: 30 days after the bill date unless the school sets another date)* |
| **Fee items** | What the fee is made of, e.g. Miscellaneous, Learning Materials, Enrichment, Student Insurance, each with an amount. |
| **Subsidy** | The FAS amount taken off an item (see [FAS-06]). |
| **Paid** | What has been paid on an item so far. |
| **Outstanding** | Amount − Subsidy − Paid, never below $0. |

**Totals:** the amount you owe = all items' amounts − all subsidies − all payments.

**Status** (never stored, always worked out from the due date and the payments):
- **Unpaid** — something is owed and the due date has not passed. Every new invoice starts here.
- **Overdue** — something is owed and the due date has passed.
- **Paid** — payments cover everything after subsidy. This is final.

Things that move an invoice:
- **Part payment** lowers the amount owed, but the invoice **stays Unpaid or Overdue** until the balance reaches $0.
- **A FAS decision** can lower the amount owed while it is Unpaid or Overdue. A 100% waiver (MOEFAS, or SBFAS Tier 1) makes the amount payable $0, so the invoice shows **Paid** without you paying anything.
- **The due date passing** turns Unpaid into Overdue.

**Payments on an invoice:** a payment can be for one fee item (when you paid only that item) or for the invoice in general (when you paid the whole invoice), in which case it is applied to the items from top to bottom.

---

### [TX-01] Transactions page — Transactions tab

The page has two tabs at the top: **Transactions** and **Invoices**. The tab you choose stays in the page address, so the browser Back button and bookmarks keep it.

**Transactions tab** — the full record of top-ups, payments and refunds of your children's Education Accounts, and the fees paid by card, newest first.

| Column | Meaning |
|---|---|
| **Date** | When the money moved. |
| **Description** | "Payment for *fee name*" for a fee payment; the top-up or refund name otherwise. |
| **Student** | Which child. |
| **Method** | *Education account* (taken from the child's account), *Card* (paid by card or bank, does not change the balance) or *MOE top-up* (money in). |
| **Amount** | Green **+** = money in; **−** = money out. |

When one fee is paid partly from the account and partly by card, it appears as **two rows** on the same date — one *Education account*, one *Card*.

### [TX-02] Filtering transactions

| Filter | Options |
|---|---|
| **Child** | All children, or one child |
| **Transaction type** | All types, Top-ups and refunds (money in), Payments (money out) |
| **From** / **To** | A date range; either end can be left blank. The To date can't be before the From date. |

If nothing matches you see "No transactions found". Change or clear a filter to see more.

### [TX-03] Invoices tab and invoice details

**Invoices tab** — the fee invoices of your children that are **fully paid**, latest due date first. Each row: fee name, child · original due date · invoice number, a green **Paid** badge and the amount that was payable (after subsidy). Use **Child** to show one child only. Unpaid invoices are on **Payments** ([PAY-03]).

Press **View details** to open the invoice:

| Part | Meaning |
|---|---|
| Header | Ministry of Education, the invoice number and its status badge. |
| **Bill to** | Parent/Guardian of the child, the school, the level and class. |
| **Bill date** / **Due date** | See [INV-01]. |
| **Details of charges** | A school row with the invoice's total outstanding, then the fee name and one row per fee item: **Amount**, **Subsidy** (shown as −, or — if none), **Paid** (shown as −) and **Outstanding**. |
| **Payments** | Each payment on the invoice: date, method (Education account or Card / PayNow) and amount. |

Close it with **×**, Esc or by clicking outside. There is no PDF download yet.

---

### [FAS-01] What FAS is

The Financial Assistance Scheme helps lower-income families with school fees. There are two schemes:

- **MOEFAS** — granted **automatically** when the household meets MOE's criteria. Tier 1 or Tier 2. School and miscellaneous fees are waived in full.
- **SBFAS** (school-based) — for families not in a MOEFAS band. **Your child's school decides.** If granted, a percentage of each school fee is waived, depending on the tier the school gives.

**MOEFAS takes precedence:** SBFAS is only considered when MOEFAS is not granted, so a child never gets both. **One application covers all your children**; each child gets their own result.

### [FAS-02] FAS page (My FAS applications)

Opening **Financial Assistance Scheme** in the menu shows **My FAS applications**.

| Part | Meaning |
|---|---|
| **Apply** button | Starts a new family application. Only shown before you have applied. |
| Table | Your application: **Submitted on**, **Children** it covers, **Status**. |
| Status *Draft* | Started but not submitted. Action: **Continue application**. |
| Status *Under review* | Submitted; at least one child is still waiting for a decision. |
| Status *Decided* | Every child has a result. |
| **View application** | Opens the application page with the tracker and results. |
| "No applications yet" | You haven't applied. Press **Apply**. |

*(assumption: only one family application is kept; past years are not listed yet)*

### [FAS-03] Household and income band

On the application page, the **Household** card lists you (Applicant), your spouse and your children with their NRIC (masked), level and school, plus your **household income band**.

- The band comes from **HOMES**. MOE only ever receives a **band** per person (e.g. "$1,001 – $1,500 per person"), never your exact income.
- "Last synced" shows when the band was last fetched.

*(assumption)* Bands: up to $750 per person → MOEFAS Tier 1; $751–$1,000 → MOEFAS Tier 2; $1,001–$1,500 → SBFAS (school decides); above $1,500 → not eligible for either.

### [FAS-04] Applying for FAS, step by step

1. Open **Financial Assistance Scheme** and press **Apply** (or **Continue application** for a draft). The form opens straight away.
2. Check the **Household** card.
3. Fill in **Your FAS application**:

   | Field | Required | What to enter |
   |---|---|---|
   | Extra monthly money (S$) | Yes | Income not in HOMES, e.g. rental, allowance, family support. Enter **0** if none. |
   | People currently living in your home | Yes | Everyone who lives with you now, including you. Whole number 1–20. Starts at the household on file (2 parents + children). |
   | Contact number | Yes | Singapore number, e.g. +65 9123 4567. Pre-filled from your profile. |
   | Mailing address | Yes | Pre-filled from your profile. |
   | Anything else the bursar should know? | No | Free text. |
   | Supporting documents | No | Payslips, retrenchment letter, medical bills. PDF, JPG or PNG, up to 5 MB each. Bigger files are skipped. **Remove** takes a file off. |

4. Read the **Declaration** (information is true; MOE and schools may verify it; false information may lead to assistance being withdrawn). It shows your name and today's date.
5. Tick the **consent** box (MOE may get your income band from HOMES and share the application with your children's schools). **Submit application** stays disabled until it is ticked.
6. Press **Submit application**. You return to **My FAS applications** with the status *Under review*.

Prefer help? Press **Help me fill this in** — the MOE Assistant asks two questions and fills the form for you to check ([AI-03]).

**Behind the scenes:** on submit, each child is assessed from the family's income band. In a MOEFAS band the child is granted MOEFAS by criteria; in the SBFAS band an SBFAS application is placed in that child's school review queue; above both, the child is not eligible.

### [FAS-05] Form errors

After you press Submit once, mistakes are shown under each field and update as you type. The form jumps to the first problem.

| Message | Fix |
|---|---|
| Enter an amount in dollars, or 0 if none. | Type a number such as 0, 300 or 250.50 (up to 2 decimals). |
| Enter a whole number from 1 to 20. | Type the number of people, no decimals. |
| Enter a contact number. / Enter a valid Singapore number, e.g. +65 9123 4567. | 8 digits starting with 3, 6, 8 or 9, optional +65. |
| Enter a mailing address. | Fill in the address. |
| Tick the box to consent before submitting. | Tick the consent box. |

### [FAS-06] Tracking the application and results

**Application status** tracker (3 steps; the current one is filled red, done ones green with a tick):

1. **Prepare info** — in progress once the form is open.
2. **Submission** — done when you submit. The reference number (e.g. FAS-2026-0418) and date appear top right.
3. **Disbursement** — done once every child's result is decided.

"Your application is with MOE" confirms the submit date.

**Result per child:**

| Badge | Meaning |
|---|---|
| **MOEFAS Tier 1/2 – Granted** | Granted automatically. School and miscellaneous fees waived in full. |
| **SBFAS – Pending** | Your child's school is deciding. |
| **SBFAS Tier N – Granted** | A share of each school fee is waived: Tier 1 100%, Tier 2 75%, Tier 3 50%, Tier 4 25%. Unpaid invoices are updated automatically. |
| **SBFAS – Declined** | The school did not grant SBFAS; the reason is shown if given. |
| **Not eligible** | Income band above both schemes. Speak to the school if your situation has changed. |

**How the subsidy reaches your invoices:** when a child is granted, the subsidy is applied to that child's invoices **that still have something owed**. Invoices already paid stay as they were. The new amount owed shows on Payments.

### [FAS-07] Asking the school again after a decline

If SBFAS was declined for any child, the **Ask the school again** card appears under the results.

1. Under **What has changed?**, describe what is different (e.g. a parent stopped working, rent went up). It is required.
2. Press **Submit a new request**.

Each declined child's application goes back to the school's review queue with your reason attached, and shows as *Pending* again. MOEFAS is not re-assessed. *(assumption: client still to confirm this right)*

---

### [SET-01] Settings: your details

**Your details** card shows Name, NRIC (masked), Residential address, Mailing address and Contact number. **SingPass identity** card repeats Name and NRIC/FIN, which come from SingPass and can't be edited here.

To change details:

1. Press **Edit** on **Your details**.
2. Change any of **Residential address**, **Mailing address**, **Contact number**.
3. Press **Save changes** (or **Cancel**). You see *Details updated*.

Rules:
- Addresses need at least 5 characters and the **6-digit postal code**.
- Contact number: Singapore number, 8 digits starting with 3, 6, 8 or 9 (optional +65; spaces and hyphens ignored).

The new contact number and mailing address are used to pre-fill the FAS form. *(assumption: which fields parents may edit is still open)*

---

### [AI-01] MOE Assistant (chatbot)

Press **Ask MOE Assistant** at the bottom right. On a wide screen it docks to the right; on a phone it covers the page.

| Part | Meaning |
|---|---|
| **AI · English** | It is an AI and answers in English. |
| Grey banner | "AI can make mistakes. Check answers on the page. Don't type ID numbers or bank details." |
| Suggestion chips | Tap one to ask it. |
| Link button under an answer | Opens the page the answer is about. |
| **Source:** line | Which help topic the answer comes from. |
| 👍 / 👎 | Rate the answer (helps improve it). |
| Circular arrow | **New chat** — clears the conversation. |
| **×** or Esc | Closes the assistant. |
| **Talk to a person** | Shows MOE's contact details ([HELP-01]). |

### [AI-02] What it can and can't do

- **Can:** explain how to use any page, take you to it, and fill in the FAS form for you to check.
- **Can't:** tell you balances, amounts owed or whether you qualify (it points you to the page), submit the form, tick consent, upload documents, or answer questions outside the portal.
- If you type an NRIC or a long number like a bank account, it won't use it and asks you not to.
- If it is unavailable you see "The assistant is unavailable right now" with **Try again** and **Fill in the form myself**. Nothing is lost; you can do everything yourself.

### [AI-03] Letting the assistant fill the FAS form

1. Ask "Apply for FAS" (or press **Help me fill this in** on the form).
2. Answer: how many people live in your home, and any extra monthly money (or **None** / **Skip for now**).
3. Check the **draft**: each value says *From your profile*, *From your answer* or *Missing, please fill*.
4. Press **Fill the form**. The form opens with the values; filled ones are tagged **AI-filled, please check** and blank ones highlighted.
5. Check everything, tick consent yourself and press **Submit application**.

If you have already submitted, it shows a link to your application instead.

---

### [STAT-01] Every status in one place

| Where | Status | Meaning | Section |
|---|---|---|---|
| Invoice | Unpaid | Owed, not late. Part-paid invoices stay here. | INV-01 |
| Invoice | Overdue | Owed, due date passed. | INV-01, PAY-05 |
| Invoice | Paid | Nothing left to pay (including a 100% waiver). | INV-01 |
| Child (Overview) | Paid up / Payment due / Overdue | Nothing owed / something owed, none late / something late. | OV-01 |
| Payment window | Review / Cancelled / Processing / Successful / Failed | Stages of one payment attempt. | PAY-06 |
| FAS application (list) | Draft / Under review / Decided | Not submitted / a child still waiting / every child has a result. | FAS-02 |
| FAS (Overview card) | Not started / In progress / Pending / Granted / Declined | No application / draft / a school still deciding / at least one child granted / no child granted. | OV-01 |
| FAS tracker step | Done / In progress / Next step / Not started | Progress of Prepare info, Submission, Disbursement. | FAS-06 |
| FAS result per child | Granted / Pending / Declined / Not eligible | See the table in FAS-06. School-side *Approved* and *Overridden* both show as Granted; *Rejected* shows as Declined. | FAS-06 |

---

### [HELP-01] Talking to a person

Press **Talk to a person** at the bottom of the MOE Assistant, or ask it to. *(assumption — contact not confirmed)*
MOE Customer Service: 1800 000 0000, Monday to Friday, 8.30am to 5.30pm.

---

## Part B — Chatbot reference

### [BOT-01] What the assistant may and may not do

| Does | Does not |
|---|---|
| Explain how to use the portal (paying, account, transactions, details, FAS). | Read or state account figures (balances, amounts owed, eligibility, grant amounts). It points to the page instead. |
| Link to the right page. | Answer anything outside the portal. It offers *Talk to a person*. |
| Pre-fill the FAS form from the profile plus two answers. | Submit the form, tick the consent box, or upload documents. |
| Ask **at most one** follow-up before answering. | Accept ID numbers or bank details. If the user types an NRIC-like value or a 12+ digit number, it refuses and does not repeat it. |
| Cite a source on every factual answer. | Guess. If no intent matches it gives the out-of-scope reply. |

Interface rules: header says *AI · English*; banner warns "AI can make mistakes… Don't type ID numbers or bank details"; each answer has 👍/👎 rating; **New chat** resets; if the assistant is down (`?ai=down`), it says so and offers *Try again* and *Fill in the form myself*.

### [BOT-02] Intent map

Each intent → the answer key in `src/data/assistant.ts` → the guide section it must agree with.

| Intent | Answer key | Guide section | Example user phrasings (use as test cases) |
|---|---|---|---|
| How to pay | `pay` | PAY-01, PAY-02, PAY-03 | "How do I pay a fee?", "pay school fees", "where do I pay the bill" |
| Payment method / not enough balance | `payShort` | PAY-01 | "Can I pay by PayNow?", "my account balance is too low", "pay by card" |
| Payment failed | `payFailed` | PAY-04, PAY-06 | "payment failed", "my payment didn't go through", "card declined" |
| What do I owe | `outstanding` | PAY-03, PAY-05, INV-01 | "what do I have to pay", "outstanding fees", "unpaid invoices" |
| Balance | `balance` | ACC-01 | "check my child's balance", "how much money is in the education account" |
| Transactions / receipts | `transactions` | TX-01, TX-02, TX-03, INV-01 | "transaction history", "can I get a receipt", "statement", "show my paid invoices", "filter by date" |
| Update details | `details` | SET-01 | "update my address", "change phone number", "mailing address" |
| FAS status | `fasStatus` | FAS-02, FAS-06 | "FAS status", "where is my FAS application", "FAS result" |
| FAS eligibility | `fasEligibility` | FAS-01 | "am I eligible for FAS?", "how much FAS will I get" |
| Apply for FAS (guided) | flow in `engine.ts` | FAS-04, AI-03 | "Apply for FAS", "help me fill the FAS form" |
| FAS already submitted | `fasSubmitted` | FAS-06 | "apply for FAS" after submission |
| Human | `HUMAN` | HELP-01 | "talk to a person", "I want to complain", "contact MOE" |
| Out of scope | `outOfScope()` | BOT-01 | "what's the weather", "school holidays" |

### [BOT-03] Guided FAS fill (conversation script)

1. User asks to apply → if already submitted, reply `fasSubmitted` and stop.
2. Bot: "I'll use the details already on your profile and only ask for what is missing…"
3. Q1: "How many people live in your home now, including you?" — chips: (children + 1), (children + 2), (children + 3). Invalid → "Please give a whole number from 1 to 20."
4. Q2: "Is there other monthly money that MOE would not already have…?" — chips: *None* (→ 0), *Skip for now* (→ blank). Invalid → "Please type an amount in dollars (for example 300)…"
5. Bot shows a **draft card**: each field labelled *From your answer*, *From your profile* or *Missing, please fill*.
6. User presses **Fill the form** → form opens pre-filled; filled fields tagged *AI-filled, please check*; blank fields highlighted.
7. Bot: "Please check every field, tick the consent box yourself and press Submit… I can't submit for you."

"start over", "cancel" or "stop" during the flow restarts it.

### [BOT-04] Gaps found — questions this guide answers but the bot can't yet

Use these to extend `ANSWERS` and the router. Each line: question → guide section → suggested fix.

| # | Parent question | Guide | Current bot behaviour | Suggested fix |
|---|---|---|---|---|
| G1 | "My child isn't showing" | GEN-02 | Out of scope | Add `missingChild` answer → HELP-01. |
| G2 | "What does overdue mean?" | PAY-05 | Out of scope | Add `overdue` answer. |
| G3 | "Why does one payment show twice in Transactions?" | TX-01 | `transactions` (partly covers) | Add the two-row explanation. |
| G4 | "Can my son's account pay my daughter's fees?" | ACC-01 | Routes to `balance` or `pay` by keyword luck | Add explicit line; already in `payShort`, route "sibling/other child" there. |
| G5 | "What documents do I need for FAS?" | FAS-04 | Starts the FAS fill flow (any "fas" message does) | Route "document/upload/payslip" to a `fasDocs` answer before `startFas`. |
| G6 | "What is HOMES / why do you need my income?" | FAS-03 | Starts the FAS flow | Add `fasHomes` answer. |
| G7 | "What's the difference between MOEFAS and SBFAS?" | FAS-01 | Starts the FAS flow | Add `fasSchemes` answer. |
| G8 | "How is my FAS subsidy applied to my fees?" | FAS-06, INV-01 | "subsid" → starts the FAS flow | Route subsidy + fee/invoice to a short answer. |
| G9 | "My SBFAS was declined, can I apply again?" | FAS-07 | `fasSubmitted` | Add `fasReapply` answer linking to the FAS page. |
| G10 | "Why can't I change my name?" | SET-01 | `details` only if "profile/update my" appears | Add "name", "nric" keywords to `details`. |
| G11 | "Why is the Submit button greyed out?" | FAS-04 step 5 | Out of scope | Add `fasConsent` answer. |
| G12 | "Can I pay just one item of an invoice?" | PAY-01, PAY-03 | `pay` (mentions part payment but not per item) | Add one line about ticking fee items. |
| G13 | "What does the red dot on the bell mean?" / "What is Paid this year?" | GEN-03, OV-01 | Out of scope | Add screen-help answers from the GEN/OV tables. |
| G14 | Non-English questions | — | Out of scope (English only) | Decide language support. |

**Router pitfall:** any message containing "fas" or "subsid" that is not about status/eligibility starts the guided fill (`engine.ts` `route`). Add specific FAS-info intents *above* that branch.

### [BOT-05] How to refine the bot with this guide

1. **Ground every answer.** Each `ANSWERS` entry's `source` should name a guide ID (e.g. `"Help: Paying fees [PAY-02]"`). An answer with no matching section is either wrong or the guide is missing something.
2. **Test from the phrasings column.** Each example in [BOT-02] is a test case for `engine.test.ts`: input → expected answer key.
3. **Close gaps.** Work through [BOT-04]; for each, write the answer from the guide text, add keywords to `route`, add a test.
4. **Review 👎 ratings.** For each downvoted answer: is the guide wrong (fix Part A), the answer wrong (fix `assistant.ts`), or the routing wrong (fix `engine.ts`)?
5. **Keep it short.** Answers should be 1–3 sentences plus steps. Copy wording from Part A so the bot and the screen say the same thing.
6. **If moving to a real LLM:** feed Part A as the retrieval corpus (one chunk per `[ID]` section), feed [BOT-01] as the system-prompt rules, and keep [BOT-02] phrasings as the evaluation set.

### [BOT-06] Open questions to resolve with the business

- Human escalation contact and hours (HELP-01, AI-07).
- Which profile fields parents may edit (SET-01).
- Real income bands and tier cut-offs (FAS-02).
- Whether invoices should be downloadable as PDF (TX-03).
- Whether a submitted FAS application can be amended or withdrawn, and confirm the re-request after a decline (FAS-07).
- Languages to support (G14).
- What the notification bell should show (GEN-03).
