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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
  getDay,
  differenceInHours,
  differenceInMinutes,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CalendarDays,
  Loader2,
  RefreshCw,
  Copy,
  Wand2,
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
  Clock,
  Trash2,
  ArrowRight,
  UserPlus,
  Save,
  BarChart3,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import DutyStatisticsTab from '@/components/duty/DutyStatisticsTab';

const MAX_PER_DAY = 3;
const MAX_PER_PERSON = 5;
const SHIFT_START_HOUR = 6;

interface DutyMember extends Profile {
  dutyCount: number;
  isFixed: boolean;
  fixedDays: number[];
  gender?: 'male' | 'female' | 'other';
}

export default function DutySchedule() {
  const { currentSchool, isSchoolAdmin } = useAuth();
  const { toast } = useToast();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [schedules, setSchedules] = useState<DutyScheduleType[]>([]);
  const [previousMonthSchedules, setPreviousMonthSchedules] = useState<DutyScheduleType[]>([]);
  const [dutyMembers, setDutyMembers] = useState<DutyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('assignment');
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeRemaining, setTimeRemaining] = useState({ hours: 0, minutes: 0 });
  const [availableMembers, setAvailableMembers] = useState<DutyMember[]>([]);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);

  // Get days in current month
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Calculate current duty date (6am to 6am next day)
  const getCurrentDutyDate = () => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // If before 6am, use previous day's duty
    if (currentHour < SHIFT_START_HOUR) {
      return addDays(now, -1);
    }
    return now;
  };

  // Calculate next duty date
  const getNextDutyDate = () => {
    return addDays(getCurrentDutyDate(), 1);
  };

  // Calculate time remaining for current shift
  useEffect(() => {
    const updateTimeRemaining = () => {
      const now = new Date();
      const hour = now.getHours();
      
      // Calculate next shift change at 6 AM
      let nextShiftChange = new Date(now);
      if (hour >= SHIFT_START_HOUR) {
        // Next shift is tomorrow at 6 AM
        nextShiftChange = addDays(nextShiftChange, 1);
      }
      nextShiftChange.setHours(SHIFT_START_HOUR, 0, 0, 0);
      
      const hoursLeft = differenceInHours(nextShiftChange, now);
      const minutesLeft = differenceInMinutes(nextShiftChange, now) % 60;
      
      setTimeRemaining({ hours: hoursLeft, minutes: minutesLeft });
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Current duty persons
  const currentDutyPersons = useMemo(() => {
    const dutyDate = getCurrentDutyDate();
    const dateStr = format(dutyDate, 'yyyy-MM-dd');
    return schedules.filter(s => s.duty_date === dateStr);
  }, [schedules]);

  // Next duty persons
  const nextDutyPersons = useMemo(() => {
    const nextDate = getNextDutyDate();
    const dateStr = format(nextDate, 'yyyy-MM-dd');
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
    fetchSavedDutyMembers();
  }, [currentSchool, currentMonth]);

  const fetchSchedules = async () => {
    if (!currentSchool) return;
    setIsLoading(true);

    try {
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      
      // Also fetch previous month for comparison
      const prevMonth = subMonths(currentMonth, 1);
      const prevMonthStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
      const prevMonthEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd');

      const [currentData, prevData] = await Promise.all([
        supabase
          .from('duty_schedules')
          .select(`*, profile:profiles(*)`)
          .eq('school_id', currentSchool.id)
          .gte('duty_date', monthStart)
          .lte('duty_date', monthEnd)
          .order('duty_date'),
        supabase
          .from('duty_schedules')
          .select(`*, profile:profiles(*)`)
          .eq('school_id', currentSchool.id)
          .gte('duty_date', prevMonthStart)
          .lte('duty_date', prevMonthEnd)
          .order('duty_date'),
      ]);

      if (currentData.error) throw currentData.error;

      setSchedules((currentData.data || []).map(s => ({
        ...s,
        profile: s.profile as unknown as Profile
      })) as DutyScheduleType[]);
      
      setPreviousMonthSchedules((prevData.data || []).map(s => ({
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

  // Fetch saved duty members from database
  const fetchSavedDutyMembers = async () => {
    if (!currentSchool) return;

    try {
      const { data, error } = await supabase
        .from('duty_members')
        .select(`*, profile:profiles(*)`)
        .eq('school_id', currentSchool.id);

      if (error) throw error;

      const members = (data || [])
        .map(m => ({
          ...(m.profile as unknown as Profile),
          dutyCount: dutiesPerMember[(m.profile as any)?.id] || 0,
          isFixed: false,
          fixedDays: [],
        }))
        .filter(Boolean) as DutyMember[];

      setDutyMembers(members);
    } catch (error) {
      console.error('Error fetching saved duty members:', error);
    }
  };

  // Fetch available members from school accounts (for adding new members)
  const fetchAvailableMembers = async () => {
    if (!currentSchool) return;

    try {
      const { data, error } = await supabase
        .from('school_memberships')
        .select(`user_id, profile:profiles(*)`)
        .eq('school_id', currentSchool.id)
        .eq('status', 'active');

      if (error) throw error;

      // Filter out members already in duty list
      const existingIds = dutyMembers.map(m => m.id);
      const available = (data || [])
        .map(m => ({
          ...(m.profile as unknown as Profile),
          dutyCount: 0,
          isFixed: false,
          fixedDays: [],
        }))
        .filter(m => m && !existingIds.includes(m.id)) as DutyMember[];

      setAvailableMembers(available);
      setSelectedNewMembers([]);
      setShowAddMemberDialog(true);
    } catch (error) {
      console.error('Error fetching available members:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách tài khoản',
        variant: 'destructive',
      });
    }
  };

  // Add selected members to duty list and save to database
  const addSelectedMembers = async () => {
    if (!currentSchool || selectedNewMembers.length === 0) return;

    setIsSaving(true);
    try {
      const newEntries = selectedNewMembers.map(userId => ({
        school_id: currentSchool.id,
        user_id: userId,
      }));

      const { error } = await supabase
        .from('duty_members')
        .insert(newEntries);

      if (error) throw error;

      // Add to local state
      const newMembers = availableMembers.filter(m => selectedNewMembers.includes(m.id));
      setDutyMembers(prev => [...prev, ...newMembers]);
      
      setShowAddMemberDialog(false);
      setSelectedNewMembers([]);
      toast({ title: 'Thành công', description: `Đã thêm ${newMembers.length} người vào danh sách trực` });
    } catch (error: any) {
      console.error('Error adding members:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể thêm người trực',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Remove member from duty list
  const removeDutyMember = async (userId: string) => {
    if (!currentSchool) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('duty_members')
        .delete()
        .eq('school_id', currentSchool.id)
        .eq('user_id', userId);

      if (error) throw error;

      // Also remove their schedules for current month
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      
      await supabase
        .from('duty_schedules')
        .delete()
        .eq('school_id', currentSchool.id)
        .eq('user_id', userId)
        .gte('duty_date', monthStart)
        .lte('duty_date', monthEnd);

      setDutyMembers(prev => prev.filter(m => m.id !== userId));
      setSchedules(prev => prev.filter(s => s.user_id !== userId));
      
      toast({ title: 'Thành công', description: 'Đã xóa người trực khỏi danh sách' });
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa người trực',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
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

  // Remove all assignments for a member in current month
  const removeAllAssignments = async (userId: string) => {
    if (!currentSchool) return;
    
    const memberSchedules = schedules.filter(s => s.user_id === userId);
    if (memberSchedules.length === 0) return;
    
    setIsSaving(true);
    try {
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('duty_schedules')
        .delete()
        .eq('school_id', currentSchool.id)
        .eq('user_id', userId)
        .gte('duty_date', monthStart)
        .lte('duty_date', monthEnd);
      
      if (error) throw error;
      
      setSchedules(prev => prev.filter(s => 
        s.user_id !== userId || 
        s.duty_date < monthStart ||
        s.duty_date > monthEnd
      ));
      
      toast({ title: 'Thành công', description: 'Đã xóa tất cả phân công của thành viên' });
    } catch (error: any) {
      console.error('Error removing assignments:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa phân công',
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

    // Separate members by gender
    const maleMembers = dutyMembers.filter(m => m.gender === 'male');
    const femaleMembers = dutyMembers.filter(m => m.gender === 'female');
    const otherMembers = dutyMembers.filter(m => m.gender !== 'male' && m.gender !== 'female');
    
    if (maleMembers.length === 0) {
      toast({
        title: 'Cảnh báo',
        description: 'Không có thành viên nam trong danh sách. Tiếp tục phân công bình thường.',
      });
    }

    setIsSaving(true);
    try {
      // Get previous month's schedules to analyze patterns
      const prevMonth = subMonths(currentMonth, 1);
      const prevMonthStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
      const prevMonthEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd');

      const { data: prevSchedules } = await supabase
        .from('duty_schedules')
        .select('*')
        .eq('school_id', currentSchool.id)
        .gte('duty_date', prevMonthStart)
        .lte('duty_date', prevMonthEnd)
        .order('duty_date', { ascending: false });

      // Calculate last duty date and weekend counts from previous month
      const lastDutyDate: Record<string, string> = {};
      const prevWeekendCounts: Record<string, number> = {};
      
      (prevSchedules || []).forEach(s => {
        if (!lastDutyDate[s.user_id]) {
          lastDutyDate[s.user_id] = s.duty_date;
        }
        const dayOfWeek = getDay(new Date(s.duty_date));
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          prevWeekendCounts[s.user_id] = (prevWeekendCounts[s.user_id] || 0) + 1;
        }
      });

      // Clear current month
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      await supabase
        .from('duty_schedules')
        .delete()
        .eq('school_id', currentSchool.id)
        .gte('duty_date', monthStart)
        .lte('duty_date', monthEnd);

      // Calculate even distribution
      const totalDays = daysInMonth.length;
      const totalMembers = dutyMembers.length;
      const totalSlots = totalDays * MAX_PER_DAY;
      
      // Calculate duties per person for even distribution
      const baseDutiesPerPerson = Math.floor(totalSlots / totalMembers);
      const extraDuties = totalSlots % totalMembers;
      
      // Initialize member quotas
      const memberQuota: Record<string, number> = {};
      const memberCounts: Record<string, number> = {};
      const memberLastDate: Record<string, string> = { ...lastDutyDate };
      const weekendCounts: Record<string, number> = {};
      
      // Assign quotas - members with fewer previous weekend duties get extra
      const sortedByPrevWeekend = [...dutyMembers].sort((a, b) => {
        const aWeekend = prevWeekendCounts[a.id] || 0;
        const bWeekend = prevWeekendCounts[b.id] || 0;
        return aWeekend - bWeekend;
      });
      
      sortedByPrevWeekend.forEach((member, idx) => {
        memberQuota[member.id] = baseDutiesPerPerson + (idx < extraDuties ? 1 : 0);
        memberCounts[member.id] = 0;
      });

      // Sort females by age (estimate from profile, older first)
      // Since we don't have birth date, we'll use member order or ID as fallback
      const sortedFemalesByAge = [...femaleMembers].sort((a, b) => {
        // If we had birth date, we'd sort by age here
        // For now, sort by ID as stable ordering (first created = older)
        return a.id.localeCompare(b.id);
      });

      const newSchedules: { school_id: string; user_id: string; duty_date: string }[] = [];
      
      // Calculate ideal gap between duties for each member
      const getIdealGap = (memberId: string) => {
        const quota = memberQuota[memberId];
        return quota > 0 ? Math.floor(totalDays / quota) : totalDays;
      };
      
      // Track which members to use in rotation
      let maleIndex = 0;
      let femaleIndex = 0;
      let otherIndex = 0;

      for (const day of daysInMonth) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = getDay(day);
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        const dayAssignments: string[] = [];
        
        // Helper to check if member can be assigned
        const canAssignMember = (member: DutyMember, relaxGap: boolean = false) => {
          if (dayAssignments.includes(member.id)) return false;
          if (memberCounts[member.id] >= memberQuota[member.id]) return false;
          
          const lastDate = memberLastDate[member.id];
          if (!lastDate) return true;
          
          const daysSinceLastDuty = Math.floor(
            (day.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          
          const idealGap = getIdealGap(member.id);
          const minGap = relaxGap ? 1 : Math.max(1, idealGap - 2);
          
          return daysSinceLastDuty >= minGap;
        };
        
        // Helper to assign a member
        const assignMember = (member: DutyMember) => {
          newSchedules.push({
            school_id: currentSchool.id,
            user_id: member.id,
            duty_date: dateStr,
          });
          memberCounts[member.id]++;
          memberLastDate[member.id] = dateStr;
          dayAssignments.push(member.id);
          if (isWeekend) {
            weekendCounts[member.id] = (weekendCounts[member.id] || 0) + 1;
          }
        };

        // Rule: Each group of 3 should have at least 1 male
        // If no male available, replace with oldest female
        let maleAssigned = false;
        
        if (maleMembers.length > 0) {
          // Try to assign a male with ideal gap
          for (let attempts = 0; attempts < maleMembers.length; attempts++) {
            const member = maleMembers[maleIndex % maleMembers.length];
            if (canAssignMember(member)) {
              assignMember(member);
              maleIndex = (maleIndex + 1) % maleMembers.length;
              maleAssigned = true;
              break;
            }
            maleIndex = (maleIndex + 1) % maleMembers.length;
          }
          
          // Fallback: try with relaxed gap
          if (!maleAssigned) {
            for (let attempts = 0; attempts < maleMembers.length; attempts++) {
              const member = maleMembers[maleIndex % maleMembers.length];
              if (canAssignMember(member, true)) {
                assignMember(member);
                maleIndex = (maleIndex + 1) % maleMembers.length;
                maleAssigned = true;
                break;
              }
              maleIndex = (maleIndex + 1) % maleMembers.length;
            }
          }
        }
        
        // If no male was assigned, use oldest available female
        if (!maleAssigned && sortedFemalesByAge.length > 0) {
          for (const female of sortedFemalesByAge) {
            if (canAssignMember(female, true)) {
              assignMember(female);
              break;
            }
          }
        }

        // Fill remaining slots (up to MAX_PER_DAY)
        // Prioritize members with fewer duties and better gaps
        const remainingMembers = [...dutyMembers]
          .filter(m => !dayAssignments.includes(m.id))
          .sort((a, b) => {
            // Prioritize by: quota remaining, then weekend balance, then last duty gap
            const aRemaining = memberQuota[a.id] - memberCounts[a.id];
            const bRemaining = memberQuota[b.id] - memberCounts[b.id];
            if (aRemaining !== bRemaining) return bRemaining - aRemaining;
            
            if (isWeekend) {
              const aWeekend = (weekendCounts[a.id] || 0) + (prevWeekendCounts[a.id] || 0);
              const bWeekend = (weekendCounts[b.id] || 0) + (prevWeekendCounts[b.id] || 0);
              if (aWeekend !== bWeekend) return aWeekend - bWeekend;
            }
            
            const aLastDate = memberLastDate[a.id] || '1900-01-01';
            const bLastDate = memberLastDate[b.id] || '1900-01-01';
            return aLastDate.localeCompare(bLastDate);
          });

        for (const member of remainingMembers) {
          if (dayAssignments.length >= MAX_PER_DAY) break;
          
          if (canAssignMember(member)) {
            assignMember(member);
          }
        }
        
        // Fallback with relaxed gaps if still not filled
        if (dayAssignments.length < MAX_PER_DAY) {
          for (const member of remainingMembers) {
            if (dayAssignments.length >= MAX_PER_DAY) break;
            
            if (canAssignMember(member, true)) {
              assignMember(member);
            }
          }
        }
      }

      if (newSchedules.length > 0) {
        const { error } = await supabase
          .from('duty_schedules')
          .insert(newSchedules);

        if (error) throw error;
      }

      // Summary statistics
      const weekendTotal = Object.values(weekendCounts).reduce((a, b) => a + b, 0);
      const avgDuties = totalMembers > 0 ? (newSchedules.length / totalMembers).toFixed(1) : 0;
      
      toast({
        title: 'Thành công',
        description: `Đã phân công ${newSchedules.length} lượt (TB ${avgDuties}/người, ${weekendTotal} lượt cuối tuần)`,
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

  // Get day of week name
  const getDayName = (date: Date) => {
    const dayIndex = getDay(date);
    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    return days[dayIndex];
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

      {/* Current Duty Display - Enhanced */}
      <Card className="mb-4 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Đang trực hiện tại
            </div>
            <Badge variant="outline" className="flex items-center gap-1 font-normal">
              <Clock className="h-3 w-3" />
              Còn {timeRemaining.hours}h {timeRemaining.minutes}p
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Current shift info */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Ca trực: {format(getCurrentDutyDate(), 'dd/MM/yyyy', { locale: vi })} (6h sáng - 6h sáng hôm sau)
            </p>
            {currentDutyPersons.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có người trực được phân công</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {currentDutyPersons.map(duty => (
                  <Badge key={duty.id} variant="default" className="px-3 py-1.5 text-sm">
                    {duty.profile?.full_name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Next shift info */}
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <ArrowRight className="h-3 w-3" />
              <span>Ca tiếp theo: {format(getNextDutyDate(), 'dd/MM/yyyy', { locale: vi })}</span>
            </div>
            {nextDutyPersons.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa phân công</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {nextDutyPersons.map(duty => (
                  <Badge key={duty.id} variant="secondary" className="px-2 py-1 text-xs">
                    {duty.profile?.full_name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="assignment" className="gap-2">
            <Users className="h-4 w-4" />
            Phân công
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            Lịch trực
          </TabsTrigger>
          <TabsTrigger value="statistics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Thống kê
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
                    onClick={fetchAvailableMembers}
                    disabled={isSaving}
                  >
                    <UserPlus className="h-4 w-4" />
                    Thêm người trực
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

          {/* Assignment Grid - Improved with horizontal scroll and better header */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : dutyMembers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">Chưa có danh sách người trực</p>
                <Button onClick={fetchAvailableMembers} className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Thêm người trực
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="relative">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-10 text-center sticky left-0 bg-muted z-20 border-r px-1 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">STT</TableHead>
                        <TableHead className="min-w-[180px] sticky left-10 bg-muted z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Họ tên</TableHead>
                        <TableHead className="w-14 text-center sticky left-[220px] bg-muted z-20 border-r px-1 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Lần</TableHead>
                        <TableHead className="w-10 text-center sticky left-[276px] bg-muted z-20 border-r px-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"></TableHead>
                        {daysInMonth.map((day, i) => {
                          const dayName = getDayName(day);
                          const dayCount = dutiesPerDay[format(day, 'yyyy-MM-dd')] || 0;
                          const isFull = dayCount >= MAX_PER_DAY;
                          const today = isToday(day);
                          const isWeekend = dayName === "CN" || dayName === "T7";
                          
                          return (
                            <TableHead 
                              key={i} 
                              className={cn(
                                "w-11 text-center p-0",
                                today && "bg-primary/10",
                                isWeekend && !today && "bg-orange-50 dark:bg-orange-950/20"
                              )}
                            >
                              <div className="flex flex-col items-center py-1.5">
                                <span className={cn(
                                  "text-[10px] font-semibold",
                                  isWeekend ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground",
                                  today && "text-primary"
                                )}>
                                  {dayName}
                                </span>
                                <span className={cn(
                                  "text-base font-bold leading-tight",
                                  isWeekend && "text-orange-600 dark:text-orange-400",
                                  today && "text-primary"
                                )}>
                                  {format(day, 'd')}
                                </span>
                                <Badge 
                                  variant={isFull ? "destructive" : "secondary"} 
                                  className="text-[9px] px-1 py-0 h-4 min-w-[22px] mt-0.5"
                                >
                                  {dayCount}/{MAX_PER_DAY}
                                </Badge>
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
                          <TableRow key={member.id} className={cn(isFull && "bg-yellow-50/50 dark:bg-yellow-950/10")}>
                            <TableCell className="text-center font-medium sticky left-0 bg-background z-10 border-r px-1 text-xs shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="sticky left-10 bg-background z-10 border-r py-1 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              <div className="flex items-center gap-1.5">
                                <Avatar className="h-5 w-5 shrink-0">
                                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                    {getInitials(member.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-sm whitespace-nowrap">
                                  {member.full_name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center sticky left-[220px] bg-background z-10 border-r px-1 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              <Badge variant={isFull ? "destructive" : "outline"} className="text-[10px] px-1.5 py-0">
                                {memberDutyCount}/{MAX_PER_PERSON}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center sticky left-[276px] bg-background z-10 border-r px-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              {isSchoolAdmin() && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-5 w-5"
                                      disabled={isSaving}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Xóa người trực</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Xóa {member.full_name} khỏi danh sách trực? Các lượt phân công của người này trong tháng cũng sẽ bị xóa.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => removeDutyMember(member.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Xóa
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </TableCell>
                            {daysInMonth.map((day, i) => {
                              const assigned = isAssigned(member.id, day);
                              const canCheck = canAssign(member.id, day);
                              const today = isToday(day);
                              const dayName = getDayName(day);
                              const isWeekend = dayName === "CN" || dayName === "T7";

                              return (
                                <TableCell 
                                  key={i} 
                                  className={cn(
                                    "text-center p-1",
                                    today && "bg-primary/5",
                                    isWeekend && !today && "bg-orange-50/50 dark:bg-orange-950/10"
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
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          {dutyMembers.length > 0 && (
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-orange-100 dark:bg-orange-950/30"></div>
                <span>Cuối tuần</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-primary/10"></div>
                <span>Hôm nay</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">3/3</Badge>
                <span>Đã đủ {MAX_PER_DAY} người/ngày</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">5/5</Badge>
                <span>Đã đủ {MAX_PER_PERSON} lần/người</span>
              </div>
            </div>
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
                const dayName = getDayName(day);
                const isWeekend = dayName === "CN" || dayName === "T7";

                return (
                  <Card 
                    key={day.toISOString()} 
                    className={cn(
                      "overflow-hidden",
                      today && "border-primary ring-1 ring-primary",
                      isWeekend && !today && "border-orange-200 dark:border-orange-900"
                    )}
                  >
                    <div className={cn(
                      "px-3 py-2 border-b text-center",
                      today ? "bg-primary/10" : 
                      isWeekend ? "bg-orange-50 dark:bg-orange-950/20" : "bg-muted/50"
                    )}>
                      <div className={cn(
                        "text-xs",
                        isWeekend ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
                      )}>
                        {format(day, 'EEEE', { locale: vi })}
                      </div>
                      <div className={cn(
                        "text-lg font-semibold",
                        today && "text-primary",
                        isWeekend && !today && "text-orange-600 dark:text-orange-400"
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
                        <div className="space-y-1">
                          {daySchedules.map(duty => (
                            <div
                              key={duty.id}
                              className="flex items-center gap-1.5 bg-primary/10 rounded px-2 py-1"
                            >
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                                  {getInitials(duty.profile?.full_name || '')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs truncate">
                                {duty.profile?.full_name?.split(' ').pop()}
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

        {/* Statistics Tab */}
        <TabsContent value="statistics">
          <DutyStatisticsTab
            schedules={schedules}
            previousMonthSchedules={previousMonthSchedules}
            dutyMembers={dutyMembers}
            currentMonth={currentMonth}
          />
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm người trực</DialogTitle>
            <DialogDescription>
              Chọn thành viên từ danh sách tài khoản để thêm vào danh sách trực
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {availableMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Không có thành viên mới để thêm
              </p>
            ) : (
              availableMembers.map(member => (
                <div
                  key={member.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors",
                    selectedNewMembers.includes(member.id) 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:bg-muted/50"
                  )}
                  onClick={() => {
                    setSelectedNewMembers(prev => 
                      prev.includes(member.id)
                        ? prev.filter(id => id !== member.id)
                        : [...prev, member.id]
                    );
                  }}
                >
                  <Checkbox
                    checked={selectedNewMembers.includes(member.id)}
                    onCheckedChange={() => {
                      setSelectedNewMembers(prev => 
                        prev.includes(member.id)
                          ? prev.filter(id => id !== member.id)
                          : [...prev, member.id]
                      );
                    }}
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(member.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{member.full_name}</span>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>
              Hủy
            </Button>
            <Button 
              onClick={addSelectedMembers} 
              disabled={selectedNewMembers.length === 0 || isSaving}
            >
              <Save className="h-4 w-4 mr-1" />
              Thêm ({selectedNewMembers.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
