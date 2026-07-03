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
  parseTeacherImportFile,
  generateTeacherTemplate,
  downloadBlob,
  TeacherImportRow,
} from '@/lib/excel-utils';
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface TeacherImportRowError {
  stt: number;
  full_name: string;
  error: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: TeacherImportRow[]) => Promise<TeacherImportRowError[]>;
}

export function TeacherImportDialog({ open, onOpenChange, onImport }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parsedData, setParsedData] = useState<TeacherImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [rowErrors, setRowErrors] = useState<TeacherImportRowError[]>([]);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const validCount = parsedData.filter(r => r.isValid).length;
  const invalidCount = parsedData.length - validCount;

  const handleDownloadTemplate = () => {
    const blob = generateTeacherTemplate();
    downloadBlob(blob, 'mau-nhap-giao-vien.xlsx');
    toast({ title: 'Đã tải mẫu', description: 'Mẫu nhập giáo viên' });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setFileName(file.name);
    setRowErrors([]);
    try {
      const data = await parseTeacherImportFile(file);
      setParsedData(data);
      const invalid = data.filter(r => !r.isValid);
      if (invalid.length > 0) {
        toast({ title: `Phát hiện ${invalid.length} dòng lỗi`, description: 'Xem chi tiết ở bảng', variant: 'destructive' });
      } else {
        toast({ title: 'Đọc file thành công', description: `${data.length} giáo viên hợp lệ` });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Lỗi', description: 'Không đọc được file (.xlsx, .xls)', variant: 'destructive' });
      setParsedData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    const validData = parsedData.filter(r => r.isValid);
    if (validData.length === 0) return;
    setIsImporting(true);
    setRowErrors([]);
    try {
      const errors = await onImport(validData);
      if (errors.length > 0) {
        setRowErrors(errors);
        const failed = new Set(errors.map(e => e.stt));
        setParsedData(prev => prev.map(r => failed.has(r.stt)
          ? { ...r, isValid: false, errors: [errors.find(e => e.stt === r.stt)?.error || 'Lỗi'] }
          : r));
        toast({
          title: `Nhập xong: ${validData.length - errors.length} thành công, ${errors.length} lỗi`,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Nhập thành công', description: `Đã nhập ${validData.length} giáo viên` });
        handleClose();
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err?.message || 'Không thể nhập giáo viên', variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setParsedData([]);
    setFileName('');
    setRowErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Nhập giáo viên từ Excel
          </DialogTitle>
          <DialogDescription>
            Tải mẫu, điền thông tin và tải lên. Nếu có SĐT, hệ thống tự tạo tài khoản đăng nhập (mật khẩu mặc định: 123456).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
              <Download className="h-4 w-4" />Tải mẫu Excel
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
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {fileName || 'Chọn file Excel...'}
              </Button>
            </div>
          </div>

          {rowErrors.length > 0 && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 space-y-1">
              <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                <AlertCircle className="h-4 w-4" />Chi tiết lỗi ({rowErrors.length}):
              </div>
              <ScrollArea className="max-h-[120px]">
                {rowErrors.map((err, i) => (
                  <p key={i} className="text-sm text-destructive ml-6">• <strong>Dòng {err.stt}</strong> - {err.full_name}: {err.error}</p>
                ))}
              </ScrollArea>
            </div>
          )}

          {parsedData.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-medium">Xem trước ({parsedData.length} giáo viên)</span>
                <div className="flex gap-2">
                  {validCount > 0 && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" />{validCount} hợp lệ
                    </Badge>
                  )}
                  {invalidCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="cursor-pointer"
                      onClick={() => setShowErrorDetails(!showErrorDetails)}
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />{invalidCount} lỗi
                      {showErrorDetails ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                    </Badge>
                  )}
                </div>
              </div>
              {invalidCount > 0 && showErrorDetails && (
                <div className="border border-destructive/30 bg-destructive/5 rounded-md p-3 mx-1 mb-1">
                  <ScrollArea className="max-h-[120px]">
                    <ul className="space-y-1">
                      {parsedData.filter(r => !r.isValid).map((row, i) => (
                        <li key={i} className="text-xs text-destructive">
                          <span className="font-semibold">Dòng {row.stt} - {row.full_name || '(trống)'}:</span> {row.errors.join(', ')}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
              <ScrollArea className="h-[320px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">STT</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead>Ngày sinh</TableHead>
                      <TableHead>Giới tính</TableHead>
                      <TableHead>SĐT</TableHead>
                      <TableHead>Cấp</TableHead>
                      <TableHead>Môn</TableHead>
                      <TableHead>Chức vụ</TableHead>
                      <TableHead>Hệ số</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, i) => (
                      <TableRow key={i} className={!row.isValid ? 'bg-destructive/10' : ''}>
                        <TableCell>{row.stt}</TableCell>
                        <TableCell className="font-medium">{row.full_name || <span className="text-destructive italic">Trống</span>}</TableCell>
                        <TableCell>{row.birthday || '-'}</TableCell>
                        <TableCell>{row.gender === 'male' ? 'Nam' : row.gender === 'female' ? 'Nữ' : row.gender === 'other' ? 'Khác' : '-'}</TableCell>
                        <TableCell>{row.phone || '-'}</TableCell>
                        <TableCell>{row.education_level || '-'}</TableCell>
                        <TableCell>{row.subject || '-'}</TableCell>
                        <TableCell>{row.position || '-'}</TableCell>
                        <TableCell>{row.salary_coefficient ?? '-'}</TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">Hợp lệ</Badge>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="destructive" className="text-xs cursor-help">
                                    <AlertCircle className="h-3 w-3 mr-1" />Lỗi
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-[300px]">
                                  <ul className="text-xs space-y-0.5">
                                    {row.errors.map((e, j) => <li key={j}>• {e}</li>)}
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
          <Button variant="outline" onClick={handleClose}>Hủy</Button>
          <Button onClick={handleImport} disabled={validCount === 0 || isImporting}>
            {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Nhập {validCount} giáo viên{invalidCount > 0 && ` (bỏ qua ${invalidCount} lỗi)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
