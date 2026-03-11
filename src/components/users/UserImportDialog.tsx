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
import { Loader2, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import XLSX from 'xlsx-js-style';

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
  'ban giám hiệu': 'board',
  'bgh': 'board',
  'board': 'board',
  'nhân viên': 'staff',
  'nv': 'staff',
  'staff': 'staff',
};

const VALID_POSITIONS = 'Quản trị, Giáo viên, GVCN, Kế toán, Nhà bếp, Ban giám hiệu, Nhân viên';

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
  const [importResults, setImportResults] = useState<string[]>([]);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

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
              error = 'Thiếu họ và tên';
            } else if (!phone && !email) {
              isValid = false;
              error = 'Cần có số điện thoại hoặc email';
            } else if (phone && !/^0\d{9,10}$/.test(phone.replace(/\s/g, ''))) {
              isValid = false;
              error = 'Số điện thoại không hợp lệ (phải bắt đầu bằng 0, 10-11 số)';
            } else if (!password) {
              isValid = false;
              error = 'Thiếu mật khẩu';
            } else if (password.length < 6) {
              isValid = false;
              error = 'Mật khẩu phải có ít nhất 6 ký tự';
            } else if (!position) {
              isValid = false;
              error = 'Thiếu chức vụ';
            } else if (!POSITION_ROLE_MAP[position.toLowerCase()]) {
              isValid = false;
              error = `Chức vụ "${position}" không hợp lệ. Hợp lệ: ${VALID_POSITIONS}`;
            } else if (POSITION_ROLE_MAP[position.toLowerCase()] === 'class_teacher' && !class_teacher) {
              isValid = false;
              error = 'GVCN phải điền tên lớp chủ nhiệm';
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
    setImportResults([]);
    let successCount = 0;
    let failCount = 0;
    const failedUsers: string[] = [];

    try {
      for (const user of validUsers) {
        try {
          const authEmail = user.email || `${user.phone}@phone.local`;
          const role = POSITION_ROLE_MAP[user.position.toLowerCase()] || 'teacher';
          
          const { data, error } = await supabase.functions.invoke('create-user', {
            body: {
              email: authEmail,
              password: user.password,
              full_name: user.full_name,
              phone: user.phone || null,
              school_id: currentSchool.id,
              role: role,
              class_id: role === 'class_teacher' ? user.class_teacher || null : null,
            },
          });

          if (error) {
            console.error('Error creating user:', user.full_name, error);
            failedUsers.push(`Dòng ${user.stt} - ${user.full_name}: ${translateUserError(error.message)}`);
            failCount++;
            continue;
          }

          if (data?.error) {
            console.error('API error creating user:', user.full_name, data.error);
            if (data.code !== 'USER_EXISTS') {
              failedUsers.push(`Dòng ${user.stt} - ${user.full_name}: ${translateUserError(data.error)}`);
              failCount++;
            } else {
              successCount++;
            }
            continue;
          }

          successCount++;
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error: unknown) {
          console.error('Error creating user:', user.full_name, error);
          const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
          failedUsers.push(`Dòng ${user.stt} - ${user.full_name}: ${translateUserError(errorMessage)}`);
          failCount++;
        }
      }

      if (failedUsers.length > 0) {
        setImportResults(failedUsers);
      }

      toast({
        title: failCount === 0 ? 'Hoàn thành' : 'Hoàn thành (có lỗi)',
        description: `Đã tạo ${successCount} tài khoản${failCount > 0 ? `, ${failCount} thất bại` : ''}`,
        variant: failCount > 0 ? 'destructive' : 'default',
      });

      if (failCount === 0) {
        onOpenChange(false);
        setImportStep('upload');
        setImportData([]);
        setImportResults([]);
        onImportComplete();
      } else {
        onImportComplete();
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Nhập tài khoản từ Excel
          </DialogTitle>
          <DialogDescription>
            Tải mẫu Excel, điền thông tin và upload để tạo tài khoản hàng loạt
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
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
                  <li>• <strong>Chức vụ:</strong> {VALID_POSITIONS}</li>
                  <li>• <strong>GVCN Lớp:</strong> Chỉ điền nếu là Giáo viên chủ nhiệm</li>
                  <li>• <strong>Số điện thoại:</strong> Dùng để đăng nhập (bắt đầu bằng 0)</li>
                  <li>• <strong>Mật khẩu:</strong> Tối thiểu 6 ký tự</li>
                  <li>• <strong>Email:</strong> Tùy chọn</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4 h-full flex flex-col">
              {/* Import result errors */}
              {importResults.length > 0 && (
                <div className="rounded-lg border border-destructive bg-destructive/10 p-3 space-y-1 flex-shrink-0">
                  <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                    <AlertCircle className="h-4 w-4" />
                    Chi tiết lỗi khi tạo tài khoản:
                  </div>
                  <ScrollArea className="max-h-[120px]">
                    {importResults.map((err, i) => (
                      <p key={i} className="text-sm text-destructive ml-6">• {err}</p>
                    ))}
                  </ScrollArea>
                </div>
              )}

              <div className="flex items-center justify-between flex-shrink-0">
                <div className="flex gap-4">
                   <Badge variant="secondary" className="flex items-center gap-1">
                     <CheckCircle2 className="h-3 w-3 text-success" />
                     {validCount} hợp lệ
                   </Badge>
                   {invalidCount > 0 && (
                     <Badge 
                       variant="destructive" 
                       className="flex items-center gap-1 cursor-pointer hover:bg-destructive/90 transition-colors"
                       onClick={() => setShowErrorDetails(!showErrorDetails)}
                     >
                       <AlertCircle className="h-3 w-3" />
                       {invalidCount} lỗi
                       {showErrorDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                     </Badge>
                   )}
                 </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportStep('upload');
                    setImportData([]);
                    setImportResults([]);
                  }}
                >
                  Chọn file khác
                </Button>
              </div>

              {/* Collapsible error details */}
              {invalidCount > 0 && showErrorDetails && (
                <div className="border border-destructive/30 bg-destructive/5 rounded-md p-3">
                  <p className="text-sm font-medium text-destructive mb-2">Chi tiết {invalidCount} dòng lỗi:</p>
                  <ScrollArea className="max-h-[120px]">
                    <ul className="space-y-1">
                      {importData.filter(u => !u.isValid).map((user, i) => (
                        <li key={i} className="text-xs text-destructive flex gap-1">
                          <span className="font-semibold whitespace-nowrap">Dòng {user.stt} - {user.full_name || '(trống)'}:</span>
                          <span>{user.error}</span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}

              <ScrollArea className="flex-1 min-h-0 max-h-[50vh] rounded-md border">
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
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
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

function translateUserError(msg: string): string {
  if (msg.includes('already been registered') || msg.includes('already exists')) return 'Email hoặc SĐT đã được đăng ký trước đó';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Quá nhiều yêu cầu, vui lòng thử lại sau';
  if (msg.includes('invalid email')) return 'Định dạng email không hợp lệ';
  if (msg.includes('password')) return 'Mật khẩu không đáp ứng yêu cầu (tối thiểu 6 ký tự)';
  if (msg.includes('permission') || msg.includes('unauthorized') || msg.includes('403')) return 'Bạn không có quyền tạo tài khoản';
  if (msg.includes('timeout') || msg.includes('TIMEOUT')) return 'Quá thời gian xử lý, thử lại sau';
  if (msg.includes('network') || msg.includes('fetch')) return 'Lỗi kết nối mạng';
  return msg;
}
