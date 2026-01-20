import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DutySchedule as DutyScheduleType, Profile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CalendarDays,
  Loader2,
  RefreshCw,
  Copy,
  Wand2,
  Pin,
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
  User,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_PER_DAY = 3;
const MAX_PER_PERSON = 5;

interface DutyMember extends Profile {
  dutyCount: number;
  isFixed: boolean;
  fixedDays: number[];
}

export default function DutySchedule() {
  const { currentSchool, isSchoolAdmin } = useAuth();
  const { toast } = useToast();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [schedules, setSchedules] = useState<DutyScheduleType[]>([]);
  const [dutyMembers, setDutyMembers] = useState<DutyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('assignment');
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Get days in current month
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Calculate current duty person (6am to 6am next day)
  const currentDutyPersons = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // If before 6am, use previous day's duty
    let dutyDate: Date;
    if (currentHour < 6) {
      dutyDate = addDays(now, -1);
    } else {
      dutyDate = now;
    }
    
    const dateStr = format(dutyDate, 'yyyy-MM-dd');
    return schedules.filter(s => s.duty_date === dateStr);
  }, [schedules]);

  // Count duties per day
  const dutiesPerDay = useMemo(() => {
    const counts: Record<string, number> = {};
    schedules.forEach(s => {
      counts[s.duty_date] = (counts[s.duty_date] || 0) + 1;
    });
    return counts;
  }, [schedules]);

  // Count duties per member for current month
  const dutiesPerMember = useMemo(() => {
    const counts: Record<string, number> = {};
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    
    schedules.forEach(s => {
      if (s.duty_date >= monthStart && s.duty_date <= monthEnd) {
        counts[s.user_id] = (counts[s.user_id] || 0) + 1;
      }
    });
    return counts;
  }, [schedules, currentMonth]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchSchedules();
  }, [currentSchool, currentMonth]);

  const fetchSchedules = async () => {
    if (!currentSchool) return;
    setIsLoading(true);

    try {
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('duty_schedules')
        .select(`*, profile:profiles(*)`)
        .eq('school_id', currentSchool.id)
        .gte('duty_date', monthStart)
        .lte('duty_date', monthEnd)
        .order('duty_date');

      if (error) throw error;

      setSchedules((data || []).map(s => ({
        ...s,
        profile: s.profile as unknown as Profile
      })) as DutyScheduleType[]);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải lịch trực',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMembers = async () => {
    if (!currentSchool) return;

    try {
      const { data, error } = await supabase
        .from('school_memberships')
        .select(`user_id, profile:profiles(*)`)
        .eq('school_id', currentSchool.id)
        .eq('status', 'active');

      if (error) throw error;

      const members = (data || [])
        .map(m => ({
          ...(m.profile as unknown as Profile),
          dutyCount: dutiesPerMember[m.user_id] || 0,
          isFixed: false,
          fixedDays: [],
        }))
        .filter(Boolean) as DutyMember[];

      setDutyMembers(members);
      toast({ title: 'Thành công', description: `Đã tải ${members.length} tài khoản` });
    } catch (error) {
      console.error('Error fetching members:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách tài khoản',
        variant: 'destructive',
      });
    }
  };

  const isAssigned = (userId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return schedules.some(s => s.user_id === userId && s.duty_date === dateStr);
  };

  const canAssign = (userId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayCount = dutiesPerDay[dateStr] || 0;
    const memberCount = dutiesPerMember[userId] || 0;
    
    // Already assigned
    if (isAssigned(userId, date)) return true;
    
    // Check limits
    if (dayCount >= MAX_PER_DAY) return false;
    if (memberCount >= MAX_PER_PERSON) return false;
    
    return true;
  };

  const toggleAssignment = async (userId: string, date: Date) => {
    if (!currentSchool) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = schedules.find(s => s.user_id === userId && s.duty_date === dateStr);

    setIsSaving(true);
    try {
      if (existing) {
        // Remove assignment
        const { error } = await supabase
          .from('duty_schedules')
          .delete()
          .eq('id', existing.id);
        
        if (error) throw error;
        
        setSchedules(prev => prev.filter(s => s.id !== existing.id));
      } else {
        // Check limits before adding
        const dayCount = dutiesPerDay[dateStr] || 0;
        const memberCount = dutiesPerMember[userId] || 0;
        
        if (dayCount >= MAX_PER_DAY) {
          toast({
            title: 'Không thể phân công',
            description: `Ngày ${format(date, 'dd/MM')} đã đủ ${MAX_PER_DAY} người trực`,
            variant: 'destructive',
          });
          return;
        }
        
        if (memberCount >= MAX_PER_PERSON) {
          toast({
            title: 'Không thể phân công',
            description: `Người này đã trực ${MAX_PER_PERSON} lần trong tháng`,
            variant: 'destructive',
          });
          return;
        }

        // Add assignment
        const { data, error } = await supabase
          .from('duty_schedules')
          .insert({
            school_id: currentSchool.id,
            user_id: userId,
            duty_date: dateStr,
          })
          .select(`*, profile:profiles(*)`)
          .single();

        if (error) throw error;

        setSchedules(prev => [...prev, {
          ...data,
          profile: data.profile as unknown as Profile
        } as DutyScheduleType]);
      }
    } catch (error: any) {
      console.error('Error toggling assignment:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật phân công',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyFromPreviousMonth = async () => {
    if (!currentSchool) return;

    const prevMonth = subMonths(currentMonth, 1);
    const prevMonthStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
    const prevMonthEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd');

    setIsSaving(true);
    try {
      // Fetch previous month's schedules
      const { data: prevSchedules, error: fetchError } = await supabase
        .from('duty_schedules')
        .select('*')
        .eq('school_id', currentSchool.id)
        .gte('duty_date', prevMonthStart)
        .lte('duty_date', prevMonthEnd);

      if (fetchError) throw fetchError;

      if (!prevSchedules || prevSchedules.length === 0) {
        toast({
          title: 'Thông báo',
          description: 'Không có lịch trực tháng trước để sao chép',
        });
        return;
      }

      // Map to current month (same day of month)
      const newSchedules = prevSchedules.map(s => {
        const prevDate = new Date(s.duty_date);
        const dayOfMonth = prevDate.getDate();
        const currentMonthDays = endOfMonth(currentMonth).getDate();
        
        // Skip if day doesn't exist in current month
        if (dayOfMonth > currentMonthDays) return null;

        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayOfMonth);
        
        return {
          school_id: currentSchool.id,
          user_id: s.user_id,
          duty_date: format(newDate, 'yyyy-MM-dd'),
        };
      }).filter(Boolean);

      if (newSchedules.length === 0) {
        toast({
          title: 'Thông báo',
          description: 'Không có lịch trực phù hợp để sao chép',
        });
        return;
      }

      // Clear current month first
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      await supabase
        .from('duty_schedules')
        .delete()
        .eq('school_id', currentSchool.id)
        .gte('duty_date', monthStart)
        .lte('duty_date', monthEnd);

      // Insert new schedules
      const { error: insertError } = await supabase
        .from('duty_schedules')
        .insert(newSchedules as any[]);

      if (insertError) throw insertError;

      toast({
        title: 'Thành công',
        description: `Đã sao chép ${newSchedules.length} lịch trực từ tháng trước`,
      });

      fetchSchedules();
    } catch (error: any) {
      console.error('Error copying schedules:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể sao chép lịch trực',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const autoAssign = async () => {
    if (!currentSchool || dutyMembers.length === 0) {
      toast({
        title: 'Thông báo',
        description: 'Vui lòng tải danh sách tài khoản trước',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Clear current month
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      await supabase
        .from('duty_schedules')
        .delete()
        .eq('school_id', currentSchool.id)
        .gte('duty_date', monthStart)
        .lte('duty_date', monthEnd);

      // Auto-assign: round-robin style
      const newSchedules: { school_id: string; user_id: string; duty_date: string }[] = [];
      const memberCounts: Record<string, number> = {};
      let memberIndex = 0;

      for (const day of daysInMonth) {
        const dateStr = format(day, 'yyyy-MM-dd');
        let dayCount = 0;

        // Try to assign MAX_PER_DAY people per day
        while (dayCount < MAX_PER_DAY) {
          const startIndex = memberIndex;
          let assigned = false;

          do {
            const member = dutyMembers[memberIndex % dutyMembers.length];
            const count = memberCounts[member.id] || 0;

            if (count < MAX_PER_PERSON) {
              newSchedules.push({
                school_id: currentSchool.id,
                user_id: member.id,
                duty_date: dateStr,
              });
              memberCounts[member.id] = count + 1;
              dayCount++;
              memberIndex = (memberIndex + 1) % dutyMembers.length;
              assigned = true;
              break;
            }

            memberIndex = (memberIndex + 1) % dutyMembers.length;
          } while (memberIndex !== startIndex);

          if (!assigned) break;
        }
      }

      if (newSchedules.length > 0) {
        const { error } = await supabase
          .from('duty_schedules')
          .insert(newSchedules);

        if (error) throw error;
      }

      toast({
        title: 'Thành công',
        description: `Đã tự động phân công ${newSchedules.length} lịch trực`,
      });

      fetchSchedules();
    } catch (error: any) {
      console.error('Error auto-assigning:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể tự động phân công',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(-2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  // Get schedules for calendar view
  const getSchedulesForRange = () => {
    let start: Date, end: Date;
    
    if (viewMode === 'day') {
      start = selectedDate;
      end = selectedDate;
    } else if (viewMode === 'week') {
      start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    } else {
      start = startOfMonth(selectedDate);
      end = endOfMonth(selectedDate);
    }
    
    return eachDayOfInterval({ start, end });
  };

  const getSchedulesForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return schedules.filter(s => s.duty_date === dateStr);
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
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-primary" />
            Lịch trực
          </h1>
          <p className="page-description">
            Quản lý phân công trực (Ca trực: 6h sáng - 6h sáng hôm sau)
          </p>
        </div>
      </div>

      {/* Current Duty Display */}
      <Card className="mb-4 border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Đang trực hiện tại
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentDutyPersons.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có người trực được phân công</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {currentDutyPersons.map(duty => (
                <div key={duty.id} className="flex items-center gap-2 bg-background rounded-full px-3 py-1.5 border">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(duty.profile?.full_name || '')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">{duty.profile?.full_name}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="assignment" className="gap-2">
            <Users className="h-4 w-4" />
            Phân công trực
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            Lịch trực
          </TabsTrigger>
        </TabsList>

        {/* Assignment Tab */}
        <TabsContent value="assignment" className="space-y-4">
          {/* Month Navigation */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <h2 className="text-lg font-semibold min-w-[140px] text-center">
                    Tháng {format(currentMonth, 'MM/yyyy')}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={fetchMembers}
                    disabled={isSaving}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Lấy danh sách
                  </Button>

                  {isSchoolAdmin() && (
                    <>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1" disabled={isSaving}>
                            <Copy className="h-4 w-4" />
                            Sao chép T.trước
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Sao chép lịch trực?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Thao tác này sẽ xóa toàn bộ lịch trực tháng hiện tại và thay thế bằng lịch trực tháng trước.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction onClick={copyFromPreviousMonth}>
                              Xác nhận
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1" disabled={isSaving || dutyMembers.length === 0}>
                            <Wand2 className="h-4 w-4" />
                            Tự động phân công
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Tự động phân công?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Thao tác này sẽ xóa toàn bộ lịch trực tháng hiện tại và tự động phân công đều cho {dutyMembers.length} người (tối đa {MAX_PER_DAY} người/ngày, {MAX_PER_PERSON} lần/người/tháng).
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction onClick={autoAssign}>
                              Xác nhận
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assignment Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : dutyMembers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">Chưa có danh sách người trực</p>
                <Button onClick={fetchMembers} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Lấy từ danh sách tài khoản
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <ScrollArea className="w-full">
                <div className="min-w-[800px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center sticky left-0 bg-background z-10">STT</TableHead>
                        <TableHead className="min-w-[150px] sticky left-12 bg-background z-10">Họ tên</TableHead>
                        <TableHead className="w-16 text-center">Số lần</TableHead>
                        {daysInMonth.map((day, i) => {
                          const dayCount = dutiesPerDay[format(day, 'yyyy-MM-dd')] || 0;
                          const isFull = dayCount >= MAX_PER_DAY;
                          const today = isToday(day);
                          
                          return (
                            <TableHead 
                              key={i} 
                              className={cn(
                                "w-10 text-center p-1",
                                today && "bg-primary/10",
                                isFull && "bg-destructive/10"
                              )}
                            >
                              <div className="flex flex-col items-center">
                                <span className="text-xs text-muted-foreground">
                                  {format(day, 'EEE', { locale: vi })}
                                </span>
                                <span className={cn("text-sm", today && "text-primary font-bold")}>
                                  {format(day, 'd')}
                                </span>
                                <span className={cn(
                                  "text-xs",
                                  isFull ? "text-destructive" : "text-muted-foreground"
                                )}>
                                  {dayCount}/{MAX_PER_DAY}
                                </span>
                              </div>
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dutyMembers.map((member, idx) => {
                        const memberDutyCount = dutiesPerMember[member.id] || 0;
                        const isFull = memberDutyCount >= MAX_PER_PERSON;

                        return (
                          <TableRow key={member.id} className={cn(isFull && "bg-destructive/5")}>
                            <TableCell className="text-center sticky left-0 bg-background">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="sticky left-12 bg-background">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {getInitials(member.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-sm truncate max-w-[120px]">
                                  {member.full_name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={isFull ? "destructive" : "secondary"}>
                                {memberDutyCount}/{MAX_PER_PERSON}
                              </Badge>
                            </TableCell>
                            {daysInMonth.map((day, i) => {
                              const assigned = isAssigned(member.id, day);
                              const canCheck = canAssign(member.id, day);
                              const today = isToday(day);

                              return (
                                <TableCell 
                                  key={i} 
                                  className={cn(
                                    "text-center p-1",
                                    today && "bg-primary/5"
                                  )}
                                >
                                  <div className="flex justify-center">
                                    <Checkbox
                                      checked={assigned}
                                      disabled={!isSchoolAdmin() || isSaving || (!assigned && !canCheck)}
                                      onCheckedChange={() => toggleAssignment(member.id, day)}
                                      className={cn(
                                        "h-5 w-5",
                                        assigned && "bg-primary border-primary"
                                      )}
                                    />
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-4">
          {/* View Mode & Navigation */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (viewMode === 'day') setSelectedDate(addDays(selectedDate, -1));
                      else if (viewMode === 'week') setSelectedDate(addDays(selectedDate, -7));
                      else setSelectedDate(subMonths(selectedDate, 1));
                    }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <h2 className="text-lg font-semibold min-w-[180px] text-center">
                    {viewMode === 'day' && format(selectedDate, 'dd/MM/yyyy', { locale: vi })}
                    {viewMode === 'week' && `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}`}
                    {viewMode === 'month' && format(selectedDate, 'MMMM yyyy', { locale: vi })}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (viewMode === 'day') setSelectedDate(addDays(selectedDate, 1));
                      else if (viewMode === 'week') setSelectedDate(addDays(selectedDate, 7));
                      else setSelectedDate(addMonths(selectedDate, 1));
                    }}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setSelectedDate(new Date())}
                  >
                    Hôm nay
                  </Button>
                  <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Ngày</SelectItem>
                      <SelectItem value="week">Tuần</SelectItem>
                      <SelectItem value="month">Tháng</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calendar Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className={cn(
              "grid gap-3",
              viewMode === 'day' ? "grid-cols-1" : 
              viewMode === 'week' ? "grid-cols-1 md:grid-cols-7" : 
              "grid-cols-2 sm:grid-cols-4 md:grid-cols-7"
            )}>
              {getSchedulesForRange().map(day => {
                const daySchedules = getSchedulesForDay(day);
                const today = isToday(day);

                return (
                  <Card 
                    key={day.toISOString()} 
                    className={cn(
                      "overflow-hidden",
                      today && "border-primary ring-1 ring-primary"
                    )}
                  >
                    <div className={cn(
                      "px-3 py-2 border-b text-center",
                      today ? "bg-primary/10" : "bg-muted/50"
                    )}>
                      <div className="text-xs text-muted-foreground">
                        {format(day, 'EEEE', { locale: vi })}
                      </div>
                      <div className={cn(
                        "text-lg font-semibold",
                        today && "text-primary"
                      )}>
                        {format(day, 'd')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(day, 'MM/yyyy')}
                      </div>
                    </div>
                    <CardContent className={cn(
                      "p-2",
                      viewMode === 'month' ? "min-h-[60px]" : "min-h-[100px]"
                    )}>
                      {daySchedules.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Chưa phân công
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {daySchedules.map(schedule => (
                            <div
                              key={schedule.id}
                              className="flex items-center gap-1.5 bg-primary/10 rounded-md px-2 py-1"
                            >
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                                  {getInitials(schedule.profile?.full_name || '')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-medium truncate">
                                {schedule.profile?.full_name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
