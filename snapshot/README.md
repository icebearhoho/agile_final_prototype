# agile-final-prototype — bản local (sao chép từ Vercel)

Bản sao y hệt của deployment đang chạy tại:
**https://agile-final-prototype.vercel.app** (Build Vite + React; snapshot được refresh ngày 15/10/2026 để khớp đúng build đang chạy — 39 assets + 7 font Inter, tools đã trỏ đúng bundle mới)

> Lưu ý: đây là bản build đã nén (không có source gốc / sourcemap).
> Mọi chỉnh sửa trong thư mục này là **chỉnh trực tiếp trên dữ liệu trong bundle** —
> phù hợp với thay đổi dữ liệu (tên fee, component, số tiền, term, hạn đóng).
> Thay đổi cấu trúc giao diện cần source React gốc từ Dev.

## 1. Xem trước trên máy (không cần internet)

Chạy `run-local.bat` (hoặc `node tools\serve.js`) rồi mở:

- http://localhost:4173 — trang đăng nhập
- http://localhost:4173/admin/fee-types — trang Fee Types

Tài khoản demo:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| School Admin (S001 Greenfield Secondary) | `alicia.tan@school.example` | `Sch00l-Demo-26` |
| MOE HQ Officer | `daniel.lim@moe.example` | `HqOfficer-Demo-26` |
| Parent (Rachel Lim) | nút Singpass mô phỏng | — |

## 2. Chỉnh sửa dữ liệu Fee Types

Dữ liệu fee-types hiện tại của trang nằm trong `data\fee-types.json`:

```json
{
  "terms":    [{ "term": "2026 Term 4", "due": "2026-11-13" }, ...],
  "feeTypes": [
    {
      "id": "FT-01",
      "school": "S001",
      "name": "School Fees (Secondary)",
      "updated": "2026-09-28",
      "components": [{ "name": "Miscellaneous", "amount": 13 }, ...]
    }
  ]
}
```

Quy trình:

1. Sửa `data\fee-types.json` (đổi tên / số tiền / thêm-bớt component / thêm fee type mới).
   `school` là mã trường S001–S012; `level` (P1…Sec 4) là tuỳ chọn — bỏ trống = tất cả các level.
2. Chạy `apply-changes.bat` (hoặc `node tools\fee-types.js apply`).
3. Refresh trình duyệt (Ctrl+F5). App không dùng localStorage nên dữ liệu mới hiện ngay.

Các lệnh khác:

| Lệnh | Công dụng |
|---|---|
| `node tools\fee-types.js extract` | Đọc lại dữ liệu hiện tại trong bundle ra JSON |
| `node tools\fee-types.js restore` | Khôi phục bundle về đúng phiên bản đang chạy trên Vercel (file `.orig`) |

## 3. Đẩy lại lên Vercel (sau khi approve)

Cần đăng nhập Vercel bằng tài khoản **sở hữu project `agile-final-prototype`**, rồi:

```
cd D:\MaivenPoint\agile-final-prototype
vercel link        # chọn project agile-final-prototype
vercel deploy --prod
```

`vercel.json` đã có sẵn rewrite SPA nên route `/admin/fee-types` hoạt động như bản gốc.
