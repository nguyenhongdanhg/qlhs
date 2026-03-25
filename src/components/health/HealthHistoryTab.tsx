import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, differenceInHours } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  RotateCcw,
  Archive,
  AlertTriangle,
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
  family_pickup: { label: 'Gia đình đón về', color: 'bg-blue-100 text-blue-700', icon: Phone },
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
  const [permanentDeleteRecord, setPermanentDeleteRecord] = useState<any>(null);
  const [showTrash, setShowTrash] = useState(false);

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

  // Fetch health records
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
          .order('record_date', { ascending: true })
          .order('created_at', { ascending: true })
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

  // Separate active and trashed records
  const activeRecords = useMemo(() => records.filter((r) => !r.deleted_at), [records]);
  const trashedRecords = useMemo(() => records.filter((r) => !!r.deleted_at), [records]);

  // Filter records based on current view
  const filteredRecords = useMemo(() => {
    const source = showTrash ? trashedRecords : activeRecords;
    return source.filter((r) => {
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
  }, [activeRecords, trashedRecords, showTrash, filterType, searchTerm]);

  // Soft delete - restore medicines then mark as deleted
  const softDeleteMutation = useMutation({
    mutationFn: async (record: any) => {
      // Restore medicines to inventory
      if (record.treatment_type === 'medicine' && record.medicines?.length > 0) {
        for (const item of record.medicines) {
          const medicineId = item.medicine?.id || item.medicine_id;
          if (medicineId && item.quantity > 0) {
            const { data: medicine, error: fetchError } = await supabase
              .from('medicines')
              .select('quantity')
              .eq('id', medicineId)
              .single();
            if (fetchError) throw fetchError;

            const { error: updateError } = await supabase
              .from('medicines')
              .update({ quantity: (medicine?.quantity || 0) + item.quantity })
              .eq('id', medicineId);
            if (updateError) throw updateError;

            const { error: txError } = await supabase
              .from('medicine_transactions')
              .insert({
                school_id: record.school_id,
                medicine_id: medicineId,
                transaction_type: 'import',
                quantity: item.quantity,
                notes: `Hoàn trả từ xóa tạm (HS: ${record.student?.full_name || 'N/A'})`,
              });
            if (txError) throw txError;
          }
        }
      }

      // Soft delete
      const { error } = await supabase
        .from('health_records')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', record.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Đã chuyển vào thùng rác', description: 'Bản ghi sẽ bị xóa vĩnh viễn sau 3 ngày' });
      queryClient.invalidateQueries({ queryKey: ['health-records'] });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['medicine-transactions'] });
      setDeleteRecord(null);
    },
    onError: (error: any) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  // Restore from trash - re-deduct medicines
  const restoreMutation = useMutation({
    mutationFn: async (record: any) => {
      // Re-deduct medicines from inventory
      if (record.treatment_type === 'medicine' && record.medicines?.length > 0) {
        for (const item of record.medicines) {
          const medicineId = item.medicine?.id || item.medicine_id;
          if (medicineId && item.quantity > 0) {
            const { data: medicine, error: fetchError } = await supabase
              .from('medicines')
              .select('quantity')
              .eq('id', medicineId)
              .single();
            if (fetchError) throw fetchError;

            const newQty = Math.max(0, (medicine?.quantity || 0) - item.quantity);
            const { error: updateError } = await supabase
              .from('medicines')
              .update({ quantity: newQty })
              .eq('id', medicineId);
            if (updateError) throw updateError;

            const { error: txError } = await supabase
              .from('medicine_transactions')
              .insert({
                school_id: record.school_id,
                medicine_id: medicineId,
                transaction_type: 'export',
                quantity: item.quantity,
                notes: `Khôi phục phát thuốc (HS: ${record.student?.full_name || 'N/A'})`,
              });
            if (txError) throw txError;
          }
        }
      }

      // Clear deleted_at
      const { error } = await supabase
        .from('health_records')
        .update({ deleted_at: null })
        .eq('id', record.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Đã khôi phục', description: 'Bản ghi đã được khôi phục thành công' });
      queryClient.invalidateQueries({ queryKey: ['health-records'] });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['medicine-transactions'] });
    },
    onError: (error: any) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  // Permanent delete
  const permanentDeleteMutation = useMutation({
    mutationFn: async (record: any) => {
      const { error } = await supabase.from('health_records').delete().eq('id', record.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Đã xóa vĩnh viễn', description: 'Bản ghi đã bị xóa hoàn toàn' });
      queryClient.invalidateQueries({ queryKey: ['health-records'] });
      setPermanentDeleteRecord(null);
    },
    onError: (error: any) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  const getRemainingHours = (deletedAt: string) => {
    const deleteTime = new Date(deletedAt);
    const expiryTime = new Date(deleteTime.getTime() + 3 * 24 * 60 * 60 * 1000);
    const hoursLeft = differenceInHours(expiryTime, new Date());
    return Math.max(0, hoursLeft);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Lịch sử chăm sóc sức khỏe</CardTitle>
          <div className="flex flex-wrap gap-2">
            {canDelete && (
              <Button
                variant={showTrash ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowTrash(!showTrash)}
                className={showTrash ? 'bg-orange-600 hover:bg-orange-700' : ''}
              >
                <Archive className="h-4 w-4 mr-1" />
                Thùng rác
                {trashedRecords.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {trashedRecords.length}
                  </Badge>
                )}
              </Button>
            )}
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
        {/* Trash banner */}
        {showTrash && (
          <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Các bản ghi trong thùng rác sẽ bị xóa vĩnh viễn sau 3 ngày. Bạn có thể khôi phục trước thời hạn.</span>
          </div>
        )}

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
              <SelectItem value="family_pickup">Gia đình đón về</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats - only show for active view */}
        {!showTrash && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-700">
                {activeRecords.filter((r) => r.treatment_type === 'medicine').length}
              </p>
              <p className="text-xs text-green-600">Phát thuốc</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-yellow-700">
                {activeRecords.filter((r) => r.treatment_type === 'first_aid').length}
              </p>
              <p className="text-xs text-yellow-600">Sơ cứu</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-700">
                {activeRecords.filter((r) => r.treatment_type === 'hospital').length}
              </p>
              <p className="text-xs text-red-600">Vào viện</p>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="border rounded-lg">
          <div className="max-h-[500px] lg:max-h-[calc(100vh-420px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">STT</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Học sinh</TableHead>
                  <TableHead>Chuẩn đoán</TableHead>
                  <TableHead>Xử lý</TableHead>
                  {showTrash && <TableHead>Còn lại</TableHead>}
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record, idx) => {
                  const treatment = TREATMENT_LABELS[record.treatment_type as HealthTreatmentType];
                  const TreatmentIcon = treatment.icon;
                  const hoursLeft = record.deleted_at ? getRemainingHours(record.deleted_at) : 0;

                  return (
                    <TableRow key={record.id} className={showTrash ? 'opacity-75' : ''}>
                      <TableCell className="text-center text-muted-foreground text-xs">{idx + 1}</TableCell>
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
                      {showTrash && (
                        <TableCell>
                          <Badge variant={hoursLeft <= 24 ? 'destructive' : 'secondary'} className="text-xs">
                            {hoursLeft > 0 ? `${hoursLeft}h` : 'Hết hạn'}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {showTrash ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-600 hover:text-green-700"
                                onClick={() => restoreMutation.mutate(record)}
                                disabled={restoreMutation.isPending}
                                title="Khôi phục"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => setPermanentDeleteRecord(record)}
                                  title="Xóa vĩnh viễn"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setViewRecord(record)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteRecord(record)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={showTrash ? 7 : 6} className="text-center py-8 text-muted-foreground">
                      {showTrash ? 'Thùng rác trống' : 'Không có bản ghi trong khoảng thời gian này'}
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

      {/* Soft Delete Confirm Dialog */}
      <Dialog open={!!deleteRecord} onOpenChange={() => setDeleteRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
            <DialogDescription>
              Bản ghi sức khỏe của "{deleteRecord?.student?.full_name}" sẽ được chuyển vào thùng rác và tự động xóa vĩnh viễn sau 3 ngày. Bạn có thể khôi phục trước thời hạn.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRecord(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteRecord && softDeleteMutation.mutate(deleteRecord)}
              disabled={softDeleteMutation.isPending}
            >
              Chuyển vào thùng rác
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirm Dialog */}
      <Dialog open={!!permanentDeleteRecord} onOpenChange={() => setPermanentDeleteRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Xóa vĩnh viễn
            </DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa vĩnh viễn bản ghi của "{permanentDeleteRecord?.student?.full_name}"? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermanentDeleteRecord(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => permanentDeleteRecord && permanentDeleteMutation.mutate(permanentDeleteRecord)}
              disabled={permanentDeleteMutation.isPending}
            >
              Xóa vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
