import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Student, Class } from '@/types';

interface MealAbsentSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  classes: Class[];
  onConfirm: (absentStudentIds: string[]) => void;
  isLoading?: boolean;
  title: string;
  description?: string;
}

export function MealAbsentSelectionDialog({
  open,
  onOpenChange,
  students,
  classes,
  onConfirm,
  isLoading = false,
  title,
  description,
}: MealAbsentSelectionDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());

  // Sort classes by grade then name
  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [classes]);

  // Filter students
  const filteredStudents = useMemo(() => {
    let filtered = students;
    
    if (selectedClass !== 'all') {
      filtered = filtered.filter(s => s.class?.name === selectedClass);
    }
    
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filtered = filtered.filter(s => 
        s.full_name.toLowerCase().includes(searchLower) ||
        s.class?.name?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [students, selectedClass, search]);

  // Group by class for compact display
  const groupedByClass = useMemo(() => {
    const groups = new Map<string, Student[]>();
    filteredStudents.forEach(student => {
      const className = student.class?.name || 'Khác';
      if (!groups.has(className)) {
        groups.set(className, []);
      }
      groups.get(className)!.push(student);
    });
    return groups;
  }, [filteredStudents]);

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
    setSearch('');
    setSelectedClass('all');
  };

  const handleClose = () => {
    setAbsentIds(new Set());
    setSearch('');
    setSelectedClass('all');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-red-500" />
            {title}
          </DialogTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </DialogHeader>

        {/* Search and class filter */}
        <div className="px-4 pb-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm học sinh..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          
          {/* Class filter buttons - flex-wrap for all classes */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSelectedClass('all')}
              className={cn(
                "px-2 py-1 text-xs rounded-md border transition-colors",
                selectedClass === 'all'
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-border"
              )}
            >
              Tất cả
            </button>
            {sortedClasses.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls.name)}
                className={cn(
                  "px-2 py-1 text-xs rounded-md border transition-colors",
                  selectedClass === cls.name
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-border"
                )}
              >
                {cls.name}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="px-4 py-2 bg-muted/50 border-y">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Tổng: {filteredStudents.length} học sinh
            </span>
            <span className="font-medium text-red-600">
              Đã chọn vắng: {absentIds.size}
            </span>
          </div>
        </div>

        {/* Student list by class */}
        <ScrollArea className="flex-1 min-h-0 px-4">
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
            Xác nhận ({students.length - absentIds.size} ăn)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
