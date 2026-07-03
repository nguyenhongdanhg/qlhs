import { memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationDropdown } from './NotificationDropdown';
import { AcademicYearSwitcher } from './AcademicYearSwitcher';

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

      <div className="flex items-center gap-3">
        <AcademicYearSwitcher />
        <NotificationDropdown />
      </div>
    </header>
  );
});
