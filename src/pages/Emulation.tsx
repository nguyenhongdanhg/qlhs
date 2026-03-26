import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Save, Calculator, RefreshCw, CalendarDays } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { naturalSortCompare } from '@/lib/utils';
import { WeekSettingsDialog } from '@/components/emulation/WeekSettingsDialog';
import { useCurrentWeek } from '@/hooks/useCurrentWeek';

import { EmulationExportDialog } from '@/components/emulation/EmulationExportDialog';
import { EmulationFormulaTab } from '@/components/emulation/EmulationFormulaTab';

interface EmulationScore {
  id?: string;
  school_id: string;
  class_id: string;
  week_number: number;
  school_year: string;
  academic_score: number;
  discipline_score: number;
  boarding_score: number;
  notes?: string;
  class?: {
    id: string;
    name: string;
    grade: number;
  };
}

interface ClassWithScore {
  class_id: string;
  class_name: string;
  grade: number;
  academic_score: number;
  discipline_score: number;
  boarding_score: number;
  average_score: number;
  rank: number;
  hasData: boolean;
  notes?: string;
}

export default function Emulation() {
  const { user, currentSchool, isSuperAdmin, isSchoolAdmin } = useAuth();
  const { hasPermission } = useSchool();
  const queryClient = useQueryClient();
  
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  // School year starts in September: Aug and before = previous year start
  const startYear = currentMonth >= 9 ? currentYear : currentYear - 1;
  const schoolYear = `${startYear}-${startYear + 1}`;
  
  const { currentWeek, weekSettings, getWeekDateRange, refetch: refetchWeekSettings } = useCurrentWeek(
    currentSchool?.id,
    schoolYear
  );
  
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [activeTab, setActiveTab] = useState('weekly');
  const [editingScores, setEditingScores] = useState<Record<string, Partial<EmulationScore>>>({});
  // Store raw string values for inputs to preserve decimal formatting
  const [inputValues, setInputValues] = useState<Record<string, Record<string, string>>>({});
  // Track which rows were changed so saving never "jumps" to wrong rows
  const [dirtyRows, setDirtyRows] = useState<Record<string, true>>({});
  
  // Period calculation state
  const [periodFromWeek, setPeriodFromWeek] = useState(1);
  const [periodToWeek, setPeriodToWeek] = useState(1);
  const [periodAverages, setPeriodAverages] = useState<ClassWithScore[] | null>(null);

  const canEdit = isSuperAdmin || isSchoolAdmin() || hasPermission('emulation', 'edit');
  
  // Auto-select current week when loaded
  useEffect(() => {
    if (currentWeek > 0) {
      setSelectedWeek(currentWeek);
    }
  }, [currentWeek]);
  
  // Get date range for selected week
  const selectedWeekDateRange = getWeekDateRange(selectedWeek);
  
  const formatWeekDateRange = (weekNum: number) => {
    const range = getWeekDateRange(weekNum);
    if (!range) return '';
    return `${format(parseISO(range.start), 'dd/MM')} - ${format(parseISO(range.end), 'dd/MM')}`;
  };

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ['classes', currentSchool?.id],
    queryFn: async () => {
      if (!currentSchool?.id) return [];
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, grade')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .order('grade', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSchool?.id,
  });

  // Fetch scores for selected week
  const { data: weeklyScores = [], isLoading, refetch } = useQuery({
    queryKey: ['emulation-scores', currentSchool?.id, selectedWeek, schoolYear],
    queryFn: async () => {
      if (!currentSchool?.id) return [];
      const { data, error } = await supabase
        .from('emulation_scores')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('week_number', selectedWeek)
        .eq('school_year', schoolYear);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSchool?.id,
  });

  // Calculate average and ranking
  const classesWithScores: ClassWithScore[] = useMemo(() => {
    const sortedClasses = [...classes].sort((a, b) => naturalSortCompare(a.name, b.name));
    
    const result = sortedClasses.map((cls) => {
      const score = weeklyScores.find((s) => s.class_id === cls.id);
      const editing = editingScores[cls.id];
      
      const academic = editing?.academic_score ?? score?.academic_score ?? 0;
      const discipline = editing?.discipline_score ?? score?.discipline_score ?? 0;
      const boarding = editing?.boarding_score ?? score?.boarding_score ?? 0;
      const notes = editing?.notes ?? score?.notes ?? '';
      
      // Formula: (Academic * 2 + Discipline + Boarding) / 4
      const average = (academic * 2 + discipline + boarding) / 4;
      
      return {
        class_id: cls.id,
        class_name: cls.name,
        grade: cls.grade,
        academic_score: academic,
        discipline_score: discipline,
        boarding_score: boarding,
        average_score: Math.round(average * 100) / 100,
        rank: 0,
        hasData: !!score || !!editing,
        notes,
      };
    });
    
    // Sort by average score descending for ranking
    const sorted = [...result].sort((a, b) => b.average_score - a.average_score);
    sorted.forEach((item, index) => {
      item.rank = item.average_score > 0 ? index + 1 : 0;
    });
    
    // Return in original class order with ranks assigned
    return result.map((item) => ({
      ...item,
      rank: sorted.find((s) => s.class_id === item.class_id)?.rank || 0,
    }));
  }, [classes, weeklyScores, editingScores]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (scores: EmulationScore[]) => {
      for (const score of scores) {
        const existing = weeklyScores.find((s) => s.class_id === score.class_id);
        
        if (existing) {
          const { error } = await supabase
            .from('emulation_scores')
            .update({
              academic_score: score.academic_score,
              discipline_score: score.discipline_score,
              boarding_score: score.boarding_score,
              notes: score.notes,
              reporter_id: user?.id,
            })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('emulation_scores')
            .insert({
              school_id: currentSchool!.id,
              class_id: score.class_id,
              week_number: selectedWeek,
              school_year: schoolYear,
              academic_score: score.academic_score,
              discipline_score: score.discipline_score,
              boarding_score: score.boarding_score,
              notes: score.notes,
              reporter_id: user?.id,
            });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast({ title: 'Đã lưu điểm thi đua' });
      setEditingScores({});
      setInputValues({});
      setDirtyRows({});
      queryClient.invalidateQueries({ queryKey: ['emulation-scores'] });
    },
    onError: (error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  const normalizeDecimalInput = (raw: string) => {
    // Allow both "," and "." as decimal separators.
    // Keep at most one dot in the value.
    const replaced = raw.replace(/,/g, '.');
    const cleaned = replaced.replace(/[^0-9.\-]/g, '');
    const firstDotIndex = cleaned.indexOf('.');
    if (firstDotIndex === -1) return cleaned;
    const before = cleaned.slice(0, firstDotIndex + 1);
    const after = cleaned.slice(firstDotIndex + 1).replace(/\./g, '');
    return before + after;
  };

  const markDirty = (classId: string) => {
    setDirtyRows((prev) => (prev[classId] ? prev : { ...prev, [classId]: true }));
  };

  const handleScoreChange = (classId: string, field: keyof EmulationScore, value: string) => {
    if (field === 'notes') {
      markDirty(classId);
      setEditingScores((prev) => ({
        ...prev,
        [classId]: {
          ...prev[classId],
          [field]: value,
        },
      }));
    } else {
      markDirty(classId);

      const cleanValue = normalizeDecimalInput(value);
      
      // Store raw string value for display
      setInputValues((prev) => ({
        ...prev,
        [classId]: {
          ...prev[classId],
          [field]: cleanValue,
        },
      }));

      // Only update numeric state when value is parseable.
      // IMPORTANT: do NOT force numeric = 0 while user is temporarily clearing to type,
      // otherwise clicking Save too quickly can persist 0.
      if (cleanValue !== '') {
        const numValue = parseFloat(cleanValue);
        if (!isNaN(numValue)) {
          const clampedValue = numValue;
          setEditingScores((prev) => ({
            ...prev,
            [classId]: {
              ...prev[classId],
              [field]: clampedValue,
            },
          }));
        }
      }
    }
  };

  const handleScoreBlur = (classId: string, field: 'academic_score' | 'discipline_score' | 'boarding_score') => {
    const inputValue = inputValues[classId]?.[field];
    if (inputValue === '' || inputValue === undefined) {
      // If empty, set to 0 visually
      setInputValues((prev) => ({
        ...prev,
        [classId]: {
          ...prev[classId],
          [field]: '0',
        },
      }));

      // Ensure numeric state has a deterministic value after leaving the field
      setEditingScores((prev) => ({
        ...prev,
        [classId]: {
          ...prev[classId],
          [field]: 0,
        },
      }));
    }
  };

  const handleSave = () => {
    const getScoreForSave = (classId: string, field: 'academic_score' | 'discipline_score' | 'boarding_score') => {
      // Prefer raw input if present (even if user typed ",")
      const raw = inputValues[classId]?.[field];
      if (raw !== undefined) {
        const normalized = normalizeDecimalInput(raw);
        if (normalized === '') return 0;
        const parsed = parseFloat(normalized);
        if (Number.isFinite(parsed)) return parsed;
      }

      const editing = editingScores[classId]?.[field];
      if (editing !== undefined) return Number(editing) || 0;

      const existing = weeklyScores.find((s) => s.class_id === classId);
      return existing ? Number(existing[field]) || 0 : 0;
    };

    const scoresToSave: EmulationScore[] = Object.keys(dirtyRows).map((classId) => {
      const notes = editingScores[classId]?.notes;
      const existing = weeklyScores.find((s) => s.class_id === classId);

      return {
        school_id: currentSchool!.id,
        class_id: classId,
        week_number: selectedWeek,
        school_year: schoolYear,
        academic_score: getScoreForSave(classId, 'academic_score'),
        discipline_score: getScoreForSave(classId, 'discipline_score'),
        boarding_score: getScoreForSave(classId, 'boarding_score'),
        // If notes isn't edited, keep current notes from DB
        notes: notes !== undefined ? notes : (existing?.notes ?? undefined),
      };
    });
    
    if (scoresToSave.length > 0) {
      saveMutation.mutate(scoresToSave);
    }
  };

  // Period calculation
  const calculatePeriodAverage = async () => {
    if (!currentSchool?.id || periodFromWeek > periodToWeek) {
      toast({ title: 'Lỗi', description: 'Vui lòng chọn tuần hợp lệ', variant: 'destructive' });
      return;
    }

    const { data, error } = await supabase
      .from('emulation_scores')
      .select('*')
      .eq('school_id', currentSchool.id)
      .eq('school_year', schoolYear)
      .gte('week_number', periodFromWeek)
      .lte('week_number', periodToWeek);

    if (error) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
      return;
    }

    const sortedClasses = [...classes].sort((a, b) => naturalSortCompare(a.name, b.name));

    const result: ClassWithScore[] = sortedClasses.map((cls) => {
      const classScores = data?.filter((s) => s.class_id === cls.id) || [];
      
      if (classScores.length === 0) {
        return {
          class_id: cls.id,
          class_name: cls.name,
          grade: cls.grade,
          academic_score: 0,
          discipline_score: 0,
          boarding_score: 0,
          average_score: 0,
          rank: 0,
          hasData: false,
        };
      }

      const totalAcademic = classScores.reduce((sum, s) => sum + (Number(s.academic_score) || 0), 0);
      const totalDiscipline = classScores.reduce((sum, s) => sum + (Number(s.discipline_score) || 0), 0);
      const totalBoarding = classScores.reduce((sum, s) => sum + (Number(s.boarding_score) || 0), 0);
      
      const avgAcademic = totalAcademic / classScores.length;
      const avgDiscipline = totalDiscipline / classScores.length;
      const avgBoarding = totalBoarding / classScores.length;
      const avgScore = (avgAcademic * 2 + avgDiscipline + avgBoarding) / 4;

      return {
        class_id: cls.id,
        class_name: cls.name,
        grade: cls.grade,
        academic_score: Math.round(avgAcademic * 100) / 100,
        discipline_score: Math.round(avgDiscipline * 100) / 100,
        boarding_score: Math.round(avgBoarding * 100) / 100,
        average_score: Math.round(avgScore * 100) / 100,
        rank: 0,
        hasData: true,
      };
    });

    // Assign ranks
    const sorted = [...result].sort((a, b) => b.average_score - a.average_score);
    sorted.forEach((item, index) => {
      item.rank = item.average_score > 0 ? index + 1 : 0;
    });

    result.forEach((item) => {
      item.rank = sorted.find((s) => s.class_id === item.class_id)?.rank || 0;
    });

    setPeriodAverages(result);
    toast({ title: `Đã tính trung bình từ tuần ${periodFromWeek} đến tuần ${periodToWeek}` });
  };

  const getScoreValue = (classId: string, field: 'academic_score' | 'discipline_score' | 'boarding_score'): string => {
    // First check if there's a raw input value being edited
    const inputValue = inputValues[classId]?.[field];
    if (inputValue !== undefined) return inputValue;
    
    // Then check editing scores
    const editing = editingScores[classId];
    if (editing && editing[field] !== undefined) {
      return String(editing[field]);
    }
    
    // Finally use saved score from database
    const score = weeklyScores.find((s) => s.class_id === classId);
    return score ? String(Number(score[field])) : '0';
  };

  const getNotesValue = (classId: string) => {
    const editing = editingScores[classId];
    if (editing && editing.notes !== undefined) return editing.notes;
    
    const score = weeklyScores.find((s) => s.class_id === classId);
    return score?.notes || '';
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-amber-400 text-amber-950';
    if (rank === 2) return 'bg-slate-400 text-slate-950';
    if (rank === 3) return 'bg-orange-400 text-orange-950';
    return 'bg-muted text-muted-foreground';
  };

  const weekOptions = Array.from({ length: 35 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 shadow-md">
          <Trophy className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Thi đua</h1>
          <p className="text-sm text-muted-foreground">Năm học {schoolYear}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="weekly">Bảng thi đua tuần</TabsTrigger>
          <TabsTrigger value="period">Thống kê giai đoạn</TabsTrigger>
          <TabsTrigger value="formula">Công thức tính</TabsTrigger>
        </TabsList>

        {/* Weekly Tab */}
        <TabsContent value="weekly" className="space-y-4">
          <Card>
<CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Bảng điểm thi đua</CardTitle>
                  <CardDescription>Nhập điểm và xếp hạng các lớp theo tuần</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={selectedWeek.toString()}
                    onValueChange={(v) => setSelectedWeek(parseInt(v))}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Chọn tuần" />
                    </SelectTrigger>
                    <SelectContent>
                      {weekOptions.map((week) => {
                        const dateRange = formatWeekDateRange(week);
                        return (
                          <SelectItem key={week} value={week.toString()}>
                            Tuần {week} {dateRange && `(${dateRange})`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {canEdit && currentSchool?.id && (
                    <WeekSettingsDialog
                      schoolId={currentSchool.id}
                      schoolYear={schoolYear}
                      onSaved={refetchWeekSettings}
                    />
                  )}
                  <Button variant="outline" size="icon" onClick={() => refetch()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  {canEdit && Object.keys(dirtyRows).length > 0 && (
                    <Button onClick={handleSave} disabled={saveMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      Lưu
                    </Button>
                  )}
                  {currentSchool && (
                    <EmulationExportDialog
                      schoolId={currentSchool.id}
                      schoolName={currentSchool.name}
                      schoolYear={schoolYear}
                      currentWeek={selectedWeek}
                      weekSettings={weekSettings}
                      currentWeekScores={classesWithScores}
                      currentWeekDateRange={selectedWeekDateRange}
                      classes={classes}
                    />
                  )}
                </div>
              </div>
              {selectedWeekDateRange && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>
                    Tuần {selectedWeek}: {format(parseISO(selectedWeekDateRange.start), 'dd/MM/yyyy', { locale: vi })} - {format(parseISO(selectedWeekDateRange.end), 'dd/MM/yyyy', { locale: vi })}
                  </span>
                  {selectedWeek === currentWeek && (
                    <Badge variant="secondary" className="ml-2">Tuần hiện tại</Badge>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px] text-center">STT</TableHead>
                      <TableHead className="w-[80px]">Lớp</TableHead>
                      <TableHead className="text-center w-[80px]">Học tập</TableHead>
                      <TableHead className="text-center w-[80px]">Nề nếp</TableHead>
                      <TableHead className="text-center w-[80px]">Nội trú</TableHead>
                      <TableHead className="text-center w-[70px]">TB</TableHead>
                      <TableHead className="text-center w-[70px]">Xếp hạng</TableHead>
                      <TableHead className="min-w-[150px]">Ghi chú</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Đang tải...
                        </TableCell>
                      </TableRow>
                    ) : classesWithScores.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Chưa có lớp nào
                        </TableCell>
                      </TableRow>
                    ) : (
                      classesWithScores.map((cls, index) => (
                        <TableRow key={cls.class_id}>
                          <TableCell className="text-center font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium">{cls.class_name}</TableCell>
                          <TableCell className="text-center">
                            {canEdit ? (
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={getScoreValue(cls.class_id, 'academic_score')}
                                onChange={(e) => handleScoreChange(cls.class_id, 'academic_score', e.target.value)}
                                onBlur={() => handleScoreBlur(cls.class_id, 'academic_score')}
                                onFocus={(e) => e.target.select()}
                                className="w-[70px] text-center mx-auto"
                              />
                            ) : (
                              <span>{cls.academic_score}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {canEdit ? (
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={getScoreValue(cls.class_id, 'discipline_score')}
                                onChange={(e) => handleScoreChange(cls.class_id, 'discipline_score', e.target.value)}
                                onBlur={() => handleScoreBlur(cls.class_id, 'discipline_score')}
                                onFocus={(e) => e.target.select()}
                                className="w-[70px] text-center mx-auto"
                              />
                            ) : (
                              <span>{cls.discipline_score}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {canEdit ? (
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={getScoreValue(cls.class_id, 'boarding_score')}
                                onChange={(e) => handleScoreChange(cls.class_id, 'boarding_score', e.target.value)}
                                onBlur={() => handleScoreBlur(cls.class_id, 'boarding_score')}
                                onFocus={(e) => e.target.select()}
                                className="w-[70px] text-center mx-auto"
                              />
                            ) : (
                              <span>{cls.boarding_score}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-semibold text-primary">
                            {cls.average_score.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            {cls.rank > 0 ? (
                              <Badge className={getRankBadgeColor(cls.rank)}>
                                {cls.rank}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {canEdit ? (
                              <Input
                                type="text"
                                value={getNotesValue(cls.class_id)}
                                onChange={(e) => handleScoreChange(cls.class_id, 'notes', e.target.value)}
                                placeholder="Ghi chú..."
                                className="w-full min-w-[120px]"
                              />
                            ) : (
                              <span className="text-sm text-muted-foreground">{cls.notes}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                * Điểm trung bình = (Học tập × 2 + Nề nếp + Nội trú) ÷ 4
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Period Tab */}
        <TabsContent value="period" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Thống kê giai đoạn</CardTitle>
              <CardDescription>Tính điểm trung bình của các lớp trong khoảng thời gian</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Từ tuần</span>
                  <Select
                    value={periodFromWeek.toString()}
                    onValueChange={(v) => setPeriodFromWeek(parseInt(v))}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weekOptions.map((week) => {
                        const dateRange = formatWeekDateRange(week);
                        return (
                          <SelectItem key={week} value={week.toString()}>
                            {week} {dateRange && `(${dateRange})`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">đến tuần</span>
                  <Select
                    value={periodToWeek.toString()}
                    onValueChange={(v) => setPeriodToWeek(parseInt(v))}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weekOptions.map((week) => {
                        const dateRange = formatWeekDateRange(week);
                        return (
                          <SelectItem key={week} value={week.toString()}>
                            {week} {dateRange && `(${dateRange})`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={calculatePeriodAverage}>
                  <Calculator className="h-4 w-4 mr-2" />
                  Tính trung bình
                </Button>
              </div>

              {periodAverages && (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px] text-center">STT</TableHead>
                        <TableHead>Lớp</TableHead>
                        <TableHead className="text-center">TB Học tập</TableHead>
                        <TableHead className="text-center">TB Nề nếp</TableHead>
                        <TableHead className="text-center">TB Nội trú</TableHead>
                        <TableHead className="text-center">Điểm TB</TableHead>
                        <TableHead className="text-center w-[80px]">Xếp hạng</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periodAverages.map((cls, index) => (
                        <TableRow key={cls.class_id}>
                          <TableCell className="text-center font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium">{cls.class_name}</TableCell>
                          <TableCell className="text-center">{cls.academic_score.toFixed(2)}</TableCell>
                          <TableCell className="text-center">{cls.discipline_score.toFixed(2)}</TableCell>
                          <TableCell className="text-center">{cls.boarding_score.toFixed(2)}</TableCell>
                          <TableCell className="text-center font-semibold text-primary">
                            {cls.average_score.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            {cls.rank > 0 ? (
                              <Badge className={getRankBadgeColor(cls.rank)}>
                                {cls.rank}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {!periodAverages && (
                <div className="text-center py-8 text-muted-foreground">
                  Chọn khoảng tuần và nhấn "Tính trung bình" để xem kết quả
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Formula Tab */}
        <TabsContent value="formula">
          {currentSchool?.id && (
            <EmulationFormulaTab schoolId={currentSchool.id} canEdit={canEdit} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
