import { useMemo, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { TeacherAttendanceStats } from '@/components/dashboard/TeacherAttendanceStats';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  Home, 
  GraduationCap,
  Building2,
  BookOpen,
  UtensilsCrossed,
  Calendar,
  TrendingUp,
  Sparkles,
  Trophy,
  UserCheck,
  CalendarCheck,
  Quote,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DashboardStats {
  totalStudents: number;
  boardingStudents: number;
  totalTeachers: number;
  totalClasses: number;
  mealStats: { breakfast: number; lunch: number; dinner: number };
  gradeStats: { grade: number; total: number; boarding: number }[];
  className?: string;
  classId?: string;
  classStudentCount?: number;
  classBoardingCount?: number;
  // Completion tracking
  hasBreakfast: boolean;
  hasLunch: boolean;
  hasDinner: boolean;
  hasBoarding: boolean;
  hasEveningStudy: boolean;
  // Real stats from database - unified boarding stats (no session split since DB doesn't store session_id)
  boardingStats: { present: number; absent: number; total: number; hasReport: boolean };
  eveningStudyStats: { present: number; absent: number; total: number; hasReport: boolean };
}

interface EmulationData {
  weekNumber: number;
  topClasses: { className: string; avgScore: number; rank: number }[];
}

interface DutyPerson {
  id: string;
  fullName: string;
  shift?: string;
}

export default function Dashboard() {
  const { currentSchool, currentMembership, isSchoolAdmin, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const dateStr = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);
  const dayName = useMemo(() => format(today, 'EEEE', { locale: vi }), [today]);
  const formattedDate = useMemo(() => format(today, 'dd/MM/yyyy'), [today]);

  const isAdmin = isSuperAdmin || isSchoolAdmin();
  const isClassTeacher = currentMembership?.role === 'class_teacher';
  const teacherClassId = currentMembership?.class_id;

  // Educational quotes/proverbs
  const educationQuotes = useMemo(() => [
    { quote: "Học tập là kho báu theo suốt đời người.", author: "Ngạn ngữ" },
    { quote: "Không thầy đố mày làm nên.", author: "Tục ngữ Việt Nam" },
    { quote: "Giáo dục là vũ khí mạnh nhất mà bạn có thể dùng để thay đổi thế giới.", author: "Nelson Mandela" },
    { quote: "Đầu tư vào kiến thức mang lại lợi nhuận tốt nhất.", author: "Benjamin Franklin" },
    { quote: "Học, học nữa, học mãi.", author: "V.I. Lenin" },
    { quote: "Một người thầy tốt có thể tạo ra hy vọng, khơi dậy trí tưởng tượng và thắp lên niềm đam mê học tập.", author: "Brad Henry" },
    { quote: "Cây ngay không sợ chết đứng, người ngay không sợ tiếng đời.", author: "Tục ngữ Việt Nam" },
    { quote: "Học để biết, học để làm, học để chung sống, học để tự khẳng định mình.", author: "UNESCO" },
    { quote: "Tri thức làm nên sức mạnh.", author: "Francis Bacon" },
    { quote: "Việc học như đi thuyền ngược nước, không tiến ắt phải lùi.", author: "Ngạn ngữ Trung Hoa" },
    { quote: "Giáo dục không phải là đổ đầy một cái thùng, mà là thắp sáng một ngọn lửa.", author: "W.B. Yeats" },
    { quote: "Người không học như ngọc không mài.", author: "Ngạn ngữ" },
    { quote: "Muốn sang thì bắc cầu kiều, muốn con hay chữ thì yêu lấy thầy.", author: "Ca dao Việt Nam" },
    { quote: "Thành công không phải là chìa khóa dẫn đến hạnh phúc. Hạnh phúc mới là chìa khóa dẫn đến thành công.", author: "Albert Schweitzer" },
    { quote: "Một ngày không học là một ngày bỏ phí.", author: "Khuyết danh" },
    { quote: "Sách là ngọn đèn sáng bất diệt của trí tuệ.", author: "Ngạn ngữ" },
    { quote: "Dạy học là nghề cao quý nhất trong các nghề cao quý.", author: "Phạm Văn Đồng" },
    { quote: "Trẻ em hôm nay, thế giới ngày mai.", author: "Khuyết danh" },
    { quote: "Giáo dục là sự chuẩn bị cho cuộc sống, chứ không chỉ là sự chuẩn bị cho việc mưu sinh.", author: "John Dewey" },
    { quote: "Học thầy không tày học bạn.", author: "Tục ngữ Việt Nam" },
  ], []);

  // Random quote - changes on each page load
  const [randomQuote] = useState(() => {
    const randomIndex = Math.floor(Math.random() * educationQuotes.length);
    return educationQuotes[randomIndex];
  });

  // Real-time subscription
  useEffect(() => {
    if (!currentSchool) return;

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `school_id=eq.${currentSchool.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats', currentSchool.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSchool?.id, queryClient]);

  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', currentSchool?.id, dateStr],
    queryFn: async (): Promise<DashboardStats> => {
      if (!currentSchool) throw new Error('No school selected');

      // First fetch students count
      const { data: allStudents } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true);
      
      const totalStudentsCount = allStudents?.length || 0;

      const [studentsResult, boardingResult, classesResult, teachersResult, attendanceResult, boardingStudentsResult] = await Promise.all([
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
          .select('attendance_type, status, created_at, student_id')
          .eq('school_id', currentSchool.id)
          .eq('attendance_date', dateStr),
        supabase
          .from('students')
          .select('id')
          .eq('school_id', currentSchool.id)
          .eq('is_active', true)
          .eq('is_boarding', true),
      ]);

      const totalBoardingStudents = boardingStudentsResult.data?.length || 0;
      const boardingStudentIds = new Set((boardingStudentsResult.data || []).map(s => s.id));

      const mealStats = { breakfast: 0, lunch: 0, dinner: 0 };
      let hasBreakfast = false, hasLunch = false, hasDinner = false;
      let hasEveningStudy = false;
      
      // Filter records by type
      const boardingRecords = (attendanceResult.data || []).filter(r => r.attendance_type === 'boarding');
      const eveningStudyRecords = (attendanceResult.data || []).filter(r => r.attendance_type === 'evening_study');
      
      // Helper: Get snapshot stats from records using 60-second window
      const getSnapshotFromRecords = (records: typeof attendanceResult.data, total: number) => {
        if (!records || records.length === 0) {
          return { present: 0, total, hasReport: false };
        }
        
        // Sort by created_at descending
        const sorted = [...records].sort((a, b) => 
          new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
        );
        
        // Get latest time and 60-second window
        const latestTime = new Date(sorted[0].created_at!).getTime();
        const windowStart = latestTime - 60 * 1000;
        
        // Get records within snapshot window
        const snapshotRecords = sorted.filter(r => {
          const recordTime = new Date(r.created_at!).getTime();
          return recordTime >= windowStart && recordTime <= latestTime;
        });
        
        // Count unique students (latest record per student)
        const latestByStudent = new Map<string, string>();
        for (const r of snapshotRecords) {
          if (!latestByStudent.has(r.student_id)) {
            latestByStudent.set(r.student_id, r.status);
          }
        }
        
        let present = 0;
        latestByStudent.forEach(status => {
          if (status === 'present') present++;
        });
        
        return { present, total, hasReport: true };
      };
      
      // Get unified boarding stats (no session split - DB doesn't store session_id)
      // Use getSnapshotFromRecords which finds latest report batch using 60-second window
      const boardingSnapshotRaw = getSnapshotFromRecords(boardingRecords, totalBoardingStudents);
      const boardingStats = {
        present: boardingSnapshotRaw.present,
        absent: boardingSnapshotRaw.total - boardingSnapshotRaw.present,
        total: boardingSnapshotRaw.total,
        hasReport: boardingSnapshotRaw.hasReport
      };
      const hasBoarding = boardingStats.hasReport;
      
      // Get meal stats using snapshot logic - use totalStudentsCount from earlier fetch
      const breakfastRecords = (attendanceResult.data || []).filter(r => r.attendance_type === 'breakfast');
      const lunchRecords = (attendanceResult.data || []).filter(r => r.attendance_type === 'lunch');
      const dinnerRecords = (attendanceResult.data || []).filter(r => r.attendance_type === 'dinner');
      
      const breakfastSnapshot = getSnapshotFromRecords(breakfastRecords, totalStudentsCount);
      const lunchSnapshot = getSnapshotFromRecords(lunchRecords, totalStudentsCount);
      const dinnerSnapshot = getSnapshotFromRecords(dinnerRecords, totalStudentsCount);
      
      hasBreakfast = breakfastSnapshot.hasReport;
      hasLunch = lunchSnapshot.hasReport;
      hasDinner = dinnerSnapshot.hasReport;
      mealStats.breakfast = breakfastSnapshot.present;
      mealStats.lunch = lunchSnapshot.present;
      mealStats.dinner = dinnerSnapshot.present;
      
      // Get evening study stats - use all students, not just boarding
      const eveningStudyStats = getSnapshotFromRecords(eveningStudyRecords, totalStudentsCount);
      hasEveningStudy = eveningStudyStats.hasReport;

      // Grade stats
      const { data: studentsWithGrades } = await supabase
        .from('students')
        .select('is_boarding, class:classes!inner(grade)')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .eq('classes.is_active', true);

      const gradeMap = new Map<number, { total: number; boarding: number }>();
      (studentsWithGrades || []).forEach((student: any) => {
        const grade = student.class?.grade;
        if (grade !== undefined) {
          const current = gradeMap.get(grade) || { total: 0, boarding: 0 };
          current.total++;
          if (student.is_boarding) current.boarding++;
          gradeMap.set(grade, current);
        }
      });

      const gradeStats = Array.from(gradeMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([grade, stats]) => ({ grade, ...stats }));

      // Class teacher specific data
      let className: string | undefined;
      let classId: string | undefined;
      let classStudentCount = 0;
      let classBoardingCount = 0;

      if (isClassTeacher && teacherClassId) {
        const { data: classData } = await supabase
          .from('classes')
          .select('id, name')
          .eq('id', teacherClassId)
          .eq('is_active', true)
          .maybeSingle();

        if (classData) {
          className = classData.name;
          classId = classData.id;

          const { data: classStudents } = await supabase
            .from('students')
            .select('id, is_boarding')
            .eq('school_id', currentSchool.id)
            .eq('class_id', classData.id)
            .eq('is_active', true);

          classStudentCount = classStudents?.length || 0;
          classBoardingCount = classStudents?.filter(s => s.is_boarding).length || 0;
        }
      }

      return {
        totalStudents: studentsResult.count || 0,
        boardingStudents: boardingResult.count || 0,
        totalTeachers: teachersResult.count || 0,
        totalClasses: classesResult.count || 0,
        mealStats,
        gradeStats,
        className,
        classId,
        classStudentCount,
        classBoardingCount,
        hasBreakfast,
        hasLunch,
        hasDinner,
        hasBoarding,
        hasEveningStudy,
        boardingStats,
        eveningStudyStats: {
          present: eveningStudyStats.present,
          absent: eveningStudyStats.total - eveningStudyStats.present,
          total: eveningStudyStats.total,
          hasReport: eveningStudyStats.hasReport
        },
      };
    },
    enabled: !!currentSchool,
    staleTime: 1000 * 60 * 2,
  });

  // Fetch previous week emulation data (show last week's results instead of current week)
  const { data: emulationData } = useQuery({
    queryKey: ['dashboard-emulation', currentSchool?.id],
    queryFn: async (): Promise<EmulationData | null> => {
      if (!currentSchool) return null;

      // Get week settings to find current week
      const { data: weekSettings } = await supabase
        .from('week_settings')
        .select('week_number, start_date, end_date')
        .eq('school_id', currentSchool.id)
        .order('week_number', { ascending: true });

      if (!weekSettings || weekSettings.length === 0) return null;

      // Find current week index
      const currentWeekIndex = weekSettings.findIndex(w => {
        try {
          const start = parseISO(w.start_date);
          const end = parseISO(w.end_date);
          return isWithinInterval(today, { start, end });
        } catch {
          return false;
        }
      });

      // Get previous week (if current week not found or is first week, return null)
      if (currentWeekIndex <= 0) return null;
      
      const previousWeek = weekSettings[currentWeekIndex - 1];

      // Get emulation scores for previous week
      const { data: scores } = await supabase
        .from('emulation_scores')
        .select(`
          class_id,
          academic_score,
          discipline_score,
          boarding_score,
          class:classes!inner(name)
        `)
        .eq('school_id', currentSchool.id)
        .eq('week_number', previousWeek.week_number);

      if (!scores || scores.length === 0) return { weekNumber: previousWeek.week_number, topClasses: [] };

      // Calculate average and rank
      const classScores = scores.map((s: any) => {
        const avg = ((s.academic_score || 0) * 2 + (s.discipline_score || 0) + (s.boarding_score || 0)) / 4;
        return {
          className: s.class?.name || 'N/A',
          avgScore: Math.round(avg * 10) / 10,
          rank: 0,
        };
      }).sort((a, b) => b.avgScore - a.avgScore);

      // Assign ranks
      classScores.forEach((c, i) => { c.rank = i + 1; });

      return {
        weekNumber: previousWeek.week_number,
        topClasses: classScores.slice(0, 3), // Top 3
      };
    },
    enabled: !!currentSchool,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch today's duty schedule
  const { data: dutyToday } = useQuery({
    queryKey: ['dashboard-duty', currentSchool?.id, dateStr],
    queryFn: async (): Promise<DutyPerson[]> => {
      if (!currentSchool) return [];

      const { data: schedules } = await supabase
        .from('duty_schedules')
        .select(`
          user_id,
          shift,
          profile:profiles!inner(id, full_name)
        `)
        .eq('school_id', currentSchool.id)
        .eq('duty_date', dateStr);

      if (!schedules) return [];

      return schedules.map((s: any) => ({
        id: s.user_id,
        fullName: s.profile?.full_name || 'N/A',
        shift: s.shift,
      }));
    },
    enabled: !!currentSchool,
    staleTime: 1000 * 60 * 5,
  });

  // Calculate completion percentage - now 5 items (3 meals + 1 boarding + 1 evening study)
  const completionStats = useMemo(() => {
    if (!stats) return { completed: 0, total: 5, percentage: 0 };
    
    let completed = 0;
    if (stats.hasBreakfast) completed++;
    if (stats.hasLunch) completed++;
    if (stats.hasDinner) completed++;
    if (stats.hasBoarding) completed++;
    if (stats.hasEveningStudy) completed++;
    
    const total = 5;
    const percentage = Math.round((completed / total) * 100);
    
    return { completed, total, percentage };
  }, [stats]);

  const statCards = useMemo(() => {
    return [
      { label: 'Học sinh', value: stats?.totalStudents || 0, icon: Users, gradient: 'from-sky-500 to-cyan-500', iconBg: 'bg-sky-500' },
      { label: 'Nội trú', value: stats?.boardingStudents || 0, icon: Home, gradient: 'from-emerald-500 to-teal-500', iconBg: 'bg-emerald-500' },
      { label: 'Giáo viên', value: stats?.totalTeachers || 0, icon: GraduationCap, gradient: 'from-amber-500 to-orange-500', iconBg: 'bg-amber-500' },
      { label: 'Lớp học', value: stats?.totalClasses || 0, icon: Building2, gradient: 'from-violet-500 to-purple-500', iconBg: 'bg-violet-500' },
    ];
  }, [stats]);

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
                <p className="text-2xl sm:text-3xl font-bold">{completionStats.percentage}%</p>
                <p className="text-[10px] sm:text-xs opacity-90">hoàn thành</p>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Educational Quote */}
      <div className="mb-4 px-1">
        <div className="flex items-start gap-2 text-muted-foreground">
          <Quote className="h-4 w-4 text-primary/60 shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm italic leading-relaxed">
            "{randomQuote.quote}" 
            <span className="text-[10px] sm:text-xs not-italic font-medium ml-1">
              — {randomQuote.author}
            </span>
          </p>
        </div>
      </div>
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Stats Cards */}
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

          {/* Class Teacher's Class Stats */}
          {isClassTeacher && stats?.className && (
            <Card className="mb-4 border-0 shadow-md bg-gradient-to-br from-primary/5 to-accent/5">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <GraduationCap className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base text-foreground">
                    Lớp chủ nhiệm: <span className="text-primary">{stats.className}</span>
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded-xl bg-background/80 shadow-sm">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.classStudentCount || 0}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Học sinh</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-background/80 shadow-sm">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Home className="h-4 w-4 text-success" />
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.classBoardingCount || 0}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Nội trú</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Today Progress - Unified */}
          <Card className="mb-4 border-0 shadow-md">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base text-foreground">Tiến độ hôm nay</h3>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full font-medium">
                  {completionStats.completed}/{completionStats.total}
                </span>
              </div>

              <div className="grid grid-cols-3 divide-x divide-border">
                {/* Meals with count */}
                <div className="pr-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-accent" />
                    <span className="text-xs font-semibold text-foreground">Bữa ăn</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-10 text-center px-1.5 py-0.5 text-[10px] rounded-full font-medium shrink-0",
                        stats?.hasBreakfast ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                      )}>Sáng</span>
                      <span className="text-xs font-medium text-foreground min-w-[2rem] text-right">
                        {stats?.hasBreakfast ? stats.mealStats.breakfast : '--'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-10 text-center px-1.5 py-0.5 text-[10px] rounded-full font-medium shrink-0",
                        stats?.hasLunch ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                      )}>Trưa</span>
                      <span className="text-xs font-medium text-foreground min-w-[2rem] text-right">
                        {stats?.hasLunch ? stats.mealStats.lunch : '--'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-10 text-center px-1.5 py-0.5 text-[10px] rounded-full font-medium shrink-0",
                        stats?.hasDinner ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                      )}>Tối</span>
                      <span className="text-xs font-medium text-foreground min-w-[2rem] text-right">
                        {stats?.hasDinner ? stats.mealStats.dinner : '--'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Boarding with unified data (no session split - DB doesn't store session_id) */}
                <div className="px-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Home className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Nội trú</span>
                  </div>
                  {stats?.boardingStats?.hasReport ? (
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-10 text-center px-1.5 py-0.5 text-[10px] rounded-full font-medium shrink-0",
                        "bg-success/20 text-success"
                      )}>
                        {stats.boardingStats.total > 0 
                          ? Math.round((stats.boardingStats.present / stats.boardingStats.total) * 100) 
                          : 0}%
                      </span>
                      <span className="text-xs font-medium text-foreground min-w-[2rem] text-right">
                        {stats.boardingStats.present}/{stats.boardingStats.total}
                      </span>
                    </div>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] rounded-full font-medium bg-muted text-muted-foreground inline-block">
                      Chưa điểm
                    </span>
                  )}
                </div>

                {/* Evening Study with real data */}
                <div className="pl-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <BookOpen className="h-3.5 w-3.5 text-warning" />
                    <span className="text-xs font-semibold text-foreground">Tự học</span>
                  </div>
                  {stats?.eveningStudyStats?.hasReport ? (
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-10 text-center px-1.5 py-0.5 text-[10px] rounded-full font-medium shrink-0",
                        "bg-success/20 text-success"
                      )}>
                        {stats.eveningStudyStats.total > 0 
                          ? Math.round((stats.eveningStudyStats.present / stats.eveningStudyStats.total) * 100) 
                          : 0}%
                      </span>
                      <span className="text-xs font-medium text-foreground min-w-[2rem] text-right">
                        {stats.eveningStudyStats.present}/{stats.eveningStudyStats.total}
                      </span>
                    </div>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] rounded-full font-medium bg-muted text-muted-foreground inline-block">
                      Chưa điểm
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Teacher Attendance Stats */}
          <div className="mb-4">
            <TeacherAttendanceStats />
          </div>

          {/* Emulation & Duty Grid */}
          <div className="grid gap-3 lg:grid-cols-2 mb-4">
            {/* Emulation - Current Week */}
            <Link to="/emulation">
              <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer h-full">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-warning/10">
                      <Trophy className="h-4 w-4 text-warning" />
                    </div>
                    <h3 className="font-semibold text-sm sm:text-base text-foreground">Thi đua tuần {emulationData?.weekNumber || '--'}</h3>
                  </div>
                  {emulationData?.topClasses && emulationData.topClasses.length > 0 ? (
                    <div className="space-y-2">
                      {emulationData.topClasses.map((c, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground",
                              i === 0 ? "bg-warning" : i === 1 ? "bg-muted-foreground" : "bg-accent"
                            )}>
                              {c.rank}
                            </span>
                            <span className="font-medium text-sm">{c.className}</span>
                          </div>
                          <span className="text-sm font-bold text-primary">{c.avgScore}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Chưa có dữ liệu thi đua</p>
                  )}
                </CardContent>
              </Card>
            </Link>

            {/* Duty Today */}
            <Link to="/duty-schedule">
              <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer h-full">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <CalendarCheck className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-semibold text-sm sm:text-base text-foreground">Lịch trực hôm nay</h3>
                  </div>
                  {dutyToday && dutyToday.length > 0 ? (
                    <div className="space-y-2">
                      {dutyToday.map((person, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <UserCheck className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{person.fullName}</p>
                            {person.shift && (
                              <p className="text-xs text-muted-foreground">{person.shift}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Chưa phân công trực</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Grade Stats - Only for admins */}
          {!isClassTeacher && stats?.gradeStats && stats.gradeStats.length > 0 && (
            <Card className="mb-4 border-0 shadow-md">
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

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-muted-foreground">
            Thiết kế bởi <span className="font-semibold text-foreground">Thầy giáo Nguyễn Hồng Dân</span> - Zalo: 0888 770 699
          </div>
        </>
      )}
    </div>
  );
}
