import { cn } from '@/lib/utils';
import { Student, AttendanceStatus } from '@/types';
import { Badge } from '@/components/ui/badge';

interface StudentCardProps {
  student: Student;
  status: AttendanceStatus;
  showDetails?: boolean;
  excused?: boolean;
  onToggle: () => void;
  onExcuseChange?: (excused: boolean) => void;
}

export function StudentCard({ 
  student, 
  status, 
  showDetails = false,
  excused = false,
  onToggle,
  onExcuseChange 
}: StudentCardProps) {
  const isAbsent = status === 'absent';

  return (
    <div
      className={cn(
        'relative flex flex-col p-3 rounded-lg border text-left transition-all cursor-pointer',
        isAbsent
          ? 'border-red-300 bg-red-50'
          : 'border-border hover:border-primary/50 bg-background'
      )}
    >
      <div className="flex items-start gap-2" onClick={onToggle}>
        <div
          className={cn(
            'w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5',
            isAbsent ? 'border-red-500 bg-red-500' : 'border-muted-foreground'
          )}
        />
        <div className="flex-1 min-w-0">
          <p className={cn('font-medium text-sm truncate', isAbsent && 'text-red-700')}>
            {student.full_name}
          </p>
          {showDetails && (
            <div className="flex flex-wrap gap-1 mt-1">
              {student.class?.name && (
                <Badge variant="outline" className="text-xs px-1.5 py-0">
                  {student.class.name}
                </Badge>
              )}
              {student.room_number && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  P.{student.room_number}
                </Badge>
              )}
              {student.meal_group && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-orange-100 text-orange-700">
                  {student.meal_group}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Excuse toggle - only show when absent */}
      {isAbsent && onExcuseChange && (
        <div className="mt-2 pt-2 border-t border-red-200 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExcuseChange(true);
            }}
            className={cn(
              'flex-1 text-xs py-1 px-2 rounded',
              excused
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            Có phép
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExcuseChange(false);
            }}
            className={cn(
              'flex-1 text-xs py-1 px-2 rounded',
              !excused
                ? 'bg-red-100 text-red-700 border border-red-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            Không phép
          </button>
        </div>
      )}
    </div>
  );
}
