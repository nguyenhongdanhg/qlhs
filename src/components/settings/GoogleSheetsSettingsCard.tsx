import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  FileSpreadsheet, 
  Loader2, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  Info
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
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [config, setConfig] = useState<SheetsConfig | null>(null);
  
  // Form state
  const [sheetId, setSheetId] = useState('');
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [syncMealAttendance, setSyncMealAttendance] = useState(true);
  const [syncEveningStudy, setSyncEveningStudy] = useState(true);
  const [syncBoarding, setSyncBoarding] = useState(true);
  const [syncEmulation, setSyncEmulation] = useState(true);
  const [mealSheetName, setMealSheetName] = useState('Điểm danh bữa ăn');
  const [eveningStudySheetName, setEveningStudySheetName] = useState('Tự học tối');
  const [boardingSheetName, setBoardingSheetName] = useState('Nội trú');
  const [emulationSheetName, setEmulationSheetName] = useState('Thi đua');

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
        setSheetId(data.sheet_id || '');
        setServiceAccountEmail(data.service_account_email || '');
        setIsEnabled(data.is_enabled);
        setSyncMealAttendance(data.sync_meal_attendance);
        setSyncEveningStudy(data.sync_evening_study);
        setSyncBoarding(data.sync_boarding);
        setSyncEmulation(data.sync_emulation);
        setMealSheetName(data.meal_sheet_name || 'Điểm danh bữa ăn');
        setEveningStudySheetName(data.evening_study_sheet_name || 'Tự học tối');
        setBoardingSheetName(data.boarding_sheet_name || 'Nội trú');
        setEmulationSheetName(data.emulation_sheet_name || 'Thi đua');
      }
    } catch (error: any) {
      console.error('Error fetching sheets config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentSchool?.id) return;
    
    if (!sheetId.trim()) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập Google Sheet ID',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const configData = {
        school_id: currentSchool.id,
        sheet_id: sheetId.trim(),
        service_account_email: serviceAccountEmail.trim() || null,
        is_enabled: isEnabled,
        sync_meal_attendance: syncMealAttendance,
        sync_evening_study: syncEveningStudy,
        sync_boarding: syncBoarding,
        sync_emulation: syncEmulation,
        meal_sheet_name: mealSheetName.trim() || 'Điểm danh bữa ăn',
        evening_study_sheet_name: eveningStudySheetName.trim() || 'Tự học tối',
        boarding_sheet_name: boardingSheetName.trim() || 'Nội trú',
        emulation_sheet_name: emulationSheetName.trim() || 'Thi đua',
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

  const handleManualSync = async (dataType: 'meal_attendance' | 'evening_study' | 'boarding' | 'emulation') => {
    if (!currentSchool?.id || !user) return;

    setIsSyncing(dataType);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('Không có phiên đăng nhập');
      }

      const sheetNameMap: Record<string, string> = {
        meal_attendance: mealSheetName,
        evening_study: eveningStudySheetName,
        boarding: boardingSheetName,
        emulation: emulationSheetName,
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-to-sheets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            school_id: currentSchool.id,
            data_type: dataType,
            sheet_name: sheetNameMap[dataType],
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Đồng bộ thất bại');
      }

      // Update last sync status
      if (config?.id) {
        await supabase
          .from('sheets_sync_config')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: `Đã đồng bộ ${dataType}: ${result.rows} dòng`,
          })
          .eq('id', config.id);
        await fetchConfig();
      }

      toast({
        title: 'Thành công',
        description: `Đã đồng bộ ${result.rows} dòng dữ liệu lên Google Sheets`,
      });
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: 'Lỗi đồng bộ',
        description: error.message || 'Không thể đồng bộ dữ liệu',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(null);
    }
  };

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

  const dataTypeLabels: Record<string, string> = {
    meal_attendance: 'Bữa ăn',
    evening_study: 'Tự học tối',
    boarding: 'Nội trú',
    emulation: 'Thi đua',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Tích hợp Google Sheets
        </CardTitle>
        <CardDescription>
          Tự động đồng bộ dữ liệu điểm danh và thi đua lên Google Sheets
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
                {config.is_enabled ? 'Đồng bộ đang hoạt động' : 'Đồng bộ đã tắt'}
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

        {/* Info Box */}
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
          <div className="flex gap-2">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Hướng dẫn cấu hình:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Tạo Google Sheet mới hoặc sử dụng Sheet có sẵn</li>
                <li>Lấy Sheet ID từ URL (phần giữa /d/ và /edit)</li>
                <li>Chia sẻ Sheet với email Service Account với quyền Editor</li>
                <li>Tạo các trang tính (tabs) tương ứng với tên bên dưới</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Bật đồng bộ tự động</Label>
            <p className="text-xs text-muted-foreground">
              Tự động đẩy dữ liệu lên Google Sheets theo lịch
            </p>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>

        <Separator />

        {/* Sheet Configuration */}
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="sheetId">Google Sheet ID *</Label>
            <Input
              id="sheetId"
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
            />
            <p className="text-xs text-muted-foreground">
              Lấy từ URL của Google Sheet: docs.google.com/spreadsheets/d/<strong>[SHEET_ID]</strong>/edit
            </p>
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
              Email này cần được chia sẻ quyền Editor trên Google Sheet
            </p>
          </div>
        </div>

        <Separator />

        {/* Sync Options */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Loại dữ liệu đồng bộ</h4>
          
          <div className="grid gap-4">
            {/* Meal Attendance */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Switch 
                  checked={syncMealAttendance} 
                  onCheckedChange={setSyncMealAttendance}
                />
                <div>
                  <Label className="cursor-pointer">Điểm danh bữa ăn</Label>
                  <Input
                    value={mealSheetName}
                    onChange={(e) => setMealSheetName(e.target.value)}
                    placeholder="Tên trang tính"
                    className="mt-1 h-8 text-xs w-48"
                    disabled={!syncMealAttendance}
                  />
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleManualSync('meal_attendance')}
                disabled={!config || isSyncing !== null}
              >
                {isSyncing === 'meal_attendance' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Evening Study */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Switch 
                  checked={syncEveningStudy} 
                  onCheckedChange={setSyncEveningStudy}
                />
                <div>
                  <Label className="cursor-pointer">Điểm danh tự học tối</Label>
                  <Input
                    value={eveningStudySheetName}
                    onChange={(e) => setEveningStudySheetName(e.target.value)}
                    placeholder="Tên trang tính"
                    className="mt-1 h-8 text-xs w-48"
                    disabled={!syncEveningStudy}
                  />
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleManualSync('evening_study')}
                disabled={!config || isSyncing !== null}
              >
                {isSyncing === 'evening_study' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Boarding */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Switch 
                  checked={syncBoarding} 
                  onCheckedChange={setSyncBoarding}
                />
                <div>
                  <Label className="cursor-pointer">Điểm danh nội trú</Label>
                  <Input
                    value={boardingSheetName}
                    onChange={(e) => setBoardingSheetName(e.target.value)}
                    placeholder="Tên trang tính"
                    className="mt-1 h-8 text-xs w-48"
                    disabled={!syncBoarding}
                  />
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleManualSync('boarding')}
                disabled={!config || isSyncing !== null}
              >
                {isSyncing === 'boarding' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Emulation */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Switch 
                  checked={syncEmulation} 
                  onCheckedChange={setSyncEmulation}
                />
                <div>
                  <Label className="cursor-pointer">Điểm thi đua</Label>
                  <Input
                    value={emulationSheetName}
                    onChange={(e) => setEmulationSheetName(e.target.value)}
                    placeholder="Tên trang tính"
                    className="mt-1 h-8 text-xs w-48"
                    disabled={!syncEmulation}
                  />
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleManualSync('emulation')}
                disabled={!config || isSyncing !== null}
              >
                {isSyncing === 'emulation' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu cấu hình
          </Button>
          
          {sheetId && (
            <Button variant="outline" asChild>
              <a 
                href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Mở Google Sheet
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
