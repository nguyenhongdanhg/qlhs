import { memo, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertTriangle, CheckCircle2, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AbsentStudent {
  id: string;
  name: string;
  className: string;
  excused?: boolean;
  reason?: string;
}

interface AbsentConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
  title: string;
  description?: string;
  absentStudents: AbsentStudent[];
  totalStudents: number;
}

export const AbsentConfirmationDialog = memo(function AbsentConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  title,
  description,
  absentStudents,
  totalStudents,
}: AbsentConfirmationDialogProps) {
  const presentCount = totalStudents - absentStudents.length;

  // Group by class
  const groupedByClass = useMemo(() => {
    const groups = new Map<string, AbsentStudent[]>();
    absentStudents.forEach(s => {
      if (!groups.has(s.className)) groups.set(s.className, []);
      groups.get(s.className)!.push(s);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  }, [absentStudents]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {title}
          </DialogTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </DialogHeader>

        {/* Summary stats */}
        <div className="px-4 py-2 bg-muted/50 border-y">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Có mặt: <strong className="text-green-600">{presentCount}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-red-500" />
              <span>Vắng: <strong className="text-red-600">{absentStudents.length}</strong></span>
            </div>
            <span className="text-muted-foreground">Tổng: {totalStudents}</span>
          </div>
        </div>

        {/* Absent list */}
        <ScrollArea className="flex-1 px-4">
          {absentStudents.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
              <p className="font-medium">Không có học sinh vắng</p>
              <p className="text-xs">Tất cả học sinh đều có mặt</p>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {groupedByClass.map(([className, students]) => (
                <div key={className} className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between p-2 bg-muted/30 rounded-t-lg">
                    <span className="font-medium text-sm">{className}</span>
                    <Badge variant="destructive" className="text-xs">
                      {students.length} vắng
                    </Badge>
                  </div>
                  <div className="p-2 space-y-0.5">
                    {students.map((s, idx) => (
                      <div
                        key={s.id}
                        className={cn(
                          "flex items-center justify-between px-2 py-1 rounded text-sm",
                          idx % 2 === 0 ? "bg-destructive/5" : ""
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs w-5">{idx + 1}.</span>
                          <span>{s.name}</span>
                        </div>
                        {s.excused && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            P {s.reason ? `- ${s.reason}` : ''}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="p-4 pt-2 border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={isLoading}>
            Quay lại chỉnh sửa
          </Button>
          <Button onClick={onConfirm} disabled={isLoading} className="flex-1">
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Xác nhận lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
