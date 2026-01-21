import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Users, 
  Home, 
  GraduationCap,
  Building2,
  Loader2,
  BookOpen,
  UtensilsCrossed,
  BarChart3,
  Calendar,
  TrendingUp,
  Sparkles,
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
  mealStats: { breakfast: number; lunch: number; dinner: number };
  gradeStats: { grade: number; total: number; boarding: number }[];
}

export default function Dashboard() {
  const { currentSchool } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const today = useMemo(() => new Date(), []);
  const dateStr = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);
  const dayName = useMemo(() => format(today, 'EEEE', { locale: vi }), [today]);
  const formattedDate = useMemo(() => format(today, 'dd/MM/yyyy'), [today]);

  const fetchStats = useCallback(async () => {
    if (!currentSchool) return;

    try {
      // Parallel fetch all basic stats
      const [studentsResult, boardingResult, classesResult, teachersResult, attendanceResult] = await Promise.all([
        supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchool.id)
          .eq('is_active', true),
        supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchool.id)
          .eq('is_active', true)
          .eq('is_boarding', true),
        supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchool.id)
          .eq('is_active', true),
        supabase
          .from('school_memberships')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchool.id)
          .eq('status', 'active'),
        supabase
          .from('attendance_records')
          .select('attendance_type, status')
          .eq('school_id', currentSchool.id)
          .eq('attendance_date', dateStr),
      ]);

      const mealStats = { breakfast: 0, lunch: 0, dinner: 0 };
      (attendanceResult.data || []).forEach(record => {
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
          const [totalResult, boardingGradeResult] = await Promise.all([
            supabase
              .from('students')
              .select('*, class:classes!inner(*)', { count: 'exact', head: true })
              .eq('school_id', currentSchool.id)
              .eq('is_active', true)
              .eq('classes.grade', grade),
            supabase
              .from('students')
              .select('*, class:classes!inner(*)', { count: 'exact', head: true })
              .eq('school_id', currentSchool.id)
              .eq('is_active', true)
              .eq('is_boarding', true)
              .eq('classes.grade', grade),
          ]);

          return { grade, total: totalResult.count || 0, boarding: boardingGradeResult.count || 0 };
        })
      );

      setStats({
        totalStudents: studentsResult.count || 0,
        boardingStudents: boardingResult.count || 0,
        totalTeachers: teachersResult.count || 0,
        totalClasses: classesResult.count || 0,
        mealStats,
        gradeStats,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentSchool, dateStr]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const quickActions = useMemo(() => [
    { label: 'Điểm danh nội trú', icon: Home, path: '/boarding', color: 'from-sky-500 to-cyan-500', iconBg: 'bg-sky-100 text-sky-600' },
    { label: 'Điểm danh giờ học', icon: BookOpen, path: '/evening-study', color: 'from-amber-500 to-orange-500', iconBg: 'bg-amber-100 text-amber-600' },
    { label: 'Báo cáo bữa ăn', icon: UtensilsCrossed, path: '/meals', color: 'from-violet-500 to-purple-500', iconBg: 'bg-violet-100 text-violet-600' },
    { label: 'Xem thống kê', icon: BarChart3, path: '/statistics', color: 'from-emerald-500 to-teal-500', iconBg: 'bg-emerald-100 text-emerald-600' },
  ], []);

  const statCards = useMemo(() => [
    { label: 'Học sinh', value: stats?.totalStudents || 0, icon: Users, gradient: 'from-sky-500 to-cyan-500', iconBg: 'bg-sky-500' },
    { label: 'Nội trú', value: stats?.boardingStudents || 0, icon: Home, gradient: 'from-emerald-500 to-teal-500', iconBg: 'bg-emerald-500' },
    { label: 'Giáo viên', value: stats?.totalTeachers || 0, icon: GraduationCap, gradient: 'from-amber-500 to-orange-500', iconBg: 'bg-amber-500' },
    { label: 'Lớp học', value: stats?.totalClasses || 0, icon: Building2, gradient: 'from-violet-500 to-purple-500', iconBg: 'bg-violet-500' },
  ], [stats]);

  if (!currentSchool) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Vui lòng chọn trường để tiếp tục</p>
      </div>
    );
  }

  return (
    <div className="content-wrapper animate-fade-in">
      {/* School Banner - Enhanced gradient */}
      <Card className="mb-4 sm:mb-6 overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-r from-primary via-primary/90 to-accent text-primary-foreground">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg">
                <Building2 className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold">{currentSchool.name}</h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm opacity-90">
                  <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="capitalize">{dayName}, {formattedDate}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 bg-white/10 rounded-xl px-3 sm:px-4 py-2 backdrop-blur-sm self-end sm:self-auto">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
              <div className="text-right">
                <p className="text-2xl sm:text-3xl font-bold">0%</p>
                <p className="text-[10px] sm:text-xs opacity-90">hoàn thành</p>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Cards - Enhanced with gradients */}
          <div className="grid gap-2 sm:gap-3 grid-cols-2 md:grid-cols-4 mb-4">
            {statCards.map(({ label, value, icon: Icon, gradient, iconBg }) => (
              <Card key={label} className="group border-0 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden">
                <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center relative">
                  <div className={cn('rounded-xl p-2 sm:p-2.5 mb-2 shadow-md', iconBg)}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{value}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">{label}</p>
                  <div className={cn('absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r opacity-60', gradient)} />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Actions - Enhanced */}
          <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
            {quickActions.map(({ label, icon: Icon, path, iconBg }) => (
              <Link key={path} to={path}>
                <Card className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 h-full border-0 shadow-md">
                  <CardContent className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
                    <div className={cn('rounded-xl p-2.5 sm:p-3 shrink-0 transition-transform group-hover:scale-105', iconBg)}>
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <span className="font-semibold text-xs sm:text-sm leading-tight text-foreground">{label}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Today Progress - Enhanced */}
          <Card className="mb-4 border-0 shadow-md">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base text-foreground">Tiến độ hôm nay</h3>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full font-medium">0/7</span>
              </div>

              <div className="grid gap-4 grid-cols-3">
                {/* Meals */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-accent" />
                    <span className="text-xs font-semibold text-foreground">Bữa ăn</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {['Sáng', 'Trưa', 'Tối'].map((meal) => (
                      <span key={meal} className="px-2 py-0.5 text-[10px] rounded-full bg-muted text-muted-foreground font-medium">
                        {meal}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Boarding */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Home className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Nội trú</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {['TD', 'Trưa', 'Tối'].map((item) => (
                      <span key={item} className="px-2 py-0.5 text-[10px] rounded-full bg-muted text-muted-foreground font-medium">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Study */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-warning" />
                    <span className="text-xs font-semibold text-foreground">Tự học</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-muted text-muted-foreground font-medium inline-block">
                    Chưa điểm
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bottom Grid - Enhanced */}
          <div className="grid gap-3 lg:grid-cols-2">
            {/* Meals Today */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-accent/10">
                    <UtensilsCrossed className="h-4 w-4 text-accent" />
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base text-foreground">Bữa ăn hôm nay</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Sáng', value: stats?.mealStats.breakfast || '--' },
                    { label: 'Trưa', value: stats?.mealStats.lunch || '--' },
                    { label: 'Tối', value: stats?.mealStats.dinner || '--' },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center p-3 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30">
                      <p className="text-xs text-muted-foreground font-medium">{label}</p>
                      <p className="text-lg sm:text-xl font-bold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Boarding Stats */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <Home className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base text-foreground">Nội trú gần nhất</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Thể dục', value: 99, total: 483, max: 486 },
                    { label: 'Ngủ trưa', value: 96, total: 48, max: 50 },
                    { label: 'Ngủ tối', value: 90, total: 45, max: 50 },
                  ].map(({ label, value, total, max }) => (
                    <div key={label} className="text-center p-3 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30">
                      <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
                      <p className={cn('text-lg sm:text-xl font-bold', value >= 95 ? 'text-success' : value >= 90 ? 'text-warning' : 'text-destructive')}>
                        {value}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">{total}/{max}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Grade Stats - Enhanced */}
          {stats?.gradeStats && stats.gradeStats.length > 0 && (
            <Card className="mt-4 border-0 shadow-md">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base text-foreground">Thống kê theo khối</h3>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {stats.gradeStats.map(({ grade, total, boarding }) => (
                    <div key={grade} className="text-center p-2 sm:p-3 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 hover:from-primary/5 hover:to-primary/10 transition-colors">
                      <p className="text-xs text-muted-foreground font-medium">Khối {grade}</p>
                      <p className="text-base sm:text-lg font-bold text-foreground">{total}</p>
                      <p className="text-[10px] text-primary font-medium">{boarding} nội trú</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-4 mt-3 pt-3 border-t text-xs">
                  <span className="text-muted-foreground">Tổng:</span>
                  <span className="font-bold text-success">{stats.totalStudents} HS</span>
                  <span className="font-bold text-primary">{stats.boardingStudents} NT</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Evening Study Progress - Enhanced */}
          <Card className="mt-4 border-0 shadow-md">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-warning/10">
                    <BookOpen className="h-4 w-4 text-warning" />
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base text-foreground">Tự học tối gần nhất</h3>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">{format(today, 'dd/MM')}</span>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={99} className="flex-1 h-2.5" />
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-success">483</span>
                  <span className="text-xs text-muted-foreground">/486</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-muted-foreground">
            Thiết kế bởi <span className="font-semibold text-foreground">Thầy giáo Nguyễn Hồng Dân</span> - Zalo: 0888 770 699
          </div>
        </>
      )}
    </div>
  );
}