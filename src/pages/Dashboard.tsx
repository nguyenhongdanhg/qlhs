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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, isWithinInterval, parseISO, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AttendanceSnapshot {
  present: number;
  absent: number;
  total: number;
  hasReport: boolean;
  lastReportTime?: string;
}

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

      const { data: allStudents } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true);
      
      const totalStudentsCount = allStudents?.length || 0;

      const [studentsResult, boardingResult, classesResult, teachersResult, attendanceResult, boardingStudentsResult] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', currentSchool.id).eq('is_active', true),
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', currentSchool.id).eq('is_active', true).eq('is_boarding', true),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', currentSchool.id).eq('is_active', true),
        supabase.from('school_memberships').select('*', { count: 'exact', head: true }).eq('school_id', currentSchool.id).eq('status', 'active'),
        supabase.from('attendance_records').select('attendance_type, status, created_at, student_id').eq('school_id', currentSchool.id).eq('attendance_date', dateStr).limit(10000),
        supabase.from('students').select('id').eq('school_id', currentSchool.id).eq('is_active', true).eq('is_boarding', true),
      ]);

      const totalBoardingStudents = boardingStudentsResult.data?.length || 0;

      const getSnapshotFromRecords = (records: any[], total: number): AttendanceSnapshot => {
        if (!records || records.length === 0) {
          return { present: 0, absent: 0, total, hasReport: false };
        }
        const sorted = [...records].sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());
        const latestTime = new Date(sorted[0].created_at!).getTime();
        const windowStart = latestTime - 60 * 1000;
        const snapshotRecords = sorted.filter(r => {
          const recordTime = new Date(r.created_at!).getTime();
          return recordTime >= windowStart && recordTime <= latestTime;
        });
        const latestByStudent = new Map<string, string>();
        for (const r of snapshotRecords) {
          if (!latestByStudent.has(r.student_id)) {
            latestByStudent.set(r.student_id, r.status);
          }
        }
        let present = 0;
        latestByStudent.forEach(status => { if (status === 'present') present++; });
        return { 
          present, 
          absent: total - present,
          total, 
          hasReport: true, 
          lastReportTime: sorted[0].created_at 
        };
      };

      const breakfastRecords = (attendanceResult.data || []).filter(r => r.attendance_type === 'breakfast');
      const lunchRecords = (attendanceResult.data || []).filter(r => r.attendance_type === 'lunch');
      const dinnerRecords = (attendanceResult.data || []).filter(r => r.attendance_type === 'dinner');
      const boardingRecords = (attendanceResult.data || []).filter(r => r.attendance_type === 'boarding');
      const eveningStudyRecords = (attendanceResult.data || []).filter(r => r.attendance_type === 'evening_study');

      const breakfastStats = getSnapshotFromRecords(breakfastRecords, totalStudentsCount);
      const lunchStats = getSnapshotFromRecords(lunchRecords, totalStudentsCount);
      const dinnerStats = getSnapshotFromRecords(dinnerRecords, totalStudentsCount);
      const boardingStats = getSnapshotFromRecords(boardingRecords, totalBoardingStudents);
      const eveningStudyStats = getSnapshotFromRecords(eveningStudyRecords, totalStudentsCount);

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
      const gradeStats = Array.from(gradeMap.entries()).sort(([a], [b]) => a - b).map(([grade, stats]) => ({ grade, ...stats }));

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
        return { className: s.class?.name || 'N/A', avgScore: Math.round(avg * 10) / 10, rank: 0 };
      }).sort((a, b) => b.avgScore - a.avgScore);

      classScores.forEach((c, i) => { c.rank = i + 1; });

      return { weekNumber: latestScore.week_number, topClasses: classScores.slice(0, 3) };
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
        .select(`user_id, shift, profile:profiles!inner(id, full_name)`)
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
      label: 'Sáng',
      icon: Sun,
      stats: stats?.breakfastStats,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-200 dark:border-amber-800',
      iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    },
    {
      label: 'Trưa',
      icon: UtensilsCrossed,
      stats: stats?.lunchStats,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950/30',
      borderColor: 'border-orange-200 dark:border-orange-800',
      iconBg: 'bg-orange-100 dark:bg-orange-900/50',
    },
    {
      label: 'Tối',
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
    <div className="content-wrapper animate-fade-in space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">{currentSchool.name}</h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span className="capitalize">{dayName}, {formattedDate}</span>
          </div>
        </div>
        {/* Quick stats badges */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-semibold">
            <Users className="h-3 w-3" />
            {stats?.totalStudents || 0}
          </div>
          <div className="flex items-center gap-1 bg-accent/10 text-accent rounded-full px-2.5 py-1 text-xs font-semibold">
            <Home className="h-3 w-3" />
            {stats?.boardingStudents || 0}
          </div>
        </div>
      </div>

      {/* Class Teacher Info */}
      {isClassTeacher && stats?.className && (
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Lớp {stats.className}</span>
          <span className="ml-auto text-xs text-muted-foreground">
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
            <div className="bg-gradient-to-r from-primary/5 to-accent/5 px-3 py-2 border-b border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Điểm danh hôm nay</span>
                <span className="text-[10px] text-muted-foreground">
                  {[stats?.hasBreakfast, stats?.hasLunch, stats?.hasDinner, stats?.hasBoarding, stats?.hasEveningStudy].filter(Boolean).length}/5 đã báo cáo
                </span>
              </div>
            </div>
            <CardContent className="p-2">
              <div className="grid grid-cols-5 gap-1.5">
                {attendanceItems.map(({ label, icon: Icon, stats: itemStats, color, bgColor, iconBg }) => (
                  <div key={label} className={cn(
                    "rounded-lg p-2 text-center transition-all",
                    itemStats?.hasReport ? bgColor : "bg-muted/30"
                  )}>
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center mx-auto mb-1",
                      itemStats?.hasReport ? iconBg : "bg-muted"
                    )}>
                      <Icon className={cn(
                        "h-3.5 w-3.5",
                        itemStats?.hasReport ? color : "text-muted-foreground"
                      )} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    {itemStats?.hasReport ? (
                      <>
                        <p className={cn("text-base font-bold leading-tight", color)}>
                          {itemStats.present}
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          /{itemStats.total}
                        </p>
                        {itemStats.absent > 0 && (
                          <p className="text-[9px] text-destructive font-medium">
                            -{itemStats.absent}
                          </p>
                        )}
                        <div className="flex items-center justify-center gap-0.5 mt-0.5">
                          <Clock className="h-2 w-2 text-muted-foreground" />
                          <span className="text-[8px] text-muted-foreground">
                            {formatTimeShort(itemStats.lastReportTime)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">--</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Teacher Attendance Stats - only for class teachers (admin already sees data above) */}
          {isClassTeacher && <TeacherAttendanceStats />}

          {/* Emulation & Duty */}
          <div className="grid gap-2 grid-cols-2">
            {/* Emulation Rankings */}
            <Link to="/emulation">
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow h-full">
                <CardContent className="p-2.5 sm:p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Trophy className="h-4 w-4 text-warning" />
                    <div>
                      <span className="text-xs sm:text-sm font-semibold">Thi đua</span>
                      {emulationData?.weekNumber && (
                        <span className="text-[10px] text-muted-foreground ml-1">T{emulationData.weekNumber}</span>
                      )}
                    </div>
                  </div>
                  {emulationData?.topClasses && emulationData.topClasses.length > 0 ? (
                    <div className="space-y-1">
                      {emulationData.topClasses.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-muted/50 rounded px-1.5 py-1">
                          <div className="flex items-center gap-1">
                            <span className="text-sm">{i < 3 ? rankMedals[i] : `#${c.rank}`}</span>
                            <span className="font-medium truncate">{c.className}</span>
                          </div>
                          <span className="font-bold text-primary text-[11px]">{c.avgScore}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground text-center py-3">Chưa có dữ liệu</p>
                  )}
                </CardContent>
              </Card>
            </Link>

            {/* Duty Today */}
            <Link to="/duty-schedule">
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow h-full">
                <CardContent className="p-2.5 sm:p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CalendarCheck className="h-4 w-4 text-primary" />
                    <span className="text-xs sm:text-sm font-semibold">Trực hôm nay</span>
                  </div>
                  {dutyToday && dutyToday.length > 0 ? (
                    <div className="space-y-1">
                      {dutyToday.slice(0, 4).map((person, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs bg-muted/50 rounded px-1.5 py-1">
                          <UserCheck className="h-3 w-3 text-primary shrink-0" />
                          <span className="font-medium truncate">{person.fullName}</span>
                        </div>
                      ))}
                      {dutyToday.length > 4 && (
                        <p className="text-[10px] text-muted-foreground text-center">+{dutyToday.length - 4} người khác</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground text-center py-3">Chưa phân công</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Grade Stats */}
          {!isClassTeacher && stats?.gradeStats && stats.gradeStats.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-2.5 sm:p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Theo khối</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {stats.gradeStats.map(({ grade, total, boarding }) => (
                    <div key={grade} className="text-center p-1.5 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground">K{grade}</p>
                      <p className="text-sm font-bold text-foreground leading-none">{total}</p>
                      <p className="text-[9px] text-primary">{boarding} NT</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
