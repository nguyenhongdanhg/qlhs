import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  resultCount?: number;
  totalCount?: number;
  className?: string;
}

export function StudentSearchInput({
  value,
  onChange,
  placeholder = 'Tìm học sinh...',
  resultCount,
  totalCount,
  className,
}: StudentSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const showCount = value.trim().length > 0 && resultCount !== undefined && totalCount !== undefined;

  return (
    <div className={cn("relative", className)}>
      <Search className={cn(
        "absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors",
        isFocused ? "text-primary" : "text-muted-foreground"
      )} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={cn(
          "w-full h-8 pl-8 pr-16 text-sm rounded-md border border-input bg-background",
          "placeholder:text-muted-foreground/60",
          "focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary",
          "transition-all"
        )}
      />
      {showCount && (
        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums">
          {resultCount}/{totalCount}
        </span>
      )}
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
