import { memo } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSelectedYear } from '@/contexts/SelectedYearContext';
import { cn } from '@/lib/utils';

interface Props {
  compact?: boolean;
}

export const AcademicYearSwitcher = memo(function AcademicYearSwitcher({ compact }: Props) {
  const { years, selectedYear, activeYear, setSelectedYearId, isViewingOtherYear } = useSelectedYear();

  if (!years.length) return null;

  const label = selectedYear?.name ?? 'Chọn năm học';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isViewingOtherYear ? 'secondary' : 'outline'}
          size={compact ? 'sm' : 'default'}
          className={cn(
            'gap-1.5',
            compact && 'h-8 px-2 text-xs',
            isViewingOtherYear && 'border-amber-500/50 text-amber-700 dark:text-amber-400'
          )}
          title={isViewingOtherYear ? 'Đang xem năm học khác năm mặc định' : 'Năm học đang xem'}
        >
          <CalendarDays className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          <span className={cn('truncate', compact ? 'max-w-[80px]' : 'max-w-[140px]')}>{label}</span>
          <ChevronDown className={compact ? 'h-3 w-3' : 'h-4 w-4 opacity-60'} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Năm học đang xem
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {years.map((y) => {
          const isSelected = y.id === selectedYear?.id;
          const isActive = y.id === activeYear?.id;
          return (
            <DropdownMenuItem
              key={y.id}
              onClick={() => setSelectedYearId(y.id)}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{y.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {y.start_date ?? '?'} → {y.end_date ?? '?'}
                  {isActive && ' • mặc định'}
                  {y.status === 'closed' && ' • đã đóng'}
                  {y.status === 'archived' && ' • lưu trữ'}
                </span>
              </div>
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
