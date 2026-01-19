import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DutySchedule as DutyScheduleType, Profile } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { format, startOfWeek, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CalendarIcon,
  Loader2,
  CalendarDays,
  Plus,
  User,
  MapPin,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const shifts = [
  { value: 'morning', label: 'Ca sáng', time: '06:00 - 12:00', color: 'bg-warning/10 text-warning border-warning/30' },
  { value: 'afternoon', label: 'Ca chiều', time: '12:00 - 18:00', color: 'bg-info/10 text-info border-info/30' },
  { value: 'evening', label: 'Ca tối', time: '18:00 - 22:00', color: 'bg-primary/10 text-primary border-primary/30' },
  { value: 'night', label: 'Ca đêm', time: '22:00 - 06:00', color: 'bg-accent/10 text-accent border-accent/30' },
];

const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function DutySchedule() {
  const { currentSchool, user, isSchoolAdmin } = useAuth();
  const { toast } = useToast();

  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [schedules, setSchedules] = useState<DutyScheduleType[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    user_id: '',
    duty_date: new Date(),
    shift: 'morning',
    location: '',
    notes: '',
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (!currentSchool) return;
    fetchData();
  }, [currentSchool, weekStart]);

  const fetchData = async () => {
    if (!currentSchool) return;
    setIsLoading(true);

    try {
      // Fetch schedules for the week
      const startStr = format(weekStart, 'yyyy-MM-dd');
      const endStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

      const { data: schedulesData } = await supabase
        .from('duty_schedules')
        .select(`
          *,
          profile:profiles(*)
        `)
        .eq('school_id', currentSchool.id)
        .gte('duty_date', startStr)
        .lte('duty_date', endStr)
        .order('duty_date');

      setSchedules((schedulesData || []).map(s => ({
        ...s,
        profile: s.profile as unknown as Profile
      })) as DutyScheduleType[]);

      // Fetch school members
      const { data: membershipsData } = await supabase
        .from('school_memberships')
        .select(`
          user_id,
          profile:profiles(*)
        `)
        .eq('school_id', currentSchool.id)
        .eq('status', 'active');

      const profiles = (membershipsData || [])
        .map(m => m.profile as unknown as Profile)
        .filter(Boolean);
      setMembers(profiles);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải lịch trực',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentSchool || !formData.user_id) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn người trực',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from('duty_schedules').insert({
        school_id: currentSchool.id,
        user_id: formData.user_id,
        duty_date: format(formData.duty_date, 'yyyy-MM-dd'),
        shift: formData.shift,
        location: formData.location || null,
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast({ title: 'Thành công', description: 'Đã thêm lịch trực' });
      setIsDialogOpen(false);
      setFormData({
        user_id: '',
        duty_date: new Date(),
        shift: 'morning',
        location: '',
        notes: '',
      });
      fetchData();
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể lưu lịch trực',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa lịch trực này?')) return;

    try {
      const { error } = await supabase.from('duty_schedules').delete().eq('id', id);
      if (error) throw error;

      toast({ title: 'Thành công', description: 'Đã xóa lịch trực' });
      fetchData();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa lịch trực',
        variant: 'destructive',
      });
    }
  };

  const getSchedulesForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return schedules.filter(s => s.duty_date === dateStr);
  };

  const getShiftInfo = (shift: string) => {
    return shifts.find(s => s.value === shift) || shifts[0];
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(-2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  if (!currentSchool) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Vui lòng chọn trường để tiếp tục</p>
      </div>
    );
  }

  return (
    <div className="content-wrapper animate-fade-in">
      <div className="page-header flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-primary" />
            Lịch trực
          </h1>
          <p className="page-description">
            Quản lý lịch trực giáo viên và nhân viên
          </p>
        </div>

        {isSchoolAdmin() && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Thêm lịch trực
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thêm lịch trực</DialogTitle>
                <DialogDescription>
                  Phân công người trực cho ca làm việc
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Người trực *</Label>
                  <Select
                    value={formData.user_id}
                    onValueChange={(v) => setFormData({ ...formData, user_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn người trực" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Ngày trực *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(formData.duty_date, 'dd/MM/yyyy', { locale: vi })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.duty_date}
                        onSelect={(d) => d && setFormData({ ...formData, duty_date: d })}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2">
                  <Label>Ca trực *</Label>
                  <Select
                    value={formData.shift}
                    onValueChange={(v) => setFormData({ ...formData, shift: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {shifts.map((shift) => (
                        <SelectItem key={shift.value} value={shift.value}>
                          {shift.label} ({shift.time})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Vị trí</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="VD: Cổng trường, Ký túc xá..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Ghi chú</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Ghi chú thêm..."
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Hủy
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Thêm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Week Navigation */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {format(weekStart, 'dd/MM')} - {format(addDays(weekStart, 6), 'dd/MM/yyyy', { locale: vi })}
              </h2>
              <Button
                variant="link"
                size="sm"
                className="text-primary p-0 h-auto"
                onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              >
                Hôm nay
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {weekDays.map((day, index) => {
            const daySchedules = getSchedulesForDay(day);
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

            return (
              <Card
                key={day.toISOString()}
                className={cn(
                  'overflow-hidden',
                  isToday && 'border-primary ring-1 ring-primary'
                )}
              >
                <div className={cn(
                  'flex items-center gap-3 px-4 py-3 border-b',
                  isToday ? 'bg-primary/5' : 'bg-muted/50'
                )}>
                  <div className={cn(
                    'flex h-10 w-10 flex-col items-center justify-center rounded-lg font-semibold',
                    isToday ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}>
                    <span className="text-xs">{dayLabels[index]}</span>
                    <span className="text-sm">{format(day, 'd')}</span>
                  </div>
                  <div>
                    <div className={cn('font-medium', isToday && 'text-primary')}>
                      {format(day, 'EEEE', { locale: vi })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(day, 'dd/MM/yyyy')}
                    </div>
                  </div>
                </div>

                <CardContent className="p-4">
                  {daySchedules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Chưa có lịch trực
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {daySchedules.map((schedule) => {
                        const shiftInfo = getShiftInfo(schedule.shift || '');
                        return (
                          <div
                            key={schedule.id}
                            className={cn(
                              'flex items-center gap-3 rounded-xl border p-3',
                              shiftInfo.color
                            )}
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                                {getInitials(schedule.profile?.full_name || '')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{shiftInfo.label}</span>
                                <span className="text-xs opacity-75">({shiftInfo.time})</span>
                              </div>
                              <div className="text-sm font-medium truncate">
                                {schedule.profile?.full_name}
                              </div>
                              {schedule.location && (
                                <div className="flex items-center gap-1 text-xs opacity-75 mt-0.5">
                                  <MapPin className="h-3 w-3" />
                                  {schedule.location}
                                </div>
                              )}
                            </div>
                            {isSchoolAdmin() && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(schedule.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
