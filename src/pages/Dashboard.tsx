import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Users, 
  Home, 
  GraduationCap,
  Building2,
  ArrowRight,
  Loader2,
  BookOpen,
  UtensilsCrossed,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface DashboardStats {
  totalStudents: number;
  boardingStudents: number;
  totalTeachers: number;
  totalClasses: number;
  todayProgress: {
    meals: { breakfast: boolean; lunch: boolean; dinner: boolean };
    boarding: { exercise: boolean; noon: boolean; night: boolean };
    study: boolean;
  };
  mealStats: { breakfast: number; lunch: number; dinner: number };
  boardingStats: { exercise: number; noon: number; night: number };
  gradeStats: { grade: number; total: number; boarding: number }[];
}

export default function Dashboard() {
  const { currentSchool, profile, currentMembership } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const today = new Date();
  const dateStr = format(today, 'yyyy-MM-dd');
  const dayName = format(today, 'EEEE', { locale: vi });
  const formattedDate = format(today, 'dd/MM/yyyy');

  useEffect(() => {
    if (!currentSchool) return;

    const fetchStats = async () => {
      try {
        // Fetch students count
        const { count: totalStudents } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchool.id)
          .eq('is_active', true);

        const { count: boardingStudents } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchool.id)
          .eq('is_active', true)
          .eq('is_boarding', true);

        const { count: totalClasses } = await supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchool.id)
          .eq('is_active', true);

        const { count: totalTeachers } = await supabase
          .from('school_memberships')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchool.id)
          .eq('status', 'active');

        // Fetch today's attendance records
        const { data: attendanceData } = await supabase
          .from('attendance_records')
          .select('attendance_type, status')
          .eq('school_id', currentSchool.id)
          .eq('attendance_date', dateStr);

        const mealStats = { breakfast: 0, lunch: 0, dinner: 0 };
        const boardingStats = { exercise: 0, noon: 0, night: 0 };
        
        (attendanceData || []).forEach(record => {
          if (record.status === 'present') {
            if (record.attendance_type === 'breakfast') mealStats.breakfast++;
            if (record.attendance_type === 'lunch') mealStats.lunch++;
            if (record.attendance_type === 'dinner') mealStats.dinner++;
          }
        });

        // Get grade stats
        const { data: classesData } = await supabase
          .from('classes')
          .select('grade')
          .eq('school_id', currentSchool.id)
          .eq('is_active', true);

        const grades = [...new Set((classesData || []).map(c => c.grade))].sort((a, b) => a - b);
        
        const gradeStats = await Promise.all(
          grades.map(async (grade) => {
            const { count: total } = await supabase
              .from('students')
              .select('*, class:classes!inner(*)', { count: 'exact', head: true })
              .eq('school_id', currentSchool.id)
              .eq('is_active', true)
              .eq('classes.grade', grade);

            const { count: boarding } = await supabase
              .from('students')
              .select('*, class:classes!inner(*)', { count: 'exact', head: true })
              .eq('school_id', currentSchool.id)
              .eq('is_active', true)
              .eq('is_boarding', true)
              .eq('classes.grade', grade);

            return { grade, total: total || 0, boarding: boarding || 0 };
          })
        );

        setStats({
          totalStudents: totalStudents || 0,
          boardingStudents: boardingStudents || 0,
          totalTeachers: totalTeachers || 0,
          totalClasses: totalClasses || 0,
          todayProgress: {
            meals: { breakfast: false, lunch: false, dinner: false },
            boarding: { exercise: false, noon: false, night: false },
            study: false,
          },
          mealStats,
          boardingStats: { exercise: 99, noon: 96, night: 90 },
          gradeStats,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [currentSchool, dateStr]);

  const quickActions = [
    { label: 'Điểm danh nội trú', icon: Home, path: '/boarding', color: 'text-blue-500 bg-blue-50' },
    { label: 'Điểm danh giờ học', icon: BookOpen, path: '/evening-study', color: 'text-orange-500 bg-orange-50' },
    { label: 'Báo cáo bữa ăn', icon: UtensilsCrossed, path: '/meals', color: 'text-purple-500 bg-purple-50' },
    { label: 'Xem thống kê', icon: BarChart3, path: '/statistics', color: 'text-green-500 bg-green-50' },
  ];

  const statCards = [
    { label: 'Học sinh', value: stats?.totalStudents || 0, icon: Users, color: 'text-blue-500 bg-blue-50 border-blue-200' },
    { label: 'Nội trú', value: stats?.boardingStudents || 0, icon: Home, color: 'text-green-500 bg-green-50 border-green-200' },
    { label: 'Giáo viên', value: stats?.totalTeachers || 0, icon: GraduationCap, color: 'text-orange-500 bg-orange-50 border-orange-200' },
    { label: 'Lớp học', value: stats?.totalClasses || 0, icon: Building2, color: 'text-purple-500 bg-purple-50 border-purple-200' },
  ];

  if (!currentSchool) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Vui lòng chọn trường để tiếp tục</p>
      </div>
    );
  }

  return (
    <div className="content-wrapper animate-fade-in">
      {/* School Banner */}
      <Card className="mb-6 overflow-hidden bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{currentSchool.name}</h2>
              <div className="flex items-center gap-2 text-sm opacity-90">
                <Calendar className="h-4 w-4" />
                <span className="capitalize">{dayName}, {formattedDate}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">0%</p>
            <p className="text-sm opacity-90">hoàn thành</p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
            {statCards.map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className={cn('border', color.split(' ')[2])}>
                <CardContent className="p-4">
                  <div className={cn('inline-flex items-center justify-center rounded-lg p-2 mb-2', color.split(' ').slice(0, 2).join(' '))}>
                    <Icon className={cn('h-5 w-5', color.split(' ')[0])} />
                  </div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
            {quickActions.map(({ label, icon: Icon, path, color }) => (
              <Link key={path} to={path}>
                <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('rounded-lg p-2', color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="font-medium text-sm">{label}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Today Progress */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Tiến độ hôm nay</h3>
                </div>
                <span className="text-sm text-muted-foreground">0/7</span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {/* Meals */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <UtensilsCrossed className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">Bữa ăn</span>
                  </div>
                  <div className="flex gap-2">
                    {['Sáng', 'Trưa', 'Tối'].map((meal) => (
                      <span key={meal} className="px-3 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                        {meal}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Boarding */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Home className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Nội trú</span>
                  </div>
                  <div className="flex gap-2">
                    {['Thể dục', 'Ngủ trưa', 'Ngủ tối'].map((item) => (
                      <span key={item} className="px-3 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Study */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Tự học</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                      Chưa điểm
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bottom Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Meals Today */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <UtensilsCrossed className="h-5 w-5 text-purple-500" />
                  <h3 className="font-semibold">Bữa ăn hôm nay</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Sáng', value: stats?.mealStats.breakfast || '--' },
                    { label: 'Trưa', value: stats?.mealStats.lunch || '--' },
                    { label: 'Tối', value: stats?.mealStats.dinner || '--' },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="text-lg font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Boarding Stats */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Home className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold">Nội trú gần nhất</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Thể dục', value: 99, total: 483, max: 486 },
                    { label: 'Ngủ trưa', value: 96, total: 48, max: 50 },
                    { label: 'Ngủ tối', value: 90, total: 45, max: 50 },
                  ].map(({ label, value, total, max }) => (
                    <div key={label} className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">{label}</p>
                      <p className={cn('text-2xl font-bold', value >= 95 ? 'text-green-500' : value >= 90 ? 'text-orange-500' : 'text-red-500')}>
                        {value}%
                      </p>
                      <p className="text-xs text-muted-foreground">{total}/{max}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Grade Stats */}
          {stats?.gradeStats && stats.gradeStats.length > 0 && (
            <Card className="mt-6">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold">Thống kê theo khối</h3>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  {stats.gradeStats.map(({ grade, total, boarding }) => (
                    <div key={grade} className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Khối {grade}</p>
                      <p className="text-xl font-bold">{total}</p>
                      <p className="text-xs text-blue-500">{boarding} nội trú</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-4 mt-4 pt-4 border-t">
                  <span className="text-sm">Tổng cộng</span>
                  <span className="font-bold text-green-500">{stats.totalStudents} học sinh</span>
                  <span className="font-bold text-blue-500">{stats.boardingStudents} nội trú</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Evening Study Progress */}
          <Card className="mt-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-orange-500" />
                  <h3 className="font-semibold">Tự học tối gần nhất</h3>
                </div>
                <span className="text-sm text-muted-foreground">{format(today, 'dd/MM/yyyy')}</span>
              </div>
              <div className="flex items-center gap-4">
                <Progress value={99} className="flex-1 h-3" />
                <div className="text-right">
                  <span className="text-xl font-bold text-green-500">483</span>
                  <span className="text-muted-foreground">/486</span>
                </div>
                <span className="text-sm text-muted-foreground">Vắng: 3</span>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-muted-foreground">
            Thiết kế bởi <span className="font-medium text-foreground">Thầy giáo Nguyễn Hồng Dân</span> - Zalo: 0888 770 699
          </div>
        </>
      )}
    </div>
  );
}
