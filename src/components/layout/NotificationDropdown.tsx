import { memo, useMemo } from 'react';
import { Bell, Check, CheckCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

function NotificationItem({ notif, onRead }: { notif: Notification; onRead: (id: string) => void }) {
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: vi });
    } catch {
      return '';
    }
  }, [notif.created_at]);

  return (
    <div
      className={cn(
        'flex gap-3 p-3 border-b border-border/50 cursor-pointer transition-colors hover:bg-muted/50',
        !notif.is_read && 'bg-primary/5'
      )}
      onClick={() => !notif.is_read && onRead(notif.id)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('text-sm truncate', !notif.is_read && 'font-semibold')}>
            {notif.title}
          </p>
          {!notif.is_read && (
            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notif.body}
        </p>
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {timeAgo}
        </div>
      </div>
    </div>
  );
}

export const NotificationDropdown = memo(function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Thông báo</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={markAllAsRead}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Đọc tất cả
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Chưa có thông báo
            </div>
          ) : (
            notifications.map(notif => (
              <NotificationItem key={notif.id} notif={notif} onRead={markAsRead} />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
});
