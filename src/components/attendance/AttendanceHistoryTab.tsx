import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
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
import { format, isToday } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CalendarIcon,
  Loader2,
  FileSpreadsheet,
  Trash2,
  Users,
  ChevronUp,
  ChevronDown,
  Edit3,
  Image,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangeType, getDateRange, exportAttendanceReport, AttendanceReportData } from '@/lib/excel-export';
import { Class, AttendanceStatus } from '@/types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ShareReportDialog } from './ShareReportDialog';
import { detectSessionLabelByTime } from './SessionSettingsDialog';

interface SessionInfo {
  id: string;
  label: string;
  start_time?: string | null;
  end_time?: string | null;
}

interface AbsentStudentInfo {
  id: string;
  name: string;
  className: string;
  excused: boolean;
  reason: string;
}

interface HistoryRecord {
  date: string;
  reportedAt: string;
  reporterId: string;
  reporterName: string;
  total: number;
  present: number;
  absent: number;
  notes?: string;
  absentStudents: AbsentStudentInfo[];
}

interface AttendanceHistoryTabProps {
  attendanceType: 'boarding' | 'evening_study';
  typeLabel: string;
  classes: Class[];
  sessions?: SessionInfo[];
  isClassTeacher: boolean;
  teacherClassId: string | null;
  teacherClassName: string | null;
  canEdit: boolean;
  canDelete: boolean;
  onEditReport: (record: HistoryRecord) => void;
}

