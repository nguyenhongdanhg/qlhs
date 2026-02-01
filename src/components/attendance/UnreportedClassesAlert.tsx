import { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Sunrise, Sun, Moon, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Class, AttendanceType, AttendanceStatus, Student } from '@/types';
import { format, addDays, isBefore, setHours, setMinutes, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SupplementMealReportDialog } from './SupplementMealReportDialog';
import { toast } from 'sonner';
interface MealDeadline {
  type: AttendanceType;
  deadlineHour: number;
  deadlineMinute: number;
  dayOffset: number;
  label: string;
}

interface UnreportedMealInfo {
  date: Date;
  meal: AttendanceType;
  mealLabel: string;
  dateLabel: string;
  unreportedClasses: string[];
  icon: typeof Sunrise;
}

interface UnreportedClassesAlertProps {
  schoolId: string;
  classes: Class[];
  students: Student[];
  mealDeadlines: MealDeadline[];
  canReport: boolean;
  onReportClass: (className: string, meal: AttendanceType, date: Date) => void;
  onRefresh?: () => void;
}

const mealIcons = {
  breakfast: Sunrise,
  lunch: Sun,
  dinner: Moon,
};

const mealLabels = {
  breakfast: 'Bữa sáng',
  lunch: 'Bữa trưa',
  dinner: 'Bữa tối',
};

