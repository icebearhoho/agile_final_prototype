# FS — SBFAS (School-Based FAS) — Functional Specification

**Phiên bản:** 2.1 · 2026-10-22
**Phạm vi:** tính năng SBFAS cho **school user** trong trang `/admin/fas` — 4 tab: *SBFAS review* · *SBFAS rules* · *MOEFAS Handbook* (chỉ đọc) · *Hardcopy applications*.
**Người dùng:** tài khoản role `school` (vd `alicia.tan@school.example` — Greenfield Secondary/S001, `geraldine.rajaratnam@school.example` — Riverbank Primary/S002; mật khẩu demo `Sch00l-Demo-26`). MOE HQ vào `/admin/fas` chỉ thấy queue **chỉ đọc**.
**Điểm mới 2.1:** editor SBFAS rules xếp lại thứ tự bước — **1. Select fee types → 2. Subsidy by fee component → 3. Configure ranks**; thêm chương *8. Data field specification cho QA* liệt kê đầy đủ trường dữ liệu từng màn hình.

---

## 1. Tổng quan nghiệp vụ

1. Đơn SBFAS đến hàng đợi trường theo **2 kênh**:
   - **MOE referral** — gia đình nộp form FAS online, rơi ngoài các băng thu nhập MOEFAS → MOE đẩy xuống queue trường. Mang ngày đồng bộ MyInfo (SingPass).
   - **Hardcopy** — gia đình nộp **đơn giấy trực tiếp tại trường**, staff tự nhập trong tab *Hardcopy applications*. Band thu nhập đọc từ form giấy (không MyInfo sync).
2. **Không map băng thu nhập → rank, không có đề xuất.** Mỗi đơn vào queue ở **rank khởi đầu** (Tier 3 nếu trường có, không thì rank cuối cùng của rule đang Active) — school user **tự duyệt**: chọn Rank trong modal → **Approve** đúng rank đã chọn, hoặc **Reject** (justification là ghi chú tùy chọn).
3. Rule của trường là **các version có trạng thái** như FAS Rules của MOE: **chỉ 1 rule Active tại một thời điểm**; Active mới thì bản Active cũ chuyển **Inactive**; bản Inactive giữ lại làm **history**; Draft chưa từng được Active.
4. Eligibility: **SBFAS chỉ dành cho Singapore Citizen** (Dual citizenship có SG vẫn hợp lệ). Hồ sơ non-SC hiện cảnh báo đỏ và phải Reject.
5. Quyết định ghi thẳng về hồ sơ học sinh + charges (writeback qua `useFasActions`): Approve/Override → subsidy áp vào charges chưa trả của học sinh.

**Lưu trữ:** mọi rule, version, quyết định nằm trong **bộ nhớ phiên (in-memory)** — reload trang trả về seed/mặc định.

---

## 2. Tab SBFAS review

### 2.1 Stat tiles
| Field | Nguồn |
|---|---|
| Waiting for your review | hồ sơ Pending của trường |
| Granted | status ∈ {Approved, Overridden} |
| Declined | status = "Rejected" |

### 2.2 Filter
- **Trạng thái:** `All (n)` · `Pending (n)` · `Granted (n)` · `Rejected (n)`.
- **Nguồn:** `All sources (n)` · `MOE referral (n)` · `Hardcopy (n)` — lọc chồng lên cùng filter trạng thái.
- Mô tả dưới tiêu đề: "*Highest risk first, pending before decided… Applications arrive from MOE referrals (families outside the MOEFAS bands) or paper forms entered at the school.*"

### 2.3 Bảng queue (10 dòng/page)
| Column | Data field | Ghi chú QA |
|---|---|---|
| Student | `student`, `level`, `id` | link `/admin/students/{studentId}/fees`; trường chỉ thấy hồ sơ của mình |
| Income per person | `incomeBand` | text band |
| **Source** | `source` | badge **MOE referral** (burgundy) / **Hardcopy** (xám) |
| Fee to pay | tính từ charges | `S$… Balance S$…` |
| Status | `status` (+ `sbfasTier`) | `Pending`/`Granted · Rank N`/`Declined` |

