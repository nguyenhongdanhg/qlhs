
# Kế hoạch: Tổ chức lại menu & thêm module Công việc

## 1. Cấu trúc menu mới (6 nhóm)

Sắp xếp lại điều hướng ở cả sidebar (desktop) và bottom-nav/menu (mobile). Mỗi nhóm chỉ tải code khi user click (dùng `React.lazy` cho từng trang) để trang nhẹ hơn.

```
📊 Tổng quan (Bảng tin - giữ nguyên)

📋 1. Công việc & tiến độ         (MỚI)
   ├─ Đảng
   ├─ Chuyên môn
   ├─ Nội trú
   └─ Đoàn - Đội

🏠 2. Quản lý nội trú
   ├─ Lịch trực
   ├─ Điểm danh nội trú
   ├─ Điểm danh tự học
   ├─ Báo ăn (chỉ nhập + ảnh báo cáo hàng ngày)
   └─ Ra vào KTX

🏆 3. Thi đua - Sức khoẻ
   ├─ Thi đua
   └─ Sức khoẻ

🍽️ 4. Thực phẩm
   ├─ Thực đơn
   └─ Kho thực phẩm

📈 5. Thống kê & Báo cáo          (TÁCH RA)
   ├─ Thống kê điểm danh
   ├─ Thống kê báo ăn
   ├─ Thống kê y tế
   └─ Xuất Excel các mục

⚙️ 6. Cài đặt
   ├─ Học sinh
   ├─ Giáo viên
   ├─ Người dùng
   ├─ Thông tin tài khoản
   └─ Hướng dẫn
```

## 2. Module "Công việc & tiến độ" (mới)

### Tính năng
- Bảng danh sách: **STT | Nội dung | Người thực hiện | Hạn hoàn thành | Trạng thái | Tài liệu**
- 4 danh mục lọc bằng tab: Đảng / Chuyên môn / Nội trú / Đoàn-Đội
- Cảnh báo đỏ khi còn ≤ 2 ngày đến hạn + gửi push notification cho người được giao
- Người được giao: đánh dấu "Hoàn thành" hoặc gõ "Phản hồi"
- Upload tài liệu → Google Drive (dùng service account đã có) → lưu link, click "Xem" mở Drive
- Phân quyền: chỉ user có quyền `tasks_manage` mới tạo/giao việc trong danh mục đó

### Cấu trúc DB
- `task_categories` (enum cứng: dang / chuyen_mon / noi_tru / doan_doi)
- `tasks`: school_id, category, title, description, assignee_id, deadline, status (pending/done), created_by
- `task_responses`: task_id, user_id, content, created_at
- `task_attachments`: task_id, file_name, drive_file_id, drive_url, uploaded_by
- RLS: admin xem tất cả; user chỉ thấy việc được giao hoặc mình tạo
- Cron/edge function chạy hàng ngày để tạo notification cho task sắp đến hạn

### Trang mới
- `/tasks` — danh sách + tab category + dialog tạo/sửa
- Component: `TaskList`, `TaskFormDialog`, `TaskResponseDialog`, `TaskAttachmentUpload`
- Edge function `upload-task-attachment` (giống `upload-exit-attachment`)
- Edge function `check-task-deadlines` để gửi notification

## 3. Code-splitting để nhẹ trang

Sửa `src/App.tsx`: đổi tất cả `import Page from` thành `const Page = lazy(() => import(...))` và bọc `<Suspense>`. Trang Điểm danh sẽ **không** còn import `Statistics`/`Export` — chuyển các nút "Xuất Excel", "Thống kê" sang trang Thống kê riêng.

Các dialog nặng (`MealExportDialog`, `HealthExportDialog`, `EmulationExportDialog`, ...) đổi sang lazy import trong chính component chứa chúng, chỉ load khi user click nút mở dialog.

## 4. Thứ tự thực hiện

1. **Migration DB**: tạo 3 bảng tasks + enum + RLS + grants
2. **Storage**: bucket `task-attachments` (private) + edge function upload
3. **Trang /tasks** + components + notification logic
4. **Cấu trúc lại menu** (Sidebar.tsx, MobileNav.tsx, MobileMenu.tsx) theo 6 nhóm
5. **Tách "Xuất Excel/Thống kê" ra khỏi trang điểm danh** — chuyển hết sang `/statistics`
6. **Lazy load** tất cả pages + dialog nặng trong App.tsx

## Chi tiết kỹ thuật (cho dev)

- Notification hạn: dùng trigger DB kiểm tra deadline < now()+2days, hoặc pg_cron gọi edge function mỗi sáng.
- Drive upload: tái dùng `GOOGLE_SERVICE_ACCOUNT_KEY` + `GOOGLE_DRIVE_FOLDER_ID` sẵn có.
- Phân quyền tasks: thêm feature code `tasks` vào `app_features` + `permission_group_permissions`.
- Giữ nguyên logic clamp năm học đã làm trước đó cho các trang mới.

---

Đây là công việc lớn (~15-20 files mới, migration DB, edge function). Anh xác nhận em triển khai theo thứ tự trên nhé? Nếu muốn ưu tiên phần nào trước (VD chỉ làm menu + lazy load trước, module Công việc làm sau), cho em biết.
