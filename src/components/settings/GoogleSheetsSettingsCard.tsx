import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
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
  CheckCircle, 
  XCircle,
  ExternalLink,
  Info,
  Calendar,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface SheetsConfig {
  id: string;
  school_id: string;
  sheet_id: string;
  service_account_email: string | null;
  is_enabled: boolean;
  sync_meal_attendance: boolean;
  sync_evening_study: boolean;
  sync_boarding: boolean;
  sync_emulation: boolean;
  meal_sheet_name: string | null;
  evening_study_sheet_name: string | null;
  boarding_sheet_name: string | null;
  emulation_sheet_name: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
}

export function GoogleSheetsSettingsCard() {
  const { currentSchool, user } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingMonthly, setIsSyncingMonthly] = useState(false);
  const [config, setConfig] = useState<SheetsConfig | null>(null);
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);
  
  // Month selector state
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  
  // Form state
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    if (currentSchool?.id) {
      fetchConfig();
    }
  }, [currentSchool?.id]);

  const fetchConfig = async () => {
    if (!currentSchool?.id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sheets_sync_config')
        .select('*')
        .eq('school_id', currentSchool.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data);
        setServiceAccountEmail(data.service_account_email || '');
        setIsEnabled(data.is_enabled);
      }
    } catch (error: any) {
      console.error('Error fetching sheets config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentSchool?.id) return;

    setIsSaving(true);
    try {
      const configData = {
        school_id: currentSchool.id,
        sheet_id: 'monthly', // Placeholder - we create new sheets per month
        service_account_email: serviceAccountEmail.trim() || null,
        is_enabled: isEnabled,
        sync_meal_attendance: true,
        sync_evening_study: true,
        sync_boarding: true,
        sync_emulation: true,
      };

      if (config?.id) {
        const { error } = await supabase
          .from('sheets_sync_config')
          .update(configData)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sheets_sync_config')
          .insert(configData);
        if (error) throw error;
      }

      await fetchConfig();
      toast({ title: 'Thành công', description: 'Đã lưu cấu hình Google Sheets' });
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể lưu cấu hình',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateMonthlyReport = async () => {
    if (!currentSchool?.id || !user) return;

    setIsSyncingMonthly(true);
    setLastCreatedUrl(null);
    
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('Không có phiên đăng nhập');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-monthly-sheets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            school_id: currentSchool.id,
            year: selectedYear,
            month: selectedMonth,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Tạo báo cáo thất bại');
      }

      setLastCreatedUrl(result.spreadsheetUrl);
      await fetchConfig();

      toast({
        title: 'Thành công',
        description: result.message,
      });
    } catch (error: any) {
      console.error('Monthly sync error:', error);
      toast({
        title: 'Lỗi tạo báo cáo',
        description: error.message || 'Không thể tạo báo cáo tháng',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingMonthly(false);
    }
  };

  const monthOptions = [
    { value: 1, label: 'Tháng 1' },
    { value: 2, label: 'Tháng 2' },
    { value: 3, label: 'Tháng 3' },
    { value: 4, label: 'Tháng 4' },
    { value: 5, label: 'Tháng 5' },
    { value: 6, label: 'Tháng 6' },
    { value: 7, label: 'Tháng 7' },
    { value: 8, label: 'Tháng 8' },
    { value: 9, label: 'Tháng 9' },
    { value: 10, label: 'Tháng 10' },
    { value: 11, label: 'Tháng 11' },
    { value: 12, label: 'Tháng 12' },
  ];

  const yearOptions = [
    currentDate.getFullYear() - 1,
    currentDate.getFullYear(),
    currentDate.getFullYear() + 1,
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Tích hợp Google Sheets
        </CardTitle>
        <CardDescription>
          Tạo báo cáo Google Sheets theo tháng với đầy đủ thống kê bữa ăn và điểm danh
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Banner */}
        {config && (
          <div className={`p-3 rounded-lg flex items-center gap-3 ${
            config.is_enabled 
              ? 'bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800' 
              : 'bg-muted'
          }`}>
            {config.is_enabled ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">
                {config.is_enabled ? 'Tích hợp đang hoạt động' : 'Tích hợp đã tắt'}
              </p>
              {config.last_sync_at && (
                <p className="text-xs text-muted-foreground">
                  Lần cuối: {format(new Date(config.last_sync_at), 'HH:mm dd/MM/yyyy', { locale: vi })}
                  {config.last_sync_status && ` - ${config.last_sync_status}`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Create Monthly Report Section */}
        <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Tạo báo cáo tháng
          </h4>
          <p className="text-xs text-muted-foreground mb-4">
            Mỗi tháng tạo một Google Spreadsheet mới với Sheet "Toàn trường" (thống kê theo ngày) 
            và các Sheet cho từng lớp (bữa ăn + nội trú/tự học)
          </p>
          
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tháng</Label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(v) => setSelectedMonth(parseInt(v))}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(m => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Năm</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleCreateMonthlyReport} 
              disabled={isSyncingMonthly}
              size="lg"
            >
              {isSyncingMonthly ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Plus className="mr-2 h-5 w-5" />
              )}
              Tạo báo cáo ngay
            </Button>
          </div>

          {lastCreatedUrl && (
            <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800">
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                ✓ Đã tạo báo cáo thành công!
              </p>
              <Button variant="outline" size="sm" asChild>
                <a 
                  href={lastCreatedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Mở Google Sheet
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
          <div className="flex gap-2">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Cấu trúc báo cáo tháng:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>Sheet "Toàn trường"</strong>: Mỗi hàng = 1 ngày, cột = S/T/C theo lớp + tổng + gạo</li>
                <li><strong>Sheet từng lớp</strong>: Ma trận điểm danh bữa ăn (x/o) theo học sinh</li>
                <li><strong>Báo cáo nội trú/tự học</strong>: Bảng thống kê bên dưới bữa ăn trong mỗi sheet lớp</li>
              </ul>
            </div>
          </div>
        </div>

        <Separator />

        {/* Configuration */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Bật tích hợp</Label>
              <p className="text-xs text-muted-foreground">
                Cho phép sử dụng tính năng tạo báo cáo Google Sheets
              </p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="serviceAccountEmail">Service Account Email</Label>
            <Input
              id="serviceAccountEmail"
              value={serviceAccountEmail}
              onChange={(e) => setServiceAccountEmail(e.target.value)}
              placeholder="your-service-account@project.iam.gserviceaccount.com"
            />
            <p className="text-xs text-muted-foreground">
              Email Service Account dùng để xác thực với Google Sheets API
            </p>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu cấu hình
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
