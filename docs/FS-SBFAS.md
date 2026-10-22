# FS — SBFAS (School-Based FAS) — Functional Specification

**Phiên bản:** 2.0 · 2026-10-22
**Phạm vi:** tính năng SBFAS cho **school user** trong trang `/admin/fas` — 4 tab: *SBFAS review* · *SBFAS rules* · *MOEFAS Handbook* (chỉ đọc) · *Hardcopy applications*.
**Người dùng:** tài khoản role `school` (vd `alicia.tan@school.example` — Greenfield Secondary/S001, `geraldine.rajaratnam@school.example` — Riverbank Primary/S002; mật khẩu demo `Sch00l-Demo-26`). MOE HQ vào `/admin/fas` chỉ thấy queue **chỉ đọc**.

---

## 1. Tổng quan nghiệp vụ

1. Đơn SBFAS đến hàng đợi trường theo **2 kênh**:
   - **MOE referral** — gia đình nộp form FAS online, rơi ngoài các băng thu nhập MOEFAS → MOE đẩy xuống queue trường. Mang ngày đồng bộ MyInfo (SingPass).
   - **Hardcopy** — gia đình nộp **đơn giấy trực tiếp tại trường**, staff tự nhập trong tab *Hardcopy applications*. Band thu nhập đọc từ form giấy (không MyInfo sync).
2. **Không map băng thu nhập → rank.** Mỗi đơn vào queue ở **rank khởi đầu** (Tier 3 nếu trường có, không thì rank cuối cùng của rule đang Active) — school user **tự duyệt và chọn rank từng đơn** (Approve rank khởi đầu / Override sang rank khác / Reject).
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
Giữ nguyên các field cũ (Student, Nationality + alert non-SC, 2 band thu nhập, Suggested rank, Fee payable/Balance, Why this suggestion, Override rank, Justification, nút Reject/Override/Approve Rank N). **Thêm 2 field mới:**

| Field | Giá trị |
|---|---|
| **Application source** | Hardcopy → "*Hardcopy — paper form entered by the school*"; còn lại → "*MOE referral — fell out of the MOE assessment*" |
| **Income sync** | có `incomeSyncedOn` → "*MyInfo · YYYY-MM-DD*"; Hardcopy → "*Not synced — paper form*" |

Validation Override giữ nguyên (justification bắt buộc; không override về đúng rank đề xuất).

---

## 3. Tab SBFAS rules — version lifecycle (như FAS Rules của MOE)

### 3.1 Danh sách version
Card `SBFAS rules — <tên trường>` + nút **Create rule**. Bảng: **Rule ID / name** (`SBFASR26100001` kiểu `SBFASR`+YYMM+0001) · **Ranks** (số) · **Subsidy** ("100%, 75%, 50%, 25%") · **Updated** · **Status** (badge Active= xanh / Draft=vàng / Inactive=xám).
Row actions: **View** (mọi bản) · **Edit**, **Activate** (chỉ bản ≠ Active). Ghi chú cuối: "*Only one rule can be Active at a time. Activating a rule makes the previous Active rule Inactive. Draft rules have never been activated.*"

**Seed demo (S001):** SBFAS 2025 — Previous package (Inactive, 3 rank) · SBFAS 2026 — Standard package (**Active**, 100/75/50/25) · SBFAS 2027 — Proposed package (Draft, 5 rank). Trường chưa Active bản nào → **default package 100/75/50/25** áp dụng.

### 3.2 Editor
Link "← SBFAS rules" · h2 *Create/Edit/View rule* · badge trạng thái ("Editable draft" khi Draft). Nội dung:
1. **Set the package ranks** — field **Rule name** (bắt buộc) + bảng Rank (basis `% of fee`/`Fixed S$`, rate 0–100 hoặc ≥0 S$, tối đa 2 số thập phân; Remove disable khi còn 1; Add rank).
2. **Fee component support** (khi trường có fee type) — mỗi dòng: Fee type → Fee component → từng Rank: `Same as rank (X%)` / `% of component` / `Fixed S$ amount`.

Footer: **Cancel / Save draft / Activate** (ẩn khi View).

### 3.3 Save / Activate / validation
| Hành động | Kết quả |
|---|---|
| Save draft | Lưu/upsert version (status Draft) → banner xanh "*Draft saved.*" |
| Activate (editor hoặc row) | Modal xác nhận "*Activate <name>? The currently active rule <id> (<name>) will become Inactive. Existing application outcomes stay unchanged.*" → Confirm: bản này **Active**, bản Active cũ → **Inactive**; banner xanh xác nhận |
| Edit bản Inactive | **Tạo version mới** (id mới) — không ghi đè history |
| Edit bản Draft | Giữ nguyên id |
| Create rule | Bản nháp mới **copy từ rule đang hiệu lực** (đổi tên trước khi lưu) |

Lỗi: thiếu tên → "*Enter a rule name.*"; rate sai → "*Enter a rate between 0 and 100 (max 2 decimals) for every component.*" / "*Enter an amount of at least 0…*"; xóa hết rank → "*Keep at least one rank.*" — banner đỏ "*Fix the highlighted fields before saving.*"

