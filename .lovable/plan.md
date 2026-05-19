## Mục tiêu

Tạo module "Giáo viên" riêng (menu mới), đồng bộ chọn lọc từ danh sách tài khoản — admin đánh dấu user nào là giáo viên thì mới xuất hiện ở đây.

## Cấu trúc dữ liệu (3 bảng mới)

**1. `teachers`** — hồ sơ giáo viên (1 user = 1 hồ sơ trong 1 trường):
- Liên kết: `school_id`, `user_id` (unique)
- Thông tin cá nhân: họ tên, ngày sinh, giới tính, dân tộc, SĐT, email, quê quán, địa chỉ
- Công tác: cấp học (Tiểu học/THCS/THPT), môn dạy, chức vụ, ngày vào ngành
- Bậc lương: bậc, hạng, cấp, hệ số, ngày hưởng
- Trạng thái: `is_active`, ghi chú

**2. `teacher_absences`** — chỉ ghi ngày vắng (không tích = đi làm):
- `teacher_id`, `absence_date`, `absence_type` (phép/ốm/không phép/công tác), lý do, người báo
- Unique `(teacher_id, absence_date)`

**3. `teacher_achievements`** — thành tích:
- `teacher_id`, tiêu đề, loại (HSG/GV giỏi/Sáng kiến...), cấp (Trường/Huyện/Tỉnh/QG), năm học, ngày khen, file đính kèm, ghi chú

RLS: admin trường quản lý tất cả; thành viên trường xem được; super admin full quyền. Soft sync với profiles (full_name lấy từ teachers, không phụ thuộc profile để cho phép admin sửa riêng).

## Giao diện

Menu mới **"Giáo viên"** trong Sidebar desktop (mục Quản lý), thêm vào "Khác" trên mobile.

Trang `/teachers` có 5 tab:

**Tab 1 — Danh sách & Thông tin**
- Lưới giáo viên, click mở dialog chi tiết với form đầy đủ trường ở mục Cấu trúc
- Nút "Thêm GV từ tài khoản": chọn từ danh sách user trong trường → tạo bản ghi teacher
- Sửa/xoá/đánh dấu nghỉ việc

**Tab 2 — Chấm công**
- Lưới ngang: hàng = GV, cột = ngày trong tháng đang chọn
- Click ô để mở dialog ghi vắng (loại + lý do); ô trống = đi làm bình thường
- Tổng cộng cuối tháng: số ngày vắng theo từng loại

**Tab 3 — Thành tích**
- Bảng theo năm học, thêm/sửa/xoá; upload file (dùng bucket có sẵn hoặc tạo mới `teacher-files`)
- Lọc theo GV, năm, loại

**Tab 4 — Bậc lương**
- Bảng tổng hợp bậc/hạng/cấp/hệ số/ngày hưởng của tất cả GV
- Sửa nhanh inline + lịch sử nâng bậc (lưu trong cùng bảng teachers, có thể mở rộng sau)

**Tab 5 — Thống kê**
- Bộ lọc: cấp học, giới tính, dân tộc, môn, trạng thái
- Biểu đồ tròn/cột: phân bố giới tính, cấp học, độ tuổi, thâm niên
- Bảng đếm theo bậc lương, theo môn
- Xuất Excel danh sách đã lọc

## Phạm vi không làm trong lần này (đề xuất bổ sung sau nếu cần)
- Lịch sử nâng bậc dạng timeline riêng
- Import Excel hàng loạt giáo viên
- Tự GV bấm vào/ra

Bạn duyệt là tôi triển khai luôn — migration trước, code UI sau.