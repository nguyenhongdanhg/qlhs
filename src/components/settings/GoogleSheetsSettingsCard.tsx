import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
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
  CheckCircle, 
  XCircle,
  ExternalLink,
  Info,
  Calendar,
  Plus,
  Key,
  FolderOpen,
  Eye,
  EyeOff,
  Shield,
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
  google_service_account_key: string | null;
  google_drive_folder_id: string | null;
}

export function GoogleSheetsSettingsCard() {
  const { currentSchool, user } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingMonthly, setIsSyncingMonthly] = useState(false);
  const [config, setConfig] = useState<SheetsConfig | null>(null);
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);
  const [showServiceKey, setShowServiceKey] = useState(false);
  
  // Month selector state
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  
  // Form state
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [serviceAccountKey, setServiceAccountKey] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');

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
        const configData = data as any;
        setConfig(configData);
        setServiceAccountEmail(configData.service_account_email || '');
        setIsEnabled(configData.is_enabled);
        setServiceAccountKey(configData.google_service_account_key || '');
        setDriveFolderId(configData.google_drive_folder_id || '');
      }
    } catch (error: any) {
      console.error('Error fetching sheets config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-extract email from service account key JSON
  const handleServiceKeyChange = (value: string) => {
    setServiceAccountKey(value);
    try {
      const parsed = JSON.parse(value);
      if (parsed.client_email) {
        setServiceAccountEmail(parsed.client_email);
      }
    } catch {
      // Not valid JSON yet, ignore
    }
  };

  const handleSave = async () => {
    if (!currentSchool?.id) return;

    setIsSaving(true);
    try {
      const configData: Record<string, any> = {
        school_id: currentSchool.id,
        sheet_id: 'monthly',
        service_account_email: serviceAccountEmail.trim() || null,
        is_enabled: isEnabled,
        sync_meal_attendance: true,
        sync_evening_study: true,
        sync_boarding: true,
        sync_emulation: true,
        google_service_account_key: serviceAccountKey.trim() || null,
        google_drive_folder_id: driveFolderId.trim() || null,
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
      toast({ title: 'Thành công', description: 'Đã lưu cấu hình Google Drive' });
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

  const isConfigured = serviceAccountKey.trim() && driveFolderId.trim();

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
          Cấu hình tài khoản Google Drive và tạo báo cáo Google Sheets tự động
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Banner */}
        {config && (
          <div className={`p-3 rounded-lg flex items-center gap-3 ${
            config.is_enabled && isConfigured
              ? 'bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800' 
              : 'bg-muted'
          }`}>
            {config.is_enabled && isConfigured ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">
                {config.is_enabled && isConfigured 
                  ? 'Tích hợp đang hoạt động' 
                  : !isConfigured 
                    ? 'Chưa cấu hình tài khoản Google Drive'
                    : 'Tích hợp đã tắt'}
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

        {/* Google Drive Account Configuration */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            Cấu hình tài khoản Google Drive
          </h4>

          <div className="grid gap-4">
            {/* Service Account Key */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="serviceAccountKey" className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  Service Account Key (JSON)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setShowServiceKey(!showServiceKey)}
                >
                  {showServiceKey ? (
                    <><EyeOff className="h-3.5 w-3.5 mr-1" /> Ẩn</>
                  ) : (
                    <><Eye className="h-3.5 w-3.5 mr-1" /> Hiện</>
                  )}
                </Button>
              </div>
              {showServiceKey ? (
                <Textarea
                  id="serviceAccountKey"
                  value={serviceAccountKey}
                  onChange={(e) => handleServiceKeyChange(e.target.value)}
                  placeholder='Dán nội dung file JSON Service Account vào đây...'
                  className="font-mono text-xs min-h-[120px]"
                />
              ) : (
                <div 
                  className="flex items-center gap-2 p-3 rounded-md border bg-background cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setShowServiceKey(true)}
                >
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {serviceAccountKey ? '••••••• (đã cấu hình - nhấn Hiện để xem)' : 'Nhấn để nhập Service Account Key'}
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Tải file JSON từ Google Cloud Console → IAM → Service Accounts → Keys
              </p>
            </div>

            {/* Service Account Email (auto-filled) */}
            <div className="grid gap-2">
              <Label htmlFor="serviceAccountEmail">Service Account Email</Label>
              <Input
                id="serviceAccountEmail"
                value={serviceAccountEmail}
                onChange={(e) => setServiceAccountEmail(e.target.value)}
                placeholder="your-service-account@project.iam.gserviceaccount.com"
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Tự động điền khi dán JSON key. Cần chia sẻ thư mục Google Drive với email này.
              </p>
            </div>

            {/* Google Drive Folder ID */}
            <div className="grid gap-2">
              <Label htmlFor="driveFolderId" className="flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                Google Drive Folder ID
              </Label>
              <Input
                id="driveFolderId"
                value={driveFolderId}
                onChange={(e) => setDriveFolderId(e.target.value)}
                placeholder="1ABCdef..."
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                ID thư mục gốc trên Google Drive. Lấy từ URL: drive.google.com/drive/folders/<strong>ID_ở_đây</strong>
              </p>
            </div>

            {/* Enable toggle */}
            <div className="flex items-center justify-between pt-1">
              <div className="space-y-0.5">
                <Label>Bật tích hợp</Label>
                <p className="text-xs text-muted-foreground">
                  Cho phép sử dụng tính năng tạo báo cáo Google Sheets
                </p>
              </div>
              <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
            </div>
          </div>
        </div>

        {/* Hướng dẫn cấu hình */}
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
          <div className="flex gap-2">
            <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium mb-1">Hướng dẫn cấu hình:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Vào <strong>Google Cloud Console</strong> → Tạo Service Account</li>
                <li>Tạo Key (JSON) cho Service Account → Tải về</li>
                <li>Bật <strong>Google Sheets API</strong> và <strong>Google Drive API</strong> trong project</li>
                <li>Dán nội dung file JSON vào ô "Service Account Key" ở trên</li>
                <li>Tạo thư mục trên Google Drive → Copy Folder ID từ URL</li>
                <li>Chia sẻ thư mục đó với email Service Account (quyền <strong>Editor</strong>)</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Save button */}
        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Lưu cấu hình
        </Button>

        <Separator />

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
              disabled={isSyncingMonthly || !isConfigured}
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

          {!isConfigured && (
            <p className="text-xs text-destructive mt-2">
              Vui lòng cấu hình Service Account Key và Folder ID trước khi tạo báo cáo.
            </p>
          )}

          {lastCreatedUrl && (
            <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800">
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                ✓ Đã tạo các sheet báo cáo thành công!
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
      </CardContent>
    </Card>
  );
}