### 2.4 Review modal
| Field | Kiểu | Hợp lệ / Mặc định |
|---|---|---|
| Student | text + link | read-only |
| Nationality | text | từ seed; **không phải SC** → alert đỏ "*… — not eligible for MOE FAS or SBFAS (Singapore Citizens only). Reject this application.*" |
| Household / Per-capita income band (monthly) | text | read-only |
| **Application source** | text | Hardcopy → "*Hardcopy — paper form entered by the school*"; còn lại → "*MOE referral — fell out of the MOEFAS assessment*" |
| **Income sync** | text | có `incomeSyncedOn` → "*MyInfo · YYYY-MM-DD*"; Hardcopy → "*Not synced — paper form*" |
| Fee payable / Account balance | S$ | read-only + link *view fees* |
| Application context | text | `explanation` (nguồn đến của đơn) |
| **Rank** | select | option `Rank N — <subsidy> subsidy` theo rule Active; **mặc định = rank khởi đầu của đơn**; trường chọn rank bất kỳ mình có |
| Justification (optional) | textarea | ghi chú kèm quyết định (trim; rỗng = không lưu) |
| Nút | — | **Reject / Approve Rank N** (N = rank đang chọn, cập nhật theo select); đóng bằng nút **X** |

**Không có khái niệm Override/de suggestion** — Approve ghi nhận đúng rank đang chọn trong select. Ánh xạ: Approve → `Approved` (+ `sbfasTier` = rank đã chọn); Reject → `Rejected`. Hiển thị: Approved/Overridden (bản ghi cũ) = *Granted*, Rejected = *Declined*.

---

## 3. Tab SBFAS rules — version lifecycle (như FAS Rules của MOE)

### 3.1 Danh sách version
Card `SBFAS rules — <tên trường>` + nút **Create rule**. Bảng: **Rule ID / name** (`SBFASR26100001` kiểu `SBFASR`+YYMM+0001) · **Ranks** (số) · **Subsidy** ("100%, 75%, 50%, 25%") · **Updated** · **Status** (badge Active=xanh / Draft=vàng / Inactive=xám).
Row actions: **View** (mọi bản) · **Edit**, **Activate** (chỉ bản ≠ Active). Ghi chú cuối: "*Only one rule can be Active at a time. Activating a rule makes the previous Active rule Inactive. Draft rules have never been activated.*"

**Seed demo (S001):** SBFAS 2025 — Previous package (Inactive, 3 rank) · SBFAS 2026 — Standard package (**Active**, 100/75/50/25) · SBFAS 2027 — Proposed package (Draft, 5 rank). Trường chưa Active bản nào → **default package 100/75/50/25** áp dụng.

### 3.2 Editor — thứ tự bước (v2.1)

Link "← SBFAS rules" · h2 *Create/Edit/View rule* · card `SBFAS · School package` + badge trạng thái ("Editable draft" khi Draft). Intro: "*Select the school's fee types, give individual components their own subsidy rates, then set the ranks and their flat subsidies.*"

**Bước 1 — Select fee types**
- Mô tả: "*Select the school's fee types. Choose their components in the subsidy table below.*" + nút **Add fee types** (mở/đóng picker).
- Trường **chưa có fee type nào** (chưa setup ở Fee structure): thông báo "*No fee types set up for your school yet. Manage them under Fee structure, then come back to subsidise components.*"
- **Picker:** checkbox từng fee type của trường; bản đã nằm trong bảng subsidy bị disable kèm "*Already selected*"; footer "*Only fee types set up for your school appear here — manage them under Fee structure.*" + nút **Add selected fee types** (disable khi chưa chọn). Chọn xong thêm 1 dòng mới trong bảng bước 2 cho component đầu tiên còn tự do của fee type đó.
- **Chips** fee type đang được subsidise (mỗi fee type có ≥ 1 dòng ở bước 2); rỗng → "*No fee types selected. Choose one or more school fee types above.*"

