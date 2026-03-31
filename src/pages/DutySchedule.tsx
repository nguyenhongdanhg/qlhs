import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';
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
  ArrowLeftRight,
  Search,
  Settings,
  Shield,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import DutyGroupsShiftsSettings from '@/components/duty/DutyGroupsShiftsSettings';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface DutyGroup {
  id: string;
  school_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  members?: DutyGroupMember[];
}

interface DutyGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  school_id: string;
  profile?: Profile;
}

const SHIFT_START_HOUR = 6;

// Group color palette for visual distinction
const GROUP_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-950/40', border: 'border-blue-400', text: 'text-blue-700 dark:text-blue-300', hex: '#3B82F6', light: 'bg-blue-50 dark:bg-blue-950/20' },
  { bg: 'bg-emerald-100 dark:bg-emerald-950/40', border: 'border-emerald-400', text: 'text-emerald-700 dark:text-emerald-300', hex: '#10B981', light: 'bg-emerald-50 dark:bg-emerald-950/20' },
  { bg: 'bg-amber-100 dark:bg-amber-950/40', border: 'border-amber-400', text: 'text-amber-700 dark:text-amber-300', hex: '#F59E0B', light: 'bg-amber-50 dark:bg-amber-950/20' },
  { bg: 'bg-purple-100 dark:bg-purple-950/40', border: 'border-purple-400', text: 'text-purple-700 dark:text-purple-300', hex: '#8B5CF6', light: 'bg-purple-50 dark:bg-purple-950/20' },
  { bg: 'bg-rose-100 dark:bg-rose-950/40', border: 'border-rose-400', text: 'text-rose-700 dark:text-rose-300', hex: '#F43F5E', light: 'bg-rose-50 dark:bg-rose-950/20' },
  { bg: 'bg-cyan-100 dark:bg-cyan-950/40', border: 'border-cyan-400', text: 'text-cyan-700 dark:text-cyan-300', hex: '#06B6D4', light: 'bg-cyan-50 dark:bg-cyan-950/20' },
  { bg: 'bg-orange-100 dark:bg-orange-950/40', border: 'border-orange-400', text: 'text-orange-700 dark:text-orange-300', hex: '#F97316', light: 'bg-orange-50 dark:bg-orange-950/20' },
  { bg: 'bg-indigo-100 dark:bg-indigo-950/40', border: 'border-indigo-400', text: 'text-indigo-700 dark:text-indigo-300', hex: '#6366F1', light: 'bg-indigo-50 dark:bg-indigo-950/20' },
];

interface DutyMember extends Profile {
  dutyCount: number;
  isFixed: boolean;
  fixedDays: number[];
  gender?: 'male' | 'female' | 'other';
}

interface DutyLeader {
  id: string;
  school_id: string;
  user_id: string;
  duty_date: string;
  notes?: string;
  created_at: string;
  profile?: Profile;
}

