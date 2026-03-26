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
  Trophy,
  UserCheck,
  CalendarCheck,
  Clock,
  Moon,
  Sun,
  Sunset,
  Shield,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, isWithinInterval, parseISO, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface AttendanceSnapshot {
  present: number;
  absent: number;
  total: number;
  hasReport: boolean;
  lastReportTime?: string;
  lastReportDate?: string;
}

interface DashboardStats {
  totalStudents: number;
  boardingStudents: number;
  totalTeachers: number;
  totalClasses: number;
  mealStats: { breakfast: number; lunch: number; dinner: number };
  gradeStats: { grade: number; total: number; boarding: number; male: number; female: number; classCount: number }[];
  className?: string;
  classId?: string;
  classStudentCount?: number;
  classBoardingCount?: number;
  hasBreakfast: boolean;
  hasLunch: boolean;
  hasDinner: boolean;
  hasBoarding: boolean;
  hasEveningStudy: boolean;
  boardingStats: AttendanceSnapshot;
  eveningStudyStats: AttendanceSnapshot;
  breakfastStats: AttendanceSnapshot;
  lunchStats: AttendanceSnapshot;
  dinnerStats: AttendanceSnapshot;
}

interface EmulationData {
  weekNumber: number;
  topClasses: { className: string; avgScore: number; rank: number }[];
}

interface DutyPerson {
  id: string;
  fullName: string;
  shift?: string;
  isLeader?: boolean;
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

