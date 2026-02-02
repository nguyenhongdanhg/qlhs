import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClassFilterButtons } from '@/components/attendance/ClassFilterButtons';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CalendarIcon,
  Search,
  Pill,
  Stethoscope,
  Building2,
  Phone,
  Loader2,
  Plus,
  Minus,
  X,
  User,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Student, Class, Medicine, HealthTreatmentType } from '@/types';

interface MedicineSelection {
  medicineId: string;
  quantity: number;
}

interface HealthRecordFormProps {
  students: Student[];
  classes: Class[];
  medicines: Medicine[];
  schoolId: string;
  userId: string;
  isAdmin: boolean;
}

const TREATMENT_OPTIONS = [
  { value: 'medicine', label: 'Phát thuốc', icon: Pill, color: 'bg-green-100 text-green-700' },
  { value: 'first_aid', label: 'Sơ cứu', icon: Stethoscope, color: 'bg-yellow-100 text-yellow-700' },
  { value: 'hospital', label: 'Vào viện', icon: Building2, color: 'bg-red-100 text-red-700' },
];

export function HealthRecordForm({
  students,
  classes,
  medicines,
  schoolId,
  userId,
  isAdmin,
}: HealthRecordFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states
  const [selectedClass, setSelectedClass] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [recordDate, setRecordDate] = useState<Date>(new Date());
  const [diagnosis, setDiagnosis] = useState('');
  const [treatmentType, setTreatmentType] = useState<HealthTreatmentType>('medicine');
  const [selectedMedicines, setSelectedMedicines] = useState<MedicineSelection[]>([]);
  
  // Hospital fields
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalDate, setHospitalDate] = useState<Date | undefined>(undefined);
  const [dischargeDate, setDischargeDate] = useState<Date | undefined>(undefined);
  const [hospitalResult, setHospitalResult] = useState('');
  
  // Parent contact
  const [parentContacted, setParentContacted] = useState(false);
  const [parentContactNotes, setParentContactNotes] = useState('');
  
  const [notes, setNotes] = useState('');

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (selectedClass !== 'all' && s.class?.name !== selectedClass) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return s.full_name.toLowerCase().includes(term) || s.student_code.toLowerCase().includes(term);
      }
      return true;
    });
  }, [students, selectedClass, searchTerm]);

  // Add medicine to selection
  const addMedicine = useCallback((medicineId: string) => {
    setSelectedMedicines((prev) => {
      const existing = prev.find((m) => m.medicineId === medicineId);
      if (existing) return prev;
      return [...prev, { medicineId, quantity: 1 }];
    });
  }, []);

  // Remove medicine from selection
  const removeMedicine = useCallback((medicineId: string) => {
    setSelectedMedicines((prev) => prev.filter((m) => m.medicineId !== medicineId));
  }, []);

  // Update medicine quantity
  const updateMedicineQty = useCallback((medicineId: string, qty: number) => {
    if (qty < 1) return;
    setSelectedMedicines((prev) =>
      prev.map((m) => (m.medicineId === medicineId ? { ...m, quantity: qty } : m))
    );
  }, []);

  // Reset form
  const resetForm = useCallback(() => {
    setSelectedStudent(null);
    setDiagnosis('');
    setTreatmentType('medicine');
    setSelectedMedicines([]);
    setHospitalName('');
    setHospitalDate(undefined);
    setDischargeDate(undefined);
    setHospitalResult('');
    setParentContacted(false);
    setParentContactNotes('');
    setNotes('');
  }, []);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudent || !diagnosis.trim()) {
        throw new Error('Vui lòng chọn học sinh và nhập chuẩn đoán');
      }

      // Validate medicine stock
      if (treatmentType === 'medicine' && selectedMedicines.length > 0) {
        for (const sel of selectedMedicines) {
          const med = medicines.find((m) => m.id === sel.medicineId);
          if (med && med.quantity < sel.quantity) {
            throw new Error(`Thuốc "${med.name}" không đủ số lượng (còn ${med.quantity})`);
          }
        }
      }

      // Insert health record
      const { data: record, error: recordError } = await supabase
        .from('health_records')
        .insert({
          school_id: schoolId,
          student_id: selectedStudent.id,
          record_date: format(recordDate, 'yyyy-MM-dd'),
          diagnosis: diagnosis.trim(),
          treatment_type: treatmentType,
          hospital_name: treatmentType === 'hospital' ? hospitalName : null,
          hospital_date: treatmentType === 'hospital' && hospitalDate ? format(hospitalDate, 'yyyy-MM-dd') : null,
          discharge_date: treatmentType === 'hospital' && dischargeDate ? format(dischargeDate, 'yyyy-MM-dd') : null,
          hospital_result: treatmentType === 'hospital' ? hospitalResult : null,
          parent_contacted: parentContacted,
          parent_contact_notes: parentContacted ? parentContactNotes : null,
          notes: notes.trim() || null,
          reporter_id: userId,
        })
        .select()
        .single();

      if (recordError) throw recordError;

      // Insert medicine records and update inventory
      if (treatmentType === 'medicine' && selectedMedicines.length > 0) {
        const medicineRecords = selectedMedicines.map((sel) => ({
          health_record_id: record.id,
          medicine_id: sel.medicineId,
          quantity: sel.quantity,
        }));

        const { error: medError } = await supabase
          .from('health_record_medicines')
          .insert(medicineRecords);

        if (medError) throw medError;

        // Update medicine quantities and log transactions
        for (const sel of selectedMedicines) {
          const med = medicines.find((m) => m.id === sel.medicineId);
          if (med) {
            await supabase
              .from('medicines')
              .update({ quantity: med.quantity - sel.quantity })
              .eq('id', sel.medicineId);

            await supabase.from('medicine_transactions').insert({
              school_id: schoolId,
              medicine_id: sel.medicineId,
              transaction_type: 'export',
              quantity: sel.quantity,
              notes: `Phát cho HS ${selectedStudent.full_name} - ${diagnosis}`,
              created_by: userId,
            });
          }
        }
      }

      return record;
    },
    onSuccess: () => {
      toast({ title: 'Thành công', description: 'Đã ghi nhận thông tin sức khỏe học sinh' });
      queryClient.invalidateQueries({ queryKey: ['health-records'] });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3">
      {/* Student Selection */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Chọn học sinh
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Class filter */}
          <ClassFilterButtons
            classes={classes}
            students={students}
            selectedClass={selectedClass}
            onSelectClass={setSelectedClass}
          />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm học sinh..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Student list */}
          <ScrollArea className="h-[250px] sm:h-[300px] border rounded-lg">
            <div className="p-2 space-y-1">
              {filteredStudents.map((student) => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudent(student)}
                  className={cn(
                    'w-full text-left p-2 rounded-md text-sm transition-colors',
                    selectedStudent?.id === student.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <p className="font-medium truncate">{student.full_name}</p>
                  <p className={cn(
                    'text-xs',
                    selectedStudent?.id === student.id ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  )}>
                    {student.class?.name} - {student.student_code}
                  </p>
                </button>
              ))}
              {filteredStudents.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Không tìm thấy học sinh
                </p>
              )}
            </div>
          </ScrollArea>

          {/* Selected student info */}
          {selectedStudent && (
            <div className="p-3 bg-primary/5 rounded-lg space-y-1">
              <p className="font-medium text-sm sm:text-base">{selectedStudent.full_name}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Lớp: {selectedStudent.class?.name} | SĐT PH: {selectedStudent.parent_phone || 'N/A'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health Record Form */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Thông tin sức khỏe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date and Treatment Type */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">Ngày ghi nhận</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{format(recordDate, 'dd/MM/yyyy', { locale: vi })}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={recordDate}
                    onSelect={(d) => d && setRecordDate(d)}
                    locale={vi}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Hình thức xử lý</Label>
              <Select value={treatmentType} onValueChange={(v) => setTreatmentType(v as HealthTreatmentType)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TREATMENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className="h-4 w-4" />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Diagnosis */}
          <div className="space-y-2">
            <Label>Chuẩn đoán / Triệu chứng *</Label>
            <Textarea
              placeholder="Nhập chuẩn đoán bệnh hoặc triệu chứng..."
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={2}
            />
          </div>

          {/* Medicine selection */}
          {treatmentType === 'medicine' && (
            <div className="space-y-3">
              <Label className="text-sm">Thuốc phát cho học sinh</Label>
              
              {/* Dropdown button to open medicine list */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between h-10"
                  >
                    <span className="flex items-center gap-2">
                      <Pill className="h-4 w-4 text-green-600" />
                      {selectedMedicines.length > 0 
                        ? `Đã chọn ${selectedMedicines.length} loại thuốc`
                        : 'Chọn thuốc từ kho...'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="bg-muted/50 px-3 py-2 border-b">
                    <p className="text-xs font-medium text-muted-foreground">Tích chọn thuốc cần phát</p>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="p-2 space-y-1">
                      {medicines.length > 0 ? (
                        medicines.map((med) => {
                          const isSelected = !!selectedMedicines.find((s) => s.medicineId === med.id);
                          const isOutOfStock = med.quantity <= 0;
                          return (
                            <div
                              key={med.id}
                              className={cn(
                                'flex items-center gap-2 p-2 rounded-md transition-colors',
                                isOutOfStock ? 'opacity-50' : 'hover:bg-muted cursor-pointer'
                              )}
                              onClick={() => {
                                if (isOutOfStock) return;
                                if (isSelected) {
                                  removeMedicine(med.id);
                                } else {
                                  addMedicine(med.id);
                                }
                              }}
                            >
                              <Checkbox 
                                checked={isSelected} 
                                disabled={isOutOfStock}
                                className="flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{med.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {isOutOfStock ? 'Hết hàng' : `Còn: ${med.quantity} ${med.unit}`}
                                </p>
                              </div>
                              <Badge 
                                variant={isOutOfStock ? 'destructive' : 'outline'} 
                                className="text-xs flex-shrink-0"
                              >
                                {med.quantity}
                              </Badge>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-center text-sm text-muted-foreground py-4">
                          Chưa có thuốc trong kho
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {/* Selected medicines with quantity input */}
              {selectedMedicines.length > 0 && (
                <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-xs font-medium text-green-700 mb-2">Nhập số lượng phát:</p>
                  {selectedMedicines.map((sel) => {
                    const med = medicines.find((m) => m.id === sel.medicineId);
                    if (!med) return null;
                    return (
                      <div key={sel.medicineId} className="bg-white p-2 rounded-md">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Pill className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <span className="text-sm font-medium truncate">{med.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive flex-shrink-0"
                            onClick={() => removeMedicine(sel.medicineId)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={() => updateMedicineQty(sel.medicineId, sel.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            max={med.quantity}
                            value={sel.quantity}
                            onChange={(e) => updateMedicineQty(sel.medicineId, parseInt(e.target.value) || 1)}
                            className="w-16 h-8 text-center text-sm flex-shrink-0"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={() => updateMedicineQty(sel.medicineId, sel.quantity + 1)}
                            disabled={sel.quantity >= med.quantity}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <span className="text-xs text-muted-foreground">{med.unit}</span>
                          <span className="text-xs text-muted-foreground ml-auto">(còn: {med.quantity})</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Hospital fields */}
          {treatmentType === 'hospital' && (
            <div className="space-y-3 p-3 sm:p-4 bg-red-50 rounded-lg border border-red-100">
              <h4 className="font-medium text-red-700 flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4" />
                Thông tin nhập viện
              </h4>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-sm">Tên bệnh viện</Label>
                  <Input
                    placeholder="Nhập tên bệnh viện..."
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Ngày nhập viện</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{hospitalDate ? format(hospitalDate, 'dd/MM/yyyy', { locale: vi }) : 'Chọn ngày'}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={hospitalDate}
                        onSelect={setHospitalDate}
                        locale={vi}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Ngày xuất viện</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{dischargeDate ? format(dischargeDate, 'dd/MM/yyyy', { locale: vi }) : 'Chọn ngày'}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dischargeDate}
                        onSelect={setDischargeDate}
                        locale={vi}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-sm">Kết quả điều trị</Label>
                  <Textarea
                    placeholder="Nhập kết quả điều trị..."
                    value={hospitalResult}
                    onChange={(e) => setHospitalResult(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Parent contact */}
          <div className="space-y-3 p-3 sm:p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                id="parentContacted"
                checked={parentContacted}
                onCheckedChange={(c) => setParentContacted(!!c)}
              />
              <Label htmlFor="parentContacted" className="flex items-center gap-2 cursor-pointer text-sm">
                <Phone className="h-4 w-4" />
                Đã liên hệ phụ huynh
              </Label>
            </div>
            {parentContacted && (
              <Textarea
                placeholder="Ghi chú nội dung liên hệ với phụ huynh..."
                value={parentContactNotes}
                onChange={(e) => setParentContactNotes(e.target.value)}
                rows={2}
              />
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm">Ghi chú thêm</Label>
            <Textarea
              placeholder="Ghi chú thêm (nếu có)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Submit */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button variant="outline" onClick={resetForm} className="sm:w-auto">
              Làm mới
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !selectedStudent || !diagnosis.trim()}
              className="flex-1"
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu thông tin
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
