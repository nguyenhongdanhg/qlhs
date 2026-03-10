import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Cloud,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

type ReportType = 'meal_attendance' | 'evening_study' | 'boarding' | 'emulation' | 'duty' | 'kitchen' | 'health';

interface ReportSpreadsheet {
  report_type: string;
  spreadsheet_id: string;
  spreadsheet_url: string | null;
  last_synced_at: string | null;
}

const REPORT_TYPES: { value: ReportType | 'all'; label: string; description: string }[] = [
  { value: 'all', label: 'Tất cả báo cáo', description: 'Đồng bộ tất cả loại báo cáo cùng lúc' },
  { value: 'meal_attendance', label: 'Báo cơm', description: 'Điểm danh bữa ăn sáng/trưa/tối' },
  { value: 'evening_study', label: 'Tự học tối', description: 'Điểm danh tự học tối' },
  { value: 'boarding', label: 'Nội trú', description: 'Điểm danh nội trú' },
  { value: 'emulation', label: 'Thi đua', description: 'Điểm thi đua các lớp' },
  { value: 'duty', label: 'Lịch trực', description: 'Phân công và thống kê lịch trực' },
  { value: 'kitchen', label: 'Kho bếp', description: 'Nhập/xuất kho bếp' },
  { value: 'health', label: 'Y tế', description: 'Báo cáo y tế hàng tháng' },
];

export function ReportSyncSettingsCard() {
  const { toast } = useToast();
  const { currentSchool } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncingType, setSyncingType] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ReportType | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [spreadsheets, setSpreadsheets] = useState<ReportSpreadsheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentSchool?.id) fetchSpreadsheets();
  }, [currentSchool?.id]);

  const fetchSpreadsheets = async () => {
    if (!currentSchool?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('report_spreadsheets')
        .select('report_type, spreadsheet_id, spreadsheet_url, last_synced_at')
        .eq('school_id', currentSchool.id);
      if (error) throw error;
      setSpreadsheets((data as any[]) || []);
    } catch (err) {
      console.error('Error fetching spreadsheets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (reportType?: ReportType | 'all') => {
    if (!currentSchool?.id) return;
    const type = reportType || selectedType;
    setSyncing(true);
    setSyncingType(type);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Chưa đăng nhập');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/sync-report-sheets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            school_id: currentSchool.id,
            report_type: type,
            year: selectedYear,
            month: selectedMonth,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Đồng bộ thất bại');

      toast({
        title: 'Đồng bộ thành công',
        description: result.message || `Đã đồng bộ ${result.results?.length || 0} loại báo cáo lên Google Sheets`,
      });

      await fetchSpreadsheets();
    } catch (err: any) {
      console.error('Sync error:', err);
      toast({
        title: 'Lỗi đồng bộ',
        description: err.message || 'Không thể đồng bộ lên Google Sheets',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
      setSyncingType(null);
    }
  };

  const getReportLabel = (type: string) => {
    const found = REPORT_TYPES.find(r => r.value === type);
    return found?.label || type;
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-blue-500" />
          Đồng bộ báo cáo Google Sheets
        </CardTitle>
        <CardDescription>
          Mỗi loại báo cáo sẽ được lưu thành 1 file Google Sheets riêng trong thư mục "Nội trú bán trú"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Sync controls */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Loại báo cáo</label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as ReportType | 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map(rt => (
                    <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tháng</label>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m} value={String(m)}>Tháng {m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Năm</label>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={() => handleSync()} 
            disabled={syncing}
            className="w-full gap-2"
          >
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang đồng bộ {syncingType === 'all' ? 'tất cả' : getReportLabel(syncingType || '')}...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Đồng bộ ngay
              </>
            )}
          </Button>
        </div>

        {/* Spreadsheet links */}
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Đang tải...
          </div>
        ) : spreadsheets.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Các file đã đồng bộ</h4>
            <div className="divide-y rounded-lg border">
              {spreadsheets.map((ss) => (
                <div key={ss.report_type} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />
                    <div>
                      <div className="text-sm font-medium">{getReportLabel(ss.report_type)}</div>
                      {ss.last_synced_at && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(ss.last_synced_at), 'HH:mm dd/MM/yyyy', { locale: vi })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={syncing}
                      onClick={() => handleSync(ss.report_type as ReportType)}
                      className="h-8 px-2"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncing && syncingType === ss.report_type ? 'animate-spin' : ''}`} />
                    </Button>
                    {ss.spreadsheet_url && (
                      <Button variant="outline" size="sm" asChild className="h-8 gap-1">
                        <a href={ss.spreadsheet_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Mở
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            Chưa có file nào được đồng bộ. Nhấn "Đồng bộ ngay" để bắt đầu.
          </div>
        )}

        {/* Info */}
        <div className="rounded-lg border border-info/30 bg-info/5 p-3 text-xs text-info space-y-1">
          <div className="font-medium">Thông tin:</div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Mỗi loại báo cáo tạo 1 file Google Sheets riêng biệt</li>
            <li>Tất cả file nằm trong thư mục "Nội trú bán trú" trên Google Drive</li>
            <li>Đồng bộ lại sẽ cập nhật dữ liệu mới nhất vào file đã tạo</li>
            <li>Cần cấu hình Google Service Account trong phần Google Sheets bên trên</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