**Rule hiệu lực:** bản **Active** của trường quyết định subsidy trong review modal + **rank khởi đầu** của đơn mới (Tier 3 nếu có, không thì rank cuối).

---

## 4. Tab Hardcopy applications

**Card 1 — Enter hardcopy application:** giải thích 2 kênh; form = **Student** (chỉ học sinh của trường, Singapore Citizen, chưa có đơn & chưa được MOEFAS grant; rỗng → "*No student of this school can be entered right now…*") · **Per-capita income band** (B1–B4: ≤S$450 / S$451–700 / S$701–1,000 / S$1,001–1,500) · **Household income band** (H1–H4) · **Note from the paper form** (tùy chọn) · nút **Add to queue**. Thiếu student → "*Pick the student the paper form belongs to.*" Nhập xong: form reset + dòng xác nhận xanh "*Hardcopy application SBFAS00XX for <tên> entered into the SBFAS queue.*"

Đơn tạo ra: Pending · `source: "Hardcopy"` · không `incomeSyncedOn` · riskScore 50 · rank khởi đầu theo rule Active · SLA 10 ngày · explanation ghi tên staff + note (trim). **Một đơn/một grant mỗi học sinh** — đã có đơn hoặc MOEFAS grant thì không nhập được.

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

## 7. QA checklist

| # | Test case | Expected |
|---|---|---|
| 1 | Đăng nhập Alicia (S001) → /admin/fas | 4 tab: SBFAS review · SBFAS rules · MOEFAS Handbook · Hardcopy applications |
| 2 | Queue → filter nguồn | Số lượng All sources = MOE referral + Hardcopy; lọc giữ nguyên filter trạng thái |
| 3 | Cột Source | Đơn băng thấp badge "MOE referral" (burgundy); băng cao badge "Hardcopy" (xám) |
| 4 | Mở modal đơn MOE referral | "Application source: MOE referral — fell out of the MOE assessment"; "Income sync: MyInfo · 2026-10-XX" |
| 5 | Mở modal đơn Hardcopy | "Hardcopy — paper form entered by the school"; "Not synced — paper form" |
| 6 | Parent portal nộp form (băng b3 SBFAS) → queue | Đơn mới Pending, badge MOE referral, "Suggests Rank 3", có ngày sync MyInfo |
| 7 | Tab Hardcopy: chọn student + băng + note → Add to queue | Dòng xanh "Hardcopy application SBFAS0019…"; đơn xuất hiện trong queue badge Hardcopy, không có sync; bảng dưới cùng có hàng mới |
| 8 | Tab Hardcopy: dropdown Student | Không chứa HS đã có đơn / đã được MOEFAS grant / non-SC |
| 9 | Tab Hardcopy: không chọn student → Add | Lỗi "Pick the student the paper form belongs to." |
| 10 | Nhập hardcopy trùng HS đã có đơn | Không tạo đơn thứ hai (một đơn/HS) |
| 11 | Approve đơn | "Granted · Rank N"; stat Granted +1; subsidy áp vào charges của HS (view fees) |
| 12 | Override thiếu justification / đúng rank đề xuất | Bị chặn đúng thông báo cũ |
| 13 | Modal non-SC | Alert đỏ "Singapore Citizens only… Reject" |
| 14 | Tab Rules lần đầu | Bảng 3 version seed: 2025 Inactive · 2026 Active · 2027 Draft; nút Create rule |
| 15 | View rule Active | Editor chỉ đọc — không Edit/Activate ở footer |
| 16 | Create rule | Editor "Create rule", nội dung copy rule đang Active, tên rỗng |
| 17 | Create → Save draft thiếu tên | Banner đỏ "Enter a rule name." |
| 18 | Save draft hợp lệ | Về danh sách, banner xanh "Draft saved.", version Draft mới có id SBFASR26100003 |
| 19 | Activate bản Draft (từ row) | Modal "Activate …? The currently active rule … will become Inactive." → Confirm: bản đó Active (xanh), SBFAS 2026 chuyển Inactive; đúng 1 Active |
| 20 | Sau khi Active, mở queue → review modal | Subsidy option theo rule Active mới |
| 21 | Edit bản Inactive → Save draft | Tạo version MỚI (id mới) — bản Inactive gốc không đổi |
| 22 | Rate = 150 / Fixed −5 / xóa hết rank | Chặn đúng 3 thông báo validation |
| 23 | Fee component: Rank 1 = 60% → Save draft → Activate → mở modal review | Option "Rank 1 — 60–100% subsidy" theo bản Active |
| 24 | Reload trang | Rules về seed 3 version; quyết định/đơn hardcopy đã nhập mất (in-memory) |
| 25 | Đăng nhập Geraldine (S002) → tab Rules | Danh sách rỗng ("No rules yet") — S002 không có seed; rule hiệu lực = default package |
| 26 | HQ mở /admin/fas | Chỉ queue read-only — không tab rules/hardcopy |

---

*Tài liệu mô tả hành vi tại bản deploy `index-DyaijKQ0.js` (2026-10-22). Mọi thay đổi UI SBFAS sau này cần cập nhật FS này.*