export default function DutySchedule() {
  const { currentSchool, isSchoolAdmin, isSuperAdmin } = useAuth();
  const { hasPermission } = useSchool();
  const { toast } = useToast();
  
  // Check if user has permission to manage duty (admin or has duty_schedule permission)
  const canManageDuty = isSuperAdmin || isSchoolAdmin() || hasPermission('duty_schedule', 'edit');

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [schedules, setSchedules] = useState<DutyScheduleType[]>([]);
  const [previousMonthSchedules, setPreviousMonthSchedules] = useState<DutyScheduleType[]>([]);
  const [dutyMembers, setDutyMembers] = useState<DutyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // Default tab based on permission - teachers see calendar first, admins see assignment
  const [activeTab, setActiveTab] = useState(canManageDuty ? 'assignment' : 'calendar');
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeRemaining, setTimeRemaining] = useState({ hours: 0, minutes: 0 });
  const [availableMembers, setAvailableMembers] = useState<DutyMember[]>([]);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  
  // Settings state
  const [maxPerDay, setMaxPerDay] = useState(3);
  const [maxPerPerson, setMaxPerPerson] = useState(5);
  const [settingsMaxPerDay, setSettingsMaxPerDay] = useState(3);
  const [settingsMaxPerPerson, setSettingsMaxPerPerson] = useState(5);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
   // Leadership duty state
  const [dutyLeaders, setDutyLeaders] = useState<DutyLeader[]>([]);
  const [leaderMembers, setLeaderMembers] = useState<Profile[]>([]);
  
  // Quick assign leader state
  const [quickAssignUserId, setQuickAssignUserId] = useState<string>('');
  const [quickAssignDays, setQuickAssignDays] = useState<number[]>([]); // 0=CN, 1=T2, ..., 6=T7
  const [isQuickAssigning, setIsQuickAssigning] = useState(false);
  
  // Filter by person name in calendar tab
  const [calendarFilterName, setCalendarFilterName] = useState('');
  
  // Assignment mode state
  const [assignMode, setAssignMode] = useState<'individual' | 'group'>('individual');
  const [showAutoAssignDialog, setShowAutoAssignDialog] = useState(false);
  const [dutyGroups, setDutyGroups] = useState<DutyGroup[]>([]);
  
  // Swap duty state
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [swapSource, setSwapSource] = useState<{ userId: string; date: string } | null>(null);
  const [swapTarget, setSwapTarget] = useState<{ userId: string; date: string } | null>(null);

  // Shorthand for limits
  const MAX_PER_DAY = maxPerDay;
  const MAX_PER_PERSON = maxPerPerson;

  // Get days in current month
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);


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

  // Map member -> group info for color coding
  const memberGroupMap = useMemo(() => {
    const map: Record<string, { groupId: string; groupIndex: number; groupName: string }> = {};
    dutyGroups.forEach((group, idx) => {
      (group.members || []).forEach(m => {
        map[m.user_id] = { groupId: group.id, groupIndex: idx, groupName: group.name };
      });
    });
    return map;
  }, [dutyGroups]);

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

  // Fetch duty settings
  const fetchDutySettings = async () => {
    if (!currentSchool) return;
    try {
      const { data } = await supabase
        .from('duty_settings')
        .select('*')
        .eq('school_id', currentSchool.id)
        .maybeSingle();
      
      if (data) {
        setMaxPerDay(data.max_per_day);
        setMaxPerPerson(data.max_per_person);
        setSettingsMaxPerDay(data.max_per_day);
        setSettingsMaxPerPerson(data.max_per_person);
      }
    } catch (error) {
      console.error('Error fetching duty settings:', error);
    }
  };

  // Save duty settings
  const saveDutySettings = async () => {
    if (!currentSchool) return;
    setIsSavingSettings(true);
    try {
      const { data: existing } = await supabase
        .from('duty_settings')
        .select('id')
        .eq('school_id', currentSchool.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('duty_settings')
          .update({ max_per_day: settingsMaxPerDay, max_per_person: settingsMaxPerPerson })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('duty_settings')
          .insert({ school_id: currentSchool.id, max_per_day: settingsMaxPerDay, max_per_person: settingsMaxPerPerson });
      }

      setMaxPerDay(settingsMaxPerDay);
      setMaxPerPerson(settingsMaxPerPerson);
      toast({ title: 'Thành công', description: 'Đã lưu cài đặt lịch trực' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Fetch duty leaders
  const fetchDutyLeaders = async () => {
    if (!currentSchool) return;
    try {
      const monthStart = format(addDays(startOfMonth(currentMonth), -7), 'yyyy-MM-dd');
      const monthEnd = format(addDays(endOfMonth(currentMonth), 7), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('duty_leaders')
        .select('*, profile:profiles(*)')
        .eq('school_id', currentSchool.id)
        .gte('duty_date', monthStart)
        .lte('duty_date', monthEnd)
        .order('duty_date');
      
      if (error) throw error;
      setDutyLeaders((data || []).map(d => ({
        ...d,
        profile: d.profile as unknown as Profile
      })) as DutyLeader[]);
    } catch (error) {
      console.error('Error fetching duty leaders:', error);
    }
  };

  // Fetch leader members (all school members for selection)
  const fetchLeaderMembers = async () => {
    if (!currentSchool) return;
    try {
      const { data } = await supabase
        .from('school_memberships')
        .select('user_id, profile:profiles(*)')
        .eq('school_id', currentSchool.id)
        .eq('status', 'active');
      
      setLeaderMembers((data || []).map(d => d.profile as unknown as Profile).filter(Boolean));
    } catch (error) {
      console.error('Error fetching leader members:', error);
    }
  };

  // Assign/remove leader for a date
  const toggleLeader = async (userId: string, date: Date) => {
    if (!currentSchool) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = dutyLeaders.find(l => l.duty_date === dateStr);

    setIsSaving(true);
    try {
      if (existing) {
        if (existing.user_id === userId) {
          // Remove
          await supabase.from('duty_leaders').delete().eq('id', existing.id);
          setDutyLeaders(prev => prev.filter(l => l.id !== existing.id));
        } else {
          // Update to new person
          const { data } = await supabase
            .from('duty_leaders')
            .update({ user_id: userId })
            .eq('id', existing.id)
            .select('*, profile:profiles(*)')
            .single();
          if (data) {
            setDutyLeaders(prev => prev.map(l => l.id === existing.id ? { ...data, profile: data.profile as unknown as Profile } as DutyLeader : l));
          }
        }
      } else {
        // Insert
        const { data } = await supabase
          .from('duty_leaders')
          .insert({ school_id: currentSchool.id, user_id: userId, duty_date: dateStr })
          .select('*, profile:profiles(*)')
          .single();
        if (data) {
          setDutyLeaders(prev => [...prev, { ...data, profile: data.profile as unknown as Profile } as DutyLeader]);
        }
      }
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch duty groups with members
  const fetchDutyGroups = async () => {
    if (!currentSchool) return;
    try {
      const { data: groups } = await supabase
        .from('duty_groups')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .order('display_order');

      if (!groups || groups.length === 0) {
        setDutyGroups([]);
        return;
      }

      const { data: members } = await supabase
        .from('duty_group_members')
        .select('*, profile:profiles(*)')
        .eq('school_id', currentSchool.id);

      const groupsWithMembers = groups.map(g => ({
        ...g,
        members: (members || [])
          .filter(m => m.group_id === g.id)
          .map(m => ({ ...m, profile: m.profile as unknown as Profile }))
      }));

      setDutyGroups(groupsWithMembers);
    } catch (error) {
      console.error('Error fetching duty groups:', error);
    }
  };

  useEffect(() => {
    if (!currentSchool) return;
    fetchSchedules();
    fetchSavedDutyMembers();
    fetchDutySettings();
    fetchDutyLeaders();
    fetchLeaderMembers();
    fetchDutyGroups();
  }, [currentSchool, currentMonth]);

  const fetchSchedules = async () => {
    if (!currentSchool) return;
    setIsLoading(true);

    try {
      // Extend range by 7 days before/after month to cover cross-month weeks and current/next duty
      const monthStart = format(addDays(startOfMonth(currentMonth), -7), 'yyyy-MM-dd');
      const monthEnd = format(addDays(endOfMonth(currentMonth), 7), 'yyyy-MM-dd');
      
      // Also fetch previous month for comparison (statistics)
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

  // Delete all schedules for current month
  const deleteAllMonthSchedules = async () => {
    if (!currentSchool) return;
    
    setIsSaving(true);
    try {
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('duty_schedules')
        .delete()
        .eq('school_id', currentSchool.id)
        .gte('duty_date', monthStart)
        .lte('duty_date', monthEnd);
      
      if (error) throw error;
      
      setSchedules(prev => prev.filter(s => 
        s.duty_date < monthStart || s.duty_date > monthEnd
      ));
      
      toast({ 
        title: 'Thành công', 
        description: `Đã xóa toàn bộ lịch trực tháng ${format(currentMonth, 'MM/yyyy')}` 
      });
    } catch (error: any) {
      console.error('Error deleting month schedules:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa lịch trực',
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
      const prevSatCounts: Record<string, number> = {};
      const prevSunCounts: Record<string, number> = {};
      
      (prevSchedules || []).forEach(s => {
        if (!lastDutyDate[s.user_id]) {
          lastDutyDate[s.user_id] = s.duty_date;
        }
        const dayOfWeek = getDay(new Date(s.duty_date));
        if (dayOfWeek === 6) {
          prevSatCounts[s.user_id] = (prevSatCounts[s.user_id] || 0) + 1;
          prevWeekendCounts[s.user_id] = (prevWeekendCounts[s.user_id] || 0) + 1;
        } else if (dayOfWeek === 0) {
          prevSunCounts[s.user_id] = (prevSunCounts[s.user_id] || 0) + 1;
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
      
      // Count weekends in this month
      const saturdaysInMonth = daysInMonth.filter(d => getDay(d) === 6).length;
      const sundaysInMonth = daysInMonth.filter(d => getDay(d) === 0).length;
      const weekendDays = saturdaysInMonth + sundaysInMonth;
      const weekendSlots = weekendDays * MAX_PER_DAY;
      
      // Calculate duties per person for even distribution
      const baseDutiesPerPerson = Math.floor(totalSlots / totalMembers);
      const extraDuties = totalSlots % totalMembers;
      
      // Calculate weekend duties per person for even rotation
      const baseWeekendPerPerson = Math.floor(weekendSlots / totalMembers);
      const extraWeekend = weekendSlots % totalMembers;
      
      // Initialize member tracking
      const memberQuota: Record<string, number> = {};
      const memberWeekendQuota: Record<string, number> = {};
      const memberCounts: Record<string, number> = {};
      const memberWeekendCounts: Record<string, number> = {};
      const memberSatCounts: Record<string, number> = {};
      const memberSunCounts: Record<string, number> = {};
      const memberLastDate: Record<string, string> = { ...lastDutyDate };
      
      // Sort members by previous weekend counts (fewer first for rotation fairness)
      const sortedByPrevWeekend = [...dutyMembers].sort((a, b) => {
        const aWeekend = prevWeekendCounts[a.id] || 0;
        const bWeekend = prevWeekendCounts[b.id] || 0;
        return aWeekend - bWeekend;
      });
      
      sortedByPrevWeekend.forEach((member, idx) => {
        memberQuota[member.id] = baseDutiesPerPerson + (idx < extraDuties ? 1 : 0);
        memberWeekendQuota[member.id] = baseWeekendPerPerson + (idx < extraWeekend ? 1 : 0);
        memberCounts[member.id] = 0;
        memberWeekendCounts[member.id] = 0;
        memberSatCounts[member.id] = 0;
        memberSunCounts[member.id] = 0;
      });

      // Sort females by age (older first based on birth_date)
      const sortedFemalesByAge = [...femaleMembers].sort((a, b) => {
        const aBirth = a.birth_date || '9999-12-31';
        const bBirth = b.birth_date || '9999-12-31';
        return aBirth.localeCompare(bBirth);
      });

      const newSchedules: { school_id: string; user_id: string; duty_date: string }[] = [];
      
      // Calculate ideal gap between duties for each member
      const getIdealGap = (memberId: string) => {
        const quota = memberQuota[memberId];
        return quota > 0 ? Math.floor(totalDays / quota) : totalDays;
      };
      
      // Helper to get days since last duty
      const getDaysSinceLastDuty = (member: DutyMember, day: Date) => {
        const lastDate = memberLastDate[member.id];
        if (!lastDate) return 999;
        return Math.floor((day.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
      };
      
      // Track rotation indices
      let maleIndex = 0;

      for (const day of daysInMonth) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = getDay(day);
        const isSaturday = dayOfWeek === 6;
        const isSunday = dayOfWeek === 0;
        const isWeekend = isSaturday || isSunday;
        
        const dayAssignments: string[] = [];
        
        // Helper to check if member can be assigned
        const canAssignMember = (member: DutyMember, relaxGap: boolean = false, checkWeekendQuota: boolean = true, checkSundayLimit: boolean = true) => {
          if (dayAssignments.includes(member.id)) return false;
          if (memberCounts[member.id] >= memberQuota[member.id]) return false;
          
          // Check weekend quota for weekend days
          if (isWeekend && checkWeekendQuota && memberWeekendCounts[member.id] >= memberWeekendQuota[member.id]) {
            return false;
          }
          
          // Sunday limit: max 1 Sunday per person per month
          if (isSunday && checkSundayLimit && memberSunCounts[member.id] >= 1) {
            return false;
          }
          
          const daysSince = getDaysSinceLastDuty(member, day);
          const idealGap = getIdealGap(member.id);
          const minGap = relaxGap ? 1 : Math.max(1, idealGap - 2);
          
          return daysSince >= minGap;
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
            memberWeekendCounts[member.id]++;
          }
          if (isSaturday) {
            memberSatCounts[member.id]++;
          }
          if (isSunday) {
            memberSunCounts[member.id]++;
          }
        };
        
        // For weekends, sort candidates by weekend rotation fairness
        const getWeekendPriority = (member: DutyMember) => {
          const prevCount = prevWeekendCounts[member.id] || 0;
          const currCount = memberWeekendCounts[member.id] || 0;
          // For Saturday, prefer those with fewer Saturdays
          if (isSaturday) {
            return (prevSatCounts[member.id] || 0) + (memberSatCounts[member.id] || 0);
          }
          // For Sunday, prefer those with fewer Sundays
          if (isSunday) {
            return (prevSunCounts[member.id] || 0) + (memberSunCounts[member.id] || 0);
          }
          return prevCount + currCount;
        };

        // Rule: Each group of 3 should have at least 1 male
        let maleAssigned = false;
        
        if (maleMembers.length > 0) {
          // Sort males by gap (longest gap first) and weekend fairness
          const sortedMales = [...maleMembers].sort((a, b) => {
            const aGap = getDaysSinceLastDuty(a, day);
            const bGap = getDaysSinceLastDuty(b, day);
            if (Math.abs(aGap - bGap) > 2) return bGap - aGap;
            
            if (isWeekend) {
              return getWeekendPriority(a) - getWeekendPriority(b);
            }
            return bGap - aGap;
          });
          
          // Try to assign a male with ideal gap
          for (const member of sortedMales) {
            if (canAssignMember(member)) {
              assignMember(member);
              maleAssigned = true;
              break;
            }
          }
          
          // Fallback: try with relaxed gap
          if (!maleAssigned) {
            for (const member of sortedMales) {
              if (canAssignMember(member, true)) {
                assignMember(member);
                maleAssigned = true;
                break;
              }
            }
          }
          
          // Last resort: ignore weekend quota but still respect Sunday limit
          if (!maleAssigned) {
            for (const member of sortedMales) {
              if (canAssignMember(member, true, false, true)) {
                assignMember(member);
                maleAssigned = true;
                break;
              }
            }
          }
          
          // Absolute last resort: ignore Sunday limit too
          if (!maleAssigned) {
            for (const member of sortedMales) {
              if (canAssignMember(member, true, false, false)) {
                assignMember(member);
                maleAssigned = true;
                break;
              }
            }
          }
        }
        
        // If no male was assigned, use oldest available female
        if (!maleAssigned && sortedFemalesByAge.length > 0) {
          for (const female of sortedFemalesByAge) {
            if (canAssignMember(female, true, false, true)) {
              assignMember(female);
              break;
            }
          }
          // If still not assigned due to Sunday limit, relax it
          if (dayAssignments.length === 0) {
            for (const female of sortedFemalesByAge) {
              if (canAssignMember(female, true, false, false)) {
                assignMember(female);
                break;
              }
            }
          }
        }

        // Fill remaining slots (up to MAX_PER_DAY)
        // Sort by: gap priority, then weekend fairness, then remaining quota
        const getCandidatePriority = (member: DutyMember) => {
          const daysSince = getDaysSinceLastDuty(member, day);
          const idealGap = getIdealGap(member.id);
          const gapScore = Math.min(daysSince / idealGap, 2); // Normalized gap score
          const remainingQuota = memberQuota[member.id] - memberCounts[member.id];
          const weekendScore = isWeekend ? getWeekendPriority(member) : 0;
          
          // Higher score = higher priority
          return gapScore * 10 + remainingQuota - weekendScore * 0.5;
        };
        
        const remainingMembers = [...dutyMembers]
          .filter(m => !dayAssignments.includes(m.id))
          .sort((a, b) => getCandidatePriority(b) - getCandidatePriority(a));

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
        
        // Last resort: ignore weekend quota but respect Sunday limit
        if (dayAssignments.length < MAX_PER_DAY) {
          for (const member of remainingMembers) {
            if (dayAssignments.length >= MAX_PER_DAY) break;
            
            if (canAssignMember(member, true, false, true)) {
              assignMember(member);
            }
          }
        }
        
        // Absolute last resort: ignore Sunday limit too
        if (dayAssignments.length < MAX_PER_DAY) {
          for (const member of remainingMembers) {
            if (dayAssignments.length >= MAX_PER_DAY) break;
            
            if (canAssignMember(member, true, false, false)) {
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
      const weekendTotal = Object.values(memberWeekendCounts).reduce((a, b) => a + b, 0);
      const avgDuties = totalMembers > 0 ? (newSchedules.length / totalMembers).toFixed(1) : 0;
      const avgWeekend = totalMembers > 0 ? (weekendTotal / totalMembers).toFixed(1) : 0;
      
      toast({
        title: 'Thành công',
        description: `Đã phân công ${newSchedules.length} lượt (TB ${avgDuties}/người, ${avgWeekend} cuối tuần/người)`,
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

  // Auto-assign by group rotation
  const autoAssignByGroup = async () => {
    if (!currentSchool || dutyGroups.length === 0) {
      toast({
        title: 'Thông báo',
        description: 'Chưa có nhóm trực nào. Vui lòng tạo nhóm trực trong phần Cài đặt.',
      });
      return;
    }

    const activeGroups = dutyGroups.filter(g => g.members && g.members.length > 0);
    if (activeGroups.length === 0) {
      toast({
        title: 'Thông báo', 
        description: 'Các nhóm trực chưa có thành viên. Vui lòng thêm thành viên vào nhóm.',
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

      const newSchedules: { school_id: string; user_id: string; duty_date: string; group_id: string }[] = [];

      // Track member rotation index per group
      const groupMemberIndex: Record<string, number> = {};
      activeGroups.forEach(g => { groupMemberIndex[g.id] = 0; });

      // Each day: pick 1 person from EACH group (rotating members within the group)
      for (let i = 0; i < daysInMonth.length; i++) {
        const day = daysInMonth[i];
        const dateStr = format(day, 'yyyy-MM-dd');

        for (const group of activeGroups) {
          const members = group.members || [];
          if (members.length === 0) continue;
          
          // Pick the next member in rotation for this group
          const memberIdx = groupMemberIndex[group.id] % members.length;
          const member = members[memberIdx];
          
          newSchedules.push({
            school_id: currentSchool.id,
            user_id: member.user_id,
            duty_date: dateStr,
            group_id: group.id,
          });
          
          groupMemberIndex[group.id] = memberIdx + 1;
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
        description: `Đã phân công ${newSchedules.length} lượt (mỗi ngày 1 người/nhóm, ${activeGroups.length} nhóm luân phiên)`,
      });

      fetchSchedules();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể tự động phân công theo nhóm',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setShowAutoAssignDialog(false);
    }
  };

  // Handle auto assign based on mode
  const handleAutoAssign = () => {
    if (assignMode === 'group') {
      autoAssignByGroup();
    } else {
      autoAssign();
      setShowAutoAssignDialog(false);
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

  // Swap duty between two people
  const handleSwapDuty = async () => {
    if (!currentSchool || !swapSource || !swapTarget) return;
    if (swapSource.userId === swapTarget.userId && swapSource.date === swapTarget.date) return;
    
    setIsSaving(true);
    try {
      const sourceSchedule = schedules.find(s => s.user_id === swapSource.userId && s.duty_date === swapSource.date);
      const targetSchedule = schedules.find(s => s.user_id === swapTarget.userId && s.duty_date === swapTarget.date);
      
      if (!sourceSchedule || !targetSchedule) {
        toast({ title: 'Lỗi', description: 'Không tìm thấy lịch trực để đổi', variant: 'destructive' });
        return;
      }
      
      // Update source to target's date and vice versa
      const [res1, res2] = await Promise.all([
        supabase.from('duty_schedules').update({ user_id: swapTarget.userId }).eq('id', sourceSchedule.id),
        supabase.from('duty_schedules').update({ user_id: swapSource.userId }).eq('id', targetSchedule.id),
      ]);
      
      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;
      
      toast({ title: 'Thành công', description: 'Đã đổi lịch trực thành công' });
      setShowSwapDialog(false);
      setSwapSource(null);
      setSwapTarget(null);
      fetchSchedules();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Get unique people who have schedules for current month (for filter)
  const scheduledPeople = useMemo(() => {
    const peopleMap = new Map<string, string>();
    schedules.forEach(s => {
      if (s.profile?.full_name && !peopleMap.has(s.user_id)) {
        peopleMap.set(s.user_id, s.profile.full_name);
      }
    });
    return Array.from(peopleMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [schedules]);

  // Filtered schedules for calendar
  const getFilteredSchedulesForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    let daySchedules = schedules.filter(s => s.duty_date === dateStr);
    if (calendarFilterName && calendarFilterName !== 'all') {
      daySchedules = daySchedules.filter(s => s.user_id === calendarFilterName);
    }
    return daySchedules;
  };

  // Get the date range for current calendar view
  const calendarViewRange = useMemo(() => {
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
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    };
  }, [viewMode, selectedDate]);

  // Personal duty summary when a person is selected - filtered by current view range
  const personalDutySummary = useMemo(() => {
    if (!calendarFilterName || calendarFilterName === 'all') return null;
    
    const personSchedules = schedules
      .filter(s => s.user_id === calendarFilterName && s.duty_date >= calendarViewRange.start && s.duty_date <= calendarViewRange.end)
      .sort((a, b) => a.duty_date.localeCompare(b.duty_date));
    
    return personSchedules.map(ps => {
      const colleagues = schedules
        .filter(s => s.duty_date === ps.duty_date && s.user_id !== calendarFilterName);
      return {
        date: ps.duty_date,
        colleagues,
      };
    });
  }, [calendarFilterName, schedules, calendarViewRange]);

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
            {/* Current duty leader */}
            {(() => {
              const currentLeader = dutyLeaders.find(l => l.duty_date === format(getCurrentDutyDate(), 'yyyy-MM-dd'));
              return currentLeader ? (
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">Lãnh đạo trực:</span>
                  <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-300">
                    {currentLeader.profile?.full_name}
                  </Badge>
                </div>
              ) : null;
            })()}
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
            {/* Next duty leader */}
            {(() => {
              const nextLeader = dutyLeaders.find(l => l.duty_date === format(getNextDutyDate(), 'yyyy-MM-dd'));
              return nextLeader ? (
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium">LĐ trực:</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 dark:text-amber-300">
                    {nextLeader.profile?.full_name}
                  </Badge>
                </div>
              ) : null;
            })()}
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
        <TabsList className={cn(
          "grid w-full mb-4",
          canManageDuty ? "grid-cols-5" : "grid-cols-1"
        )}>
          {/* Lịch trực tab - always visible, first for teachers */}
          <TabsTrigger value="calendar" className="gap-1 text-xs sm:text-sm">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Lịch trực</span>
            <span className="sm:hidden">Lịch</span>
          </TabsTrigger>
          {/* Phân công & Thống kê - only for admins and authorized users */}
          {canManageDuty && (
            <>
              <TabsTrigger value="assignment" className="gap-1 text-xs sm:text-sm">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Phân công</span>
                <span className="sm:hidden">PC</span>
              </TabsTrigger>
              <TabsTrigger value="leaders" className="gap-1 text-xs sm:text-sm">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Lãnh đạo trực</span>
                <span className="sm:hidden">LĐ</span>
              </TabsTrigger>
              <TabsTrigger value="statistics" className="gap-1 text-xs sm:text-sm">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Thống kê</span>
                <span className="sm:hidden">TK</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1 text-xs sm:text-sm">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Cài đặt</span>
                <span className="sm:hidden">CĐ</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Assignment Tab - Only for admins and authorized users */}
        {canManageDuty && (
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

                  {canManageDuty && (
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

                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1" 
                        disabled={isSaving || (dutyMembers.length === 0 && dutyGroups.length === 0)}
                        onClick={() => setShowAutoAssignDialog(true)}
                      >
                        <Wand2 className="h-4 w-4" />
                        Tự động phân công
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive" disabled={isSaving || schedules.length === 0}>
                            <Trash2 className="h-4 w-4" />
                            Xóa cả tháng
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Xóa toàn bộ lịch trực tháng này?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Thao tác này sẽ xóa tất cả {schedules.length} lịch trực trong tháng {format(currentMonth, 'MM/yyyy')}. Hành động này không thể hoàn tác.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction onClick={deleteAllMonthSchedules} className="bg-destructive hover:bg-destructive/90">
                              Xóa tất cả
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1" 
                        disabled={isSaving || schedules.length === 0}
                        onClick={() => {
                          setSwapSource(null);
                          setSwapTarget(null);
                          setShowSwapDialog(true);
                        }}
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                        Đổi lịch trực
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mode Toggle */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Chế độ xem:</Label>
            <div className="flex gap-1">
              <Button
                variant={assignMode === 'individual' ? 'default' : 'outline'}
                size="sm"
                className="gap-1"
                onClick={() => setAssignMode('individual')}
              >
                <Users className="h-3.5 w-3.5" />
                Theo giáo viên
              </Button>
              <Button
                variant={assignMode === 'group' ? 'default' : 'outline'}
                size="sm"
                className="gap-1"
                onClick={() => setAssignMode('group')}
                disabled={dutyGroups.length === 0}
              >
                <Users className="h-3.5 w-3.5" />
                Theo nhóm
              </Button>
            </div>
          </div>

          {/* Assignment Grid */}
          {assignMode === 'individual' ? (
          <>
          {/* Individual Assignment Grid */}
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
                        const groupInfo = memberGroupMap[member.id];
                        const groupColor = groupInfo ? GROUP_COLORS[groupInfo.groupIndex % GROUP_COLORS.length] : null;

                        return (
                          <TableRow key={member.id} className={cn(
                            isFull && "bg-yellow-50/50 dark:bg-yellow-950/10",
                            groupColor && !isFull && groupColor.light
                          )}>
                            <TableCell className={cn(
                              "text-center font-medium sticky left-0 z-10 border-r px-1 text-xs shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
                              groupColor ? groupColor.light : "bg-background"
                            )}>
                              {idx + 1}
                            </TableCell>
                            <TableCell className={cn(
                              "sticky left-10 z-10 border-r py-1 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
                              groupColor ? groupColor.light : "bg-background"
                            )}>
                              <div className="flex items-center gap-1.5">
                                {groupColor && (
                                  <div className={cn("w-1.5 h-6 rounded-full shrink-0", groupColor.bg, groupColor.border, "border")} />
                                )}
                                <Avatar className="h-5 w-5 shrink-0">
                                  <AvatarFallback className={cn(
                                    "text-[10px]",
                                    groupColor ? cn(groupColor.bg, groupColor.text) : "bg-primary/10 text-primary"
                                  )}>
                                    {getInitials(member.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm whitespace-nowrap">
                                    {member.full_name}
                                  </span>
                                  {groupInfo && (
                                    <span className={cn("text-[9px] leading-tight", groupColor?.text || "text-muted-foreground")}>
                                      {groupInfo.groupName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className={cn(
                              "text-center sticky left-[220px] z-10 border-r px-1 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
                              groupColor ? groupColor.light : "bg-background"
                            )}>
                              <Badge variant={isFull ? "destructive" : "outline"} className="text-[10px] px-1.5 py-0">
                                {memberDutyCount}/{MAX_PER_PERSON}
                              </Badge>
                            </TableCell>
                            <TableCell className={cn(
                              "text-center sticky left-[276px] z-10 border-r px-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
                              groupColor ? groupColor.light : "bg-background"
                            )}>
                              {canManageDuty && (
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
                                    isWeekend && !today && "bg-orange-50/50 dark:bg-orange-950/10",
                                    assigned && groupColor && !today && !isWeekend && groupColor.light
                                  )}
                                >
                                  <div className="flex justify-center">
                                    <Checkbox
                                      checked={assigned}
                                      disabled={!canManageDuty || isSaving || (!assigned && !canCheck)}
                                      onCheckedChange={() => toggleAssignment(member.id, day)}
                                      className={cn(
                                        "h-5 w-5",
                                        assigned && groupColor 
                                          ? cn(groupColor.bg, groupColor.border, "border") 
                                          : assigned && "bg-primary border-primary"
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
              {dutyGroups.length > 0 && (
                <>
                  <span className="text-muted-foreground">|</span>
                  {dutyGroups.map((g, i) => {
                    const color = GROUP_COLORS[i % GROUP_COLORS.length];
                    return (
                      <div key={g.id} className="flex items-center gap-1">
                        <div className={cn("w-3 h-3 rounded border", color.bg, color.border)} />
                        <span>{g.name}</span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
          </>
          ) : (
          <>
          {/* Group Assignment Grid */}
          {dutyGroups.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">Chưa có nhóm trực nào</p>
                <p className="text-sm text-muted-foreground">Vui lòng tạo nhóm trực trong tab Cài đặt</p>
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
                        <TableHead className="min-w-[200px] sticky left-10 bg-muted z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Nhóm trực</TableHead>
                        {daysInMonth.map((day, i) => {
                          const dayName = getDayName(day);
                          const today = isToday(day);
                          const isWeekend = dayName === "CN" || dayName === "T7";
                          
                          // Check which group is assigned this day
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const daySchedules = schedules.filter(s => s.duty_date === dateStr);
                          
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
                              </div>
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dutyGroups.map((group, idx) => {
                        const memberIds = (group.members || []).map(m => m.user_id);
                        const memberNames = (group.members || []).map(m => m.profile?.full_name || '').filter(Boolean);
                        const color = GROUP_COLORS[idx % GROUP_COLORS.length];
                        
                        return (
                          <TableRow key={group.id} className={color.light}>
                            <TableCell className={cn("text-center font-medium sticky left-0 z-10 border-r px-1 text-xs shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]", color.light)}>
                              {idx + 1}
                            </TableCell>
                            <TableCell className={cn("sticky left-10 z-10 border-r py-1 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]", color.light)}>
                              <div className="flex items-center gap-1.5">
                                <div className={cn("w-1.5 h-6 rounded-full shrink-0 border", color.bg, color.border)} />
                                <div>
                                  <span className={cn("font-medium text-sm", color.text)}>{group.name}</span>
                                  <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                                    {memberNames.join(', ') || 'Chưa có TV'}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            {daysInMonth.map((day, i) => {
                              const dateStr = format(day, 'yyyy-MM-dd');
                              // Check if any member of this group is assigned on this day
                              const isGroupAssigned = schedules.some(s => 
                                s.duty_date === dateStr && memberIds.includes(s.user_id)
                              );
                              const today = isToday(day);
                              const dayName = getDayName(day);
                              const isWeekend = dayName === "CN" || dayName === "T7";

                              const toggleGroupAssignment = async () => {
                                if (!currentSchool) return;
                                setIsSaving(true);
                                try {
                                  if (isGroupAssigned) {
                                    // Remove all members of this group from this day
                                    for (const memberId of memberIds) {
                                      const existing = schedules.find(s => s.user_id === memberId && s.duty_date === dateStr);
                                      if (existing) {
                                        await supabase.from('duty_schedules').delete().eq('id', existing.id);
                                      }
                                    }
                                  } else {
                                    // Remove existing schedules for this day first (replace with group)
                                    await supabase
                                      .from('duty_schedules')
                                      .delete()
                                      .eq('school_id', currentSchool.id)
                                      .eq('duty_date', dateStr);
                                    
                                    // Add all members of this group
                                    const inserts = memberIds.map(userId => ({
                                      school_id: currentSchool.id,
                                      user_id: userId,
                                      duty_date: dateStr,
                                      group_id: group.id,
                                    }));
                                    if (inserts.length > 0) {
                                      await supabase.from('duty_schedules').insert(inserts);
                                    }
                                  }
                                  fetchSchedules();
                                } catch (error: any) {
                                  toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
                                } finally {
                                  setIsSaving(false);
                                }
                              };

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
                                      checked={isGroupAssigned}
                                      disabled={!canManageDuty || isSaving}
                                      onCheckedChange={toggleGroupAssignment}
                                      className={cn(
                                        "h-5 w-5",
                                        isGroupAssigned && cn(color.bg, color.border, "border")
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
          </>
          )}

          {/* Auto Assign Dialog */}
          <Dialog open={showAutoAssignDialog} onOpenChange={setShowAutoAssignDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Tự động phân công</DialogTitle>
                <DialogDescription>
                  Chọn phương thức phân công tự động cho tháng {format(currentMonth, 'MM/yyyy')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <RadioGroup value={assignMode} onValueChange={(v) => setAssignMode(v as 'individual' | 'group')}>
                  <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                    onClick={() => setAssignMode('individual')}>
                    <RadioGroupItem value="individual" id="mode-individual" className="mt-0.5" />
                    <div className="space-y-1">
                      <Label htmlFor="mode-individual" className="font-medium cursor-pointer">Theo giáo viên</Label>
                      <p className="text-xs text-muted-foreground">
                        Phân công đều cho {dutyMembers.length} giáo viên (tối đa {MAX_PER_DAY} người/ngày, {MAX_PER_PERSON} lần/tháng). Đảm bảo cân bằng giới tính và cuối tuần.
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    "flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer",
                    dutyGroups.length === 0 && "opacity-50 pointer-events-none"
                  )}
                    onClick={() => dutyGroups.length > 0 && setAssignMode('group')}>
                    <RadioGroupItem value="group" id="mode-group" className="mt-0.5" disabled={dutyGroups.length === 0} />
                    <div className="space-y-1">
                      <Label htmlFor="mode-group" className="font-medium cursor-pointer">Theo nhóm trực</Label>
                      <p className="text-xs text-muted-foreground">
                        {dutyGroups.length > 0 
                          ? `Mỗi ngày lấy 1 người từ mỗi nhóm, luân phiên thành viên trong nhóm. ${dutyGroups.filter(g => (g.members?.length || 0) > 0).length} nhóm hoạt động.`
                          : 'Chưa có nhóm trực. Vui lòng tạo nhóm trong tab Cài đặt.'}
                      </p>
                      {dutyGroups.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {dutyGroups.map((g, i) => {
                            const color = GROUP_COLORS[i % GROUP_COLORS.length];
                            return (
                              <Badge key={g.id} className={cn("text-[10px]", color.bg, color.text, color.border, "border")}>
                                {g.name} ({g.members?.length || 0})
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </RadioGroup>
                <p className="text-xs text-destructive">
                  ⚠️ Thao tác này sẽ xóa toàn bộ lịch trực tháng hiện tại và phân công lại.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAutoAssignDialog(false)}>Hủy</Button>
                <Button onClick={handleAutoAssign} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Xác nhận phân công
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
        )}

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

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Filter by person */}
                  <Select value={calendarFilterName} onValueChange={setCalendarFilterName}>
                    <SelectTrigger className="w-[180px]">
                      <Search className="h-4 w-4 mr-1" />
                      <SelectValue placeholder="Lọc theo người" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      {scheduledPeople.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

          {/* Personal Duty Summary */}
          {personalDutySummary && personalDutySummary.length > 0 && (
            <Card className="mb-4 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">
                    Lịch trực của {scheduledPeople.find(p => p.id === calendarFilterName)?.name}
                  </span>
                  <Badge variant="secondary">{personalDutySummary.length} ngày</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3 italic">
                  * Chú ý chọn đúng tuần và tháng cần xem
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {personalDutySummary.map(item => {
                    const d = new Date(item.date);
                    const dayOfWeek = getDay(d);
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    return (
                      <div
                        key={item.date}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                          isToday(d) && "border-primary bg-primary/5",
                          isWeekend && !isToday(d) && "border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20"
                        )}
                      >
                        <div className="font-medium whitespace-nowrap">
                          {format(d, 'dd/MM')}
                          <span className={cn(
                            "ml-1 text-xs",
                            isWeekend ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
                          )}>
                            ({format(d, 'EEEE', { locale: vi })})
                          </span>
                        </div>
                        {item.colleagues.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                            <span>cùng</span>
                            {item.colleagues.map(c => (
                              <Badge key={c.id} variant="outline" className="text-[10px] px-1 py-0">
                                {c.profile?.full_name?.split(' ').pop()}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

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
                const daySchedules = getFilteredSchedulesForDay(day);
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
                      {/* Leader for this day */}
                      {(() => {
                        const leader = dutyLeaders.find(l => l.duty_date === format(day, 'yyyy-MM-dd'));
                        return leader ? (
                          <div className="flex items-center gap-1 mb-1.5 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                            <Shield className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="truncate text-[11px] font-semibold text-amber-700 dark:text-amber-300">{leader.profile?.full_name?.split(' ').pop()}</span>
                          </div>
                        ) : null;
                      })()}
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

        {/* Statistics Tab - Only for admins and authorized users */}
        {canManageDuty && (
          <TabsContent value="statistics">
            <DutyStatisticsTab
              schedules={schedules}
              previousMonthSchedules={previousMonthSchedules}
              dutyMembers={dutyMembers}
              currentMonth={currentMonth}
              schoolName={currentSchool?.name || ''}
            />
          </TabsContent>
        )}

        {/* Leaders Tab */}
        {canManageDuty && (
          <TabsContent value="leaders" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-lg font-semibold min-w-[140px] text-center">
                      Tháng {format(currentMonth, 'MM/yyyy')}
                    </h2>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-5 w-5 text-amber-500" />
                  Phân công lãnh đạo trực
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Mỗi ngày chỉ định 1 lãnh đạo trực. Chọn người từ danh sách rồi chọn ngày.
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[60px] text-center">Ngày</TableHead>
                        <TableHead className="w-[80px] text-center">Thứ</TableHead>
                        <TableHead>Lãnh đạo trực</TableHead>
                        <TableHead className="w-[100px] text-center">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {daysInMonth.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const leader = dutyLeaders.find(l => l.duty_date === dateStr);
                        const dayName = getDayName(day);
                        const isWeekend = dayName === 'CN' || dayName === 'T7';
                        const today = isToday(day);

                        return (
                          <TableRow key={dateStr} className={cn(
                            today && "bg-primary/5",
                            isWeekend && !today && "bg-orange-50/50 dark:bg-orange-950/10"
                          )}>
                            <TableCell className="text-center font-medium">
                              {format(day, 'dd/MM')}
                            </TableCell>
                            <TableCell className={cn(
                              "text-center text-sm",
                              isWeekend && "text-orange-600 dark:text-orange-400 font-medium"
                            )}>
                              {format(day, 'EEEE', { locale: vi })}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={leader?.user_id || ''}
                                onValueChange={(v) => {
                                  if (v) toggleLeader(v, day);
                                }}
                              >
                                <SelectTrigger className="w-full max-w-[250px]">
                                  <SelectValue placeholder="Chọn lãnh đạo trực" />
                                </SelectTrigger>
                                <SelectContent>
                                  {leaderMembers.map(m => (
                                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center">
                              {leader && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => toggleLeader(leader.user_id, day)}
                                  disabled={isSaving}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Settings Tab */}
        {canManageDuty && (
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Cài đặt chung
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="maxPerDay">Số người trực trong 1 ngày</Label>
                    <Input
                      id="maxPerDay"
                      type="number"
                      min={1}
                      max={20}
                      value={settingsMaxPerDay}
                      onChange={(e) => setSettingsMaxPerDay(parseInt(e.target.value) || 1)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Hiện tại: {maxPerDay} người/ngày
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxPerPerson">Số lần trực tối đa của 1 người/tháng</Label>
                    <Input
                      id="maxPerPerson"
                      type="number"
                      min={1}
                      max={31}
                      value={settingsMaxPerPerson}
                      onChange={(e) => setSettingsMaxPerPerson(parseInt(e.target.value) || 1)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Hiện tại: {maxPerPerson} lần/tháng
                    </p>
                  </div>
                </div>
                <Button onClick={saveDutySettings} disabled={isSavingSettings} className="gap-2">
                  {isSavingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Lưu cài đặt
                </Button>
              </CardContent>
            </Card>

            {/* Duty Groups & Shifts Settings */}
            <DutyGroupsShiftsSettings />
          </TabsContent>
        )}
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

      {/* Swap Duty Dialog */}
      <Dialog open={showSwapDialog} onOpenChange={setShowSwapDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Đổi lịch trực
            </DialogTitle>
            <DialogDescription>
              Chọn hai người để đổi lịch trực cho nhau
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Source */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Người 1</label>
              <div className="flex gap-2">
                <Select 
                  value={swapSource?.userId || ''} 
                  onValueChange={(v) => setSwapSource(prev => ({ userId: v, date: prev?.date || '' }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Chọn người" />
                  </SelectTrigger>
                  <SelectContent>
                    {dutyMembers.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select 
                  value={swapSource?.date || ''} 
                  onValueChange={(v) => setSwapSource(prev => ({ userId: prev?.userId || '', date: v }))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Ngày trực" />
                  </SelectTrigger>
                  <SelectContent>
                    {swapSource?.userId && schedules
                      .filter(s => s.user_id === swapSource.userId)
                      .map(s => (
                        <SelectItem key={s.duty_date} value={s.duty_date}>
                          {format(new Date(s.duty_date), 'dd/MM (EEE)', { locale: vi })}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-center">
              <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
            </div>

            {/* Target */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Người 2</label>
              <div className="flex gap-2">
                <Select 
                  value={swapTarget?.userId || ''} 
                  onValueChange={(v) => setSwapTarget(prev => ({ userId: v, date: prev?.date || '' }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Chọn người" />
                  </SelectTrigger>
                  <SelectContent>
                    {dutyMembers.filter(m => m.id !== swapSource?.userId).map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select 
                  value={swapTarget?.date || ''} 
                  onValueChange={(v) => setSwapTarget(prev => ({ userId: prev?.userId || '', date: v }))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Ngày trực" />
                  </SelectTrigger>
                  <SelectContent>
                    {swapTarget?.userId && schedules
                      .filter(s => s.user_id === swapTarget.userId)
                      .map(s => (
                        <SelectItem key={s.duty_date} value={s.duty_date}>
                          {format(new Date(s.duty_date), 'dd/MM (EEE)', { locale: vi })}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSwapDialog(false)}>
              Hủy
            </Button>
            <Button 
              onClick={handleSwapDuty} 
              disabled={!swapSource?.userId || !swapSource?.date || !swapTarget?.userId || !swapTarget?.date || isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ArrowLeftRight className="h-4 w-4 mr-1" />}
              Đổi lịch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
