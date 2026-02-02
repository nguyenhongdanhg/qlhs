import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Student, AttendanceStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { User, Check, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

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

// Compact student button component
const StudentButton = memo(function StudentButton({
  student,
  isAbsent,
  excuse,
  onToggle,
}: {
  student: Student;
  isAbsent: boolean;
  excuse?: ExcuseInfo;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex items-center gap-1 px-1.5 py-1 rounded text-left transition-all text-[11px]',
        isAbsent 
          ? 'bg-destructive/15 text-destructive' 
          : 'hover:bg-muted/50'
      )}
    >
      <div
        className={cn(
          'w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center',
          isAbsent ? 'border-destructive bg-destructive' : 'border-primary bg-primary'
        )}
      >
        {isAbsent ? (
          <X className="h-2 w-2 text-destructive-foreground" />
        ) : (
          <Check className="h-2 w-2 text-primary-foreground" />
        )}
      </div>
      <span className="truncate leading-tight">{student.full_name}</span>
      {isAbsent && excuse && (
        <span className={cn(
          "text-[9px] font-medium px-0.5 rounded",
          excuse.excused ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-600"
        )}>
          {excuse.excused ? 'P' : 'K'}
        </span>
      )}
    </button>
  );
});

// Class group component with collapsible
const ClassGroup = memo(function ClassGroup({
  className,
  classStudents,
  attendance,
  excuseInfo,
  onToggleAbsent,
}: {
  className: string;
  classStudents: Student[];
  attendance: Record<string, AttendanceStatus>;
  excuseInfo: Record<string, ExcuseInfo>;
  onToggleAbsent: (student: Student) => void;
}) {
  const absentCount = classStudents.filter(s => {
    const status = attendance[s.id];
    return status === 'absent' || status === 'excused';
  }).length;
  const presentCount = classStudents.length - absentCount;

  return (
    <Collapsible defaultOpen className="border rounded-lg bg-card">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-2 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{className}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
            {classStudents.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-green-600">{presentCount}✓</span>
          {absentCount > 0 && (
            <span className="text-xs text-destructive font-medium">{absentCount}✗</span>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-2 pb-2">
          <div className="grid grid-cols-3 gap-0.5">
            {classStudents.map((student) => {
              const status = attendance[student.id];
              const isAbsent = status === 'absent' || status === 'excused';
              return (
                <StudentButton
                  key={student.id}
                  student={student}
                  isAbsent={isAbsent}
                  excuse={excuseInfo[student.id]}
                  onToggle={() => onToggleAbsent(student)}
                />
              );
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

export const CompactStudentList = memo(function CompactStudentList({
  students,
  attendance,
  excuseInfo,
  onToggleAbsent,
  isLoading = false,
}: CompactStudentListProps) {
  // Group students by class
  const groupedByClass = useMemo(() => {
    const groups = new Map<string, Student[]>();
    students.forEach(student => {
      const className = student.class?.name || 'Khác';
      if (!groups.has(className)) {
        groups.set(className, []);
      }
      groups.get(className)!.push(student);
    });
    // Sort groups by grade
    return Array.from(groups.entries()).sort((a, b) => {
      const gradeA = a[1][0]?.class?.grade || 0;
      const gradeB = b[1][0]?.class?.grade || 0;
      return gradeA - gradeB;
    });
  }, [students]);

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
    <div className="max-h-[50vh] overflow-y-auto space-y-2">
      {groupedByClass.map(([className, classStudents]) => (
        <ClassGroup
          key={className}
          className={className}
          classStudents={classStudents}
          attendance={attendance}
          excuseInfo={excuseInfo}
          onToggleAbsent={onToggleAbsent}
        />
      ))}
    </div>
  );
});
