import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  HelpCircle,
  Users,
  UtensilsCrossed,
  Home,
  Moon,
  BarChart3,
  UserCog,
  CalendarDays,
  Trophy,
  Settings,
  ChevronRight,
  Shield,
  Utensils,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuideSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  content: GuideItem[];
}

interface GuideItem {
  question: string;
  answer: string;
  steps?: string[];
}

const guideSections: GuideSection[] = [
  {
    id: 'students',
    title: 'Quản lý học sinh',
    icon: Users,
    roles: ['admin', 'teacher', 'class_teacher'],
    content: [
      {
        question: 'Làm sao để thêm học sinh mới?',
        answer: 'Bạn có thể thêm học sinh bằng 2 cách: thêm thủ công hoặc nhập từ file Excel.',
        steps: [
          'Vào menu "Thông tin học sinh"',
          'Nhấn nút "Thêm học sinh" hoặc "Nhập Excel"',
          'Điền đầy đủ thông tin học sinh',
          'Chọn lớp và nhóm mâm ăn phù hợp',
          'Nhấn "Lưu" để hoàn tất',
        ],
      },
      {
        question: 'Cách chỉnh sửa thông tin học sinh?',
        answer: 'Nhấn vào học sinh cần sửa trong danh sách, cập nhật thông tin và lưu lại.',
        steps: [
          'Vào menu "Thông tin học sinh"',
          'Tìm và chọn học sinh cần sửa',
          'Nhấn nút "Sửa" hoặc nhấp đúp vào hàng',
          'Cập nhật thông tin cần thiết',
          'Nhấn "Lưu" để hoàn tất',
        ],
      },
      {
        question: 'Cách phân nhóm mâm ăn cho học sinh?',
        answer: 'Trong thông tin học sinh, chọn trường "Nhóm mâm" để phân chia học sinh theo nhóm ăn.',
        steps: [
          'Vào phần chỉnh sửa thông tin học sinh',
          'Tìm mục "Nhóm mâm"',
          'Chọn nhóm mâm phù hợp (Mâm 1, Mâm 2,...)',
          'Lưu thay đổi',
        ],
      },
    ],
  },
  {
    id: 'meals',
    title: 'Báo cáo bữa ăn',
    icon: UtensilsCrossed,
    roles: ['admin', 'teacher', 'class_teacher', 'kitchen', 'accountant'],
    content: [
      {
        question: 'Quy trình báo cơm hàng ngày?',
        answer: 'Báo cơm được thực hiện trước mỗi bữa ăn, thống kê số học sinh ăn/vắng.',
        steps: [
          'Vào menu "Báo cáo bữa ăn"',
          'Chọn lớp và bữa ăn (sáng/trưa/tối)',
          'Đánh dấu học sinh vắng ăn',
          'Ghi chú lý do nếu có',
          'Nhấn "Lưu báo cáo"',
        ],
      },
      {
        question: 'Cách xem thống kê bữa ăn toàn trường?',
        answer: 'Vào menu "Thống kê" để xem tổng hợp số lượng ăn của toàn trường.',
        steps: [
          'Vào menu "Thống kê"',
          'Chọn tab "Bữa ăn"',
          'Xem tổng số học sinh ăn, vắng theo từng bữa',
          'Có thể xuất báo cáo dạng ảnh hoặc Excel',
        ],
      },
      {
        question: 'Cách xuất báo cáo bữa ăn?',
        answer: 'Trong phần thống kê, nhấn nút "Xuất báo cáo" để tải về dạng ảnh hoặc Excel.',
        steps: [
          'Vào "Thống kê" > "Bữa ăn"',
          'Nhấn nút "Xuất báo cáo"',
          'Chọn định dạng: Ảnh thống kê, DS vắng theo mâm, hoặc Excel',
          'Chia sẻ hoặc tải về',
        ],
      },
    ],
  },
  {
    id: 'boarding',
    title: 'Điểm danh nội trú',
    icon: Home,
    roles: ['admin', 'teacher', 'class_teacher'],
    content: [
      {
        question: 'Quy trình điểm danh nội trú?',
        answer: 'Điểm danh nội trú thực hiện vào buổi tối để kiểm tra học sinh có mặt tại ký túc xá.',
        steps: [
          'Vào menu "Điểm danh nội trú"',
          'Chọn ngày và lớp cần điểm danh',
          'Đánh dấu học sinh vắng',
          'Ghi chú lý do vắng (có phép/không phép)',
          'Nhấn "Lưu" để hoàn tất',
        ],
      },
      {
        question: 'Cách ghi nhận học sinh vắng có phép?',
        answer: 'Khi đánh dấu vắng, chọn "Có phép" và nhập lý do cụ thể.',
        steps: [
          'Chọn học sinh vắng',
          'Nhấn nút "Có phép"',
          'Nhập lý do (về nhà, đi khám bệnh,...)',
          'Lưu thay đổi',
        ],
      },
    ],
  },
  {
    id: 'evening_study',
    title: 'Điểm danh tự học',
    icon: Moon,
    roles: ['admin', 'teacher', 'class_teacher'],
    content: [
      {
        question: 'Quy trình điểm danh giờ tự học?',
        answer: 'Điểm danh tự học thực hiện vào các ca học tối để kiểm tra học sinh.',
        steps: [
          'Vào menu "Điểm danh giờ học"',
          'Chọn ngày, lớp và ca học',
          'Đánh dấu học sinh vắng',
          'Ghi chú nếu cần',
          'Nhấn "Lưu"',
        ],
      },
      {
        question: 'Có thể điểm danh nhiều ca cùng lúc không?',
        answer: 'Mỗi lần điểm danh cho 1 ca. Sau khi xong ca 1, chuyển sang ca 2.',
        steps: [
          'Hoàn thành điểm danh ca 1',
          'Chọn ca 2 từ danh sách',
          'Tiếp tục điểm danh',
        ],
      },
    ],
  },
  {
    id: 'statistics',
    title: 'Thống kê báo cáo',
    icon: BarChart3,
    roles: ['admin', 'teacher', 'class_teacher', 'accountant', 'kitchen'],
    content: [
      {
        question: 'Các loại báo cáo thống kê?',
        answer: 'Hệ thống cung cấp thống kê bữa ăn, nội trú, tự học và thi đua.',
        steps: [
          'Thống kê bữa ăn: Số lượng ăn, vắng theo ngày/tuần',
          'Thống kê nội trú: Tình trạng điểm danh',
          'Thống kê tự học: Số học sinh vắng các ca',
          'Thống kê thi đua: Điểm thi đua các lớp',
        ],
      },
      {
        question: 'Cách xuất báo cáo cho kế toán?',
        answer: 'Sử dụng chức năng xuất Excel trong phần thống kê.',
        steps: [
          'Vào "Thống kê"',
          'Chọn loại báo cáo cần xuất',
          'Nhấn "Xuất Excel"',
          'Tải file về và xử lý',
        ],
      },
    ],
  },
  {
    id: 'emulation',
    title: 'Thi đua',
    icon: Trophy,
    roles: ['admin', 'teacher', 'class_teacher'],
    content: [
      {
        question: 'Cách nhập điểm thi đua?',
        answer: 'Điểm thi đua được nhập theo tuần, bao gồm điểm học tập, kỷ luật và nội trú.',
        steps: [
          'Vào menu "Thi đua"',
          'Chọn tuần cần nhập điểm',
          'Chọn lớp',
          'Nhập điểm các tiêu chí',
          'Nhấn "Lưu"',
        ],
      },
      {
        question: 'Cách xem bảng xếp hạng thi đua?',
        answer: 'Bảng xếp hạng hiển thị tự động dựa trên tổng điểm các lớp.',
        steps: [
          'Vào menu "Thi đua"',
          'Xem bảng xếp hạng bên phải màn hình',
          'Có thể xuất bảng xếp hạng dạng ảnh',
        ],
      },
    ],
  },
  {
    id: 'duty_schedule',
    title: 'Lịch trực',
    icon: CalendarDays,
    roles: ['admin', 'teacher'],
    content: [
      {
        question: 'Cách xem lịch trực?',
        answer: 'Lịch trực hiển thị theo tuần, cho biết ai trực ngày nào.',
        steps: [
          'Vào menu "Lịch trực"',
          'Xem lịch theo tuần hoặc tháng',
          'Xem chi tiết người trực từng ngày',
        ],
      },
      {
        question: 'Cách thêm/sửa lịch trực?',
        answer: 'Chỉ Admin mới có quyền thêm/sửa lịch trực.',
        steps: [
          'Vào "Lịch trực"',
          'Nhấn nút "Thêm lịch trực"',
          'Chọn ngày và người trực',
          'Lưu thay đổi',
        ],
      },
    ],
  },
  {
    id: 'user_management',
    title: 'Quản lý tài khoản',
    icon: UserCog,
    roles: ['admin'],
    content: [
      {
        question: 'Cách thêm tài khoản giáo viên?',
        answer: 'Admin có thể tạo tài khoản mới cho giáo viên và phân quyền.',
        steps: [
          'Vào menu "Quản lý tài khoản"',
          'Nhấn "Thêm người dùng"',
          'Nhập thông tin: họ tên, email, vai trò',
          'Phân quyền truy cập',
          'Nhấn "Tạo" để hoàn tất',
        ],
      },
      {
        question: 'Cách reset mật khẩu cho người dùng?',
        answer: 'Admin có thể đặt lại mật khẩu cho người dùng quên mật khẩu.',
        steps: [
          'Vào "Quản lý tài khoản"',
          'Tìm người dùng cần reset',
          'Nhấn nút "Reset mật khẩu"',
          'Nhập mật khẩu mới và xác nhận',
        ],
      },
      {
        question: 'Các vai trò trong hệ thống?',
        answer: 'Hệ thống có nhiều vai trò: Admin, Giáo viên, GVCN, Kế toán, Nhà bếp, BGH.',
        steps: [
          'Admin: Toàn quyền quản lý',
          'Giáo viên: Điểm danh, báo cơm',
          'GVCN: Quản lý lớp chủ nhiệm',
          'Kế toán: Xem thống kê, báo cáo',
          'Nhà bếp: Xem số lượng ăn',
          'BGH: Xem tổng quan',
        ],
      },
    ],
  },
  {
    id: 'settings',
    title: 'Cài đặt',
    icon: Settings,
    roles: ['admin', 'teacher', 'class_teacher'],
    content: [
      {
        question: 'Cách đổi mật khẩu?',
        answer: 'Vào Cài đặt > Tài khoản để đổi mật khẩu cá nhân.',
        steps: [
          'Vào menu "Cài đặt"',
          'Chọn "Đổi mật khẩu"',
          'Nhập mật khẩu cũ và mật khẩu mới',
          'Xác nhận để hoàn tất',
        ],
      },
      {
        question: 'Cách cài đặt thời hạn báo cơm?',
        answer: 'Admin có thể thiết lập giờ hết hạn báo cơm cho từng bữa.',
        steps: [
          'Vào "Cài đặt" > "Bữa ăn"',
          'Thiết lập giờ deadline cho sáng/trưa/tối',
          'Lưu thay đổi',
        ],
      },
    ],
  },
];

