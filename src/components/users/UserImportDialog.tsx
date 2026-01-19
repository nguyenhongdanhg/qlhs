import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Loader2, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface UserImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface UserImportRow {
  stt: number;
  full_name: string;
  position: string;
  class_teacher: string;
  phone: string;
  password: string;
  email: string;
  isValid: boolean;
  error?: string;
}

const USER_IMPORT_COLUMNS = [
  'STT',
  'Họ và tên',
  'Chức vụ',
  'GVCN Lớp',
  'Số điện thoại',
  'Mật khẩu',
  'Email',
];

const POSITION_ROLE_MAP: Record<string, string> = {
  'quản trị': 'admin',
  'quản trị viên': 'admin',
  'admin': 'admin',
  'giáo viên': 'teacher',
  'gv': 'teacher',
  'teacher': 'teacher',
  'giáo viên chủ nhiệm': 'class_teacher',
  'gvcn': 'class_teacher',
  'class_teacher': 'class_teacher',
  'kế toán': 'accountant',
  'kt': 'accountant',
  'accountant': 'accountant',
  'nhà bếp': 'kitchen',
  'bếp': 'kitchen',
  'kitchen': 'kitchen',
};

export default function UserImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: UserImportDialogProps) {
  const { currentSchool } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importData, setImportData] = useState<UserImportRow[]>([]);
  const [importStep, setImportStep] = useState<'upload' | 'preview'>('upload');

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      USER_IMPORT_COLUMNS,
      [1, 'Nguyễn Văn A', 'Giáo viên chủ nhiệm', '10A1', '0901234567', '123456', 'a.nguyen@school.edu.vn'],
      [2, 'Trần Thị B', 'Giáo viên', '', '0901234568', '123456', 'b.tran@school.edu.vn'],
      [3, 'Lê Văn C', 'Kế toán', '', '0901234569', '123456', 'c.le@school.edu.vn'],
      [4, 'Phạm Thị D', 'Nhà bếp', '', '0901234570', '123456', 'd.pham@school.edu.vn'],
    ]);

    ws['!cols'] = [
      { wch: 5 },  // STT
      { wch: 25 }, // Họ và tên
      { wch: 20 }, // Chức vụ
      { wch: 12 }, // GVCN Lớp
      { wch: 15 }, // Số điện thoại
      { wch: 12 }, // Mật khẩu
      { wch: 30 }, // Email
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách tài khoản');

    XLSX.writeFile(wb, 'mau-nhap-tai-khoan.xlsx');
    toast({ title: 'Đã tải mẫu Excel' });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const data = await parseUserImportFile(file);
      setImportData(data);
      setImportStep('preview');
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const parseUserImportFile = (file: File): Promise<UserImportRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          const users: UserImportRow[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row[1]) continue; // Skip empty rows

            const full_name = String(row[1] || '').trim();
            const position = String(row[2] || '').trim();
            const class_teacher = String(row[3] || '').trim();
            const phone = String(row[4] || '').trim();
            const password = String(row[5] || '').trim();
            const email = String(row[6] || '').trim();

            let isValid = true;
            let error = '';

            // Validate required fields
            if (!full_name) {
              isValid = false;
              error = 'Thiếu họ tên';
            } else if (!phone && !email) {
              isValid = false;
              error = 'Cần có SĐT hoặc email';
            } else if (!password || password.length < 6) {
              isValid = false;
              error = 'Mật khẩu phải >= 6 ký tự';
            } else if (!position || !POSITION_ROLE_MAP[position.toLowerCase()]) {
              isValid = false;
              error = 'Chức vụ không hợp lệ';
            }

            users.push({
              stt: row[0] || i,
              full_name,
              position,
              class_teacher,
              phone,
              password,
              email,
              isValid,
              error,
            });
          }

          resolve(users);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Helper function to delay between requests
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleImport = async () => {
    if (!currentSchool) return;

    const validUsers = importData.filter((u) => u.isValid);
    if (validUsers.length === 0) {
      toast({
        title: 'Không có dữ liệu hợp lệ',
        description: 'Vui lòng kiểm tra lại file Excel',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    try {
      // Process users sequentially with delay to avoid rate limiting
      for (let i = 0; i < validUsers.length; i++) {
        const user = validUsers[i];
        
        try {
          // Create auth user with email or phone-based email
          const authEmail = user.email || `${user.phone}@phone.local`;
          
          let authData = null;
          let retryCount = 0;
          const maxRetries = 3;

          // Retry logic for rate limiting
          while (retryCount < maxRetries) {
            const { data, error: authError } = await supabase.auth.signUp({
              email: authEmail,
              password: user.password,
              options: {
                emailRedirectTo: `${window.location.origin}/`,
                data: {
                  full_name: user.full_name,
                },
              },
            });

            if (authError) {
              if (authError.status === 429) {
                // Rate limited - wait longer and retry
                retryCount++;
                console.log(`Rate limited for ${user.full_name}, waiting... (retry ${retryCount}/${maxRetries})`);
                await delay(2000 * retryCount); // Exponential backoff
                continue;
              } else if (authError.message === 'User already registered') {
                // User exists, skip but don't count as error
                errors.push(`${user.full_name}: Tài khoản đã tồn tại`);
                failCount++;
                break;
              } else {
                throw authError;
              }
            }

            authData = data;
            break;
          }

          if (!authData?.user) {
            if (retryCount >= maxRetries) {
              errors.push(`${user.full_name}: Quá nhiều yêu cầu, vui lòng thử lại sau`);
              failCount++;
            }
            continue;
          }

          // Update profile with phone
          await supabase.from('profiles').update({
            full_name: user.full_name,
            phone: user.phone || null,
            username: user.phone || user.email.split('@')[0],
          }).eq('id', authData.user.id);

          // Create school membership
          const role = POSITION_ROLE_MAP[user.position.toLowerCase()] || 'teacher';
          await supabase.from('school_memberships').insert({
            school_id: currentSchool.id,
            user_id: authData.user.id,
            role: role as any,
            class_id: role === 'class_teacher' ? user.class_teacher || null : null,
            status: 'active',
          });

          successCount++;

          // Add delay between requests to avoid rate limiting (500ms)
          if (i < validUsers.length - 1) {
            await delay(500);
          }
        } catch (error: any) {
          console.error('Error creating user:', user.full_name, error);
          errors.push(`${user.full_name}: ${error.message || 'Lỗi không xác định'}`);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Hoàn thành',
          description: `Đã tạo ${successCount} tài khoản${failCount > 0 ? `, ${failCount} thất bại` : ''}`,
        });
        onImportComplete();
      }

      if (failCount > 0 && errors.length > 0) {
        console.log('Import errors:', errors);
        toast({
          title: `${failCount} tài khoản thất bại`,
          description: errors.slice(0, 3).join('; ') + (errors.length > 3 ? `... và ${errors.length - 3} lỗi khác` : ''),
          variant: 'destructive',
        });
      }

      if (successCount > 0) {
        onOpenChange(false);
        setImportStep('upload');
        setImportData([]);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Lỗi',
        description: 'Có lỗi xảy ra khi nhập tài khoản',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = importData.filter((u) => u.isValid).length;
  const invalidCount = importData.length - validCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Nhập tài khoản từ Excel
          </DialogTitle>
          <DialogDescription>
            Tải mẫu Excel, điền thông tin và upload để tạo tài khoản hàng loạt
          </DialogDescription>
        </DialogHeader>

        {importStep === 'upload' ? (
          <div className="space-y-6 py-4">
            <div className="rounded-lg border-2 border-dashed p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Upload file Excel</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Hỗ trợ định dạng .xlsx, .xls
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <Button variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Tải mẫu Excel
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Chọn file
                </Button>
              </div>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-medium mb-2">Hướng dẫn:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Họ và tên:</strong> Bắt buộc</li>
                <li>• <strong>Chức vụ:</strong> Quản trị / Giáo viên / GVCN / Kế toán / Nhà bếp</li>
                <li>• <strong>GVCN Lớp:</strong> Chỉ điền nếu là Giáo viên chủ nhiệm</li>
                <li>• <strong>Số điện thoại:</strong> Dùng để đăng nhập</li>
                <li>• <strong>Mật khẩu:</strong> Tối thiểu 6 ký tự</li>
                <li>• <strong>Email:</strong> Tùy chọn</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  {validCount} hợp lệ
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {invalidCount} lỗi
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportStep('upload');
                  setImportData([]);
                }}
              >
                Chọn file khác
              </Button>
            </div>

            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">STT</TableHead>
                    <TableHead>Họ và tên</TableHead>
                    <TableHead>Chức vụ</TableHead>
                    <TableHead>Lớp CN</TableHead>
                    <TableHead>Điện thoại</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[100px]">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.map((user, index) => (
                    <TableRow
                      key={index}
                      className={!user.isValid ? 'bg-destructive/10' : ''}
                    >
                      <TableCell>{user.stt}</TableCell>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.position}</TableCell>
                      <TableCell>{user.class_teacher || '-'}</TableCell>
                      <TableCell>{user.phone || '-'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{user.email || '-'}</TableCell>
                      <TableCell>
                        {user.isValid ? (
                          <Badge variant="secondary" className="bg-success/10 text-success">
                            Hợp lệ
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            {user.error}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          {importStep === 'preview' && (
            <Button onClick={handleImport} disabled={isImporting || validCount === 0}>
              {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Nhập {validCount} tài khoản
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
