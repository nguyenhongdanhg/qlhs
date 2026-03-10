import { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { parseStudentImportFile, StudentImportRow } from '@/lib/excel-utils';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
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
import { Student, Class } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface SupplementInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  classes: Class[];
  onComplete: () => void;
}

interface MatchedUpdate {
  student: Student;
  imported: StudentImportRow;
  fields: Record<string, { old: string; new: string; dbKey: string; dbValue: any }>;
}

const SUPPLEMENT_FIELDS = [
  { key: 'ethnicity', importKey: 'ethnicity', label: 'Dân tộc' },
  { key: 'phone', importKey: 'phone', label: 'SĐT học sinh' },
  { key: 'address', importKey: 'address', label: 'Địa chỉ' },
  { key: 'room_number', importKey: 'room_number', label: 'Phòng KTX' },
  { key: 'meal_group', importKey: 'meal_group', label: 'Mâm ăn' },
  { key: 'date_of_birth', importKey: 'date_of_birth', label: 'Ngày sinh' },
  { key: 'gender', importKey: 'gender', label: 'Giới tính' },
  { key: 'cccd', importKey: 'cccd', label: 'CCCD' },
  { key: 'avatar_url', importKey: 'avatar_url', label: 'Link ảnh' },
] as const;

export function SupplementInfoDialog({ open, onOpenChange, students, classes, onComplete }: SupplementInfoDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [parsedData, setParsedData] = useState<StudentImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(['ethnicity', 'phone', 'address', 'room_number', 'meal_group']));
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  const classMap = useMemo(() => {
    const map: Record<string, string> = {};
    classes.forEach(cls => { map[cls.name.toLowerCase()] = cls.id; });
    return map;
  }, [classes]);

  // Match imported rows to existing students
  const matchedUpdates = useMemo<MatchedUpdate[]>(() => {
    if (parsedData.length === 0) return [];
    
    const results: MatchedUpdate[] = [];
    
    for (const row of parsedData) {
      if (!row.isValid && !row.full_name) continue;
      
      const existing = students.find(s =>
        (row.cccd && s.cccd && s.cccd === row.cccd) ||
        (row.full_name && s.full_name.toLowerCase() === row.full_name.toLowerCase() &&
         row.class_name && s.class?.name?.toLowerCase() === row.class_name.toLowerCase())
      );
      
      if (!existing) continue;
      
      const fields: MatchedUpdate['fields'] = {};
      
      for (const field of SUPPLEMENT_FIELDS) {
        if (!selectedFields.has(field.key)) continue;
        
        const importVal = row[field.importKey as keyof StudentImportRow] as string;
        if (!importVal) continue;
        
        const existingVal = existing[field.key as keyof Student] as string;
        
        // Only show if there's actually a change
        if (importVal === existingVal) continue;
        
        let displayOld = existingVal || '(trống)';
        let displayNew = String(importVal);
        let dbValue: any = importVal;
        
        if (field.key === 'gender') {
          displayOld = existingVal === 'male' ? 'Nam' : existingVal === 'female' ? 'Nữ' : '(trống)';
          displayNew = importVal === 'male' ? 'Nam' : 'Nữ';
          dbValue = importVal;
        }
        
        fields[field.key] = { old: displayOld, new: displayNew, dbKey: field.key, dbValue };
      }
      
      if (Object.keys(fields).length > 0) {
        results.push({ student: existing, imported: row, fields });
      }
    }
    
    return results;
  }, [parsedData, students, selectedFields]);

  const unmatchedCount = useMemo(() => {
    if (parsedData.length === 0) return 0;
    return parsedData.filter(row => {
      if (!row.full_name) return false;
      return !students.find(s =>
        (row.cccd && s.cccd && s.cccd === row.cccd) ||
        (row.full_name && s.full_name.toLowerCase() === row.full_name.toLowerCase() &&
         row.class_name && s.class?.name?.toLowerCase() === row.class_name.toLowerCase())
      );
    }).length;
  }, [parsedData, students]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setFileName(file.name);

    try {
      const data = await parseStudentImportFile(file);
      setParsedData(data);
      setStep('preview');
      toast({
        title: 'Đọc file thành công',
        description: `Tìm thấy ${data.length} dòng dữ liệu`,
      });
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể đọc file. Vui lòng kiểm tra định dạng.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleField = (field: string) => {
    const next = new Set(selectedFields);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    setSelectedFields(next);
  };

  const handleUpdate = async () => {
    if (matchedUpdates.length === 0) return;
    setIsUpdating(true);

    let successCount = 0;
    let errorCount = 0;

    for (const match of matchedUpdates) {
      const updateData: Record<string, any> = {};
      for (const [, val] of Object.entries(match.fields)) {
        updateData[val.dbKey] = val.dbValue;
      }

      if (Object.keys(updateData).length === 0) continue;

      const { error } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', match.student.id);

      if (error) {
        errorCount++;
        console.error('Error updating:', match.student.full_name, error);
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast({
        title: 'Bổ sung thành công',
        description: `Đã cập nhật ${successCount} học sinh${errorCount > 0 ? `, ${errorCount} lỗi` : ''}`,
      });
      onComplete();
      handleClose();
    } else {
      toast({ title: 'Lỗi', description: 'Không thể cập nhật', variant: 'destructive' });
    }

    setIsUpdating(false);
  };

  const handleClose = () => {
    setParsedData([]);
    setFileName('');
    setStep('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Bổ sung thông tin học sinh
          </DialogTitle>
          <DialogDescription>
            Tải lên danh sách bổ sung, hệ thống sẽ khớp theo CCCD hoặc Tên + Lớp để cập nhật
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Field selection */}
          <div>
            <p className="text-sm font-medium mb-2">Chọn thông tin cần bổ sung:</p>
            <div className="flex flex-wrap gap-3">
              {SUPPLEMENT_FIELDS.map(field => (
                <label
                  key={field.key}
                  className="flex items-center gap-1.5 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={selectedFields.has(field.key)}
                    onCheckedChange={() => toggleField(field.key)}
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </div>

          {/* File upload */}
          {step === 'upload' && (
            <div className="space-y-3">
              <div className="relative">
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

              <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
                <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm font-medium">File Excel cần có các cột: Họ và tên, Lớp (hoặc CCCD)</p>
                <p className="text-xs mt-1">Hệ thống sẽ tự động khớp và chỉ cập nhật các trường đã chọn ở trên</p>
              </div>
            </div>
          )}

          {/* Preview */}
          {step === 'preview' && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {matchedUpdates.length} học sinh khớp có thay đổi
                </Badge>
                {unmatchedCount > 0 && (
                  <Badge variant="outline" className="text-muted-foreground">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {unmatchedCount} không tìm thấy
                  </Badge>
                )}
                {parsedData.length - matchedUpdates.length - unmatchedCount > 0 && (
                  <Badge variant="outline" className="text-muted-foreground">
                    {parsedData.length - matchedUpdates.length - unmatchedCount} không có thay đổi
                  </Badge>
                )}
              </div>

              {/* Change button to re-upload */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  setStep('upload');
                  setParsedData([]);
                  setFileName('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}>
                  Chọn file khác
                </Button>
                <span className="text-sm text-muted-foreground">{fileName}</span>
              </div>

              {matchedUpdates.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <ScrollArea className="h-[350px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">Học sinh</TableHead>
                          <TableHead className="w-[100px]">Lớp</TableHead>
                          <TableHead>Thông tin thay đổi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matchedUpdates.map((match, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium text-sm">{match.student.full_name}</TableCell>
                            <TableCell className="text-sm">{match.student.class?.name || '-'}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {Object.entries(match.fields).map(([key, val]) => {
                                  const fieldDef = SUPPLEMENT_FIELDS.find(f => f.key === key);
                                  return (
                                    <div key={key} className="flex items-center gap-1 text-xs flex-wrap">
                                      <span className="font-medium text-muted-foreground w-16 shrink-0">{fieldDef?.label}:</span>
                                      <span className="text-destructive line-through">{val.old}</span>
                                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                      <span className="text-primary font-medium">{val.new}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm font-medium">Không tìm thấy thay đổi nào</p>
                  <p className="text-xs mt-1">Kiểm tra lại file hoặc các trường đã chọn</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Hủy</Button>
          {step === 'preview' && matchedUpdates.length > 0 && (
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cập nhật {matchedUpdates.length} học sinh
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
