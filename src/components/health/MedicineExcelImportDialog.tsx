import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

interface MedicineExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  userId: string;
}

interface ImportRow {
  name: string;
  unit: string;
  quantity: number;
  expiryDate: string | null;
  notes: string;
  error?: string;
}

const TEMPLATE_COLUMNS = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'Tên thuốc (*)', key: 'name', width: 30 },
  { header: 'Đơn vị (*)', key: 'unit', width: 12 },
  { header: 'Số lượng (*)', key: 'quantity', width: 12 },
  { header: 'Hạn sử dụng (dd/mm/yyyy)', key: 'expiry', width: 22 },
  { header: 'Ghi chú', key: 'notes', width: 25 },
];

const SAMPLE_DATA = [
  [1, 'Paracetamol 500mg', 'viên', 100, '31/12/2027', 'Hạ sốt, giảm đau'],
  [2, 'Amoxicillin 250mg', 'viên', 50, '30/06/2026', ''],
  [3, 'Băng cá nhân', 'hộp', 20, '', 'Loại chống nước'],
];

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  
  const headerRow = TEMPLATE_COLUMNS.map(c => c.header);
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...SAMPLE_DATA]);

  // Style headers
  TEMPLATE_COLUMNS.forEach((col, i) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '2563EB' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'D1D5DB' } },
        bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
        left: { style: 'thin', color: { rgb: 'D1D5DB' } },
        right: { style: 'thin', color: { rgb: 'D1D5DB' } },
      },
    };
  });

  // Style sample data rows
  for (let r = 1; r <= SAMPLE_DATA.length; r++) {
    for (let c = 0; c < TEMPLATE_COLUMNS.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { color: { rgb: '6B7280' }, italic: true, sz: 10 },
          fill: { fgColor: { rgb: r % 2 === 0 ? 'F3F4F6' : 'FFFFFF' } },
          alignment: { horizontal: c === 0 || c === 3 ? 'center' : 'left', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } },
          },
        };
      }
    }
  }

  ws['!cols'] = TEMPLATE_COLUMNS.map(c => ({ wch: c.width }));
  
  XLSX.utils.book_append_sheet(wb, ws, 'Nhập thuốc');
  XLSX.writeFile(wb, 'Mau_nhap_thuoc.xlsx');
}

function parseExcelDate(value: any): string | null {
  if (!value) return null;
  
  // If it's a string like "dd/mm/yyyy"
  if (typeof value === 'string') {
    const parts = value.trim().split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const date = new Date(Number(y), Number(m) - 1, Number(d));
      if (!isNaN(date.getTime())) {
        return format(date, 'yyyy-MM-dd');
      }
    }
    // Try ISO format
    const d = new Date(value);
    if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
  }
  
  // If it's an Excel serial date number
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) return format(date, 'yyyy-MM-dd');
  }
  
  return null;
}