export function UnreportedClassesAlert({
  schoolId,
  classes,
  students,
  mealDeadlines,
  canReport,
  onReportClass,
  onRefresh,
}: UnreportedClassesAlertProps) {
  const [unreportedMeals, setUnreportedMeals] = useState<UnreportedMealInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Supplement dialog state
  const [supplementDialogOpen, setSupplementDialogOpen] = useState(false);
  const [selectedSupplementData, setSelectedSupplementData] = useState<{
    meal: AttendanceType;
    date: Date;
    classesNotReported: string[];
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if a meal deadline has passed
  const isMealExpired = useCallback((mealType: AttendanceType, targetDate: Date): boolean => {
    const deadline = mealDeadlines.find(d => d.type === mealType);
    if (!deadline) return true;

    const now = new Date();
    let deadlineDate = new Date(targetDate);
    
    if (deadline.dayOffset === -1) {
      deadlineDate = subDays(deadlineDate, 1);
    }
    
    deadlineDate = setHours(deadlineDate, deadline.deadlineHour);
    deadlineDate = setMinutes(deadlineDate, deadline.deadlineMinute);

    return !isBefore(now, deadlineDate);
  }, [mealDeadlines]);

  // Fetch unreported classes for today and tomorrow
  const fetchUnreportedClasses = useCallback(async () => {
    if (!schoolId || classes.length === 0) return;
    
    setIsLoading(true);
    try {
      const today = new Date();
      const tomorrow = addDays(today, 1);
      const todayStr = format(today, 'yyyy-MM-dd');
      const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
      const todayDisplay = format(today, 'dd/MM', { locale: vi });
      const tomorrowDisplay = format(tomorrow, 'dd/MM', { locale: vi });

      // Fetch DISTINCT class_id for each date/meal combination to avoid duplicates
      const { data: records } = await supabase
        .from('attendance_records')
        .select('attendance_date, attendance_type, class_id')
        .eq('school_id', schoolId)
        .in('attendance_type', ['breakfast', 'lunch', 'dinner'])
        .in('attendance_date', [todayStr, tomorrowStr]);

      // Create a set of reported class-date-meal combinations using class_id
      const reportedSet = new Set<string>();
      (records || []).forEach((record: any) => {
        if (record.class_id) {
          // Use class_id (not class name) for accurate matching
          const key = `${record.class_id}-${record.attendance_date}-${record.attendance_type}`;
          reportedSet.add(key);
        }
      });

      // Build unreported meals info
      const unreported: UnreportedMealInfo[] = [];

      // Filter classes that have boarding students (same logic as Statistics.tsx)
      const classesWithStudents = classes.filter(cls => 
        students.some(s => s.class_id === cls.id)
      );

      // Check today's meals
      const todayMeals: AttendanceType[] = ['breakfast', 'lunch', 'dinner'];
      todayMeals.forEach(meal => {
        const unreportedClasses = classesWithStudents.filter(cls => {
          const key = `${cls.id}-${todayStr}-${meal}`;
          return !reportedSet.has(key);
        }).map(c => c.name);

        if (unreportedClasses.length > 0) {
          unreported.push({
            date: today,
            meal,
            mealLabel: mealLabels[meal],
            dateLabel: `Hôm nay (${todayDisplay})`,
            unreportedClasses,
            icon: mealIcons[meal],
          });
        }
      });

      // Check tomorrow's breakfast (can be reported today)
      const tomorrowBreakfastUnreported = classesWithStudents.filter(cls => {
        const key = `${cls.id}-${tomorrowStr}-breakfast`;
        return !reportedSet.has(key);
      }).map(c => c.name);

      if (tomorrowBreakfastUnreported.length > 0) {
        unreported.push({
          date: tomorrow,
          meal: 'breakfast' as AttendanceType,
          mealLabel: mealLabels.breakfast,
          dateLabel: `Ngày mai (${tomorrowDisplay})`,
          unreportedClasses: tomorrowBreakfastUnreported,
          icon: mealIcons.breakfast,
        });
      }

      setUnreportedMeals(unreported);
    } catch (error) {
      console.error('Error fetching unreported classes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, classes]);

  useEffect(() => {
    fetchUnreportedClasses();
    // Refresh every 60 seconds
    const interval = setInterval(fetchUnreportedClasses, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreportedClasses]);

  // Handle clicking on "Bổ sung tất cả" button
  const handleSupplementAll = (info: UnreportedMealInfo) => {
    setSelectedSupplementData({
      meal: info.meal,
      date: info.date,
      classesNotReported: info.unreportedClasses,
    });
    setSupplementDialogOpen(true);
  };

  // Handle confirming supplement report
  const handleConfirmSupplement = async (absentStudentIds: string[]) => {
    if (!selectedSupplementData) return;
    
    setIsSubmitting(true);
    try {
      const { meal, date, classesNotReported } = selectedSupplementData;
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Get students from unreported classes
      const classNamesSet = new Set(classesNotReported);
      const studentsToReport = students.filter(s => classNamesSet.has(s.class?.name || ''));
      
      if (studentsToReport.length === 0) {
        toast.error('Không tìm thấy học sinh để báo cáo');
        setIsSubmitting(false);
        return;
      }

      const absentSet = new Set(absentStudentIds);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      // Insert attendance records
      const records = studentsToReport.map(student => ({
        school_id: schoolId,
        student_id: student.id,
        class_id: student.class_id,
        attendance_date: dateStr,
        attendance_type: meal,
        status: (absentSet.has(student.id) ? 'absent' : 'present') as AttendanceStatus,
        reporter_id: user.id,
      }));

      const { error } = await supabase.from('attendance_records').insert(records);
      if (error) throw error;

      // Show success notification with counts
      const mealLabel = mealLabels[meal as keyof typeof mealLabels] || meal;
      toast.success(
        `Đã bổ sung ${classesNotReported.length} lớp cho ${mealLabel}`,
        { description: `${studentsToReport.length} học sinh (${absentStudentIds.length} vắng)` }
      );

      // Close dialog first
      setSupplementDialogOpen(false);
      setSelectedSupplementData(null);
      
      // Then refresh data - use small delay to ensure DB has committed
      setTimeout(async () => {
        await fetchUnreportedClasses();
        onRefresh?.();
      }, 500);
      
    } catch (error) {
      console.error('Error submitting supplement report:', error);
      toast.error('Lỗi khi bổ sung báo cáo', { 
        description: error instanceof Error ? error.message : 'Vui lòng thử lại' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sort classes naturally
  const sortClasses = (classNames: string[]) => {
    return [...classNames].sort((a, b) => a.localeCompare(b, 'vi'));
  };

  if (isLoading) {
    return null;
  }

  if (unreportedMeals.length === 0) {
    return null;
  }

  return (
    <>
      <Alert className="border-warning bg-warning/10 mb-4">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle className="flex items-center justify-between">
          <span className="text-warning font-semibold">Lớp chưa báo cáo</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </AlertTitle>
        
        {isExpanded && (
          <AlertDescription className="mt-3 space-y-3">
            {unreportedMeals.map((info, index) => {
              const Icon = info.icon;
              const isExpired = isMealExpired(info.meal, info.date);
              
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "flex items-center gap-1",
                        isExpired 
                          ? "border-muted-foreground/30 text-muted-foreground" 
                          : "border-warning text-warning"
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {info.mealLabel} - {info.dateLabel}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ({info.unreportedClasses.length} lớp)
                    </span>
                    {canReport && info.unreportedClasses.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSupplementAll(info)}
                        className="h-6 text-xs px-2 ml-auto"
                      >
                        Bổ sung tất cả
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {sortClasses(info.unreportedClasses).map((className) => (
                      <Button
                        key={`${info.meal}-${info.date.toISOString()}-${className}`}
                        variant="outline"
                        size="sm"
                        disabled={!canReport}
                        onClick={() => onReportClass(className, info.meal, info.date)}
                        className={cn(
                          "h-7 px-2 text-xs",
                          canReport 
                            ? "hover:bg-warning/20 hover:border-warning hover:text-warning" 
                            : "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {className}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </AlertDescription>
        )}
      </Alert>

      {/* Supplement Dialog */}
      {selectedSupplementData && (
        <SupplementMealReportDialog
          open={supplementDialogOpen}
          onOpenChange={setSupplementDialogOpen}
          students={students}
          classes={classes}
          classesNotReported={selectedSupplementData.classesNotReported}
          mealType={selectedSupplementData.meal}
          date={selectedSupplementData.date}
          onConfirm={handleConfirmSupplement}
          isLoading={isSubmitting}
        />
      )}
    </>
  );
}
