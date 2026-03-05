import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserCheck, ShieldCheck } from 'lucide-react';

interface SchoolMember {
  id: string;
  full_name: string;
  role: string;
}

interface AdminReportOptionsProps {
  schoolId: string;
  currentUserId: string;
  isAdmin: boolean;
  selectedReporterId: string;
  onReporterChange: (reporterId: string) => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Quản trị',
  teacher: 'Giáo viên',
  class_teacher: 'GVCN',
  accountant: 'Kế toán',
  kitchen: 'Bếp',
  board: 'BGH',
  staff: 'Nhân viên',
};

export function AdminReportOptions({
  schoolId,
  currentUserId,
  isAdmin,
  selectedReporterId,
  onReporterChange,
}: AdminReportOptionsProps) {
  const [members, setMembers] = useState<SchoolMember[]>([]);

  useEffect(() => {
    if (!isAdmin || !schoolId) return;
    fetchMembers();
  }, [isAdmin, schoolId]);

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('school_memberships')
      .select('user_id, role, profiles:profiles!school_memberships_user_id_fkey(full_name)')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .order('role');

    if (data) {
      const mapped = data.map((m: any) => ({
        id: m.user_id,
        full_name: m.profiles?.full_name || 'N/A',
        role: m.role,
      }));
      // Sort: current user first, then alphabetically
      mapped.sort((a, b) => {
        if (a.id === currentUserId) return -1;
        if (b.id === currentUserId) return 1;
        return a.full_name.localeCompare(b.full_name, 'vi');
      });
      setMembers(mapped);
    }
  };

  if (!isAdmin) return null;

  return (
    <div>
      <label className="text-sm text-muted-foreground mb-1.5 flex items-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5" />
        Báo cáo thay
      </label>
      <Select value={selectedReporterId} onValueChange={onReporterChange}>
        <SelectTrigger>
          <UserCheck className="h-4 w-4 mr-2 shrink-0" />
          <SelectValue placeholder="Chọn người báo cáo" />
        </SelectTrigger>
        <SelectContent>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <span className="flex items-center gap-2">
                {m.full_name}
                {m.id === currentUserId && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">Tôi</Badge>
                )}
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {ROLE_LABELS[m.role] || m.role}
                </Badge>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