**Bước 2 — Subsidy by fee component**
- Mô tả: "*Give a component its own subsidy for a rank. Leave a cell empty to follow that rank's flat rate in step 3.*"
- Bảng: **Fee type** (tên + nút `+ Component` thêm dòng tiếp theo của fee type đó; disable khi hết component tự do) · **Fee component** (select theo component của fee type; component trùng fee type bị disable) · **Basis** (`Percentage (%)` / `Fixed amount (SGD)`) · **Rank 1…N** (ô số theo từng rank; để trống = dùng flat rate của rank ở bước 3; placeholder hiện flat rate nếu đã nhập) · **Action** (**Remove**).
- Rỗng: "*No components selected. Add school fee types above to give components their own rates.*"
- Ghi chú dưới bảng: "*Only the components added here get their own rates. Every other component — and any empty cell — follows its rank's flat rate from step 3.*"
- Hàng điều khiển rank: "**N rank(s)**" + **Add rank** + **Remove last rank** (disable khi còn 1; bấm ra confirm "*Remove the last rank and its subsidy values?*"). Rank là **cột** của bảng này — Add/Remove làm cột tăng/giảm ngay tại chỗ.

**Bước 3 — Configure ranks**
- Field **Rule name** (bắt buộc).
- Banner: "*Ranks are the school's own support levels — income bands play no part in SBFAS. The school sets each applicant's rank at review.*"
- Bảng **Rank | Subsidy**: mỗi rank 1 dòng — basis (`% of fee` / `Fixed S$`) + rate (0–100 khi percent, ≥0 khi fixed, tối đa 2 số thập phân). Đây là **flat rate** áp cho mọi component không có giá trị riêng ở bước 2.
- Ghi chú: "*A rank is one support level of the package. Its flat subsidy applies to every fee component; step 2 can give a single component its own rate for a rank. Each rank added in step 2 adds a column to the subsidy table.*"

Footer: **Cancel / Save draft / Activate** (ẩn khi View).

### 3.3 Save / Activate / validation
| Hành động | Kết quả |
|---|---|
| Save draft | Lưu/upsert version (status Draft) → banner xanh "*Draft saved.*" |
| Activate (editor hoặc row) | Modal xác nhận "*Activate <name>? The currently active rule <id> (<name>) will become Inactive. Existing application outcomes stay unchanged.*" → Confirm: bản này **Active**, bản Active cũ → **Inactive**; banner xanh xác nhận |
| Edit bản Inactive | **Tạo version mới** (id mới) — không ghi đè history |
| Edit bản Draft | Giữ nguyên id |
| Create rule | Bản nháp mới **copy từ rule đang hiệu lực** (đổi tên trước khi lưu) |

Lỗi: thiếu tên → "*Enter a rule name.*"; rate sai → "*Enter a rate between 0 and 100 (max 2 decimals) for every component.*" / "*Enter an amount of at least 0 (max 2 decimals) for every component.*"; xóa hết rank → "*Keep at least one rank.*" — banner đỏ "*Fix the highlighted fields before saving.*"

**Rule hiệu lực:** bản **Active** của trường quyết định subsidy trong review modal + **rank khởi đầu** của đơn mới (Tier 3 nếu có, không thì rank cuối).

---

## 4. Tab Hardcopy applications

**Card 1 — Enter hardcopy application:** giải thích 2 kênh; form = **Student** (chỉ học sinh của trường, Singapore Citizen, chưa có đơn & chưa được MOEFAS grant; rỗng → "*No student of this school can be entered right now…*") · **Per-capita income band** (B1–B4: ≤S$450 / S$451–700 / S$701–1,000 / S$1,001–1,500) · **Household income band** (H1–H4) · **Note from the paper form** (tùy chọn) · nút **Add to queue**. Thiếu student → "*Pick the student the paper form belongs to.*" Nhập xong: form reset + dòng xác nhận xanh "*Hardcopy application SBFAS00XX for <tên> entered into the SBFAS queue.*"