export function AttendanceHistoryTab({
  attendanceType,
  typeLabel,
  classes,
  sessions = [],
  isClassTeacher,
  teacherClassId,
  teacherClassName,
  canEdit,
  canDelete,
  onEditReport,
}: AttendanceHistoryTabProps) {
  const { currentSchool, user, isSuperAdmin, isSchoolAdmin } = useAuth();

  // Helper to detect session label using configured sessions or fallback to typeLabel
  const getSessionLabel = (reportedAt: string): string => {
    if (sessions.length > 0) {
      return detectSessionLabelByTime(reportedAt, sessions);
    }
    return typeLabel;
  };

  const [historyDate, setHistoryDate] = useState<Date>(new Date());
  const [historyRangeType, setHistoryRangeType] = useState<DateRangeType>('week');
  const [historyReporterFilter, setHistoryReporterFilter] = useState<string>('all');
  const [reporters, setReporters] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [totalStudents, setTotalStudents] = useState(0);

  // Bulk delete state
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Share dialog
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [reportToShare, setReportToShare] = useState<HistoryRecord | null>(null);

  const historyDateRange = useMemo(() => getDateRange(historyDate, historyRangeType), [historyDate, historyRangeType]);

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [classes]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchReporters();
  }, [currentSchool, historyDateRange]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchHistory();
  }, [currentSchool, historyDateRange, historyReporterFilter]);

  const fetchAllRecords = async (buildQuery: () => any) => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (data && data.length > 0) {
        allData = allData.concat(data);
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  const fetchReporters = async () => {
    if (!currentSchool) return;
    try {
      const startDate = format(historyDateRange.start, 'yyyy-MM-dd');
      const endDate = format(historyDateRange.end, 'yyyy-MM-dd');

      const data = await fetchAllRecords(() =>
        supabase
          .from('attendance_records')
          .select('reporter_id, reporter:profiles!attendance_records_reporter_id_fkey(full_name)')
          .eq('school_id', currentSchool.id)
          .eq('attendance_type', attendanceType)
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate)
      );

      const reporterMap = new Map<string, string>();
      (data || []).forEach((record: any) => {
        if (record.reporter_id && record.reporter?.full_name) {
          reporterMap.set(record.reporter_id, record.reporter.full_name);
        }
      });

      const uniqueReporters = Array.from(reporterMap.entries()).map(([id, name]) => ({ id, name }));
      uniqueReporters.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      setReporters(uniqueReporters);
    } catch (error) {
      console.error('Error fetching reporters:', error);
    }
  };

  const fetchHistory = async () => {
    if (!currentSchool) return;
    setIsLoadingHistory(true);
    try {
      const startDate = format(historyDateRange.start, 'yyyy-MM-dd');
      const endDate = format(historyDateRange.end, 'yyyy-MM-dd');

      // Get total boarding students
      const { data: studentsData } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .eq('is_boarding', true);
      const total = studentsData?.length || 0;
      setTotalStudents(total);

      const buildQuery = () => {
        let q = supabase
          .from('attendance_records')
          .select('*, reporter:profiles!attendance_records_reporter_id_fkey(full_name), student:students(full_name, class:classes(name))')
          .eq('school_id', currentSchool.id)
          .eq('attendance_type', attendanceType)
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate)
          .order('created_at', { ascending: false });

        if (historyReporterFilter !== 'all') {
          q = q.eq('reporter_id', historyReporterFilter);
        }
        return q;
      };

      const recordsData = await fetchAllRecords(buildQuery);

      // Get latest record per student/date
      const latestByStudentDate = new Map<string, any>();
      (recordsData || []).forEach((record: any) => {
        const key = `${record.student_id}-${record.attendance_date}`;
        const existing = latestByStudentDate.get(key);
        if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
          latestByStudentDate.set(key, record);
        }
      });

      // Group by date
      const historyByDate = new Map<string, HistoryRecord>();

      latestByStudentDate.forEach((record) => {
        const key = record.attendance_date;

        if (!historyByDate.has(key)) {
          historyByDate.set(key, {
            date: record.attendance_date,
            reportedAt: record.created_at,
            reporterId: record.reporter_id,
            reporterName: record.reporter?.full_name || 'N/A',
            total: total,
            present: 0,
            absent: 0,
            notes: record.notes || '',
            absentStudents: [],
          });
        }

        const entry = historyByDate.get(key)!;
        if (record.status === 'present') {
          entry.present++;
        } else {
          entry.absent++;
          entry.absentStudents.push({
            id: record.student_id,
            name: record.student?.full_name || 'N/A',
            className: record.student?.class?.name || 'N/A',
            excused: record.status === 'excused',
            reason: record.excused_reason || '',
          });
        }

        // Keep the latest report time
        if (new Date(record.created_at) > new Date(entry.reportedAt)) {
          entry.reportedAt = record.created_at;
          entry.reporterId = record.reporter_id;
          entry.reporterName = record.reporter?.full_name || 'N/A';
        }
      });

      // Sort absent students by class then name
      historyByDate.forEach((entry) => {
        entry.absentStudents.sort((a, b) => {
          const gradeA = parseInt(a.className.match(/^\\d+/)?.[0] || '99');
          const gradeB = parseInt(b.className.match(/^\\d+/)?.[0] || '99');
          if (gradeA !== gradeB) return gradeA - gradeB;
          if (a.className !== b.className) return a.className.localeCompare(b.className, 'vi');
          return a.name.localeCompare(b.name, 'vi');
        });
      });

      setHistoryRecords(Array.from(historyByDate.values()).sort((a, b) => b.date.localeCompare(a.date)));
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDeleteDay = async (date: string) => {
    if (!currentSchool || !window.confirm(`Xác nhận xóa báo cáo ngày ${format(new Date(date), 'dd/MM/yyyy')}?`)) return;
    
    try {
      await supabase
        .from('attendance_records')
        .delete()
        .eq('school_id', currentSchool.id)
        .eq('attendance_date', date)
        .eq('attendance_type', attendanceType);
      
      fetchHistory();
    } catch (error) {
      console.error('Error deleting history:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (!currentSchool || selectedDays.size === 0) return;
    if (!window.confirm(`Xác nhận xóa ${selectedDays.size} ngày báo cáo?`)) return;
    
    setIsDeleting(true);
    try {
      for (const date of selectedDays) {
        await supabase
          .from('attendance_records')
          .delete()
          .eq('school_id', currentSchool.id)
          .eq('attendance_date', date)
          .eq('attendance_type', attendanceType);
      }
      setSelectedDays(new Set());
      fetchHistory();
    } catch (error) {
      console.error('Error bulk deleting:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectDay = (date: string) => {
    setSelectedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDays.size === historyRecords.length) {
      setSelectedDays(new Set());
    } else {
      setSelectedDays(new Set(historyRecords.map(d => d.date)));
    }
  };

  const toggleExpandDay = (date: string) => {
    setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const handleExportExcel = async () => {
    if (!currentSchool) return;
    setIsExporting(true);
    try {
      const exportData: AttendanceReportData[] = historyRecords.map(record => {
        const sessionLabel = getSessionLabel(record.reportedAt);
        return {
          date: record.date,
          session: attendanceType,
          sessionLabel,
          total: record.total,
          present: record.present,
          absent: record.absent,
          reporter: record.reporterName,
          reportTime: format(new Date(record.reportedAt), 'HH:mm dd/MM/yyyy'),
          notes: record.notes || '',
          absentStudents: record.absentStudents.map(s => ({
            name: s.name,
            className: s.className,
            excused: s.excused,
            reason: s.reason,
          })),
        };
      });

      const config = {
        schoolName: currentSchool.name,
        title: `BÁO CÁO ĐIỂM DANH ${typeLabel.toUpperCase()}`,
        dateRange: historyDateRange,
        exportTime: new Date(),
      };

      exportAttendanceReport(
        exportData,
        config,
        attendanceType
      );
    } catch (error) {
      console.error('Error exporting:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = (record: HistoryRecord) => {
    setReportToShare(record);
    setShareDialogOpen(true);
  };

  // Summary stats
  const summaryStats = useMemo(() => {
    let totalPresent = 0;
    let totalAbsent = 0;

    historyRecords.forEach(record => {
      totalPresent += record.present;
      totalAbsent += record.absent;
    });

    return { daysCount: historyRecords.length, totalPresent, totalAbsent };
  }, [historyRecords]);

  const canManageHistory = isSuperAdmin || isSchoolAdmin() || canDelete;

  return (
    <div className="space-y-4">
      {/* Filters - Compact Layout */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Loại thống kê</label>
          <Select value={historyRangeType} onValueChange={(v) => setHistoryRangeType(v as DateRangeType)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Theo ngày</SelectItem>
              <SelectItem value="week">Theo tuần</SelectItem>
              <SelectItem value="month">Theo tháng</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Thời gian</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-9 justify-start text-sm">
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {historyDateRange.label}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar 
                mode="single" 
                selected={historyDate} 
                onSelect={(d) => d && setHistoryDate(d)} 
                className="pointer-events-auto" 
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Người báo cáo</label>
          <Select value={historyReporterFilter} onValueChange={setHistoryReporterFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Tất cả" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {reporters.map((reporter) => (
                <SelectItem key={reporter.id} value={reporter.id}>{reporter.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={handleExportExcel} variant="outline" size="sm" disabled={isExporting || historyRecords.length === 0}>
          {isExporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1.5" />}
          Xuất Excel ({historyRecords.length})
        </Button>
        {canManageHistory && selectedDays.size > 0 && (
          <Button onClick={handleBulkDelete} variant="destructive" size="sm" disabled={isDeleting}>
            {isDeleting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
            Xóa {selectedDays.size} ngày
          </Button>
        )}
      </div>

      {/* Summary Stats - Compact */}
      {historyRecords.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center bg-blue-50 border-blue-100">
            <p className="text-xl font-bold text-blue-600">{summaryStats.daysCount}</p>
            <p className="text-[10px] text-muted-foreground">Ngày báo cáo</p>
          </Card>
          <Card className="p-3 text-center bg-green-50 border-green-100">
            <p className="text-xl font-bold text-green-600">{summaryStats.totalPresent}</p>
            <p className="text-[10px] text-muted-foreground">Tổng có mặt</p>
          </Card>
          <Card className="p-3 text-center bg-red-50 border-red-100">
            <p className="text-xl font-bold text-red-600">{summaryStats.totalAbsent}</p>
            <p className="text-[10px] text-muted-foreground">Tổng vắng</p>
          </Card>
        </div>
      )}

      {/* History List */}
      {isLoadingHistory ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : historyRecords.length > 0 ? (
        <div className="space-y-2">
          {/* Select All */}
          {canManageHistory && historyRecords.length > 1 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
              <Checkbox 
                checked={selectedDays.size === historyRecords.length}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-muted-foreground">
                Chọn tất cả ({historyRecords.length} ngày)
              </span>
            </div>
          )}

          {historyRecords.map((record) => {
            const isExpanded = expandedDays[record.date];
            const canEditThis = (isSuperAdmin || isSchoolAdmin() || record.reporterId === user?.id) && canEdit;
            const canDeleteThis = isSuperAdmin || isSchoolAdmin() || canDelete;

            return (
              <Collapsible key={record.date} open={isExpanded} onOpenChange={() => toggleExpandDay(record.date)}>
                <Card className="overflow-hidden border">
                  {/* Day Header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                    {canDeleteThis && (
                      <Checkbox 
                        checked={selectedDays.has(record.date)}
                        onCheckedChange={() => toggleSelectDay(record.date)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <CollapsibleTrigger className="flex-1 flex items-center justify-between hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {format(new Date(record.date), 'EEEE, dd/MM', { locale: vi })}
                          </span>
                          {isToday(new Date(record.date)) && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">Hôm nay</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(record.reportedAt), 'HH:mm')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs px-1.5">
                          {record.present}/{record.total}
                        </Badge>
                        {record.absent > 0 && (
                          <Badge variant="destructive" className="text-xs px-1.5">
                            -{record.absent}
                          </Badge>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="px-3 py-2 border-t bg-background">
                      {/* Reporter Info */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>Người báo cáo: <span className="font-medium text-foreground">{record.reporterName}</span></span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {attendanceType === 'boarding' ? detectBoardingSessionLabel(record.reportedAt) : detectStudySessionLabel(record.reportedAt)}
                          </Badge>
                          <span>{format(new Date(record.reportedAt), 'HH:mm dd/MM/yyyy', { locale: vi })}</span>
                        </div>
                      </div>

                      {/* Notes */}
                      {record.notes && (
                        <div className="text-xs text-muted-foreground mb-2 p-2 bg-muted/50 rounded">
                          <span className="font-medium">Ghi chú:</span> {record.notes}
                        </div>
                      )}

                      {/* Absent Students */}
                      {record.absentStudents.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-destructive mb-1.5">
                            Danh sách vắng ({record.absentStudents.length}):
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                            {record.absentStudents.map((student, idx) => (
                              <div 
                                key={idx}
                                className={cn(
                                  "text-xs px-2 py-1 rounded flex items-center gap-1",
                                  student.excused ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800"
                                )}
                              >
                                <span className="font-medium truncate">{student.name}</span>
                                <span className="text-[10px] opacity-70 flex-shrink-0">({student.className})</span>
                                {student.excused && (
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 ml-auto flex-shrink-0">P</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleShare(record)}>
                          <Image className="h-3.5 w-3.5 mr-1" />
                          Chia sẻ
                        </Button>
                        {canEditThis && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onEditReport(record)}>
                            <Edit3 className="h-3.5 w-3.5 mr-1" />
                            Sửa
                          </Button>
                        )}
                        {canDeleteThis && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs text-destructive hover:text-destructive ml-auto" 
                            onClick={() => handleDeleteDay(record.date)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Xóa
                          </Button>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mb-2 opacity-50" />
          <p className="text-sm">Không có dữ liệu lịch sử trong khoảng thời gian này</p>
        </div>
      )}

      {/* Share Dialog */}
      {reportToShare && (
        <ShareReportDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          report={{
            id: `${attendanceType}_${reportToShare.date}`,
            date: reportToShare.date,
            session: attendanceType,
            sessionLabel: attendanceType === 'boarding' 
              ? detectBoardingSessionLabel(reportToShare.reportedAt) 
              : detectStudySessionLabel(reportToShare.reportedAt),
            total: reportToShare.total,
            present: reportToShare.present,
            absent: reportToShare.absent,
            reporter: reportToShare.reporterName,
            time: format(new Date(reportToShare.reportedAt), 'HH:mm dd/MM/yyyy'),
            notes: reportToShare.notes || '',
            absentStudents: reportToShare.absentStudents.map(s => ({
              name: s.name,
              className: s.className,
              excused: s.excused,
              reason: s.reason,
            })),
          }}
          schoolName={currentSchool?.name || ''}
          title={`Điểm danh ${attendanceType === 'boarding' ? detectBoardingSessionLabel(reportToShare.reportedAt) : detectStudySessionLabel(reportToShare.reportedAt)}`}
        />
      )}
    </div>
  );
}