  // Real-time subscription
  useEffect(() => {
    if (!currentSchool) return;
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance_records',
        filter: `school_id=eq.${currentSchool.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats', currentSchool.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentSchool?.id, queryClient]);

  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', currentSchool?.id, dateStr],
    queryFn: async (): Promise<DashboardStats> => {
      if (!currentSchool) throw new Error('No school selected');

      // Single batch of parallel queries - removed redundant allStudents query
      const [studentsResult, boardingResult, classesResult, teachersResult, breakfastResult, lunchResult, dinnerResult, latestBoardingResult, latestStudyResult, studentsWithGradesResult] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', currentSchool.id).eq('is_active', true),
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', currentSchool.id).eq('is_active', true).eq('is_boarding', true),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', currentSchool.id).eq('is_active', true),
        supabase.from('school_memberships').select('*', { count: 'exact', head: true }).eq('school_id', currentSchool.id).eq('status', 'active'),
        supabase.from('attendance_records').select('status, created_at, student_id, class_id').eq('school_id', currentSchool.id).eq('attendance_date', dateStr).eq('attendance_type', 'breakfast').order('created_at', { ascending: false }).limit(2000),
        supabase.from('attendance_records').select('status, created_at, student_id, class_id').eq('school_id', currentSchool.id).eq('attendance_date', dateStr).eq('attendance_type', 'lunch').order('created_at', { ascending: false }).limit(2000),
        supabase.from('attendance_records').select('status, created_at, student_id, class_id').eq('school_id', currentSchool.id).eq('attendance_date', dateStr).eq('attendance_type', 'dinner').order('created_at', { ascending: false }).limit(2000),
        supabase.from('attendance_records').select('status, created_at, student_id, attendance_date').eq('school_id', currentSchool.id).eq('attendance_type', 'boarding').gte('attendance_date', format(new Date(today.getTime() - 2 * 86400000), 'yyyy-MM-dd')).lte('attendance_date', dateStr).order('attendance_date', { ascending: false }).limit(2000),
        supabase.from('attendance_records').select('status, created_at, student_id, attendance_date').eq('school_id', currentSchool.id).eq('attendance_type', 'evening_study').gte('attendance_date', format(new Date(today.getTime() - 2 * 86400000), 'yyyy-MM-dd')).lte('attendance_date', dateStr).order('attendance_date', { ascending: false }).limit(2000),
        // Grade stats - moved into parallel batch
        supabase.from('students').select('is_boarding, gender, class_id, class:classes!inner(grade)').eq('school_id', currentSchool.id).eq('is_active', true).eq('classes.is_active', true),
      ]);

      const totalStudentsCount = studentsResult.count || 0;
      const totalBoardingStudents = boardingResult.count || 0;

      

      // Unified snapshot logic: latest-per-student (same as Statistics page)
      const getSnapshot = (records: any[], total: number, filterDate?: string): AttendanceSnapshot => {
        const filtered = filterDate ? records.filter(r => r.attendance_date === filterDate) : records;
        if (!filtered || filtered.length === 0) {
          return { present: 0, absent: 0, total, hasReport: false };
        }
        const latestByStudent = new Map<string, any>();
        filtered.forEach(r => {
          const existing = latestByStudent.get(r.student_id);
          if (!existing || new Date(r.created_at!).getTime() > new Date(existing.created_at!).getTime()) {
            latestByStudent.set(r.student_id, r);
          }
        });
        const latestRecords = Array.from(latestByStudent.values());
        const presentCount = latestRecords.filter(r => r.status === 'present').length;
        const absentCount = latestRecords.filter(r => r.status !== 'present').length;
        const sorted = [...filtered].sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());
        return {
          present: presentCount,
          absent: absentCount,
          total,
          hasReport: true,
          lastReportTime: sorted[0].created_at,
          lastReportDate: filterDate || sorted[0].attendance_date,
        };
      };

      // Meals: use getLatestRecordsPerClass logic (same as Statistics page)
      // This gets the latest record per student, and total = number of reported students
      const getMealSnapshot = (records: any[]): AttendanceSnapshot => {
        if (!records || records.length === 0) {
          return { present: 0, absent: 0, total: totalStudentsCount, hasReport: false };
        }
        // Get latest record per student (same as Statistics getLatestRecordsPerClass)
        const latestByStudent = new Map<string, any>();
        records.forEach(r => {
          const key = `${r.class_id || 'unknown'}-${r.student_id}`;
          const existing = latestByStudent.get(key);
          if (!existing || new Date(r.created_at!).getTime() > new Date(existing.created_at!).getTime()) {
            latestByStudent.set(key, r);
          }
        });
        const latestRecords = Array.from(latestByStudent.values());
        const presentCount = latestRecords.filter(r => r.status === 'present').length;
        const absentCount = latestRecords.filter(r => r.status !== 'present').length;
        const sorted = [...records].sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());
        return {
          present: presentCount,
          absent: absentCount,
          total: latestRecords.length, // total = reported students (same as Statistics)
          hasReport: true,
          lastReportTime: sorted[0].created_at,
          lastReportDate: sorted[0].attendance_date,
        };
      };

      // Meals: today only (each fetched separately like Statistics page)
      const breakfastRecords = breakfastResult.data || [];
      const lunchRecords = lunchResult.data || [];
      const dinnerRecords = dinnerResult.data || [];
      const breakfastStats = getMealSnapshot(breakfastRecords);
      const lunchStats = getMealSnapshot(lunchRecords);
      const dinnerStats = getMealSnapshot(dinnerRecords);

      // Boarding: find latest date with records
      const boardingAllRecords = latestBoardingResult.data || [];
      const latestBoardingDate = boardingAllRecords.length > 0 ? boardingAllRecords[0].attendance_date : null;
      const boardingStats = latestBoardingDate
        ? getSnapshot(boardingAllRecords, totalBoardingStudents, latestBoardingDate)
        : { present: 0, absent: 0, total: totalBoardingStudents, hasReport: false } as AttendanceSnapshot;

      // Evening study: find latest date with records
      const studyAllRecords = latestStudyResult.data || [];
      const latestStudyDate = studyAllRecords.length > 0 ? studyAllRecords[0].attendance_date : null;
      const eveningStudyStats = latestStudyDate
        ? getSnapshot(studyAllRecords, totalStudentsCount, latestStudyDate)
        : { present: 0, absent: 0, total: totalStudentsCount, hasReport: false } as AttendanceSnapshot;

      const studentsWithGrades = studentsWithGradesResult.data;

      const gradeMap = new Map<number, { total: number; boarding: number; male: number; female: number; classIds: Set<string> }>();
      (studentsWithGrades || []).forEach((student: any) => {
        const grade = student.class?.grade;
        if (grade !== undefined) {
          const current = gradeMap.get(grade) || { total: 0, boarding: 0, male: 0, female: 0, classIds: new Set<string>() };
          current.total++;
          if (student.is_boarding) current.boarding++;
          if (student.gender === 'male') current.male++;
          if (student.gender === 'female') current.female++;
          if (student.class_id) current.classIds.add(student.class_id);
          gradeMap.set(grade, current);
        }
      });
      const gradeStats = Array.from(gradeMap.entries()).sort(([a], [b]) => a - b).map(([grade, s]) => ({ grade, total: s.total, boarding: s.boarding, male: s.male, female: s.female, classCount: s.classIds.size }));

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
        mealStats: { breakfast: breakfastStats.present, lunch: lunchStats.present, dinner: dinnerStats.present },
        gradeStats,
        className, classId, classStudentCount, classBoardingCount,
        hasBreakfast: breakfastStats.hasReport,
        hasLunch: lunchStats.hasReport,
        hasDinner: dinnerStats.hasReport,
        hasBoarding: boardingStats.hasReport,
        hasEveningStudy: eveningStudyStats.hasReport,
        boardingStats, eveningStudyStats,
        breakfastStats, lunchStats, dinnerStats,
      };
    },
    enabled: !!currentSchool,
    staleTime: 1000 * 60 * 2,
  });

  // Fetch latest emulation data (most recent week with data)
  const { data: emulationData } = useQuery({
    queryKey: ['dashboard-emulation', currentSchool?.id],
    queryFn: async (): Promise<EmulationData | null> => {
      if (!currentSchool) return null;

      // Get the latest emulation scores directly (most recent week)
      const { data: latestScore } = await supabase
        .from('emulation_scores')
        .select('week_number')
        .eq('school_id', currentSchool.id)
        .order('week_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestScore) return null;

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
        .eq('week_number', latestScore.week_number);

      if (!scores || scores.length === 0) return { weekNumber: latestScore.week_number, topClasses: [] };

      const classScores = scores.map((s: any) => {
        const avg = ((s.academic_score || 0) * 2 + (s.discipline_score || 0) + (s.boarding_score || 0)) / 4;
        return { className: s.class?.name || 'N/A', avgScore: Math.round(avg * 100) / 100, rank: 0 };
      }).sort((a, b) => b.avgScore - a.avgScore);

      // Only rank classes with score > 0 (matching Emulation page logic)
      classScores.forEach((c, i) => { c.rank = c.avgScore > 0 ? i + 1 : 0; });
      const ranked = classScores.filter(c => c.rank > 0);

      return { weekNumber: latestScore.week_number, topClasses: ranked.slice(0, 3) };
    },
    enabled: !!currentSchool,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch current duty schedule (shift runs 6am to 6am next day)
  const dutyDateStr = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    // Before 6am means still on previous day's shift
    const dutyDate = currentHour < 6 ? new Date(now.getTime() - 86400000) : now;
    return format(dutyDate, 'yyyy-MM-dd');
  }, []);

  const { data: dutyToday } = useQuery({
    queryKey: ['dashboard-duty', currentSchool?.id, dutyDateStr],
    queryFn: async (): Promise<DutyPerson[]> => {
      if (!currentSchool) return [];
      const [schedulesRes, leadersRes] = await Promise.all([
        supabase
          .from('duty_schedules')
          .select(`user_id, shift, profile:profiles!inner(id, full_name)`)
          .eq('school_id', currentSchool.id)
          .eq('duty_date', dutyDateStr),
        supabase
          .from('duty_leaders')
          .select('user_id')
          .eq('school_id', currentSchool.id)
          .eq('duty_date', dutyDateStr)
          .maybeSingle(),
      ]);
      if (!schedulesRes.data) return [];
      const leaderId = leadersRes.data?.user_id;
      const persons = schedulesRes.data.map((s: any) => ({
        id: s.user_id,
        fullName: s.profile?.full_name || 'N/A',
        shift: s.shift,
        isLeader: s.user_id === leaderId,
      }));
      // Sort leader first
      return persons.sort((a, b) => (b.isLeader ? 1 : 0) - (a.isLeader ? 1 : 0));
    },
    enabled: !!currentSchool,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch today's & tomorrow's menu
  const tomorrowStr = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return format(d, 'yyyy-MM-dd');
  }, [today]);

  const parseMenu = (data: any[] | null) => {
    if (!data || data.length === 0) return null;
    const menu: Record<string, string[]> = {};
    data.forEach((item: any) => {
      const dishes = (item.dishes || '').split(',').map((d: string) => d.trim()).filter(Boolean);
      if (dishes.length > 0) menu[item.meal_type] = dishes;
    });
    return Object.keys(menu).length > 0 ? menu : null;
  };

  const { data: todayMenu } = useQuery({
    queryKey: ['dashboard-menu', currentSchool?.id, dateStr],
    queryFn: async () => {
      if (!currentSchool) return null;
      const { data } = await supabase
        .from('menu_assignments')
        .select('meal_type, dishes')
        .eq('school_id', currentSchool.id)
        .eq('menu_date', dateStr);
      return parseMenu(data);
    },
    enabled: !!currentSchool,
    staleTime: 1000 * 60 * 10,
  });

  const { data: tomorrowMenu } = useQuery({
    queryKey: ['dashboard-menu-tomorrow', currentSchool?.id, tomorrowStr],
    queryFn: async () => {
      if (!currentSchool) return null;
      const { data } = await supabase
        .from('menu_assignments')
        .select('meal_type, dishes')
        .eq('school_id', currentSchool.id)
        .eq('menu_date', tomorrowStr);
      return parseMenu(data);
    },
    enabled: !!currentSchool,
    staleTime: 1000 * 60 * 10,
  });

  const formatTimeAgo = (time?: string) => {
    if (!time) return '';
    try {
      return formatDistanceToNow(new Date(time), { addSuffix: true, locale: vi });
    } catch {
      return '';
    }
  };

  const formatTimeShort = (time?: string) => {
    if (!time) return '';
    try {
      return format(new Date(time), 'HH:mm');
    } catch {
      return '';
    }
  };

  if (!currentSchool) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Vui lòng chọn trường để tiếp tục</p>
      </div>
    );
  }

  const attendanceItems = [
    {
      label: 'Bữa sáng',
      icon: Sun,
      stats: stats?.breakfastStats,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-200 dark:border-amber-800',
      iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    },
    {
      label: 'Bữa trưa',
      icon: UtensilsCrossed,
      stats: stats?.lunchStats,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950/30',
      borderColor: 'border-orange-200 dark:border-orange-800',
      iconBg: 'bg-orange-100 dark:bg-orange-900/50',
    },
    {
      label: 'Bữa tối',
      icon: Sunset,
      stats: stats?.dinnerStats,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50 dark:bg-rose-950/30',
      borderColor: 'border-rose-200 dark:border-rose-800',
      iconBg: 'bg-rose-100 dark:bg-rose-900/50',
    },
    {
      label: 'Nội trú',
      icon: Home,
      stats: stats?.boardingStats,
      color: 'text-sky-600',
      bgColor: 'bg-sky-50 dark:bg-sky-950/30',
      borderColor: 'border-sky-200 dark:border-sky-800',
      iconBg: 'bg-sky-100 dark:bg-sky-900/50',
    },
    {
      label: 'Tự học',
      icon: BookOpen,
      stats: stats?.eveningStudyStats,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50 dark:bg-violet-950/30',
      borderColor: 'border-violet-200 dark:border-violet-800',
      iconBg: 'bg-violet-100 dark:bg-violet-900/50',
    },
  ];

  const rankMedals = ['🥇', '🥈', '🥉'];

  return (
    <div className="content-wrapper animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{currentSchool.name}</h1>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span className="capitalize">{dayName}, {formattedDate}</span>
          </div>
        </div>
        {/* Quick stats badges */}
        <div className="flex items-center gap-2">
          <Link
            to="/students"
            className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-primary/20 transition-colors"
          >
            <Users className="h-4 w-4" />
            {stats?.totalStudents || 0}
          </Link>
          <div className="flex items-center gap-1.5 bg-accent/10 text-accent rounded-full px-3 py-1.5 text-sm font-semibold">
            <Home className="h-4 w-4" />
            {stats?.boardingStudents || 0}
          </div>
        </div>
      </div>

      {/* Class Teacher Info */}
      {isClassTeacher && stats?.className && (
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/10 rounded-lg px-4 py-2.5">
          <GraduationCap className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold">Lớp {stats.className}</span>
          <span className="ml-auto text-sm text-muted-foreground">
            {stats.classStudentCount} HS · {stats.classBoardingCount} NT
          </span>
        </div>
      )}

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Attendance Overview Panel */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-primary/5 to-accent/5 px-4 py-2.5 border-b border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-base sm:text-lg font-semibold text-foreground">Số liệu điểm danh gần nhất</span>
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {[stats?.hasBreakfast, stats?.hasLunch, stats?.hasDinner, stats?.hasBoarding, stats?.hasEveningStudy].filter(Boolean).length}/5 đã báo cáo
                </span>
              </div>
            </div>
            <CardContent className="p-3">
              <div className="grid grid-cols-5 gap-2">
                {attendanceItems.map(({ label, icon: Icon, stats: itemStats, color, bgColor, iconBg }) => (
                  <div key={label} className={cn(
                    "rounded-lg p-2.5 text-center transition-all",
                    itemStats?.hasReport ? bgColor : "bg-muted/30"
                  )}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1.5",
                      itemStats?.hasReport ? iconBg : "bg-muted"
                    )}>
                      <Icon className={cn(
                        "h-4 w-4",
                        itemStats?.hasReport ? color : "text-muted-foreground"
                      )} />
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">{label}</p>
                    {itemStats?.hasReport ? (
                      <>
                        <p className={cn("text-2xl sm:text-3xl font-bold leading-tight", color)}>
                          {itemStats.present}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          /{itemStats.total}
                        </p>
                        {itemStats.absent > 0 && (
                          <p className="text-xs sm:text-sm text-destructive font-semibold">
                            -{itemStats.absent}
                          </p>
                        )}
                        <div className="flex items-center justify-center gap-0.5 mt-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatTimeShort(itemStats.lastReportTime)}
                            {' '}
                            {itemStats.lastReportDate === dateStr ? 'hôm nay' : itemStats.lastReportDate ? format(new Date(itemStats.lastReportDate), 'dd/MM') : ''}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-base text-muted-foreground mt-2">--</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Teacher Attendance Stats - only for class teachers (admin already sees data above) */}
          {isClassTeacher && <TeacherAttendanceStats />}

          {/* Menu: Today & Tomorrow */}
          {(todayMenu || tomorrowMenu) && (
            <Link to="/meal-menu">
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <UtensilsCrossed className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm sm:text-base font-semibold">Thực đơn</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Today */}
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Hôm nay</div>
                      {todayMenu ? (
                        <div className="space-y-1.5">
                          {(['breakfast', 'lunch', 'dinner'] as const).map(meal => {
                            const dishes = todayMenu[meal];
                            if (!dishes) return null;
                            const mealLabel = meal === 'breakfast' ? 'Sáng' : meal === 'lunch' ? 'Trưa' : 'Tối';
                            const mealIcon = meal === 'breakfast' ? '🌅' : meal === 'lunch' ? '☀️' : '🌙';
                            return (
                              <div key={meal} className="flex items-start gap-2 text-sm bg-muted/50 rounded-lg px-2.5 py-1.5">
                                <span className="shrink-0 text-sm">{mealIcon}</span>
                                <div>
                                  <span className="font-semibold text-foreground text-xs">{mealLabel}:</span>{' '}
                                  <span className="text-muted-foreground text-xs">{dishes.join(', ')}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Chưa có thực đơn</p>
                      )}
                    </div>
                    {/* Tomorrow */}
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Ngày mai</div>
                      {tomorrowMenu ? (
                        <div className="space-y-1.5">
                          {(['breakfast', 'lunch', 'dinner'] as const).map(meal => {
                            const dishes = tomorrowMenu[meal];
                            if (!dishes) return null;
                            const mealLabel = meal === 'breakfast' ? 'Sáng' : meal === 'lunch' ? 'Trưa' : 'Tối';
                            const mealIcon = meal === 'breakfast' ? '🌅' : meal === 'lunch' ? '☀️' : '🌙';
                            return (
                              <div key={meal} className="flex items-start gap-2 text-sm bg-muted/50 rounded-lg px-2.5 py-1.5">
                                <span className="shrink-0 text-sm">{mealIcon}</span>
                                <div>
                                  <span className="font-semibold text-foreground text-xs">{mealLabel}:</span>{' '}
                                  <span className="text-muted-foreground text-xs">{dishes.join(', ')}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Chưa có thực đơn</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {/* Emulation & Duty */}
          <div className="grid gap-3 grid-cols-2">
            {/* Emulation Rankings */}
            <Link to="/emulation">
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow h-full">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Trophy className="h-5 w-5 text-warning" />
                    <div>
                      <span className="text-sm sm:text-base font-semibold">Xếp loại thi đua</span>
                      {emulationData?.weekNumber && (
                        <span className="text-xs sm:text-sm text-muted-foreground ml-1.5">tuần {emulationData.weekNumber}</span>
                      )}
                    </div>
                  </div>
                  {emulationData?.topClasses && emulationData.topClasses.length > 0 ? (
                    <div className="space-y-1.5">
                      {emulationData.topClasses.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{i < 3 ? rankMedals[i] : `#${c.rank}`}</span>
                            <span className="font-medium truncate">{c.className}</span>
                          </div>
                          <span className="font-bold text-primary text-sm">{c.avgScore}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-3">Chưa có dữ liệu</p>
                  )}
                </CardContent>
              </Card>
            </Link>

