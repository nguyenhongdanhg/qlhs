import { memo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, ChevronDown, Building2, LogOut, Settings } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export const MobileHeader = memo(function MobileHeader() {
  const { profile, currentSchool, memberships, signOut, isSuperAdmin, selectSchool } = useAuth();

  const getInitials = useCallback((name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/50 bg-background/95 px-3 sm:px-4 backdrop-blur-xl lg:hidden shadow-sm">
      {/* Logo & School */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-md">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        
        {memberships.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-auto p-1">
                <span className="max-w-[120px] truncate text-sm font-medium">
                  {currentSchool?.name || 'Chọn trường'}
                </span>
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {memberships.map((membership) => (
                <DropdownMenuItem
                  key={membership.id}
                  onClick={() => membership.school && selectSchool(membership.school)}
                  className={cn(
                    membership.school_id === currentSchool?.id && 'bg-accent'
                  )}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  {membership.school?.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="max-w-[150px] truncate text-sm font-medium">
            {currentSchool?.name || 'EduBoard'}
          </span>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        <NotificationDropdown />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {isSuperAdmin ? 'Super Admin' : currentSchool?.name}
              </p>
            </div>
            <DropdownMenuSeparator />
            {isSuperAdmin && (
              <DropdownMenuItem asChild>
                <Link to="/superadmin">
                  <Building2 className="mr-2 h-4 w-4" />
                  Quản trị hệ thống
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Cài đặt
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
});