export function MedicineExcelImportDialog({ open, onOpenChange, schoolId, userId }: MedicineExcelImportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        // Skip header row, parse data
        const parsed: ImportRow[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const name = String(row[1] || '').trim();
          const unit = String(row[2] || '').trim();
          const qtyRaw = row[3];
          const quantity = typeof qtyRaw === 'number' ? qtyRaw : parseInt(String(qtyRaw || '0'));
          const expiryDate = parseExcelDate(row[4]);
          const notes = String(row[5] || '').trim();
          
          // Validate
          let error: string | undefined;
          if (!name) error = 'Thiếu tên thuốc';
          else if (!unit) error = 'Thiếu đơn vị';
          else if (isNaN(quantity) || quantity < 0) error = 'Số lượng không hợp lệ';
          
          if (name || unit || quantity) {
            parsed.push({ name, unit, quantity, expiryDate, notes, error });
          }
        }
        
        if (parsed.length === 0) {
          toast({ title: 'Lỗi', description: 'File không có dữ liệu hoặc sai định dạng', variant: 'destructive' });
          return;
        }
        
        setPreviewData(parsed);
        setStep('preview');
      } catch {
        toast({ title: 'Lỗi', description: 'Không thể đọc file Excel', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validRows = previewData.filter(r => !r.error);
  const errorRows = previewData.filter(r => r.error);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (validRows.length === 0) throw new Error('Không có dòng hợp lệ để nhập');
      
      const currentDate = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: vi });
      
      for (const row of validRows) {
        // Insert medicine
        const { data: newMedicine, error: medError } = await supabase.from('medicines').insert({
          school_id: schoolId,
          name: row.name,
          unit: row.unit,
          quantity: row.quantity,
          expiry_date: row.expiryDate,
          notes: row.notes || null,
        }).select().single();
        
        if (medError) throw new Error(`Lỗi khi thêm "${row.name}": ${medError.message}`);
        
        // Create initial import transaction if quantity > 0
        if (row.quantity > 0 && newMedicine) {
          await supabase.from('medicine_transactions').insert({
            school_id: schoolId,
            medicine_id: newMedicine.id,
            transaction_type: 'import',
            quantity: row.quantity,
            notes: `Nhập kho ban đầu (Excel) - ${currentDate}`,
            created_by: userId,
          });
        }
      }
    },
    onSuccess: () => {
      toast({ title: 'Thành công', description: `Đã nhập ${validRows.length} thuốc vào kho` });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['all-medicine-transactions'] });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  const handleClose = () => {
    setPreviewData([]);
    setFileName('');
    setStep('upload');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Nhập thuốc từ Excel
          </DialogTitle>
          <DialogDescription>
            Tải mẫu Excel, điền thông tin thuốc và tải lên để nhập hàng loạt.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            {/* Download template */}
            <div className="rounded-lg border-2 border-dashed border-green-200 bg-green-50/50 p-6 text-center space-y-3">
              <FileSpreadsheet className="h-10 w-10 text-green-600 mx-auto" />
              <div>
                <p className="font-medium text-sm">Bước 1: Tải mẫu Excel</p>
                <p className="text-xs text-muted-foreground mt-1">File mẫu có sẵn dữ liệu ví dụ để tham khảo</p>
              </div>
              <Button variant="outline" size="sm" className="text-green-600 border-green-300 hover:bg-green-100" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" />
                Tải mẫu Excel
              </Button>
            </div>

            {/* Upload file */}
            <div className="rounded-lg border-2 border-dashed border-primary/20 bg-primary/5 p-6 text-center space-y-3">
              <Upload className="h-10 w-10 text-primary mx-auto" />
              <div>
                <p className="font-medium text-sm">Bước 2: Tải lên file đã điền</p>
                <p className="text-xs text-muted-foreground mt-1">Hỗ trợ file .xlsx, .xls</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" />
                Chọn file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Column guide */}
            <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 rounded-lg p-3">
              <p className="font-medium text-foreground">Hướng dẫn các cột:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li><strong>Tên thuốc (*)</strong> — Bắt buộc</li>
                <li><strong>Đơn vị (*)</strong> — viên, gói, lọ, tuýp, hộp, chai, vỉ, ống...</li>
                <li><strong>Số lượng (*)</strong> — Số nguyên ≥ 0</li>
                <li><strong>Hạn sử dụng</strong> — Định dạng dd/mm/yyyy (không bắt buộc)</li>
                <li><strong>Ghi chú</strong> — Tùy chọn</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-3 flex-1 min-h-0">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                File: <span className="font-medium text-foreground">{fileName}</span>
              </p>
              <div className="flex gap-2">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Hợp lệ: {validRows.length}
                </Badge>
                {errorRows.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Lỗi: {errorRows.length}
                  </Badge>
                )}
              </div>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-10 text-center">STT</TableHead>
                    <TableHead>Tên thuốc</TableHead>
                    <TableHead className="w-16">Đơn vị</TableHead>
                    <TableHead className="w-16 text-center">SL</TableHead>
                    <TableHead className="w-28">HSD</TableHead>
                    <TableHead>Ghi chú</TableHead>
                    <TableHead className="w-20">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, i) => (
                    <TableRow key={i} className={row.error ? 'bg-red-50' : ''}>
                      <TableCell className="text-center text-sm">{i + 1}</TableCell>
                      <TableCell className="text-sm font-medium">{row.name || '—'}</TableCell>
                      <TableCell className="text-sm">{row.unit || '—'}</TableCell>
                      <TableCell className="text-center text-sm">{row.quantity}</TableCell>
                      <TableCell className="text-sm">
                        {row.expiryDate ? format(new Date(row.expiryDate), 'dd/MM/yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.notes || '—'}</TableCell>
                      <TableCell>
                        {row.error ? (
                          <Badge variant="destructive" className="text-xs">{row.error}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-200">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {errorRows.length > 0 && (
              <p className="text-xs text-amber-600">
                ⚠ Các dòng lỗi sẽ bị bỏ qua. Chỉ {validRows.length} dòng hợp lệ được nhập.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'preview' && (
            <Button variant="outline" onClick={() => setStep('upload')}>
              Quay lại
            </Button>
          )}
          <Button variant="ghost" onClick={handleClose}>Đóng</Button>
          {step === 'preview' && (
            <Button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || validRows.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {importMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Nhập {validRows.length} thuốc
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
