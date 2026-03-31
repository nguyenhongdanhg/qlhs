import { memo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationDropdown } from './NotificationDropdown';

export const MainHeader = memo(function MainHeader() {
  const { currentSchool } = useAuth();

  return (
    <header className="sticky top-0 z-30 hidden lg:flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur px-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          {currentSchool?.name || 'QUẢN LÝ NỘI TRÚ/BÁN TRÚ'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Ứng dụng quản lý nội trú/bán trú
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm..."
            className="w-[280px] pl-9 bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>
        
        <NotificationDropdown />
      </div>
    </header>
  );
});
