
-- Table for guide/documentation sections
CREATE TABLE public.guide_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  video_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guide_sections ENABLE ROW LEVEL SECURITY;

-- Public read access (docs page is public)
CREATE POLICY "Anyone can view active guide sections"
ON public.guide_sections FOR SELECT
USING (is_active = true);

-- Only super_admin can manage
CREATE POLICY "Super admins can insert guide sections"
ON public.guide_sections FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update guide sections"
ON public.guide_sections FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete guide sections"
ON public.guide_sections FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Storage bucket for guide images
INSERT INTO storage.buckets (id, name, public) VALUES ('guide-images', 'guide-images', true);

-- Allow authenticated users to upload to guide-images
CREATE POLICY "Authenticated users can upload guide images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'guide-images');

-- Public read for guide images
CREATE POLICY "Anyone can view guide images"
ON storage.objects FOR SELECT
USING (bucket_id = 'guide-images');

-- Allow super admins to delete guide images
CREATE POLICY "Authenticated can delete guide images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'guide-images');

-- Seed the existing hardcoded content as initial data
INSERT INTO public.guide_sections (title, content, display_order) VALUES
('Tổng quan', '<p><strong>QUẢN LÝ NỘI TRÚ / BÁN TRÚ</strong> là ứng dụng web hỗ trợ các trường nội trú, bán trú quản lý toàn diện hoạt động hàng ngày: từ điểm danh, báo cơm, y tế, thi đua đến thống kê báo cáo — tất cả trên một nền tảng duy nhất.</p>
<p>Ứng dụng hoạt động trên mọi thiết bị (máy tính, điện thoại, máy tính bảng) và có thể cài đặt như app điện thoại thông qua công nghệ PWA.</p>
<h4>Điểm nổi bật:</h4>
<ul>
<li>Giao diện đơn giản, dễ sử dụng cho giáo viên</li>
<li>Báo cáo bằng ảnh — chia sẻ nhanh qua Zalo, Messenger</li>
<li>Xuất Excel chi tiết cho kế toán</li>
<li>Phân quyền linh hoạt theo vai trò</li>
<li>Đồng bộ Google Sheets tự động</li>
<li>Thông báo đẩy nhắc nhở báo cơm</li>
<li>Hỗ trợ quản lý đa trường (multi-school)</li>
</ul>', 1),

('Quản lý học sinh', '<p>Quản lý toàn bộ thông tin học sinh: hồ sơ cá nhân, lớp, nhóm mâm ăn, phòng ở, trạng thái nội trú.</p>
<ul>
<li>Thêm học sinh thủ công hoặc nhập hàng loạt từ file Excel</li>
<li>Phân lớp, phân nhóm mâm ăn (Mâm 1, 2, 3...)</li>
<li>Quản lý trạng thái nội trú / bán trú</li>
<li>Lưu trữ thông tin CCCD, số điện thoại phụ huynh</li>
<li>Tìm kiếm, lọc nhanh theo lớp, giới tính, dân tộc</li>
</ul>', 2),

('Báo cáo bữa ăn', '<p>Hệ thống báo cơm 3 bữa/ngày với deadline tự động, thống kê số lượng ăn theo lớp và nhóm mâm.</p>
<ul>
<li>Báo cơm sáng, trưa, tối với thời hạn (deadline) riêng</li>
<li>Đánh dấu học sinh vắng ăn theo từng bữa</li>
<li>Tự động tính tổng số suất ăn theo nhóm mâm</li>
<li>Xuất báo cáo dạng ảnh để chia sẻ qua Zalo/Messenger</li>
<li>Hỗ trợ ghi lý do vắng ăn (có phép / không phép)</li>
</ul>', 3),

('Bắt đầu sử dụng', '<h4>Trên điện thoại (Android/iOS):</h4>
<ol>
<li>Mở trình duyệt Chrome/Safari</li>
<li>Truy cập địa chỉ ứng dụng do quản trị viên cung cấp</li>
<li>Nhấn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính"</li>
<li>Đăng nhập bằng tài khoản được cấp</li>
</ol>
<h4>Trên máy tính:</h4>
<ol>
<li>Mở trình duyệt bất kỳ (Chrome, Edge, Firefox...)</li>
<li>Truy cập địa chỉ ứng dụng</li>
<li>Đăng nhập bằng tài khoản được cấp</li>
</ol>', 4),

('Quy trình sử dụng hàng ngày', '<h4>🌅 Buổi sáng</h4>
<ol>
<li>Giáo viên điểm danh và báo cơm bữa sáng cho lớp</li>
<li>Nhà bếp xem tổng số suất ăn trưa</li>
</ol>
<h4>🌤️ Buổi trưa</h4>
<ol>
<li>Giáo viên báo cơm bữa trưa</li>
<li>Báo cơm bữa tối (trước deadline)</li>
</ol>
<h4>🌙 Buổi tối</h4>
<ol>
<li>Điểm danh giờ tự học (các ca)</li>
<li>Điểm danh nội trú</li>
<li>Báo cơm sáng ngày mai (trước deadline)</li>
</ol>', 5);