Đơn tạo ra: Pending · `source: "Hardcopy"` · không `incomeSyncedOn` · rank khởi đầu theo rule Active · SLA 10 ngày · explanation ghi tên staff + note (trim). **Một đơn/một grant mỗi học sinh** — đã có đơn hoặc MOEFAS grant thì không nhập được.

**Card 2 — Hardcopy applications from this school:** mọi đơn giấy của trường (seed + mới nhập): Student (link fees) · Income bands · Suggested rank · Status. Rỗng → "*Nothing on paper yet*".

---

## 5. MOEFAS Handbook (tab 3)

Chỉ đọc, không đổi cấu trúc. Đoạn mở đầu có 1 câu mới: đơn vào queue trường theo 2 kênh — MOE referral (rơi ngoài băng MOEFAS) và đơn giấy trường tự nhập; cả hai cùng quy trình review.

---

## 6. Data model (QA đối chiếu storage)

- **SbfasRule:** `id` (SBFASR…), `name`, `status` (Active/Inactive/Draft), `school`, `updated`, `tiers: [{tier:"Tier N", basis, rate, components?}]`, `coveredComponents?`. **Không còn** `grouping` / `levelTiers` / `history`.
- **SbfasStore:** `rules: Record<mã trường, SbfasRule[]>`; action `save-rule` (upsert theo id) và `activate-rule` (đúng 1 Active).
- **SbfasApplication:** các field cũ **+ `source: "MOE referral" | "Hardcopy"`**; `incomeSyncedOn` chỉ có trên MOE referral. Seed 16 đơn: băng thấp (B1/B2, household cao) = MOE referral có ngày sync; băng cao (B3/B4) = Hardcopy không sync.
- **FasStore action mới:** `addHardcopy {studentId, incomeBand, householdBand, note, at, by, start}`; `submitFamily` giờ tag đơn SBFAS là MOE referral + `start` là rank khởi đầu.
- **UI vocabulary:** nội bộ "Tier N", hiển thị **"Rank N"**.

---

## 7. Data field specification cho QA

Tổ chức theo màn hình. "Required" = bắt buộc nhập/chọn trước khi **Save draft / Activate**. "UI-only" = giá trị chỉ hiển thị, không lưu vào record.

### 7.1 Rules — danh sách version
| Field / item | Required | Rule QA verifies | Example |
|---|---|---|---|
| Card title | — | `SBFAS rules — <tên trường>` theo mã trường đăng nhập | SBFAS rules — Greenfield Secondary School |
| Create rule | — | Mở editor "Create rule", nội dung copy từ rule đang hiệu lực, **Rule name rỗng** | — |
| Rule ID / name | — | ID `SBFASR`+YYMM+0001 (chuỗi tự tăng trong tháng, sắp theo số); tên hiển thị đậm, ID nằm dưới | SBFASR26100001 · SBFAS 2026 — Standard package |
| Ranks | — | Số rank của version, đúng số dòng bảng bước 3 khi mở editor | 4 ranks |
| Subsidy | — | Chuỗi summary từng rank, phân cách ", "; percent → `X%`, fixed → `S$X`; component riêng cùng đơn vị gộp thành khoảng `lo–hi` | 100%, 75%, 50%, 25% |
| Updated | — | `d MMM yyyy`; sortable | 1 Sept 2026 |
| Status badge | — | Active=xanh · Draft=vàng · Inactive=xám; đúng 1 Active mỗi trường | Active |
| Row actions | — | View: mọi bản. Edit + Activate: **chỉ** bản ≠ Active. Activate từ row mở modal xác nhận | — |
| Empty school (S002) | — | "*No rules yet*" + hint Create rule; rule hiệu lực = default package | — |

### 7.2 Rules editor — phần chung
| Field / item | Required | Rule QA verifies | Example |
|---|---|---|---|
| Back link | — | "← SBFAS rules" quay về danh sách (không lưu) | — |
| Page title | — | View rule / Create rule / Edit rule theo ngữ cảnh | Edit rule |
| Card title + badge | — | `SBFAS · School package`; Draft editable → "Editable draft"; bản khác hiển thị đúng status | Editable draft |
| Intro | — | Mô tả 3 bước đúng thứ tự mới: fee types → component rates → ranks | — |
| Footer buttons | — | Cancel / Save draft / Activate; **ẩn hoàn toàn** ở View (fieldset disable + ẩn nút) | — |

