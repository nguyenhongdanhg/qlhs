import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Search, CalendarOff, Loader2, Trash2, UserMinus } from 'lucide-react';
import { cn, vietnameseNameSortCompare } from '@/lib/utils';
import { Student } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  schoolId: string;
}

export function MultiDayMealLeaveDialog({ open, onOpenChange, students, schoolId }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedStudentId('');
      setSelectedDates([]);
      setNotes('');
    }
  }, [open]);

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => vietnameseNameSortCompare(a.full_name, b.full_name));
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return sortedStudents;
    const s = search.toLowerCase().trim();
    return sortedStudents.filter(st =>
      st.full_name.toLowerCase().includes(s) ||
      st.class?.name?.toLowerCase().includes(s)
    );
  }, [sortedStudents, search]);

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // Load existing leaves for selected student
  const { data: existingLeaves = [] } = useQuery({
    queryKey: ['meal-leaves', schoolId, selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('student_meal_leaves')
        .select('*')
        .eq('school_id', schoolId)
        .eq('student_id', selectedStudentId)
        .gte('leave_date', today)
        .order('leave_date');
      return data || [];
    },
    enabled: !!selectedStudentId && open,
  });

  const handleSave = async () => {
    if (!selectedStudentId || selectedDates.length === 0 || !user) {
      toast({ title: 'Thiếu thông tin', description: 'Chọn học sinh và ít nhất 1 ngày nghỉ', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const rows = selectedDates.map(d => ({
        school_id: schoolId,
        student_id: selectedStudentId,
        leave_date: format(d, 'yyyy-MM-dd'),
        notes: notes || null,
        created_by: user.id,
      }));
      const { error } = await supabase
        .from('student_meal_leaves')
        .upsert(rows, { onConflict: 'school_id,student_id,leave_date' });
      if (error) throw error;
      toast({ title: 'Đã lưu', description: `Đã đăng ký nghỉ ăn ${rows.length} ngày cho ${selectedStudent?.full_name}` });
      qc.invalidateQueries({ queryKey: ['meal-leaves'] });
      setSelectedDates([]);
      setNotes('');
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('student_meal_leaves').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Đã xóa lịch nghỉ' });
      qc.invalidateQueries({ queryKey: ['meal-leaves'] });
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-destructive" />
            Đăng ký nghỉ ăn nhiều ngày
          </DialogTitle>
          <DialogDescription>
            Chọn học sinh và các ngày nghỉ. Học sinh sẽ tự động được tính vắng (cả 3 bữa) trong các ngày đó mà không cần báo thủ công.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Step 1: Select student */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">1. Chọn học sinh</label>
            {!selectedStudent ? (
              <>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm theo tên hoặc lớp..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <ScrollArea className="h-48 border rounded-md">
                  <div className="p-1">
                    {filteredStudents.slice(0, 100).map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStudentId(s.id)}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm flex items-center justify-between"
                      >
                        <span className="truncate">{s.full_name}</span>
                        <Badge variant="outline" className="text-[10px] ml-2 shrink-0">{s.class?.name}</Badge>
                      </button>
                    ))}
                    {filteredStudents.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Không tìm thấy học sinh</p>
                    )}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex items-center justify-between p-2 rounded-md border bg-muted/50">
                <div className="flex items-center gap-2">
                  <UserMinus className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{selectedStudent.full_name}</span>
                  <Badge variant="outline" className="text-xs">{selectedStudent.class?.name}</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedStudentId('')}>Đổi</Button>
              </div>
            )}
          </div>

          {selectedStudent && (
            <>
              {/* Step 2: Select dates */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  2. Chọn các ngày nghỉ {selectedDates.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{selectedDates.length} ngày</Badge>
                  )}
                </label>
                <div className="border rounded-md p-2 flex justify-center">
                  <Calendar
                    mode="multiple"
                    selected={selectedDates}
                    onSelect={(d) => setSelectedDates(d || [])}
                    locale={vi}
                    className="pointer-events-auto"
                  />
                </div>
                {selectedDates.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedDates
                      .sort((a, b) => a.getTime() - b.getTime())
                      .map(d => (
                        <Badge key={d.toISOString()} variant="secondary" className="text-xs">
                          {format(d, 'dd/MM/yyyy')}
                        </Badge>
                      ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Ghi chú (tuỳ chọn)</label>
                <Input
                  placeholder="VD: Về quê, ốm..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Existing leaves */}
              {existingLeaves.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Lịch nghỉ đã đăng ký (từ hôm nay)
                  </label>
                  <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                    {existingLeaves.map((l: any) => (
                      <div key={l.id} className="flex items-center justify-between p-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CalendarOff className="h-3.5 w-3.5 text-destructive" />
                          <span>{format(new Date(l.leave_date), 'EEEE, dd/MM/yyyy', { locale: vi })}</span>
                          {l.notes && <span className="text-xs text-muted-foreground">— {l.notes}</span>}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(l.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="p-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button onClick={handleSave} disabled={isSaving || !selectedStudentId || selectedDates.length === 0}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarOff className="h-4 w-4 mr-2" />}
            Lưu nghỉ ăn ({selectedDates.length} ngày)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
