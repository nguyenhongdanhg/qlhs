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
import { useEmulationFormula, DEFAULT_COLUMNS } from '@/hooks/useEmulationFormula';
import { EmulationExportDialog } from '@/components/emulation/EmulationExportDialog';
import { EmulationFormulaTab } from '@/components/emulation/EmulationFormulaTab';

interface ClassWithScore {
  class_id: string;
  class_name: string;
  grade: number;
  scores: Record<string, number>; // column_key -> value
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
  const currentMonth = currentDate.getMonth() + 1;
  const startYear = currentMonth >= 9 ? currentYear : currentYear - 1;
  const schoolYear = `${startYear}-${startYear + 1}`;
  
  const { currentWeek, weekSettings, getWeekDateRange, refetch: refetchWeekSettings } = useCurrentWeek(
    currentSchool?.id,
    schoolYear
  );
  
  const { columns: formulaColumns, isCustom: hasCustomFormula, calculateScore, getFormulaString } = useEmulationFormula(currentSchool?.id);
  
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [activeTab, setActiveTab] = useState('weekly');
  // Dynamic editing: key = classId, value = { columnKey: numericValue }
  const [editingScores, setEditingScores] = useState<Record<string, Record<string, number | string>>>({});
  const [inputValues, setInputValues] = useState<Record<string, Record<string, string>>>({});
  const [dirtyRows, setDirtyRows] = useState<Record<string, true>>({});
  
  const [periodFromWeek, setPeriodFromWeek] = useState(1);
  const [periodToWeek, setPeriodToWeek] = useState(1);
  const [periodAverages, setPeriodAverages] = useState<ClassWithScore[] | null>(null);

  const canEdit = isSuperAdmin || isSchoolAdmin() || hasPermission('emulation', 'edit');
  
  // Determine which columns to show
  const displayColumns = useMemo(() => {
    if (hasCustomFormula && formulaColumns.length > 0) {
      return formulaColumns.map(col => ({
        key: col.id,
        name: col.column_name,
        weight: col.weight,
      }));
    }
    return DEFAULT_COLUMNS.map(col => ({
      key: col.key,
      name: col.column_name,
      weight: col.weight,
    }));
  }, [hasCustomFormula, formulaColumns]);
  
  useEffect(() => {
    if (currentWeek > 0) {
      setSelectedWeek(currentWeek);
    }
  }, [currentWeek]);
  
  const selectedWeekDateRange = getWeekDateRange(selectedWeek);
  
  const formatWeekDateRange = (weekNum: number) => {
    const range = getWeekDateRange(weekNum);
    if (!range) return '';
    return `${format(parseISO(range.start), 'dd/MM')} - ${format(parseISO(range.end), 'dd/MM')}`;
  };

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

  // Helper: extract score value for a column key from a DB record
  const getScoreFromRecord = (record: any, colKey: string): number => {
    // Check custom_scores first (for custom columns)
    if (record?.custom_scores && record.custom_scores[colKey] !== undefined) {
      return Number(record.custom_scores[colKey]) || 0;
    }
    // Fall back to legacy columns
    if (record?.[colKey] !== undefined) {
      return Number(record[colKey]) || 0;
    }
    return 0;
  };

  const classesWithScores: ClassWithScore[] = useMemo(() => {
    const sortedClasses = [...classes].sort((a, b) => naturalSortCompare(a.name, b.name));
    
    const result = sortedClasses.map((cls) => {
      const record = weeklyScores.find((s) => s.class_id === cls.id);
      const editing = editingScores[cls.id];
      
      const scores: Record<string, number> = {};
      displayColumns.forEach(col => {
        const editVal = editing?.[col.key];
        if (editVal !== undefined) {
          scores[col.key] = Number(editVal) || 0;
        } else {
          scores[col.key] = getScoreFromRecord(record, col.key);
        }
      });
      
      const notes = (editing?.notes as string) ?? record?.notes ?? '';
      const average = calculateScore(scores);
      
      return {
        class_id: cls.id,
        class_name: cls.name,
        grade: cls.grade,
        scores,
        average_score: Math.round(average * 100) / 100,
        rank: 0,
        hasData: !!record || !!editing,
        notes,
      };
    });
    
    const sorted = [...result].sort((a, b) => b.average_score - a.average_score);
    sorted.forEach((item, index) => {
      item.rank = item.average_score > 0 ? index + 1 : 0;
    });
    
    return result.map((item) => ({
      ...item,
      rank: sorted.find((s) => s.class_id === item.class_id)?.rank || 0,
    }));
  }, [classes, weeklyScores, editingScores, displayColumns, calculateScore]);

