import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Home, BookOpen, Users, AlertCircle, CheckCircle2, Clock, RefreshCw, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AttendanceRecord {
  id: string;
  student_id: string;
  attendance_date: string;
  attendance_type: string;
  status: string;
  excused_reason: string | null;
  notes: string | null;
  created_at: string;
}

interface Student {
  id: string;
  full_name: string;
  student_code: string;
  is_boarding: boolean;
  class_id: string | null;
}

interface ClassInfo {
  id: string;
  name: string;
}

interface DailyStats {
  date: string;
  dayName: string;
  boarding: { present: number; absent: number; total: number };
  eveningStudy: { present: number; absent: number; total: number };
}

export function TeacherAttendanceStats() {
  const { currentSchool, currentMembership, isSchoolAdmin, isSuperAdmin } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAbsentListOpen, setIsAbsentListOpen] = useState(false);

  // Determine view mode
  const isAdmin = isSuperAdmin || isSchoolAdmin();
  const isClassTeacher = currentMembership?.role === 'class_teacher';
  // class_id in school_memberships is stored as text but contains UUID
  const teacherClassId = currentMembership?.class_id;

  // Only show for admin or class teachers
  const shouldShow = isAdmin || (isClassTeacher && teacherClassId);

  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => startOfMonth(today), [today]);
  const monthEnd = useMemo(() => endOfMonth(today), [today]);

  const fetchData = useCallback(async () => {
    if (!currentSchool) return;

    try {
      if (isAdmin) {
        // Admin: Fetch all boarding students in the school
        const { data: studentsData } = await supabase
          .from('students')
          .select('id, full_name, student_code, is_boarding, class_id')
          .eq('school_id', currentSchool.id)
          .eq('is_active', true)
          .order('full_name');

        setStudents(studentsData || []);

        // Fetch all attendance records for this month
        const studentIds = (studentsData || []).map(s => s.id);
        if (studentIds.length > 0) {
          const { data: attendanceData } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('school_id', currentSchool.id)
            .in('attendance_type', ['boarding', 'evening_study'])
            .gte('attendance_date', format(monthStart, 'yyyy-MM-dd'))
            .lte('attendance_date', format(monthEnd, 'yyyy-MM-dd'))
            .order('attendance_date', { ascending: false })
            .limit(5000);

          setAttendanceRecords(attendanceData || []);
        }
      } else if (isClassTeacher && teacherClassId) {
        // Class teacher: Fetch only their class students
        // teacherClassId contains the class UUID from currentMembership.class_id
        const { data: classData } = await supabase
          .from('classes')
          .select('id, name')
          .eq('id', teacherClassId)
          .eq('is_active', true)
          .maybeSingle();

        if (!classData) {
          setIsLoading(false);
          return;
        }

        setClassInfo(classData);

        const { data: studentsData } = await supabase
          .from('students')
          .select('id, full_name, student_code, is_boarding, class_id')
          .eq('school_id', currentSchool.id)
          .eq('class_id', classData.id)
          .eq('is_active', true)
          .order('full_name');

        setStudents(studentsData || []);

        const studentIds = (studentsData || []).map(s => s.id);
        if (studentIds.length > 0) {
          // Fetch attendance by student IDs to ensure accuracy
          const { data: attendanceData } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('school_id', currentSchool.id)
            .in('student_id', studentIds)
            .in('attendance_type', ['boarding', 'evening_study'])
            .gte('attendance_date', format(monthStart, 'yyyy-MM-dd'))
            .lte('attendance_date', format(monthEnd, 'yyyy-MM-dd'))
            .order('attendance_date', { ascending: false })
            .order('created_at', { ascending: false });

          setAttendanceRecords(attendanceData || []);
        } else {
          setAttendanceRecords([]);
        }
      }
    } catch (error) {
      console.error('Error fetching attendance stats:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentSchool, isAdmin, isClassTeacher, teacherClassId, monthStart, monthEnd]);

  useEffect(() => {
    if (shouldShow) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [shouldShow, fetchData]);

  // Real-time subscription for attendance updates
  useEffect(() => {
    if (!currentSchool || !shouldShow) return;

    const channel = supabase
      .channel('teacher-attendance-stats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `school_id=eq.${currentSchool.id}`,
        },
        () => {
          // Refetch data when attendance changes
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSchool?.id, shouldShow, fetchData]);

  // Helper: Get the latest record per student for a specific type and date
  const getLatestRecordsPerStudent = useCallback((
    records: AttendanceRecord[],
    date: string,
    type: string
  ): Map<string, AttendanceRecord> => {
    const latestMap = new Map<string, AttendanceRecord>();
    
    // Filter records by date and type
    const filtered = records.filter(r => 
      r.attendance_date === date && r.attendance_type === type
    );
    
    // Sort by created_at descending to get latest first
    filtered.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    // Keep only the latest record per student
    for (const record of filtered) {
      if (!latestMap.has(record.student_id)) {
        latestMap.set(record.student_id, record);
      }
    }
    
    return latestMap;
  }, []);

  // Calculate daily stats for the last 7 days using latest record per student
  const dailyStats = useMemo((): DailyStats[] => {
    const last7Days = eachDayOfInterval({
      start: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
      end: today
    }).reverse();

    const boardingStudents = students.filter(s => s.is_boarding);
    const totalBoarding = boardingStudents.length;
    const totalStudents = students.length;

    return last7Days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Get latest records per student for each type
      const boardingLatest = getLatestRecordsPerStudent(attendanceRecords, dateStr, 'boarding');
      const studyLatest = getLatestRecordsPerStudent(attendanceRecords, dateStr, 'evening_study');
      
      // Count unique absent students from latest records only
      let boardingAbsent = 0;
      boardingLatest.forEach(record => {
        if (record.status === 'absent') boardingAbsent++;
      });
      
      let studyAbsent = 0;
      studyLatest.forEach(record => {
        if (record.status === 'absent') studyAbsent++;
      });

      return {
        date: dateStr,
        dayName: format(date, 'EEEE', { locale: vi }),
        boarding: {
          present: totalBoarding - boardingAbsent,
          absent: boardingAbsent,
          total: totalBoarding
        },
        eveningStudy: {
          present: totalStudents - studyAbsent,
          absent: studyAbsent,
          total: totalStudents
        }
      };
    });
  }, [students, attendanceRecords, today, getLatestRecordsPerStudent]);

  // Today's summary
  const todayStats = useMemo(() => {
    return dailyStats.find(d => isSameDay(new Date(d.date), today));
  }, [dailyStats, today]);

  // Get today's absent students using latest record per student logic
  const todayAbsentStudents = useMemo(() => {
    const todayStr = format(today, 'yyyy-MM-dd');
    const absentList: { student: Student; record: AttendanceRecord }[] = [];
    const seenStudentTypes = new Set<string>(); // to prevent duplicates
    
    // Get latest boarding records
    const boardingLatest = getLatestRecordsPerStudent(attendanceRecords, todayStr, 'boarding');
    boardingLatest.forEach((record) => {
      if (record.status === 'absent') {
        const student = students.find(s => s.id === record.student_id);
        if (student) {
          const key = `${record.student_id}-${record.attendance_type}`;
          if (!seenStudentTypes.has(key)) {
            seenStudentTypes.add(key);
            absentList.push({ student, record });
          }
        }
      }
    });
    
    // Get latest evening study records
    const studyLatest = getLatestRecordsPerStudent(attendanceRecords, todayStr, 'evening_study');
    studyLatest.forEach((record) => {
      if (record.status === 'absent') {
        const student = students.find(s => s.id === record.student_id);
        if (student) {
          const key = `${record.student_id}-${record.attendance_type}`;
          if (!seenStudentTypes.has(key)) {
            seenStudentTypes.add(key);
            absentList.push({ student, record });
          }
        }
      }
    });
    
    return absentList;
  }, [students, attendanceRecords, today, getLatestRecordsPerStudent]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
  };

  if (!shouldShow) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const title = isAdmin 
    ? 'Thống kê điểm danh toàn trường' 
    : `Thống kê lớp ${classInfo?.name || ''}`;
  
  const TitleIcon = isAdmin ? Building2 : Users;
  const studentLabel = isAdmin 
    ? `${students.length} HS | ${students.filter(s => s.is_boarding).length} NT`
    : `${students.length} học sinh`;

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <TitleIcon className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-sm sm:text-base font-semibold">
              {title}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {studentLabel}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Today's Summary */}
        <div className="grid grid-cols-2 gap-3">
          {/* Boarding Today */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-900/20 dark:to-sky-800/20">
            <div className="flex items-center gap-2 mb-2">
              <Home className="h-4 w-4 text-sky-600" />
              <span className="text-xs font-semibold text-sky-700 dark:text-sky-400">Nội trú hôm nay</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-sky-700 dark:text-sky-300">
                {todayStats?.boarding.present || 0}
              </span>
              <span className="text-sm text-sky-600 dark:text-sky-400">
                /{todayStats?.boarding.total || students.filter(s => s.is_boarding).length}
              </span>
            </div>
            {todayStats && todayStats.boarding.absent > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3 text-destructive" />
                <span className="text-xs text-destructive font-medium">
                  {todayStats.boarding.absent} vắng
                </span>
              </div>
            )}
          </div>

          {/* Evening Study Today */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Tự học hôm nay</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                {todayStats?.eveningStudy.present || 0}
              </span>
              <span className="text-sm text-amber-600 dark:text-amber-400">
                /{todayStats?.eveningStudy.total || students.length}
              </span>
            </div>
            {todayStats && todayStats.eveningStudy.absent > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3 text-destructive" />
                <span className="text-xs text-destructive font-medium">
                  {todayStats.eveningStudy.absent} vắng
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Weekly Stats Table - Collapsible */}
        <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-2 h-auto hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">7 ngày gần nhất</span>
              </div>
              {isHistoryOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs py-2 px-2 w-24">Ngày</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Home className="h-3 w-3" />
                        <span>Nội trú</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-xs py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        <span>Tự học</span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyStats.map((day) => {
                    const isCurrentDay = isToday(new Date(day.date));
                    return (
                      <TableRow 
                        key={day.date} 
                        className={cn(isCurrentDay && "bg-primary/5")}
                      >
                        <TableCell className="py-2 px-2">
                          <div className="flex flex-col">
                            <span className={cn(
                              "text-xs font-medium",
                              isCurrentDay && "text-primary"
                            )}>
                              {format(new Date(day.date), 'dd/MM')}
                            </span>
                            <span className="text-[10px] text-muted-foreground capitalize">
                              {day.dayName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-2 text-center">
                          {day.boarding.total > 0 ? (
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-1">
                                {day.boarding.absent === 0 ? (
                                  <CheckCircle2 className="h-3 w-3 text-success" />
                                ) : (
                                  <AlertCircle className="h-3 w-3 text-destructive" />
                                )}
                                <span className={cn(
                                  "text-xs font-semibold",
                                  day.boarding.absent === 0 ? "text-success" : "text-foreground"
                                )}>
                                  {day.boarding.present}/{day.boarding.total}
                                </span>
                              </div>
                              {day.boarding.absent > 0 && (
                                <span className="text-[10px] text-destructive">
                                  -{day.boarding.absent}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 px-2 text-center">
                          {day.eveningStudy.total > 0 ? (
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-1">
                                {day.eveningStudy.absent === 0 ? (
                                  <CheckCircle2 className="h-3 w-3 text-success" />
                                ) : (
                                  <AlertCircle className="h-3 w-3 text-destructive" />
                                )}
                                <span className={cn(
                                  "text-xs font-semibold",
                                  day.eveningStudy.absent === 0 ? "text-success" : "text-foreground"
                                )}>
                                  {day.eveningStudy.present}/{day.eveningStudy.total}
                                </span>
                              </div>
                              {day.eveningStudy.absent > 0 && (
                                <span className="text-[10px] text-destructive">
                                  -{day.eveningStudy.absent}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Absent students list for today - only for class teacher - Collapsible */}
        {!isAdmin && todayAbsentStudents.length > 0 && (
          <Collapsible open={isAbsentListOpen} onOpenChange={setIsAbsentListOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full flex items-center justify-between p-2 h-auto hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-xs font-semibold text-muted-foreground">
                    Học sinh vắng hôm nay ({todayAbsentStudents.length})
                  </span>
                </div>
                {isAbsentListOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="rounded-lg border p-2 space-y-1 max-h-32 overflow-y-auto">
                {todayAbsentStudents.map(({ student, record }) => (
                  <div key={record.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{student.full_name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] py-0">
                        {record.attendance_type === 'boarding' ? 'Nội trú' : 'Tự học'}
                      </Badge>
                      {record.excused_reason && (
                        <span className="text-muted-foreground truncate max-w-20">
                          {record.excused_reason}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