// Role labels and icons
const roleInfo: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  admin: { label: 'Quản trị viên', icon: Shield, color: 'bg-red-100 text-red-800' },
  teacher: { label: 'Giáo viên', icon: GraduationCap, color: 'bg-blue-100 text-blue-800' },
  class_teacher: { label: 'GVCN', icon: Users, color: 'bg-green-100 text-green-800' },
  accountant: { label: 'Kế toán', icon: BarChart3, color: 'bg-yellow-100 text-yellow-800' },
  kitchen: { label: 'Nhà bếp', icon: Utensils, color: 'bg-orange-100 text-orange-800' },
};

export default function Guide() {
  const { currentMembership, isSuperAdmin, isSchoolAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Get user's current role
  const userRole = isSuperAdmin ? 'admin' : (currentMembership?.role || 'teacher');

  // Filter sections based on user role
  const visibleSections = guideSections.filter(section => {
    if (isSuperAdmin || isSchoolAdmin()) return true;
    return section.roles.includes(userRole);
  });

  const toggleItem = (sectionId: string, index: number) => {
    const key = `${sectionId}-${index}`;
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const currentSection = visibleSections.find(s => s.id === activeSection);

  return (
    <div className="content-wrapper animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <HelpCircle className="h-6 w-6" />
          Hướng dẫn sử dụng
        </h1>
        <p className="page-description">
          Tài liệu hướng dẫn chi tiết các tính năng của phần mềm
        </p>
      </div>

      {/* Role indicator */}
      <Card className="mb-6 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              {roleInfo[userRole] ? (
                (() => {
                  const RoleIcon = roleInfo[userRole].icon;
                  return <RoleIcon className="h-5 w-5 text-primary" />;
                })()
              ) : (
                <Shield className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hướng dẫn dành cho vai trò</p>
              <p className="font-semibold text-foreground">
                {roleInfo[userRole]?.label || (isSuperAdmin ? 'Super Admin' : 'Người dùng')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="features" className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="features">Theo tính năng</TabsTrigger>
          <TabsTrigger value="roles">Theo vai trò</TabsTrigger>
          <TabsTrigger value="faq">Câu hỏi thường gặp</TabsTrigger>
        </TabsList>

        {/* Tab: Theo tính năng */}
        <TabsContent value="features" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              return (
                <Card
                  key={section.id}
                  className={cn(
                    'cursor-pointer transition-all hover:border-primary hover:shadow-md',
                    activeSection === section.id && 'border-primary ring-1 ring-primary'
                  )}
                  onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{section.title}</h3>
                      <p className="text-sm text-muted-foreground">{section.content.length} mục hướng dẫn</p>
                    </div>
                    <ChevronRight className={cn(
                      'h-5 w-5 text-muted-foreground transition-transform',
                      activeSection === section.id && 'rotate-90'
                    )} />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Expanded section content */}
          {currentSection && (
            <Card className="animate-fade-in">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <currentSection.icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{currentSection.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[60vh]">
                  <div className="space-y-3 pr-4">
                    {currentSection.content.map((item, index) => {
                      const isExpanded = expandedItems.has(`${currentSection.id}-${index}`);
                      return (
                        <div
                          key={index}
                          className={cn(
                            'rounded-lg border bg-card transition-all',
                            isExpanded ? 'border-primary/50' : 'border-border'
                          )}
                        >
                          <button
                            className="flex w-full items-center justify-between p-4 text-left"
                            onClick={() => toggleItem(currentSection.id, index)}
                          >
                            <span className="font-medium">{item.question}</span>
                            <ChevronRight className={cn(
                              'h-5 w-5 text-muted-foreground transition-transform',
                              isExpanded && 'rotate-90'
                            )} />
                          </button>
                          {isExpanded && (
                            <div className="border-t px-4 pb-4 pt-3 animate-fade-in">
                              <p className="text-muted-foreground mb-3">{item.answer}</p>
                              {item.steps && item.steps.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">Các bước thực hiện:</p>
                                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                                    {item.steps.map((step, stepIndex) => (
                                      <li key={stepIndex}>{step}</li>
                                    ))}
                                  </ol>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Theo vai trò */}
        <TabsContent value="roles" className="space-y-4">
          {Object.entries(roleInfo).map(([roleKey, info]) => {
            const RoleIcon = info.icon;
            const roleSections = guideSections.filter(s => s.roles.includes(roleKey));
            
            return (
              <Card key={roleKey}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Badge className={cn('px-3 py-1', info.color)}>
                      <RoleIcon className="h-4 w-4 mr-1" />
                      {info.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {roleSections.map(section => {
                      const Icon = section.icon;
                      return (
                        <div
                          key={section.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{section.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Tab: FAQ */}
        <TabsContent value="faq" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Câu hỏi thường gặp</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  {
                    q: 'Tôi quên mật khẩu, làm sao để lấy lại?',
                    a: 'Liên hệ Admin của trường để được reset mật khẩu, hoặc sử dụng chức năng "Quên mật khẩu" trên trang đăng nhập.',
                  },
                  {
                    q: 'Báo cơm sau giờ deadline có được không?',
                    a: 'Không. Hệ thống sẽ khóa báo cơm sau giờ deadline. Liên hệ Admin nếu cần mở khóa đặc biệt.',
                  },
                  {
                    q: 'Làm sao để xem lịch sử điểm danh?',
                    a: 'Vào phần Thống kê, chọn loại điểm danh và khoảng thời gian cần xem.',
                  },
                  {
                    q: 'Ứng dụng có hoạt động offline không?',
                    a: 'Hiện tại ứng dụng cần kết nối internet để hoạt động. Các dữ liệu đã tải có thể xem offline tạm thời.',
                  },
                  {
                    q: 'Làm sao để cài đặt app trên điện thoại?',
                    a: 'Vào Menu > Cài đặt ứng dụng để xem hướng dẫn cài PWA trên iOS và Android.',
                  },
                ].map((faq, index) => (
                  <div key={index} className="rounded-lg border p-4">
                    <p className="font-medium mb-2">{faq.q}</p>
                    <p className="text-sm text-muted-foreground">{faq.a}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Contact support */}
          <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="py-6 text-center">
              <HelpCircle className="h-12 w-12 mx-auto text-primary mb-3" />
              <h3 className="font-semibold text-lg mb-2">Cần hỗ trợ thêm?</h3>
              <p className="text-muted-foreground mb-4">
                Liên hệ với chúng tôi qua Zalo để được hỗ trợ nhanh chóng
              </p>
              <a
                href="https://zalo.me/0888770699"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Zalo: 0888 770 699
              </a>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