  const saveMutation = useMutation({
    mutationFn: async (scoresToSave: { classId: string; scores: Record<string, number>; notes?: string }[]) => {
      for (const item of scoresToSave) {
        const existing = weeklyScores.find((s) => s.class_id === item.classId);
        
        // Build the update/insert payload
        const payload: any = {
          reporter_id: user?.id,
          notes: item.notes,
        };

        if (hasCustomFormula) {
          // Store in custom_scores JSONB
          payload.custom_scores = item.scores;
        } else {
          // Store in legacy columns
          payload.academic_score = item.scores['academic_score'] ?? 0;
          payload.discipline_score = item.scores['discipline_score'] ?? 0;
          payload.boarding_score = item.scores['boarding_score'] ?? 0;
        }
        
        if (existing) {
          const { error } = await supabase
            .from('emulation_scores')
            .update(payload)
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('emulation_scores')
            .insert({
              school_id: currentSchool!.id,
              class_id: item.classId,
              week_number: selectedWeek,
              school_year: schoolYear,
              ...payload,
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

  const handleScoreChange = (classId: string, colKey: string, value: string) => {
    if (colKey === 'notes') {
      markDirty(classId);
      setEditingScores((prev) => ({
        ...prev,
        [classId]: { ...prev[classId], notes: value },
      }));
    } else {
      markDirty(classId);
      const cleanValue = normalizeDecimalInput(value);
      
      setInputValues((prev) => ({
        ...prev,
        [classId]: { ...prev[classId], [colKey]: cleanValue },
      }));

      if (cleanValue !== '') {
        const numValue = parseFloat(cleanValue);
        if (!isNaN(numValue)) {
          setEditingScores((prev) => ({
            ...prev,
            [classId]: { ...prev[classId], [colKey]: numValue },
          }));
        }
      }
    }
  };

  const handleScoreBlur = (classId: string, colKey: string) => {
    const inputValue = inputValues[classId]?.[colKey];
    if (inputValue === '' || inputValue === undefined) {
      setInputValues((prev) => ({
        ...prev,
        [classId]: { ...prev[classId], [colKey]: '0' },
      }));
      setEditingScores((prev) => ({
        ...prev,
        [classId]: { ...prev[classId], [colKey]: 0 },
      }));
    }
  };

  const handleSave = () => {
    const scoresToSave = Object.keys(dirtyRows).map((classId) => {
      const scores: Record<string, number> = {};
      displayColumns.forEach(col => {
        const raw = inputValues[classId]?.[col.key];
        if (raw !== undefined) {
          const normalized = normalizeDecimalInput(raw);
          scores[col.key] = normalized === '' ? 0 : (parseFloat(normalized) || 0);
        } else {
          const editing = editingScores[classId]?.[col.key];
          if (editing !== undefined) {
            scores[col.key] = Number(editing) || 0;
          } else {
            const record = weeklyScores.find((s) => s.class_id === classId);
            scores[col.key] = getScoreFromRecord(record, col.key);
          }
        }
      });

      const notes = editingScores[classId]?.notes as string | undefined;
      const existing = weeklyScores.find((s) => s.class_id === classId);

      return {
        classId,
        scores,
        notes: notes !== undefined ? notes : (existing?.notes ?? undefined),
      };
    });
    
    if (scoresToSave.length > 0) {
      saveMutation.mutate(scoresToSave);
    }
  };

  const getDisplayValue = (classId: string, colKey: string): string => {
    const inputValue = inputValues[classId]?.[colKey];
    if (inputValue !== undefined) return inputValue;
    
    const editing = editingScores[classId]?.[colKey];
    if (editing !== undefined) return String(editing);
    
    const record = weeklyScores.find((s) => s.class_id === classId);
    return String(getScoreFromRecord(record, colKey));
  };

  const getNotesValue = (classId: string) => {
    const editing = editingScores[classId];
    if (editing && editing.notes !== undefined) return editing.notes as string;
    const score = weeklyScores.find((s) => s.class_id === classId);
    return score?.notes || '';
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
      const classRecords = data?.filter((s) => s.class_id === cls.id) || [];
      
      if (classRecords.length === 0) {
        const emptyScores: Record<string, number> = {};
        displayColumns.forEach(col => { emptyScores[col.key] = 0; });
        return {
          class_id: cls.id,
          class_name: cls.name,
          grade: cls.grade,
          scores: emptyScores,
          average_score: 0,
          rank: 0,
          hasData: false,
        };
      }

      // Average each column across weeks
      const avgScores: Record<string, number> = {};
      displayColumns.forEach(col => {
        const total = classRecords.reduce((sum, r) => sum + getScoreFromRecord(r, col.key), 0);
        avgScores[col.key] = Math.round((total / classRecords.length) * 100) / 100;
      });

      const avgScore = calculateScore(avgScores);

      return {
        class_id: cls.id,
        class_name: cls.name,
        grade: cls.grade,
        scores: avgScores,
        average_score: Math.round(avgScore * 100) / 100,
        rank: 0,
        hasData: true,
      };
    });

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

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-amber-400 text-amber-950';
    if (rank === 2) return 'bg-slate-400 text-slate-950';
    if (rank === 3) return 'bg-orange-400 text-orange-950';
    return 'bg-muted text-muted-foreground';
  };

  const weekOptions = Array.from({ length: 35 }, (_, i) => i + 1);
  const totalCols = displayColumns.length + 4; // STT + columns + TB + Rank + Notes

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
                      currentWeekScores={classesWithScores.map(cls => ({
                        class_name: cls.class_name,
                        scores: cls.scores,
                        average_score: cls.average_score,
                        rank: cls.rank,
                        notes: cls.notes,
                      }))}
                      currentWeekDateRange={selectedWeekDateRange}
                      classes={classes}
                      displayColumns={displayColumns}
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
                      {displayColumns.map(col => (
                        <TableHead key={col.key} className="text-center w-[80px]">
                          {col.name}
                          {col.weight !== 1 && (
                            <span className="text-xs text-muted-foreground ml-1">(×{col.weight})</span>
                          )}
                        </TableHead>
                      ))}
                      <TableHead className="text-center w-[70px]">Điểm thi đua</TableHead>
                      <TableHead className="text-center w-[70px]">Xếp hạng</TableHead>
                      <TableHead className="min-w-[150px]">Ghi chú</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={totalCols} className="text-center py-8 text-muted-foreground">
                          Đang tải...
                        </TableCell>
                      </TableRow>
                    ) : classesWithScores.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={totalCols} className="text-center py-8 text-muted-foreground">
                          Chưa có lớp nào
                        </TableCell>
                      </TableRow>
                    ) : (
                      classesWithScores.map((cls, index) => (
                        <TableRow key={cls.class_id}>
                          <TableCell className="text-center font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium">{cls.class_name}</TableCell>
                          {displayColumns.map(col => (
                            <TableCell key={col.key} className="text-center">
                              {canEdit ? (
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={getDisplayValue(cls.class_id, col.key)}
                                  onChange={(e) => handleScoreChange(cls.class_id, col.key, e.target.value)}
                                  onBlur={() => handleScoreBlur(cls.class_id, col.key)}
                                  onFocus={(e) => e.target.select()}
                                  className="w-[70px] text-center mx-auto"
                                />
                              ) : (
                                <span>{cls.scores[col.key]}</span>
                              )}
                            </TableCell>
                          ))}
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
                * Công thức: {getFormulaString()}
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
                        {displayColumns.map(col => (
                          <TableHead key={col.key} className="text-center">
                            TB {col.name}
                          </TableHead>
                        ))}
                        <TableHead className="text-center">Điểm thi đua</TableHead>
                        <TableHead className="text-center w-[80px]">Xếp hạng</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periodAverages.map((cls, index) => (
                        <TableRow key={cls.class_id}>
                          <TableCell className="text-center font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium">{cls.class_name}</TableCell>
                          {displayColumns.map(col => (
                            <TableCell key={col.key} className="text-center">
                              {cls.scores[col.key]?.toFixed(2) ?? '0.00'}
                            </TableCell>
                          ))}
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
