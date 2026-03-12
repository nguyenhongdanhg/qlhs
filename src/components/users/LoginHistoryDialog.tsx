import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, Monitor, Smartphone } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LoginHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  userName?: string;
}

interface LoginRecord {
  id: string;
  user_id: string;
  login_at: string | null;
  success: boolean | null;
  user_agent: string | null;
  ip_address: string | null;
}

function parseDevice(ua: string | null): { icon: 'mobile' | 'desktop'; label: string } {
  if (!ua) return { icon: 'desktop', label: 'Không rõ' };
  const isMobile = /mobile|android|iphone|ipad/i.test(ua);
  let browser = 'Trình duyệt';
  if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edg/i.test(ua)) browser = 'Edge';
  return { icon: isMobile ? 'mobile' : 'desktop', label: `${browser} (${isMobile ? 'Di động' : 'Máy tính'})` };
}

export default function LoginHistoryDialog({ open, onOpenChange, userId, userName }: LoginHistoryDialogProps) {
  const { currentSchool } = useAuth();
  const [records, setRecords] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    
    const fetchHistory = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('login_history')
          .select('*')
          .eq('user_id', userId)
          .order('login_at', { ascending: false })
          .limit(50);

        if (currentSchool) {
          // Also include records without school_id (older records)
          query = supabase
            .from('login_history')
            .select('*')
            .eq('user_id', userId)
            .order('login_at', { ascending: false })
            .limit(50);
        }

        const { data, error } = await query;
        if (error) throw error;
        setRecords(data || []);
      } catch (err) {
        console.error('Error fetching login history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [open, userId, currentSchool]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Lịch sử đăng nhập {userName ? `- ${userName}` : ''}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Chưa có lịch sử đăng nhập
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Thiết bị</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const device = parseDevice(record.user_agent);
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap">
                        {record.login_at
                          ? format(new Date(record.login_at), 'HH:mm - dd/MM/yyyy', { locale: vi })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={record.success ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {record.success ? 'Thành công' : 'Thất bại'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          {device.icon === 'mobile' ? (
                            <Smartphone className="h-3.5 w-3.5" />
                          ) : (
                            <Monitor className="h-3.5 w-3.5" />
                          )}
                          {device.label}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
