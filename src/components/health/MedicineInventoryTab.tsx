import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus,
  Search,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  Trash2,
  Edit,
  Loader2,
  Pill,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Medicine, MedicineTransaction } from '@/types';

interface MedicineInventoryTabProps {
  schoolId: string;
  isAdmin: boolean;
  userId: string;
}

const UNIT_OPTIONS = ['viên', 'gói', 'lọ', 'tuýp', 'hộp', 'chai', 'vỉ', 'ống'];

export function MedicineInventoryTab({ schoolId, isAdmin, userId }: MedicineInventoryTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [editMedicine, setEditMedicine] = useState<Medicine | null>(null);
  const [deleteMedicine, setDeleteMedicine] = useState<Medicine | null>(null);

  // Form states
  const [medicineName, setMedicineName] = useState('');
  const [medicineUnit, setMedicineUnit] = useState('viên');
  const [medicineNotes, setMedicineNotes] = useState('');
  const [importQty, setImportQty] = useState<number>(0);
  const [importNotes, setImportNotes] = useState('');

  // Fetch medicines
  const { data: medicines = [], isLoading } = useQuery({
    queryKey: ['medicines', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('medicines')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Medicine[];
    },
    enabled: !!schoolId,
  });

  // Fetch transactions for history
  const { data: transactions = [] } = useQuery({
    queryKey: ['medicine-transactions', schoolId, selectedMedicine?.id],
    queryFn: async () => {
      if (!schoolId || !selectedMedicine?.id) return [];
      const { data, error } = await supabase
        .from('medicine_transactions')
        .select(`
          *,
          medicine:medicines(name, unit),
          profile:profiles(full_name)
        `)
        .eq('school_id', schoolId)
        .eq('medicine_id', selectedMedicine.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!schoolId && !!selectedMedicine?.id,
  });

  // Filter medicines
  const filteredMedicines = useMemo(() => {
    if (!searchTerm) return medicines;
    const term = searchTerm.toLowerCase();
    return medicines.filter((m) => m.name.toLowerCase().includes(term));
  }, [medicines, searchTerm]);

  // Add medicine mutation
  const addMutation = useMutation({
    mutationFn: async () => {
      if (!medicineName.trim()) throw new Error('Vui lòng nhập tên thuốc');
      const { error } = await supabase.from('medicines').insert({
        school_id: schoolId,
        name: medicineName.trim(),
        unit: medicineUnit,
        notes: medicineNotes.trim() || null,
        quantity: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Thành công', description: 'Đã thêm thuốc mới' });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setShowAddDialog(false);
      setMedicineName('');
      setMedicineNotes('');
    },
    onError: (error: any) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  // Update medicine mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editMedicine || !medicineName.trim()) throw new Error('Vui lòng nhập tên thuốc');
      const { error } = await supabase
        .from('medicines')
        .update({
          name: medicineName.trim(),
          unit: medicineUnit,
          notes: medicineNotes.trim() || null,
        })
        .eq('id', editMedicine.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Thành công', description: 'Đã cập nhật thuốc' });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setEditMedicine(null);
      setMedicineName('');
      setMedicineNotes('');
    },
    onError: (error: any) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  // Delete medicine mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('medicines')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Đã xóa', description: 'Đã xóa thuốc khỏi danh sách' });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setDeleteMedicine(null);
    },
    onError: (error: any) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  // Import medicine mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMedicine || importQty <= 0) throw new Error('Vui lòng nhập số lượng hợp lệ');
      
      // Update quantity
      const { error: updateError } = await supabase
        .from('medicines')
        .update({ quantity: selectedMedicine.quantity + importQty })
        .eq('id', selectedMedicine.id);
      if (updateError) throw updateError;

      // Log transaction
      const { error: txError } = await supabase.from('medicine_transactions').insert({
        school_id: schoolId,
        medicine_id: selectedMedicine.id,
        transaction_type: 'import',
        quantity: importQty,
        notes: importNotes.trim() || null,
        created_by: userId,
      });
      if (txError) throw txError;
    },
    onSuccess: () => {
      toast({ title: 'Thành công', description: 'Đã nhập thuốc vào kho' });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['medicine-transactions'] });
      setShowImportDialog(false);
      setImportQty(0);
      setImportNotes('');
      setSelectedMedicine(null);
    },
    onError: (error: any) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  const openEditDialog = (medicine: Medicine) => {
    setEditMedicine(medicine);
    setMedicineName(medicine.name);
    setMedicineUnit(medicine.unit);
    setMedicineNotes(medicine.notes || '');
  };

  const openImportDialog = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setShowImportDialog(true);
  };

  const openHistoryDialog = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setShowHistoryDialog(true);
  };

  // Stats
  const totalMedicines = medicines.length;
  const lowStockCount = medicines.filter((m) => m.quantity <= 10).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalMedicines}</p>
                <p className="text-xs text-muted-foreground">Loại thuốc</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn('bg-orange-50', lowStockCount > 0 && 'bg-red-50')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Pill className={cn('h-8 w-8', lowStockCount > 0 ? 'text-red-500' : 'text-orange-500')} />
              <div>
                <p className="text-2xl font-bold">{lowStockCount}</p>
                <p className="text-xs text-muted-foreground">Sắp hết (≤10)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Danh sách thuốc</CardTitle>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Thêm thuốc
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm thuốc..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên thuốc</TableHead>
                  <TableHead>Đơn vị</TableHead>
                  <TableHead className="text-center">Số lượng</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMedicines.map((med) => (
                  <TableRow key={med.id}>
                    <TableCell>
                      <p className="font-medium">{med.name}</p>
                      {med.notes && (
                        <p className="text-xs text-muted-foreground">{med.notes}</p>
                      )}
                    </TableCell>
                    <TableCell>{med.unit}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={med.quantity <= 10 ? 'destructive' : med.quantity <= 30 ? 'secondary' : 'default'}
                      >
                        {med.quantity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 hover:text-green-700"
                            onClick={() => openImportDialog(med)}
                            title="Nhập thuốc"
                          >
                            <ArrowUpCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openHistoryDialog(med)}
                          title="Lịch sử"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(med)}
                              title="Sửa"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteMedicine(med)}
                              title="Xóa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMedicines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'Không tìm thấy thuốc' : 'Chưa có thuốc nào trong kho'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add Medicine Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm thuốc mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tên thuốc *</Label>
              <Input
                placeholder="Nhập tên thuốc..."
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Đơn vị tính</Label>
              <Select value={medicineUnit} onValueChange={setMedicineUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Textarea
                placeholder="Ghi chú thêm..."
                value={medicineNotes}
                onChange={(e) => setMedicineNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Hủy
            </Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Thêm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Medicine Dialog */}
      <Dialog open={!!editMedicine} onOpenChange={() => setEditMedicine(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa thông tin thuốc</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tên thuốc *</Label>
              <Input
                placeholder="Nhập tên thuốc..."
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Đơn vị tính</Label>
              <Select value={medicineUnit} onValueChange={setMedicineUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Textarea
                placeholder="Ghi chú thêm..."
                value={medicineNotes}
                onChange={(e) => setMedicineNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMedicine(null)}>
              Hủy
            </Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteMedicine} onOpenChange={() => setDeleteMedicine(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa thuốc "{deleteMedicine?.name}" khỏi danh sách?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteMedicine(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMedicine && deleteMutation.mutate(deleteMedicine.id)}
              disabled={deleteMutation.isPending}
            >
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Medicine Dialog */}
      <Dialog open={showImportDialog} onOpenChange={() => { setShowImportDialog(false); setSelectedMedicine(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nhập thuốc vào kho</DialogTitle>
            <DialogDescription>
              Thuốc: <strong>{selectedMedicine?.name}</strong> (Hiện có: {selectedMedicine?.quantity} {selectedMedicine?.unit})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Số lượng nhập</Label>
              <Input
                type="number"
                min={1}
                value={importQty || ''}
                onChange={(e) => setImportQty(parseInt(e.target.value) || 0)}
                placeholder="Nhập số lượng..."
              />
            </div>
            <div className="space-y-2">
              <Label>Ghi chú (nguồn nhập, lô...)</Label>
              <Textarea
                placeholder="Ghi chú thêm..."
                value={importNotes}
                onChange={(e) => setImportNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImportDialog(false); setSelectedMedicine(null); }}>
              Hủy
            </Button>
            <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending || importQty <= 0}>
              {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Nhập kho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={() => { setShowHistoryDialog(false); setSelectedMedicine(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Lịch sử nhập/xuất thuốc</DialogTitle>
            <DialogDescription>
              Thuốc: <strong>{selectedMedicine?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className={cn(
                    'p-3 rounded-lg text-sm',
                    tx.transaction_type === 'import' ? 'bg-green-50' : 'bg-red-50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {tx.transaction_type === 'import' ? (
                        <ArrowUpCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium">
                        {tx.transaction_type === 'import' ? 'Nhập' : 'Xuất'}: {tx.quantity} {tx.medicine?.unit}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(tx.created_at), 'dd/MM HH:mm', { locale: vi })}
                    </span>
                  </div>
                  {tx.notes && <p className="text-xs text-muted-foreground mt-1">{tx.notes}</p>}
                  <p className="text-xs text-muted-foreground">
                    Bởi: {tx.profile?.full_name || 'N/A'}
                  </p>
                </div>
              ))}
              {transactions.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Chưa có lịch sử giao dịch</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
