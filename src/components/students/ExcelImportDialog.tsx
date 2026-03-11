import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  parseStudentImportFile, 
  generateStudentTemplate, 
  downloadBlob,
  StudentImportRow 
} from '@/lib/excel-utils';
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface ImportRowError {
  stt: number;
  full_name: string;
  error: string;
}

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (students: StudentImportRow[]) => Promise<ImportRowError[]>;
}

export function ExcelImportDialog({ open, onOpenChange, onImport }: ExcelImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parsedData, setParsedData] = useState<StudentImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [rowErrors, setRowErrors] = useState<ImportRowError[]>([]);

  const validCount = parsedData.filter(r => r.isValid).length;
  const invalidCount = parsedData.length - validCount;

  const handleDownloadTemplate = () => {
    const blob = generateStudentTemplate();
    downloadBlob(blob, 'mau-nhap-hoc-sinh.xlsx');
    toast({ title: 'Thành công', description: 'Đã tải mẫu nhập học sinh' });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setFileName(file.name);
    setImportErrors([]);
    setRowErrors([]);

    try {
      const data = await parseStudentImportFile(file);
      setParsedData(data);
      const invalid = data.filter(r => !r.isValid);
      if (invalid.length > 0) {
        toast({ 
          title: `Phát hiện ${invalid.length} dòng lỗi`, 
          description: 'Kiểm tra bảng xem trước để xem chi tiết',
          variant: 'destructive'
        });
      } else {
        toast({ 
          title: 'Đọc file thành công', 
          description: `Tìm thấy ${data.length} học sinh hợp lệ` 
        });
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({ 
        title: 'Lỗi', 
        description: 'Không thể đọc file. Vui lòng kiểm tra định dạng (chỉ hỗ trợ .xlsx, .xls).', 
        variant: 'destructive' 
      });
      setParsedData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    const validData = parsedData.filter(r => r.isValid);
    if (validData.length === 0) return;

    setIsImporting(true);
    setImportErrors([]);
    setRowErrors([]);
    try {
      const errors = await onImport(validData);
      if (errors.length > 0) {
        setRowErrors(errors);
        // Mark failed rows in parsedData
        const failedStts = new Set(errors.map(e => e.stt));
        setParsedData(prev => prev.map(row => {
          if (failedStts.has(row.stt)) {
            const rowErr = errors.find(e => e.stt === row.stt);
            return { ...row, isValid: false, errors: [rowErr?.error || 'Lỗi không xác định'] };
          }
          return row;
        }));
        const successCount = validData.length - errors.length;
        toast({ 
          title: `Nhập xong: ${successCount} thành công, ${errors.length} lỗi`, 
          description: 'Xem chi tiết lỗi ở bảng bên dưới',
          variant: 'destructive' 
        });
      } else {
        toast({ 
          title: 'Nhập thành công', 
          description: `Đã nhập ${validData.length} học sinh` 
        });
        handleClose();
      }
    } catch (error: any) {
      const msg = error.message || 'Không thể nhập học sinh';
      const vietnameseError = translateError(msg);
      setImportErrors([vietnameseError]);
      toast({ 
        title: 'Lỗi nhập dữ liệu', 
        description: vietnameseError, 
        variant: 'destructive' 
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setParsedData([]);
    setFileName('');
    setImportErrors([]);
    setRowErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  const failedStts = new Set(rowErrors.map(e => e.stt));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Nhập học sinh từ Excel
          </DialogTitle>
          <DialogDescription>
            Tải mẫu Excel, điền thông tin và tải lên để nhập hàng loạt
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              Tải mẫu Excel
            </Button>
            <div className="relative flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button variant="outline" className="w-full gap-2" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {fileName || 'Chọn file Excel...'}
              </Button>
            </div>
          </div>

          {/* Import errors - generic */}
          {importErrors.length > 0 && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 space-y-1">
              <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                <AlertCircle className="h-4 w-4" />
                Lỗi khi nhập dữ liệu:
              </div>
              {importErrors.map((err, i) => (
                <p key={i} className="text-sm text-destructive ml-6">• {err}</p>
              ))}
            </div>
          )}

          {/* Row-specific errors */}
          {rowErrors.length > 0 && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 space-y-1">
              <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                <AlertCircle className="h-4 w-4" />
                Chi tiết lỗi từng dòng ({rowErrors.length} lỗi):
              </div>
              <ScrollArea className="max-h-[120px]">
                {rowErrors.map((err, i) => (
                  <p key={i} className="text-sm text-destructive ml-6">
                    • <strong>Dòng {err.stt}</strong> - {err.full_name}: {err.error}
                  </p>
                ))}
              </ScrollArea>
            </div>
          )}

          {/* Preview */}
          {parsedData.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-medium">
                  Xem trước ({parsedData.length} học sinh)
                </span>
                <div className="flex gap-2">
                  {validCount > 0 && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {validCount} hợp lệ
                    </Badge>
                  )}
                  {invalidCount > 0 && (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {invalidCount} lỗi
                    </Badge>
                  )}
                </div>
              </div>
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">STT</TableHead>
                      <TableHead>Họ và tên</TableHead>
                      <TableHead>Ngày sinh</TableHead>
                      <TableHead>Giới tính</TableHead>
                      <TableHead>Lớp</TableHead>
                      <TableHead>CCCD</TableHead>
                      <TableHead>SĐT</TableHead>
                      <TableHead>Dân tộc</TableHead>
                      <TableHead>Phòng</TableHead>
                      <TableHead>Mâm</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, index) => (
                      <TableRow key={index} className={!row.isValid ? 'bg-destructive/10' : ''}>
                        <TableCell>{row.stt}</TableCell>
                        <TableCell className="font-medium">{row.full_name || <span className="text-destructive italic">Trống</span>}</TableCell>
                        <TableCell>{row.date_of_birth || '-'}</TableCell>
                        <TableCell>
                          {row.gender === 'male' ? 'Nam' : row.gender === 'female' ? 'Nữ' : '-'}
                        </TableCell>
                        <TableCell>{row.class_name || <span className="text-destructive italic">Trống</span>}</TableCell>
                        <TableCell>{row.cccd || '-'}</TableCell>
                        <TableCell>{row.phone || '-'}</TableCell>
                        <TableCell>{row.ethnicity || '-'}</TableCell>
                        <TableCell>{row.room_number || '-'}</TableCell>
                        <TableCell>{row.meal_group || '-'}</TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                              Hợp lệ
                            </Badge>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="destructive" className="text-xs cursor-help">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Lỗi
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-[300px]">
                                  <ul className="text-xs space-y-0.5">
                                    {row.errors.map((err, i) => (
                                      <li key={i}>• {err}</li>
                                    ))}
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {parsedData.length === 0 && !isLoading && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="font-medium">Chưa có dữ liệu</p>
              <p className="text-sm">Tải mẫu Excel hoặc chọn file để xem trước</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Hủy
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={validCount === 0 || isImporting}
          >
            {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Nhập {validCount} học sinh
            {invalidCount > 0 && ` (bỏ qua ${invalidCount} lỗi)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Translate common DB/Supabase errors to Vietnamese
function translateError(msg: string): string {
  if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
    if (msg.includes('student_code')) return 'Trùng mã học sinh. Vui lòng kiểm tra cột CCCD hoặc mã học sinh.';
    if (msg.includes('cccd')) return 'Trùng số CCCD với học sinh đã có trong hệ thống.';
    return 'Dữ liệu bị trùng lặp với hồ sơ đã tồn tại.';
  }
  if (msg.includes('not-null') || msg.includes('null value')) {
    if (msg.includes('full_name')) return 'Thiếu họ và tên học sinh (cột bắt buộc).';
    if (msg.includes('school_id')) return 'Lỗi hệ thống: thiếu thông tin trường.';
    if (msg.includes('student_code')) return 'Thiếu mã học sinh hoặc CCCD.';
    return 'Thiếu dữ liệu bắt buộc. Vui lòng kiểm tra lại file Excel.';
  }
  if (msg.includes('foreign key') || msg.includes('violates foreign key')) {
    if (msg.includes('class_id')) return 'Lớp học không tồn tại trong hệ thống. Vui lòng tạo lớp trước khi nhập.';
    return 'Dữ liệu tham chiếu không hợp lệ.';
  }
  if (msg.includes('permission') || msg.includes('policy')) return 'Bạn không có quyền nhập học sinh.';
  if (msg.includes('timeout')) return 'Quá thời gian xử lý. Thử nhập ít học sinh hơn.';
  return msg;
}
