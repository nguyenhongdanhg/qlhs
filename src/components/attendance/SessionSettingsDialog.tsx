import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Clock, Settings2, GripVertical } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface SessionConfig {
  id: string;
  session_id: string;
  label: string;
  start_time: string | null;
  end_time: string | null;
  display_order: number;
}

interface SessionSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  sessionType: 'boarding' | 'evening_study';
  onSessionsUpdated: () => void;
}

export function SessionSettingsDialog({
  open,
  onOpenChange,
  schoolId,
  sessionType,
  onSessionsUpdated,
}: SessionSettingsDialogProps) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const typeLabel = sessionType === 'boarding' ? 'ca trực' : 'ca học';

  useEffect(() => {
    if (open) fetchSessions();
  }, [open, schoolId, sessionType]);

  const fetchSessions = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('school_id', schoolId)
      .eq('session_type', sessionType)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (!error && data) {
      setSessions(data.map(s => ({
        id: s.id,
        session_id: s.session_id,
        label: s.label,
        start_time: (s as any).start_time || null,
        end_time: (s as any).end_time || null,
        display_order: s.display_order || 0,
      })));
    }
    setIsLoading(false);
  };

  const handleAddSession = () => {
    const newId = `session_${Date.now()}`;
    setSessions([...sessions, {
      id: '', // new, not in DB yet
      session_id: newId,
      label: '',
      start_time: null,
      end_time: null,
      display_order: sessions.length,
    }]);
  };

  const handleRemoveSession = (index: number) => {
    if (sessions.length <= 1) {
      toast({ title: 'Không thể xóa', description: `Phải có ít nhất một ${typeLabel}`, variant: 'destructive' });
      return;
    }
    setSessions(sessions.filter((_, i) => i !== index));
  };

  const updateSession = (index: number, field: keyof SessionConfig, value: string) => {
    const updated = [...sessions];
    (updated[index] as any)[field] = value;
    setSessions(updated);
  };

  const handleSave = async () => {
    // Validate
    for (const s of sessions) {
      if (!s.label.trim()) {
        toast({ title: 'Lỗi', description: `Tên ${typeLabel} không được để trống`, variant: 'destructive' });
        return;
      }
    }

    setIsSaving(true);
    try {
      // Delete all existing sessions for this type
      await supabase
        .from('attendance_sessions')
        .delete()
        .eq('school_id', schoolId)
        .eq('session_type', sessionType);

      // Insert all sessions
      const inserts = sessions.map((s, index) => ({
        school_id: schoolId,
        session_type: sessionType,
        session_id: s.session_id,
        label: s.label.trim(),
        start_time: s.start_time || null,
        end_time: s.end_time || null,
        display_order: index,
        is_active: true,
      }));

      const { error } = await supabase.from('attendance_sessions').insert(inserts);
      if (error) throw error;

      toast({ title: 'Đã lưu cài đặt' });
      onSessionsUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Cài đặt {sessionType === 'boarding' ? 'buổi điểm danh nội trú' : 'ca học tự học'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-2">
            {sessions.map((session, index) => (
              <div key={session.session_id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium text-muted-foreground shrink-0">
                    {sessionType === 'boarding' ? 'Ca' : 'Ca'} {index + 1}
                  </span>
                  <Input
                    value={session.label}
                    onChange={(e) => updateSession(index, 'label', e.target.value)}
                    placeholder={`Tên ${typeLabel}...`}
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={() => handleRemoveSession(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Label className="text-xs text-muted-foreground shrink-0">Từ</Label>
                  <Input
                    type="time"
                    value={session.start_time || ''}
                    onChange={(e) => updateSession(index, 'start_time', e.target.value)}
                    className="h-7 text-xs w-28"
                  />
                  <Label className="text-xs text-muted-foreground shrink-0">đến</Label>
                  <Input
                    type="time"
                    value={session.end_time || ''}
                    onChange={(e) => updateSession(index, 'end_time', e.target.value)}
                    className="h-7 text-xs w-28"
                  />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <Button variant="outline" size="sm" onClick={handleAddSession} className="w-full gap-1">
          <Plus className="h-4 w-4" />
          Thêm {typeLabel}
        </Button>

        <p className="text-xs text-muted-foreground">
          💡 Thời gian giúp hệ thống tự nhận buổi điểm danh theo giờ hiện tại và hiển thị đúng tên trong tiêu đề báo cáo.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Utility: auto-detect session based on current time and configured sessions
export function detectSessionByTimeConfig(
  sessions: { id: string; label: string; start_time?: string | null; end_time?: string | null }[]
): string {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const session of sessions) {
    if (session.start_time && session.end_time) {
      const [sh, sm] = session.start_time.split(':').map(Number);
      const [eh, em] = session.end_time.split(':').map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      if (currentMinutes >= start && currentMinutes < end) {
        return session.id;
      }
    }
  }
  // Fallback to first session
  return sessions[0]?.id || '';
}

// Utility: detect session label from a report timestamp
export function detectSessionLabelByTime(
  reportedAt: string,
  sessions: { id: string; label: string; start_time?: string | null; end_time?: string | null }[]
): string {
  const date = new Date(reportedAt);
  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  for (const session of sessions) {
    if (session.start_time && session.end_time) {
      const [sh, sm] = session.start_time.split(':').map(Number);
      const [eh, em] = session.end_time.split(':').map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      if (currentMinutes >= start && currentMinutes < end) {
        return session.label;
      }
    }
  }
  return sessions[0]?.label || 'Điểm danh';
}