### 7.3 Editor bước 1 — Select fee types
| Field / item | Required | Rule QA verifies | Example |
|---|---|---|---|
| Heading | — | "1. Select fee types" + mô tả; đứng **đầu tiên** | — |
| Add fee types | — | Toggle picker; ẩn khi trường không có fee type nào | — |
| No-fee-type notice | — | Khi trường chưa setup fee type: câu hướng dẫn qua Fee structure, **không** có picker | — |
| Picker checkbox list | — | Chỉ liệt kê fee type **của trường đăng nhập**; bản đã có trong bảng bước 2: checked + disable + "Already selected" | School Fees (Secondary) |
| Add selected fee types | — | Disable khi chưa tick; bấm thêm fee type vào bước 2 (mỗi fee type 1 dòng, component đầu tiên còn tự do) | — |
| Fee type chips | — | Mỗi fee type có ≥1 dòng ở bước 2 có 1 chip; bỏ hết dòng của 1 fee type → chip mất; rỗng → câu "No fee types selected…" | School Fees (Secondary) |
| Picker footer note | — | "Only fee types set up for your school appear here — manage them under Fee structure." | — |

### 7.4 Editor bước 2 — Subsidy by fee component
| Field / item | Required | Rule QA verifies | Example |
|---|---|---|---|
| Heading | — | "2. Subsidy by fee component" — đứng **thứ hai** (sau fee types, trước ranks) | — |
| Fee type (cột) | — | Tên fee type + nút `+ Component`: thêm dòng mới cùng fee type với component còn tự do; disable khi hết | School Fees (Secondary) |
| Fee component (cột) | — | Select chỉ chứa component của fee type đó; component đã dùng ở fee type khác dòng khác → disable; đổi component giữ nguyên giá trị đã nhập | Miscellaneous |
| Basis (cột) | Y | `Percentage (%)` hoặc `Fixed amount (SGD)`; áp cho **cả dòng** (đổi basis giữ rate) | Percentage (%) |
| Rank N (ô số) | N | number 0–100 (percent) / ≥0 (fixed), step 0.5, **max 2 decimals**; **để trống hợp lệ** = theo flat rate của rank (bước 3); placeholder = flat rate nếu đã nhập | 80 |
| Remove (Action) | — | Xóa dòng; component trở lại tự do, chip cập nhật theo | — |
| Empty state | — | Không dòng nào: "*No components selected. Add school fee types above…*" | — |
| Counter N ranks | — | UI-only; bằng số cột Rank = số dòng bảng bước 3 | 5 ranks |
| Add rank | — | Thêm **cột Rank N+1** ở bước 2 **và** dòng Rank N+1 ở bước 3 | — |
| Remove last rank | — | Disable khi còn 1 rank; confirm "*Remove the last rank and its subsidy values?*" → cột cuối bước 2 + dòng cuối bước 3 biến mất | — |

### 7.5 Editor bước 3 — Configure ranks
| Field / item | Required | Rule QA verifies | Example |
|---|---|---|---|
| Heading | — | "3. Configure ranks" — đứng **cuối cùng** | — |
| Rule name | **Y** | Text tự do, trim; rỗng → lỗi "*Enter a rule name.*" (banner đỏ, không lưu) | SBFAS 2027 — Proposed package |
| Banner | — | "Ranks are the school's own support levels — income bands play no part in SBFAS. The school sets each applicant's rank at review." | — |
| Rank (dòng) | — | Nhãn `Rank N` theo thứ tự 1..N, KHÔNG dùng từ "Tier" trên UI | Rank 3 |
| Subsidy basis | Y | `% of fee` hoặc `Fixed S$` cho từng rank | % of fee |
| Subsidy rate | **Y** | percent: 0–100; fixed: ≥0; ≤2 decimals; sai → lỗi đỏ ngay dưới ô + banner đỏ khi save | 60 |
| Helper | — | Flat rate áp mọi component; rank thêm ở bước 2 thêm cột ở bảng subsidy | — |

