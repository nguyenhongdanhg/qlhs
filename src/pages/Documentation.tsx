import {
  Users, UtensilsCrossed, Home, Moon, BarChart3, Trophy,
  CalendarDays, UserCog, Settings, Heart, DoorOpen, Printer,
  BookOpen, Shield, Smartphone, ChevronRight, GraduationCap,
  ClipboardList, FileSpreadsheet, Bell, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const features = [
  {
    icon: Users,
    title: 'Quản lý học sinh',
    desc: 'Quản lý toàn bộ thông tin học sinh: hồ sơ cá nhân, lớp, nhóm mâm ăn, phòng ở, trạng thái nội trú.',
    details: [
      'Thêm học sinh thủ công hoặc nhập hàng loạt từ file Excel',
      'Phân lớp, phân nhóm mâm ăn (Mâm 1, 2, 3...)',
      'Quản lý trạng thái nội trú / bán trú',
      'Lưu trữ thông tin CCCD, số điện thoại phụ huynh',
      'Tìm kiếm, lọc nhanh theo lớp, giới tính, dân tộc',
    ],
  },
  {
    icon: UtensilsCrossed,
    title: 'Báo cáo bữa ăn',
    desc: 'Hệ thống báo cơm 3 bữa/ngày với deadline tự động, thống kê số lượng ăn theo lớp và nhóm mâm.',
    details: [
      'Báo cơm sáng, trưa, tối với thời hạn (deadline) riêng',
      'Đánh dấu học sinh vắng ăn theo từng bữa',
      'Tự động tính tổng số suất ăn theo nhóm mâm',
      'Xuất báo cáo dạng ảnh để chia sẻ qua Zalo/Messenger',
      'Xuất danh sách vắng theo nhóm mâm cho nhà bếp',
      'Hỗ trợ ghi lý do vắng ăn (có phép / không phép)',
    ],
  },
  {
    icon: Home,
    title: 'Điểm danh nội trú',
    desc: 'Điểm danh học sinh nội trú vào buổi tối, theo dõi tình trạng có mặt tại ký túc xá.',
    details: [
      'Điểm danh theo lớp hoặc toàn trường',
      'Đánh dấu vắng có phép / không phép',
      'Ghi chú lý do vắng chi tiết',
      'Xuất báo cáo điểm danh dạng ảnh',
      'Xem lịch sử điểm danh theo ngày',
    ],
  },
  {
    icon: Moon,
    title: 'Điểm danh giờ tự học',
    desc: 'Quản lý điểm danh các ca tự học tối của học sinh nội trú.',
    details: [
      'Hỗ trợ nhiều ca học (Ca 1, Ca 2...)',
      'Điểm danh từng ca riêng biệt',
      'Theo dõi học sinh vắng theo ca',
      'Xuất báo cáo và chia sẻ nhanh',
    ],
  },
  {
    icon: Trophy,
    title: 'Thi đua',
    desc: 'Chấm điểm thi đua hàng tuần cho các lớp, xếp hạng tự động.',
    details: [
      'Nhập điểm thi đua theo 3 tiêu chí: Học tập, Kỷ luật, Nội trú',
      'Xếp hạng tự động theo tổng điểm',
      'Cài đặt tuần thi đua linh hoạt',
      'Xuất bảng xếp hạng dạng ảnh',
      'Xuất Excel thống kê thi đua theo tuần/tháng',
    ],
  },
  {
    icon: Heart,
    title: 'Y tế học đường',
    desc: 'Ghi nhận và quản lý sức khỏe học sinh, kho thuốc, lịch sử điều trị.',
    details: [
      'Ghi nhận bệnh lý: phát thuốc, sơ cứu, chuyển viện, phụ huynh đón',
      'Quản lý kho thuốc: nhập/xuất, tồn kho, hạn sử dụng',
      'Liên kết thuốc đã cấp với hồ sơ y tế',
      'Ghi nhận liên hệ phụ huynh',
      'Xem lịch sử y tế theo học sinh',
    ],
  },
  {
    icon: DoorOpen,
    title: 'Xin ra cổng',
    desc: 'Quản lý đơn xin ra cổng của học sinh nội trú, phê duyệt và theo dõi.',
    details: [
      'Tạo đơn xin ra cổng với giờ đi và giờ về dự kiến',
      'Phê duyệt / từ chối đơn với lý do',
      'Theo dõi trạng thái đơn (chờ duyệt, đã duyệt, từ chối)',
      'Xuất báo cáo ra cổng dạng ảnh',
    ],
  },
  {
    icon: CalendarDays,
    title: 'Lịch trực',
    desc: 'Quản lý và phân công lịch trực giáo viên theo tuần.',
    details: [
      'Phân công trực theo ngày',
      'Quản lý danh sách thành viên trực',
      'Xem lịch trực theo tuần/tháng',
      'Thống kê số lần trực',
      'Xuất lịch trực dạng Excel',
    ],
  },
  {
    icon: ClipboardList,
    title: 'Thực đơn & Nhà bếp',
    desc: 'Quản lý thực đơn hàng ngày, mẫu thực đơn tuần, và chi phí nguyên liệu.',
    details: [
      'Tạo thực đơn theo ngày cho từng bữa',
      'Mẫu thực đơn tuần - tự động áp dụng',
      'Quản lý nguyên liệu: nhập/xuất, giá, nhà cung cấp',
      'Thống kê chi phí nguyên liệu theo ngày/tháng',
    ],
  },
  {
    icon: BarChart3,
    title: 'Thống kê & Báo cáo',
    desc: 'Tổng hợp dữ liệu toàn trường với biểu đồ trực quan và xuất file.',
    details: [
      'Thống kê bữa ăn: số suất, kg gạo theo ngày',
      'Thống kê điểm danh nội trú và tự học',
      'Biểu đồ trực quan (cột, tròn, đường)',
      'Xuất Excel chi tiết cho kế toán',
      'Xuất ảnh báo cáo để chia sẻ nhanh',
    ],
  },
  {
    icon: UserCog,
    title: 'Quản lý tài khoản',
    desc: 'Tạo và phân quyền tài khoản cho giáo viên, nhân viên trong trường.',
    details: [
      'Tạo tài khoản với nhiều vai trò: Admin, Giáo viên, GVCN, Kế toán, Nhà bếp, BGH',
      'Phân quyền theo nhóm quyền hoặc cá nhân',
      'Reset mật khẩu cho người dùng',
      'Xem lịch sử đăng nhập',
      'Nhập hàng loạt tài khoản từ Excel',
    ],
  },
  {
    icon: Settings,
    title: 'Cài đặt hệ thống',
    desc: 'Tùy chỉnh các thông số cho trường: deadline báo cơm, đồng bộ Google Sheets.',
    details: [
      'Thiết lập giờ deadline báo cơm cho từng bữa',
      'Cấu hình lượng gạo/học sinh',
      'Đồng bộ dữ liệu với Google Sheets',
      'Quản lý thông báo đẩy (push notification)',
    ],
  },
];

const roles = [
  { name: 'Admin (Quản trị)', desc: 'Toàn quyền quản lý: tài khoản, cài đặt, dữ liệu, báo cáo.', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  { name: 'Giáo viên', desc: 'Điểm danh, báo cơm cho các lớp trong trường.', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { name: 'GVCN (Giáo viên chủ nhiệm)', desc: 'Quản lý lớp chủ nhiệm: điểm danh, báo cơm, xem thống kê lớp.', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { name: 'Kế toán', desc: 'Xem thống kê, xuất báo cáo Excel, theo dõi chi phí.', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { name: 'Nhà bếp', desc: 'Xem số lượng suất ăn, thực đơn, quản lý nguyên liệu.', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  { name: 'BGH (Ban giám hiệu)', desc: 'Xem tổng quan, theo dõi thi đua, xem báo cáo.', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
];

export default function Documentation() {
  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-background">
      {/* Header - hidden when printing */}
      <div className="print:hidden sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/auth" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Về trang đăng nhập
          </a>
          <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            In / Tải PDF
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 print:px-0 print:py-0">
        {/* Cover */}
        <div className="text-center mb-12 print:mb-8 print:pt-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6 print:mb-4">
            <GraduationCap className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3 print:text-3xl">
            QUẢN LÝ NỘI TRÚ / BÁN TRÚ
          </h1>
          <p className="text-lg text-muted-foreground mb-2">
            Ứng dụng thông tin quản lý học sinh
          </p>
          <p className="text-sm text-muted-foreground">
            Tài liệu giới thiệu tổng quan & Hướng dẫn sử dụng
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <Badge variant="secondary" className="gap-1"><Smartphone className="h-3 w-3" /> PWA</Badge>
            <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> Bảo mật</Badge>
            <Badge variant="secondary" className="gap-1"><FileSpreadsheet className="h-3 w-3" /> Xuất Excel</Badge>
            <Badge variant="secondary" className="gap-1"><Bell className="h-3 w-3" /> Thông báo</Badge>
          </div>
        </div>

        <Separator className="mb-10 print:mb-6" />

        {/* Section 1: Overview */}
        <section className="mb-12 print:mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            1. Tổng quan
          </h2>
          <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
            <p>
              <strong className="text-foreground">QUẢN LÝ NỘI TRÚ / BÁN TRÚ</strong> là ứng dụng web hỗ trợ các trường nội trú, bán trú quản lý toàn diện hoạt động hàng ngày: 
              từ điểm danh, báo cơm, y tế, thi đua đến thống kê báo cáo — tất cả trên một nền tảng duy nhất.
            </p>
            <p>
              Ứng dụng hoạt động trên mọi thiết bị (máy tính, điện thoại, máy tính bảng) và có thể cài đặt như app điện thoại thông qua công nghệ PWA (Progressive Web App).
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border print:bg-gray-50">
              <p className="font-semibold text-foreground mb-2">Điểm nổi bật:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Giao diện đơn giản, dễ sử dụng cho giáo viên</li>
                <li>Báo cáo bằng ảnh — chia sẻ nhanh qua Zalo, Messenger</li>
                <li>Xuất Excel chi tiết cho kế toán</li>
                <li>Phân quyền linh hoạt theo vai trò</li>
                <li>Đồng bộ Google Sheets tự động</li>
                <li>Thông báo đẩy nhắc nhở báo cơm</li>
                <li>Hỗ trợ quản lý đa trường (multi-school)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 2: Features */}
        <section className="mb-12 print:mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            2. Các tính năng chi tiết
          </h2>
          <div className="space-y-8">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="print:break-inside-avoid">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        2.{idx + 1}. {feature.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">{feature.desc}</p>
                    </div>
                  </div>
                  <ul className="ml-12 space-y-1">
                    {feature.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ChevronRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  {idx < features.length - 1 && <Separator className="mt-5" />}
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 3: Roles */}
        <section className="mb-12 print:mb-8 print:break-inside-avoid">
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            3. Phân quyền & Vai trò
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Hệ thống phân quyền linh hoạt theo vai trò, đảm bảo mỗi người dùng chỉ truy cập được các chức năng phù hợp.
          </p>
          <div className="grid gap-3">
            {roles.map((role, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border print:p-2">
                <Badge className={`${role.color} text-xs font-medium whitespace-nowrap`}>
                  {role.name}
                </Badge>
                <p className="text-sm text-muted-foreground">{role.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Getting Started */}
        <section className="mb-12 print:mb-8 print:break-inside-avoid">
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-primary" />
            4. Bắt đầu sử dụng
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="bg-muted/50 rounded-lg p-4 border print:bg-gray-50">
              <p className="font-semibold text-foreground mb-3">Trên điện thoại (Android/iOS):</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Mở trình duyệt Chrome/Safari</li>
                <li>Truy cập địa chỉ ứng dụng do quản trị viên cung cấp</li>
                <li>Nhấn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính"</li>
                <li>Đăng nhập bằng tài khoản được cấp</li>
              </ol>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 border print:bg-gray-50">
              <p className="font-semibold text-foreground mb-3">Trên máy tính:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Mở trình duyệt bất kỳ (Chrome, Edge, Firefox...)</li>
                <li>Truy cập địa chỉ ứng dụng</li>
                <li>Đăng nhập bằng tài khoản được cấp</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Section 5: Workflow */}
        <section className="mb-12 print:mb-8 print:break-inside-avoid">
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            5. Quy trình sử dụng hàng ngày
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="bg-muted/50 rounded-lg p-4 border print:bg-gray-50">
              <p className="font-semibold text-foreground mb-2">🌅 Buổi sáng</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Giáo viên điểm danh và báo cơm bữa sáng cho lớp</li>
                <li>Nhà bếp xem tổng số suất ăn trưa</li>
              </ol>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 border print:bg-gray-50">
              <p className="font-semibold text-foreground mb-2">🌤️ Buổi trưa</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Giáo viên báo cơm bữa trưa</li>
                <li>Báo cơm bữa tối (trước deadline)</li>
              </ol>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 border print:bg-gray-50">
              <p className="font-semibold text-foreground mb-2">🌙 Buổi tối</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Điểm danh giờ tự học (các ca)</li>
                <li>Điểm danh nội trú</li>
                <li>Báo cơm sáng ngày mai (trước deadline)</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Footer */}
        <Separator className="mb-6" />
        <div className="text-center text-xs text-muted-foreground pb-10 print:pb-4">
          <p className="font-medium text-foreground mb-1">QUẢN LÝ NỘI TRÚ / BÁN TRÚ</p>
          <p>Thiết kế & phát triển bởi Trần Hữu Cường</p>
          <p>SĐT: 0386 805 841 | Email: huucuong.se@gmail.com</p>
        </div>
      </div>
    </div>
  );
}
