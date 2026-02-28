import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  CalendarIcon,
  Search,
  Pill,
  Stethoscope,
  Building2,
  Phone,
  Trash2,
  Eye,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Student, Class, HealthRecord, HealthTreatmentType } from '@/types';

interface HealthHistoryTabProps {
  schoolId: string;
  students: Student[];
  classes: Class[];
  isAdmin: boolean;
  userId: string;
  canDelete?: boolean;
}

const TREATMENT_LABELS: Record<HealthTreatmentType, { label: string; color: string; icon: any }> = {
  medicine: { label: 'Phát thuốc', color: 'bg-green-100 text-green-700', icon: Pill },
  first_aid: { label: 'Sơ cứu', color: 'bg-yellow-100 text-yellow-700', icon: Stethoscope },
  hospital: { label: 'Vào viện', color: 'bg-red-100 text-red-700', icon: Building2 },
};

export function HealthHistoryTab({
  schoolId,
  students,
  classes,
  isAdmin,
  userId,
  canDelete = false,
}: HealthHistoryTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dateRange, setDateRange] = useState<'day' | 'week' | 'month'>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | HealthTreatmentType>('all');
  const [viewRecord, setViewRecord] = useState<HealthRecord | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<HealthRecord | null>(null);

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    let start: Date, end: Date;
    if (dateRange === 'day') {
      start = startOfDay(selectedDate);
      end = endOfDay(selectedDate);
    } else if (dateRange === 'week') {
      start = subDays(selectedDate, 6);
      end = endOfDay(selectedDate);
    } else {
      start = startOfMonth(selectedDate);
      end = endOfMonth(selectedDate);
    }
    return { startDate: start, endDate: end };
  }, [dateRange, selectedDate]);

  // Fetch health records with pagination to get all results
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['health-records', schoolId, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!schoolId) return [];
      const PAGE_SIZE = 1000;
      let allRecords: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('health_records')
          .select(`
            *,
            student:students(id, full_name, student_code, class:classes(name)),
            reporter:profiles(id, full_name),
            medicines:health_record_medicines(
              id,
              quantity,
              medicine:medicines(id, name, unit)
            )
          `)
          .eq('school_id', schoolId)
          .gte('record_date', format(startDate, 'yyyy-MM-dd'))
          .lte('record_date', format(endDate, 'yyyy-MM-dd'))
          .order('record_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        allRecords = [...allRecords, ...(data || [])];
        hasMore = (data?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      return allRecords;
    },
    enabled: !!schoolId,
  });

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterType !== 'all' && r.treatment_type !== filterType) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          r.student?.full_name?.toLowerCase().includes(term) ||
          r.diagnosis?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [records, filterType, searchTerm]);

  // Delete mutation - restore medicine quantities before deleting
  const deleteMutation = useMutation({
    mutationFn: async (record: any) => {
      // If the record has medicines, restore their quantities to inventory
      if (record.treatment_type === 'medicine' && record.medicines && record.medicines.length > 0) {
        for (const item of record.medicines) {
          // Get medicine_id from nested medicine object or direct field
          const medicineId = item.medicine?.id || item.medicine_id;
          
          if (medicineId && item.quantity > 0) {
            // Get current medicine quantity
            const { data: medicine, error: fetchError } = await supabase
              .from('medicines')
              .select('quantity')
              .eq('id', medicineId)
              .single();
            
            if (fetchError) throw fetchError;
            
            // Update medicine quantity (add back the dispensed amount)
            const { error: updateError } = await supabase
              .from('medicines')
              .update({ quantity: (medicine?.quantity || 0) + item.quantity })
              .eq('id', medicineId);
            
            if (updateError) throw updateError;
            
            // Record the return transaction
            const { error: txError } = await supabase
              .from('medicine_transactions')
              .insert({
                school_id: record.school_id,
                medicine_id: medicineId,
                transaction_type: 'import',
                quantity: item.quantity,
                notes: `Hoàn trả từ xóa lịch sử (HS: ${record.student?.full_name || 'N/A'})`
              });
            
            if (txError) throw txError;
          }
        }
      }
      
      // Delete the health record (health_record_medicines will cascade delete)
      const { error } = await supabase.from('health_records').delete().eq('id', record.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Đã xóa', description: 'Đã xóa bản ghi và hoàn trả thuốc về kho' });
      queryClient.invalidateQueries({ queryKey: ['health-records'] });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['medicine-transactions'] });
      setDeleteRecord(null);
    },
    onError: (error: any) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Lịch sử chăm sóc sức khỏe</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1">
              {(['day', 'week', 'month'] as const).map((r) => (
                <Button
                  key={r}
                  variant={dateRange === r ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateRange(r)}
                >
                  {r === 'day' ? 'Ngày' : r === 'week' ? 'Tuần' : 'Tháng'}
                </Button>
              ))}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  {format(selectedDate, 'dd/MM/yyyy', { locale: vi })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  locale={vi}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm học sinh, chuẩn đoán..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="medicine">Phát thuốc</SelectItem>
              <SelectItem value="first_aid">Sơ cứu</SelectItem>
              <SelectItem value="hospital">Vào viện</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-700">
              {records.filter((r) => r.treatment_type === 'medicine').length}
            </p>
            <p className="text-xs text-green-600">Phát thuốc</p>
          </div>
          <div className="p-3 bg-yellow-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-yellow-700">
              {records.filter((r) => r.treatment_type === 'first_aid').length}
            </p>
            <p className="text-xs text-yellow-600">Sơ cứu</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-red-700">
              {records.filter((r) => r.treatment_type === 'hospital').length}
            </p>
            <p className="text-xs text-red-600">Vào viện</p>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <div className="max-h-[500px] lg:max-h-[calc(100vh-420px)] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead>Học sinh</TableHead>
                <TableHead>Chuẩn đoán</TableHead>
                <TableHead>Xử lý</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => {
                const treatment = TREATMENT_LABELS[record.treatment_type as HealthTreatmentType];
                const TreatmentIcon = treatment.icon;
                return (
                  <TableRow key={record.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(record.record_date), 'dd/MM', { locale: vi })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{record.student?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{record.student?.class?.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm line-clamp-2">{record.diagnosis}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('gap-1', treatment.color)}>
                        <TreatmentIcon className="h-3 w-3" />
                        {treatment.label}
                      </Badge>
                      {record.parent_contacted && (
                        <Badge variant="outline" className="ml-1 gap-1">
                          <Phone className="h-3 w-3" />
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setViewRecord(record)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(isAdmin || record.reporter_id === userId) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteRecord(record)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Không có bản ghi trong khoảng thời gian này
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      </CardContent>

      {/* View Detail Dialog */}
      <Dialog open={!!viewRecord} onOpenChange={() => setViewRecord(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết ghi nhận sức khỏe</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Học sinh</p>
                  <p className="font-medium">{viewRecord.student?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{viewRecord.student?.class?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ngày</p>
                  <p className="font-medium">
                    {format(new Date(viewRecord.record_date), 'dd/MM/yyyy', { locale: vi })}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Chuẩn đoán</p>
                <p className="font-medium">{viewRecord.diagnosis}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Xử lý</p>
                <Badge className={TREATMENT_LABELS[viewRecord.treatment_type as HealthTreatmentType].color}>
                  {TREATMENT_LABELS[viewRecord.treatment_type as HealthTreatmentType].label}
                </Badge>
              </div>
              {viewRecord.treatment_type === 'medicine' && viewRecord.medicines?.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-sm mb-2">Thuốc đã phát</p>
                  <div className="space-y-1">
                    {viewRecord.medicines.map((m: any) => (
                      <div key={m.id} className="flex justify-between text-sm bg-muted/50 p-2 rounded">
                        <span>{m.medicine?.name}</span>
                        <span className="font-medium">{m.quantity} {m.medicine?.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {viewRecord.treatment_type === 'hospital' && (
                <div className="bg-red-50 p-3 rounded-lg space-y-2 text-sm">
                  {viewRecord.hospital_name && (
                    <p><span className="text-muted-foreground">Bệnh viện:</span> {viewRecord.hospital_name}</p>
                  )}
                  {viewRecord.hospital_date && (
                    <p><span className="text-muted-foreground">Ngày nhập:</span> {format(new Date(viewRecord.hospital_date), 'dd/MM/yyyy')}</p>
                  )}
                  {viewRecord.discharge_date && (
                    <p><span className="text-muted-foreground">Ngày ra:</span> {format(new Date(viewRecord.discharge_date), 'dd/MM/yyyy')}</p>
                  )}
                  {viewRecord.hospital_result && (
                    <p><span className="text-muted-foreground">Kết quả:</span> {viewRecord.hospital_result}</p>
                  )}
                </div>
              )}
              {viewRecord.parent_contacted && (
                <div className="bg-blue-50 p-3 rounded-lg text-sm">
                  <p className="font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Đã liên hệ phụ huynh
                  </p>
                  {viewRecord.parent_contact_notes && (
                    <p className="mt-1 text-muted-foreground">{viewRecord.parent_contact_notes}</p>
                  )}
                </div>
              )}
              {viewRecord.notes && (
                <div>
                  <p className="text-muted-foreground text-sm">Ghi chú</p>
                  <p className="text-sm">{viewRecord.notes}</p>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Người ghi nhận: {viewRecord.reporter?.full_name || 'N/A'}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteRecord} onOpenChange={() => setDeleteRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa bản ghi sức khỏe của học sinh "{deleteRecord?.student?.full_name}"?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRecord(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteRecord && deleteMutation.mutate(deleteRecord)}
              disabled={deleteMutation.isPending}
            >
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
