import { useState, useEffect } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Class, Student } from "@/types";

interface MealDiagnosticDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  students: Student[];
  classes: Class[];
  startDate: Date;
  endDate: Date;
}

interface ClassDiagnostic {
  classId: string;
  className: string;
  studentCount: number;
  expectedRecords: number;
  actualRecords: number;
  missingDays: string[];
  status: "ok" | "partial" | "missing";
}

export function MealDiagnosticDialog({
  open,
  onOpenChange,
  schoolId,
  students,
  classes,
  startDate,
  endDate,
}: MealDiagnosticDialogProps) {
  const [diagnostics, setDiagnostics] = useState<ClassDiagnostic[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const runDiagnostic = async () => {
    setIsLoading(true);
    try {
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      // Calculate number of days in range
      const dayCount = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      // Group students by class
      const studentsByClass = new Map<string, Student[]>();
      students.forEach((s) => {
        if (s.class_id && s.class?.name) {
          const existing = studentsByClass.get(s.class_id) || [];
          existing.push(s);
          studentsByClass.set(s.class_id, existing);
        }
      });

      const results: ClassDiagnostic[] = [];

      // For each class, check attendance records
      for (const [classId, classStudents] of studentsByClass) {
        const classInfo = classes.find((c) => c.id === classId);
        if (!classInfo) continue;

        const studentIds = classStudents.map((s) => s.id);

        // Fetch attendance records for this class
        const { data: records, error } = await supabase
          .from("attendance_records")
          .select("student_id, attendance_date, attendance_type")
          .eq("school_id", schoolId)
          .in("student_id", studentIds)
          .in("attendance_type", ["breakfast", "lunch", "dinner"])
          .gte("attendance_date", startDateStr)
          .lte("attendance_date", endDateStr);

        if (error) {
          console.error(`[Diagnostic] Error fetching class ${classInfo.name}:`, error);
          continue;
        }

        // Count unique student-date-meal combinations
        const uniqueRecords = new Set<string>();
        const datesWithRecords = new Set<string>();

        (records || []).forEach((r) => {
          uniqueRecords.add(`${r.student_id}-${r.attendance_date}-${r.attendance_type}`);
          datesWithRecords.add(r.attendance_date);
        });

        // Expected: each student × each day × 3 meals
        const expectedRecords = classStudents.length * dayCount * 3;
        const actualRecords = uniqueRecords.size;

        // Find missing days
        const allDates: string[] = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          allDates.push(format(new Date(d), "yyyy-MM-dd"));
        }
        const missingDays = allDates.filter((d) => !datesWithRecords.has(d));

        let status: "ok" | "partial" | "missing" = "ok";
        if (actualRecords === 0) {
          status = "missing";
        } else if (actualRecords < expectedRecords * 0.5) {
          status = "partial";
        }

        results.push({
          classId,
          className: classInfo.name,
          studentCount: classStudents.length,
          expectedRecords,
          actualRecords,
          missingDays: missingDays.slice(0, 5), // Show first 5 missing days
          status,
        });
      }

      // Sort: missing first, then partial, then ok
      results.sort((a, b) => {
        const order = { missing: 0, partial: 1, ok: 2 };
        return order[a.status] - order[b.status];
      });

      setDiagnostics(results);
      console.log("[Meal Diagnostic] Results:", results);
    } catch (error) {
      console.error("[Meal Diagnostic] Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      runDiagnostic();
    }
  }, [open, startDate, endDate]);

  const problematicClasses = diagnostics.filter((d) => d.status !== "ok");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Chẩn đoán dữ liệu bữa ăn
          </DialogTitle>
          <DialogDescription>
            Kiểm tra các lớp có học sinh nhưng thiếu bản ghi điểm danh từ{" "}
            <strong>{format(startDate, "dd/MM/yyyy", { locale: vi })}</strong> đến{" "}
            <strong>{format(endDate, "dd/MM/yyyy", { locale: vi })}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {problematicClasses.length > 0 ? (
                <span className="text-amber-600 font-medium">
                  Phát hiện {problematicClasses.length} lớp có vấn đề
                </span>
              ) : diagnostics.length > 0 ? (
                <span className="text-green-600 font-medium">
                  Tất cả {diagnostics.length} lớp đều có dữ liệu
                </span>
              ) : null}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={runDiagnostic}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Kiểm tra lại
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Đang kiểm tra...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lớp</TableHead>
                  <TableHead className="text-center">Số HS</TableHead>
                  <TableHead className="text-center">Bản ghi</TableHead>
                  <TableHead className="text-center">Trạng thái</TableHead>
                  <TableHead>Ngày thiếu dữ liệu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diagnostics.map((d) => (
                  <TableRow
                    key={d.classId}
                    className={
                      d.status === "missing"
                        ? "bg-red-50 dark:bg-red-950/20"
                        : d.status === "partial"
                        ? "bg-amber-50 dark:bg-amber-950/20"
                        : ""
                    }
                  >
                    <TableCell className="font-medium">{d.className}</TableCell>
                    <TableCell className="text-center">{d.studentCount}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={
                          d.status === "missing"
                            ? "text-red-600 font-semibold"
                            : d.status === "partial"
                            ? "text-amber-600"
                            : ""
                        }
                      >
                        {d.actualRecords}
                      </span>
                      <span className="text-muted-foreground">
                        /{d.expectedRecords}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {d.status === "ok" && (
                        <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          OK
                        </Badge>
                      )}
                      {d.status === "partial" && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Thiếu
                        </Badge>
                      )}
                      {d.status === "missing" && (
                        <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Không có
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.missingDays.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {d.missingDays
                            .map((day) =>
                              format(new Date(day), "dd/MM", { locale: vi })
                            )
                            .join(", ")}
                          {d.missingDays.length === 5 && "..."}
                        </span>
                      ) : (
                        <span className="text-xs text-green-600">Đầy đủ</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {diagnostics.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Không có dữ liệu để kiểm tra
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {problematicClasses.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <h4 className="font-medium text-amber-800 dark:text-amber-300 mb-2">
                Gợi ý khắc phục:
              </h4>
              <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
                <li>Kiểm tra xem GVCN các lớp trên đã báo cáo bữa ăn trong khoảng thời gian này chưa</li>
                <li>Nếu đã báo cáo, kiểm tra xem có lỗi khi lưu không (xem Console log)</li>
                <li>Có thể dùng tính năng "Báo cáo bổ sung" để thêm dữ liệu thiếu</li>
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
