import { memo, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Class, Student } from '@/types';

interface ClassFilterButtonsProps {
  classes: Class[];
  students: Student[];
  selectedClass: string;
  onSelectClass: (className: string) => void;
  showAll?: boolean;
  allLabel?: string;
  size?: 'sm' | 'default';
  className?: string;
  disabled?: boolean;
}

export const ClassFilterButtons = memo(function ClassFilterButtons({
  classes,
  students,
  selectedClass,
  onSelectClass,
  showAll = true,
  allLabel = 'Tất cả',
  size = 'sm',
  className,
  disabled = false,
}: ClassFilterButtonsProps) {
  // Sort classes by grade then name
  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [classes]);

  // Count students per class
  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach(s => {
      const className = s.class?.name || 'Khác';
      counts[className] = (counts[className] || 0) + 1;
    });
    return counts;
  }, [students]);

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {showAll && (
        <Button
          variant={selectedClass === 'all' ? 'default' : 'outline'}
          size={size}
          onClick={() => onSelectClass('all')}
          disabled={disabled}
          className="whitespace-nowrap"
        >
          {allLabel} ({students.length})
        </Button>
      )}
      {sortedClasses.map((cls) => {
        const count = classCounts[cls.name] || 0;
        if (count === 0 && !showAll) return null;
        return (
          <Button
            key={cls.id}
            variant={selectedClass === cls.name ? 'default' : 'outline'}
            size={size}
            onClick={() => onSelectClass(cls.name)}
            disabled={disabled}
            className="whitespace-nowrap"
          >
            {cls.name} ({count})
          </Button>
        );
      })}
    </div>
  );
});
