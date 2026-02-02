import { useState, useMemo, useCallback, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, UtensilsCrossed, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Student, Class, AttendanceType } from '@/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface SupplementMealReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  classes: Class[];
  classesNotReported: string[];
  mealType: AttendanceType;
  date: Date;
  onConfirm: (absentStudentIds: string[]) => void;
  isLoading?: boolean;
}

export const SupplementMealReportDialog = memo(function SupplementMealReportDialog({
  open,
  onOpenChange,
  students,
  classes,
  classesNotReported,
  mealType,
  date,
  onConfirm,
  isLoading = false,
}: SupplementMealReportDialogProps) {
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());

  const mealLabel = mealType === 'breakfast' ? 'Bữa sáng' : mealType === 'lunch' ? 'Bữa trưa' : 'Bữa tối';

  // Get students from classes that haven't reported
  const missingStudents = useMemo(() => {
    const notReportedSet = new Set(classesNotReported);
    return students.filter(s => notReportedSet.has(s.class?.name || ''));
  }, [students, classesNotReported]);

  // Group by class
  const groupedByClass = useMemo(() => {
    const groups = new Map<string, Student[]>();
    missingStudents.forEach(student => {
      const className = student.class?.name || 'Khác';
      if (!groups.has(className)) {
        groups.set(className, []);
      }
      groups.get(className)!.push(student);
    });
    return groups;
  }, [missingStudents]);

  const toggleStudent = (studentId: string) => {
    const newSet = new Set(absentIds);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
    } else {
      newSet.add(studentId);
    }
    setAbsentIds(newSet);
  };

  const toggleAllInClass = (className: string) => {
    const classStudents = groupedByClass.get(className) || [];
    const allSelected = classStudents.every(s => absentIds.has(s.id));
    
    const newSet = new Set(absentIds);
    classStudents.forEach(s => {
      if (allSelected) {
        newSet.delete(s.id);
      } else {
        newSet.add(s.id);
      }
    });
    setAbsentIds(newSet);
  };

  const handleConfirm = () => {
    onConfirm(Array.from(absentIds));
    setAbsentIds(new Set());
  };

  const handleClose = () => {
    setAbsentIds(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            Bổ sung {mealLabel}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Ngày {format(date, 'dd/MM/yyyy', { locale: vi })} - {classesNotReported.length} lớp chưa báo
          </p>
        </DialogHeader>

        {/* Summary */}
        <div className="px-4 py-2 bg-muted/50 border-y">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Học sinh cần bổ sung: {missingStudents.length}
            </span>
            <Badge variant="destructive" className="text-xs">
              Vắng: {absentIds.size}
            </Badge>
          </div>
        </div>

        {/* Classes not reported */}
        <div className="px-4 py-2">
          <div className="flex flex-wrap gap-1">
            {classesNotReported.map(className => (
              <Badge key={className} variant="outline" className="text-xs">
                {className}
              </Badge>
            ))}
          </div>
        </div>

        {/* Student list by class */}
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-3 py-2">
            {Array.from(groupedByClass.entries())
              .sort((a, b) => {
                const gradeA = a[1][0]?.class?.grade || 0;
                const gradeB = b[1][0]?.class?.grade || 0;
                return gradeA - gradeB;
              })
              .map(([className, classStudents]) => {
                const allSelected = classStudents.every(s => absentIds.has(s.id));
                const someSelected = classStudents.some(s => absentIds.has(s.id));
                const absentCount = classStudents.filter(s => absentIds.has(s.id)).length;

                return (
                  <div key={className} className="rounded-lg border bg-card">
                    {/* Class header */}
                    <button
                      onClick={() => toggleAllInClass(className)}
                      className="w-full flex items-center justify-between p-2 hover:bg-muted/50 rounded-t-lg transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          checked={allSelected}
                          className={cn(
                            someSelected && !allSelected && "bg-muted"
                          )}
                        />
                        <span className="font-medium text-sm">{className}</span>
                        <Badge variant="secondary" className="text-xs">
                          {classStudents.length}
                        </Badge>
                      </div>
                      {absentCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {absentCount} vắng
                        </Badge>
                      )}
                    </button>

                    {/* Students - 3 columns for compact view */}
                    <div className="px-2 pb-2">
                      <div className="grid grid-cols-3 gap-0.5">
                        {classStudents.map((student) => (
                          <button
                            key={student.id}
                            onClick={() => toggleStudent(student.id)}
                            className={cn(
                              "flex items-center gap-1 px-1.5 py-1 rounded text-left transition-colors",
                              absentIds.has(student.id)
                                ? "bg-destructive/15 text-destructive"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <div className={cn(
                              "w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center",
                              absentIds.has(student.id)
                                ? "border-destructive bg-destructive"
                                : "border-muted-foreground/50"
                            )}>
                              {absentIds.has(student.id) && (
                                <span className="text-destructive-foreground text-[8px] font-bold">✓</span>
                              )}
                            </div>
                            <span className="truncate text-[11px] leading-tight">{student.full_name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 pt-2 border-t gap-2">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Hủy
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Lưu ({missingStudents.length - absentIds.size} ăn)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