### 7.6 Save / Activate / validation
| Field / item | Required | Rule QA verifies | Example |
|---|---|---|---|
| Save draft | — | Lưu/upsert status Draft → về danh sách + banner xanh "*Draft saved.*" | — |
| Activate (editor/row) | — | Modal "*Activate <name>? The currently active rule <id> (<name>) will become Inactive. Existing application outcomes stay unchanged.*"; Confirm → đúng 1 Active | — |
| Validation summary | — | Mọi lỗi chặn lưu với banner đỏ "*Fix the highlighted fields before saving.*"; lỗi từng ô hiện dưới ô tương ứng | — |
| Rule name rỗng | — | "*Enter a rule name.*" | — |
| Rate percent sai | — | "*Enter a rate between 0 and 100 (max 2 decimals) for every component.*" | 150 / 12.345 |
| Amount fixed sai | — | "*Enter an amount of at least 0 (max 2 decimals) for every component.*" | −5 |
| Hết rank | — | "*Keep at least one rank.*" (chỉ reachable qua luồng edit bản cũ) | — |
| Banner kết quả | — | Xanh: thành công (focusable, aria-live); đỏ: lỗi kèm icon cảnh báo | — |

### 7.7 Review queue & modal (đối chiếu nhanh)
| Field / item | Required | Rule QA verifies | Example |
|---|---|---|---|
| Queue sắp xếp | — | Pending trước (nguồn theo risk), decided sau; 10 dòng/page | — |
| Source badge | — | MOE referral (burgundy) / Hardcopy (xám); khớp filter nguồn | MOE referral |
| Rank select trong modal | — | Option `Rank N — <subsidy> subsidy` theo rule Active: uniform → `100%`; component riêng lệch → khoảng `50–100%`; fixed → `S$…` | Rank 1 — 100% subsidy |
| Approve Rank N | — | Nút đổi theo select; Granted · Rank N; subsidy áp charges chưa trả (kiểm tra ở Student fees) | — |
| Non-SC alert | — | Đỏ: "*Singapore Citizens only… Reject this application.*" | — |

### 7.8 Hardcopy entry (đối chiếu nhanh)
| Field / item | Required | Rule QA verifies | Example |
|---|---|---|---|
| Student select | **Y** | Chỉ HS trường, SC, chưa có đơn/MOEFAS grant; rỗng → "*Pick the student the paper form belongs to.*" | Ethan Teo |
| Per-capita band | Y | 4 option B1–B4 đúng nhãn S$ | S$451 - S$700 |
| Household band | Y | 4 option H1–H4 | S$1,501 - S$2,500 |
| Note | N | Free text, trim vào explanation | "Father between jobs" |
| Add to queue | — | Tạo đơn Pending badge Hardcopy, không sync; form reset + banner xanh "*Hardcopy application SBFAS00XX…*" | SBFAS0019 |

---

## 8. QA checklist