            {/* Duty Today */}
            <Link to="/duty-schedule">
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow h-full">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <CalendarCheck className="h-5 w-5 text-primary" />
                    <span className="text-sm sm:text-base font-semibold">Ca trực hiện tại</span>
                  </div>
                  {dutyToday && dutyToday.length > 0 ? (
                    <div className="space-y-1.5">
                      {dutyToday.slice(0, 4).map((person, i) => (
                        <div key={i} className={cn(
                          "flex items-center gap-2 text-sm rounded px-2 py-1.5",
                          person.isLeader 
                            ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" 
                            : "bg-muted/50"
                        )}>
                          {person.isLeader ? (
                            <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          ) : (
                            <UserCheck className="h-4 w-4 text-primary shrink-0" />
                          )}
                          <span className={cn("font-medium truncate", person.isLeader && "text-amber-700 dark:text-amber-300")}>{person.fullName}</span>
                          {person.isLeader && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-300 text-amber-600 dark:text-amber-400 ml-auto shrink-0">
                              LĐ trực
                            </Badge>
                          )}
                        </div>
                      ))}
                      {dutyToday.length > 4 && (
                        <p className="text-xs text-muted-foreground text-center">+{dutyToday.length - 4} người khác</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-3">Chưa phân công</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Grade Stats */}
          {!isClassTeacher && stats?.gradeStats && stats.gradeStats.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-base sm:text-lg font-semibold">Thông tin lớp học</span>
                </div>
                {(() => {
                  const items = stats.gradeStats;
                  const total = items.length;
                  const firstRowCount = Math.ceil(total / 2);
                  const firstRow = items.slice(0, firstRowCount);
                  const secondRow = items.slice(firstRowCount);
                  
                  return (
                    <div className="space-y-2">
                      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${firstRowCount}, 1fr)` }}>
                          {firstRow.map(({ grade, total, classCount, male, female }) => (
                          <div key={grade} className="text-center p-2.5 rounded-lg bg-muted/50 space-y-0.5">
                            <p className="text-sm font-bold text-primary">Khối {grade}</p>
                            <p className="text-lg font-bold text-foreground leading-tight">{total}</p>
                            <p className="text-xs text-muted-foreground">{classCount} lớp</p>
                            <div className="flex justify-center gap-2 text-xs">
                              <span className="text-blue-600">♂{male}</span>
                              <span className="text-pink-500">♀{female}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {secondRow.length > 0 && (
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${secondRow.length}, 1fr)` }}>
                          {secondRow.map(({ grade, total, classCount, male, female }) => (
                            <div key={grade} className="text-center p-2.5 rounded-lg bg-muted/50 space-y-0.5">
                              <p className="text-sm font-bold text-primary">Khối {grade}</p>
                              <p className="text-lg font-bold text-foreground leading-tight">{total}</p>
                              <p className="text-xs text-muted-foreground">{classCount} lớp</p>
                              <div className="flex justify-center gap-2 text-xs">
                                <span className="text-blue-600">♂{male}</span>
                                <span className="text-pink-500">♀{female}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
