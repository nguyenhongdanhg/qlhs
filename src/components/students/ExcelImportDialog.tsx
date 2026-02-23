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
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (students: StudentImportRow[]) => Promise<void>;
}

export function ExcelImportDialog({ open, onOpenChange, onImport }: ExcelImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parsedData, setParsedData] = useState<StudentImportRow[]>([]);
  const [fileName, setFileName] = useState('');

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

    try {
      const data = await parseStudentImportFile(file);
      setParsedData(data);
      toast({ 
        title: 'Đọc file thành công', 
        description: `Tìm thấy ${data.length} học sinh` 
      });
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({ 
        title: 'Lỗi', 
        description: 'Không thể đọc file. Vui lòng kiểm tra định dạng.', 
        variant: 'destructive' 
      });
      setParsedData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    setIsImporting(true);
    try {
      await onImport(parsedData);
      toast({ 
        title: 'Nhập thành công', 
        description: `Đã nhập ${parsedData.length} học sinh` 
      });
      handleClose();
    } catch (error: any) {
      toast({ 
        title: 'Lỗi', 
        description: error.message || 'Không thể nhập học sinh', 
        variant: 'destructive' 
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setParsedData([]);
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

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

          {/* Preview */}
          {parsedData.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-medium">
                  Xem trước ({parsedData.length} học sinh)
                </span>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Sẵn sàng nhập
                </Badge>
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
                      <TableHead>Phòng</TableHead>
                      <TableHead>Mâm</TableHead>
                      <TableHead>Ảnh</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.stt}</TableCell>
                        <TableCell className="font-medium">{row.full_name}</TableCell>
                        <TableCell>{row.date_of_birth}</TableCell>
                        <TableCell>
                          {row.gender === 'male' ? 'Nam' : row.gender === 'female' ? 'Nữ' : '-'}
                        </TableCell>
                        <TableCell>{row.class_name || '-'}</TableCell>
                        <TableCell>{row.cccd || '-'}</TableCell>
                        <TableCell>{row.phone || '-'}</TableCell>
                        <TableCell>{row.room_number || '-'}</TableCell>
                        <TableCell>{row.meal_group || '-'}</TableCell>
                        <TableCell>
                          {row.avatar_url ? (
                            <img src={row.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : '-'}
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
            disabled={parsedData.length === 0 || isImporting}
          >
            {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Nhập {parsedData.length} học sinh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