| # | Test case | Expected |
|---|---|---|
| 1 | Đăng nhập Alicia (S001) → /admin/fas | 4 tab: SBFAS review · SBFAS rules · MOEFAS Handbook · Hardcopy applications |
| 2 | Queue → filter nguồn | Số lượng All sources = MOE referral + Hardcopy; lọc giữ nguyên filter trạng thái |
| 3 | Cột Source | Đơn băng thấp badge "MOE referral" (burgundy); băng cao badge "Hardcopy" (xám) |
| 4 | Mở modal đơn MOE referral | "Application source: MOE referral — fell out of the MOEFAS assessment"; "Income sync: MyInfo · 2026-10-XX" |
| 5 | Mở modal đơn Hardcopy | "Hardcopy — paper form entered by the school"; "Not synced — paper form" |
| 6 | Parent portal nộp form (băng b3 SBFAS) → queue | Đơn mới Pending, badge MOE referral, modal mở với Rank mặc định = rank khởi đầu, có ngày sync MyInfo |
| 7 | Tab Hardcopy: chọn student + băng + note → Add to queue | Dòng xanh "Hardcopy application SBFAS0019…"; đơn xuất hiện trong queue badge Hardcopy, không có sync; bảng dưới cùng có hàng mới |
| 8 | Tab Hardcopy: dropdown Student | Không chứa HS đã có đơn / đã được MOEFAS grant / non-SC |
| 9 | Tab Hardcopy: không chọn student → Add | Lỗi "Pick the student the paper form belongs to." |
| 10 | Nhập hardcopy trùng HS đã có đơn | Không tạo đơn thứ hai (một đơn/HS) |
| 11 | Mở modal, đổi Rank trong select → Approve | "Granted · Rank N" đúng rank đã chọn; stat Granted +1; subsidy áp vào charges của HS (view fees) |
| 12 | Reject | "Declined"; stat Declined +1 |
| 13 | Modal non-SC | Alert đỏ "Singapore Citizens only… Reject" |
| 14 | Tab Rules lần đầu | Bảng 3 version seed: 2025 Inactive · 2026 Active · 2027 Draft; nút Create rule |
| 15 | View rule Active | Editor chỉ đọc — không Edit/Activate ở footer |
| 16 | **Thứ tự 3 bước trong editor** | "1. Select fee types" → "2. Subsidy by fee component" → "3. Configure ranks" |
| 17 | Bước 1: Add fee types → tick 1 fee type → Add selected | Chip mới xuất hiện; bước 2 thêm dòng với component đầu của fee type; fee type đã có disable "Already selected" |
| 18 | Bước 2: nút "+ Component" | Thêm dòng cùng fee type khi còn component tự do; hết → disable |
| 19 | Bước 2: Add rank | Bước 2 thêm cột Rank N+1 **và** bước 3 thêm dòng Rank N+1; counter "N ranks" tăng |
| 20 | Bước 2: Remove last rank khi còn 1 | Nút disable; ≥2 rank: confirm rồi xóa cột + dòng tương ứng |
| 21 | Bước 2: ô Rank để trống → Save | Hợp lệ — cell theo flat rate của rank (bước 3) |
| 22 | Bước 3: nhập flat rate → quay bước 2 | Placeholder ô trống hiện đúng flat rate (`X%` / `S$X`) |
| 23 | Create rule | Editor "Create rule", nội dung copy rule đang Active, tên rỗng |
| 24 | Create → Save draft thiếu tên | Banner đỏ "Enter a rule name." |
| 25 | Save draft hợp lệ | Về danh sách, banner xanh "Draft saved.", version Draft mới có id SBFASR26100003 |
| 26 | Activate bản Draft (từ row) | Modal "Activate …? The currently active rule … will become Inactive." → Confirm: bản đó Active (xanh), SBFAS 2026 chuyển Inactive; đúng 1 Active |
| 27 | Sau khi Active, mở queue → review modal | Subsidy option theo rule Active mới |
| 28 | Edit bản Inactive → Save draft | Tạo version MỚI (id mới) — bản Inactive gốc không đổi |
| 29 | Rate = 150 / Fixed −5 | Chặn đúng 2 thông báo validation; banner đỏ "Fix the highlighted fields before saving." |
| 30 | Fee component: Rank 1 = 60% → Save draft → Activate → mở modal review | Option "Rank 1 — 60–100% subsidy" theo bản Active |
| 31 | Reload trang | Rules về seed 3 version; quyết định/đơn hardcopy đã nhập mất (in-memory) |
| 32 | Đăng nhập Geraldine (S002) → tab Rules | Danh sách rỗng ("No rules yet") — S002 không có seed; rule hiệu lực = default package |
| 33 | HQ mở /admin/fas | Chỉ queue read-only — không tab rules/hardcopy |

---

*Tài liệu mô tả hành vi tại bản deploy `index-DeNlCcQ6.js` (2026-10-22). Mọi thay đổi UI SBFAS sau này cần cập nhật FS này.*
