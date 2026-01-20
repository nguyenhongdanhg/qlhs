import { cn } from '@/lib/utils';
import { Student, AttendanceStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { User, Check } from 'lucide-react';

interface ExcuseInfo {
  excused: boolean;
  reason: string;
}

interface CompactStudentListProps {
  students: Student[];
  attendance: Record<string, AttendanceStatus>;
  excuseInfo: Record<string, ExcuseInfo>;
  onToggleAbsent: (student: Student) => void;
  isLoading?: boolean;
}

export function CompactStudentList({
  students,
  attendance,
  excuseInfo,
  onToggleAbsent,
  isLoading = false,
}: CompactStudentListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <User className="h-10 w-10 mb-2 opacity-50" />
        <p className="text-sm">Không có học sinh nào</p>
      </div>
    );
  }

  return (
    <div className="max-h-[50vh] overflow-y-auto border rounded-lg">
      <div className="divide-y">
        {students.map((student) => {
          const status = attendance[student.id];
          const isAbsent = status === 'absent' || status === 'excused';
          const excuse = excuseInfo[student.id];

          return (
            <button
              key={student.id}
              onClick={() => onToggleAbsent(student)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-left transition-all',
                isAbsent
                  ? 'bg-red-50'
                  : 'hover:bg-muted/50'
              )}
            >
              {/* Status indicator */}
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                  isAbsent
                    ? 'border-red-500 bg-red-500'
                    : 'border-green-500 bg-green-500'
                )}
              >
                {!isAbsent && <Check className="h-3 w-3 text-white" />}
              </div>

              {/* Student info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'font-medium text-sm truncate',
                      isAbsent && 'text-red-700'
                    )}
                  >
                    {student.full_name}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {student.class?.name}
                  </span>
                </div>

                {/* Show excuse info if absent */}
                {isAbsent && excuse && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge
                      variant={excuse.excused ? 'secondary' : 'destructive'}
                      className="text-[10px] px-1 py-0 h-4"
                    >
                      {excuse.excused ? 'Có phép' : 'Không phép'}
                    </Badge>
                    {excuse.reason && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                        {excuse.reason}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Room number badge for boarding */}
              {student.room_number && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 flex-shrink-0">
                  P.{student.room_number}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
