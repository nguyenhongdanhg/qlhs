import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CalendarOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Class } from '@/types';

interface MealDayOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  mealLabel: string;
  dateLabel: string;
  classes: Class[];
  reportedClassIds: string[];
  isDeleting: boolean;
  onConfirm: (classIds: string[]) => void;
}

export function MealDayOffDialog({
  open,
  onOpenChange,
  mealLabel,
  dateLabel,
  classes,
  reportedClassIds,
  isDeleting,
  onConfirm,
}: MealDayOffDialogProps) {
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());

  // Only show classes that have reports (can be deleted)
  const reportedClasses = useMemo(() => {
    const reportedSet = new Set(reportedClassIds);
    return classes
      .filter(c => reportedSet.has(c.id))
      .sort((a, b) => {
        if (a.grade !== b.grade) return a.grade - b.grade;
        return a.name.localeCompare(b.name, 'vi');
      });
  }, [classes, reportedClassIds]);

  const allSelected = reportedClasses.length > 0 && selectedClassIds.size === reportedClasses.length;

  const toggleClass = (classId: string) => {
    setSelectedClassIds(prev => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedClassIds(new Set());
    } else {
      setSelectedClassIds(new Set(reportedClasses.map(c => c.id)));
    }
  };

  const handleConfirm = () => {
    if (selectedClassIds.size === 0) return;
    onConfirm(Array.from(selectedClassIds));
  };

  // Reset selection when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setSelectedClassIds(new Set());
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-destructive" />
            Nghỉ - {mealLabel}
          </DialogTitle>
          <DialogDescription>
            Chọn lớp để xóa báo cáo {mealLabel.toLowerCase()} ngày {dateLabel}
          </DialogDescription>
        </DialogHeader>

        {reportedClasses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Không có lớp nào đã báo cáo để xóa
          </p>
        ) : (
          <div className="space-y-3">
            {/* Select all */}
            <div
              className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
              onClick={toggleAll}
            >
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
              />
              <span className="font-medium text-sm">Tích tất cả</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {reportedClasses.length} lớp
              </Badge>
            </div>

            {/* Class list */}
            <div className="max-h-60 overflow-y-auto space-y-1">
              {reportedClasses.map(cls => (
                <div
                  key={cls.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleClass(cls.id)}
                >
                  <Checkbox
                    checked={selectedClassIds.has(cls.id)}
                    onCheckedChange={() => toggleClass(cls.id)}
                  />
                  <span className="text-sm">{cls.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isDeleting}>
            Hủy
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={selectedClassIds.size === 0 || isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CalendarOff className="mr-2 h-4 w-4" />
            )}
            Nghỉ ({selectedClassIds.size} lớp)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
