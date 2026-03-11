import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format, addDays, subDays } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon, Plus, Copy, Trash2, Edit2, ChevronLeft, ChevronRight, Store, Phone, MapPin, Package, Search, Pin } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface FoodItem {
  id: string;
  name: string;
  unit: string;
  default_price: number;
}

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
}

interface KitchenTransaction {
  id: string;
  transaction_date: string;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  transaction_type: string;
  notes: string | null;
  created_by: string | null;
  supplier: string | null;
}

interface KitchenInventoryTabProps {
  schoolId: string;
  canEdit: boolean;
}

export function KitchenInventoryTab({ schoolId, canEdit }: KitchenInventoryTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<KitchenTransaction[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [transactionType, setTransactionType] = useState<string>('import');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showAddFoodDialog, setShowAddFoodDialog] = useState(false);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [copyFromDate, setCopyFromDate] = useState<Date>(subDays(new Date(), 1));
  const [editingItem, setEditingItem] = useState<Partial<KitchenTransaction> | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [newItem, setNewItem] = useState({ item_name: '', unit: 'kg', quantity: 0, unit_price: 0, notes: '', supplier: '' });
  const [newFoodItem, setNewFoodItem] = useState({ name: '', unit: 'kg', default_price: 0 });
  const [editingFoodItem, setEditingFoodItem] = useState<FoodItem | null>(null);
  const [foodSearchQuery, setFoodSearchQuery] = useState("");
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', address: '', notes: '' });
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  useEffect(() => {
    fetchFoodItems();
    fetchSuppliers();
  }, [schoolId]);

  useEffect(() => {
    fetchTransactions();
  }, [schoolId, dateStr, transactionType]);

  const fetchFoodItems = async () => {
    const { data } = await supabase
      .from('food_items')
      .select('*')
      .eq('school_id', schoolId)
      .eq('category', 'ingredient')
      .eq('is_active', true)
      .order('name');
    if (data) setFoodItems(data as FoodItem[]);
  };

  const fetchSuppliers = async () => {
    const { data } = await supabase
      .from('kitchen_suppliers')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name');
    if (data) setSuppliers(data as Supplier[]);
  };

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('kitchen_transactions')
      .select('*')
      .eq('school_id', schoolId)
      .eq('transaction_date', dateStr)
      .eq('transaction_type', transactionType)
      .order('created_at');
    if (data) setTransactions(data as KitchenTransaction[]);
  };

  const selectFoodItem = (item: FoodItem) => {
    setNewItem(prev => ({
      ...prev,
      item_name: item.name,
      unit: item.unit || 'kg',
      unit_price: item.default_price || 0,
    }));
    setSearchQuery("");
  };

  const addFoodItem = async () => {
    if (!newFoodItem.name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('food_items').insert({
      school_id: schoolId,
      name: newFoodItem.name.trim(),
      category: 'ingredient',
      unit: newFoodItem.unit,
      default_price: newFoodItem.default_price,
    });
    if (error) {
      toast({ title: "Lỗi", description: error.message.includes('duplicate') ? "Thực phẩm đã tồn tại" : error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã thêm thực phẩm" });
      setNewFoodItem({ name: '', unit: 'kg', default_price: 0 });
      setShowAddFoodDialog(false);
      fetchFoodItems();
    }
    setLoading(false);
  };

  const updateFoodItem = async () => {
    if (!editingFoodItem) return;
    setLoading(true);
    const { error } = await supabase.from('food_items').update({
      name: editingFoodItem.name,
      unit: editingFoodItem.unit,
      default_price: editingFoodItem.default_price,
    }).eq('id', editingFoodItem.id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã cập nhật thực phẩm" });
      setEditingFoodItem(null);
      fetchFoodItems();
    }
    setLoading(false);
  };

  const deleteFoodItem = async (id: string) => {
    const { error } = await supabase.from('food_items').update({ is_active: false }).eq('id', id);
    if (!error) {
      toast({ title: "Đã xóa thực phẩm" });
      fetchFoodItems();
    }
  };

  const addSupplier = async () => {
    if (!newSupplier.name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('kitchen_suppliers').insert({
      school_id: schoolId,
      name: newSupplier.name.trim(),
      phone: newSupplier.phone || null,
      address: newSupplier.address || null,
      notes: newSupplier.notes || null,
    });
    if (error) {
      toast({ title: "Lỗi", description: error.message.includes('duplicate') ? "Nhà cung cấp đã tồn tại" : error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã thêm nhà cung cấp" });
      setNewSupplier({ name: '', phone: '', address: '', notes: '' });
      fetchSuppliers();
    }
    setLoading(false);
  };

  const updateSupplier = async () => {
    if (!editingSupplier) return;
    setLoading(true);
    const { error } = await supabase.from('kitchen_suppliers').update({
      name: editingSupplier.name,
      phone: editingSupplier.phone,
      address: editingSupplier.address,
      notes: editingSupplier.notes,
    }).eq('id', editingSupplier.id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã cập nhật" });
      setEditingSupplier(null);
      fetchSuppliers();
    }
    setLoading(false);
  };

  const deleteSupplier = async (id: string) => {
    const { error } = await supabase.from('kitchen_suppliers').update({ is_active: false }).eq('id', id);
    if (!error) {
      toast({ title: "Đã xóa nhà cung cấp" });
      fetchSuppliers();
    }
  };

  const addTransaction = async () => {
    if (!newItem.item_name.trim()) {
      toast({ title: "Vui lòng chọn thực phẩm", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('kitchen_transactions').insert({
      school_id: schoolId,
      transaction_date: dateStr,
      item_name: newItem.item_name,
      unit: newItem.unit,
      quantity: newItem.quantity,
      unit_price: newItem.unit_price,
      transaction_type: transactionType,
      notes: newItem.notes || null,
      supplier: newItem.supplier || null,
      created_by: user?.id,
    });
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã thêm" });
      setNewItem({ item_name: '', unit: 'kg', quantity: 0, unit_price: 0, notes: '', supplier: '' });
      setShowAddDialog(false);
      fetchTransactions();
    }
    setLoading(false);
  };

  const updateTransaction = async () => {
    if (!editingItem?.id) return;
    setLoading(true);
    const { error } = await supabase.from('kitchen_transactions').update({
      item_name: editingItem.item_name,
      unit: editingItem.unit,
      quantity: editingItem.quantity,
      unit_price: editingItem.unit_price,
      notes: editingItem.notes,
      supplier: editingItem.supplier,
    }).eq('id', editingItem.id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã cập nhật" });
      setEditingItem(null);
      fetchTransactions();
    }
    setLoading(false);
  };

  const deleteTransaction = async (id: string) => {
    const { error } = await supabase.from('kitchen_transactions').delete().eq('id', id);
    if (!error) fetchTransactions();
  };

  const copyFromOtherDate = async () => {
    setLoading(true);
    const copyDateStr = format(copyFromDate, 'yyyy-MM-dd');
    const { data: sourceData } = await supabase
      .from('kitchen_transactions')
      .select('*')
      .eq('school_id', schoolId)
      .eq('transaction_date', copyDateStr)
      .eq('transaction_type', transactionType);

    if (!sourceData || sourceData.length === 0) {
      toast({ title: "Không có dữ liệu", description: `Ngày ${format(copyFromDate, 'dd/MM/yyyy')} không có phiếu ${transactionType === 'import' ? 'nhập' : 'xuất'}`, variant: "destructive" });
      setLoading(false);
      return;
    }

    const inserts = sourceData.map(item => ({
      school_id: schoolId,
      transaction_date: dateStr,
      item_name: item.item_name,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      transaction_type: transactionType,
      notes: `Sao chép từ ${format(copyFromDate, 'dd/MM/yyyy')}`,
      supplier: item.supplier || null,
      created_by: user?.id,
    }));

    const { error } = await supabase.from('kitchen_transactions').insert(inserts);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Đã sao chép ${inserts.length} mục` });
      setShowCopyDialog(false);
      fetchTransactions();
    }
    setLoading(false);
  };

  const totalAmount = useMemo(() =>
    transactions.reduce((sum, t) => sum + (t.quantity * t.unit_price), 0),
    [transactions]
  );

  const formatCurrency = (n: number) => n.toLocaleString('vi-VN') + 'đ';

  const filteredFoodItems = foodItems.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Supplier selector component
  const SupplierSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value || '_none'} onValueChange={(v) => onChange(v === '_none' ? '' : v)}>
      <SelectTrigger>
        <SelectValue placeholder="Chọn NCC" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">-- Không chọn --</SelectItem>
        {suppliers.map(s => (
          <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => subDays(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="h-4 w-4 mr-1" />
                {format(selectedDate, 'dd/MM/yyyy', { locale: vi })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} locale={vi} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => addDays(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Select value={transactionType} onValueChange={setTransactionType}>
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="import">Nhập kho</SelectItem>
            <SelectItem value="export">Xuất kho</SelectItem>
          </SelectContent>
        </Select>

        {canEdit && (
          <div className="flex gap-1 ml-auto">
            <Button size="sm" variant="outline" onClick={() => setShowSupplierDialog(true)}>
              <Store className="h-4 w-4 mr-1" />NCC
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setFoodSearchQuery(''); setShowAddFoodDialog(true); }}>
              <Package className="h-4 w-4 mr-1" />Thực phẩm
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCopyDialog(true)}>
              <Copy className="h-4 w-4 mr-1" />Sao chép
            </Button>
            <Button size="sm" onClick={() => { setNewItem({ item_name: '', unit: 'kg', quantity: 0, unit_price: 0, notes: '', supplier: '' }); setShowAddDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" />Thêm
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">STT</TableHead>
                <TableHead>Tên thực phẩm</TableHead>
                <TableHead className="w-28">NCC</TableHead>
                <TableHead className="w-20">ĐVT</TableHead>
                <TableHead className="w-24 text-right">Số lượng</TableHead>
                <TableHead className="w-28 text-right">Đơn giá</TableHead>
                <TableHead className="w-28 text-right">Thành tiền</TableHead>
                {canEdit && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 8 : 7} className="text-center text-muted-foreground py-8">
                    Chưa có dữ liệu {transactionType === 'import' ? 'nhập' : 'xuất'} kho ngày {format(selectedDate, 'dd/MM/yyyy')}
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((t, idx) => (
                  <TableRow key={t.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-medium">{t.item_name}</TableCell>
                    <TableCell className="text-xs">{t.supplier || '-'}</TableCell>
                    <TableCell>{t.unit}</TableCell>
                    <TableCell className="text-right">{t.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(t.unit_price)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(t.quantity * t.unit_price)}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem(t)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTransaction(t.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
              {transactions.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={6} className="text-right">TỔNG CỘNG:</TableCell>
                  <TableCell className="text-right text-primary">{formatCurrency(totalAmount)}</TableCell>
                  {canEdit && <TableCell />}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add transaction dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm {transactionType === 'import' ? 'nhập' : 'xuất'} kho</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-1">Chọn thực phẩm:</p>
              <Command className="border rounded-md">
                <CommandInput
                  placeholder="Tìm thực phẩm..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList className="max-h-[150px]">
                  <CommandEmpty>
                    <span className="text-sm text-muted-foreground">Không tìm thấy. </span>
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredFoodItems.map(item => (
                      <CommandItem
                        key={item.id}
                        onSelect={() => selectFoodItem(item)}
                        className="cursor-pointer"
                      >
                        {item.name} {item.unit && `(${item.unit})`}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
              {newItem.item_name && (
                <p className="text-sm mt-1">Đã chọn: <span className="font-semibold">{newItem.item_name}</span></p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="ĐVT" value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))} />
              <Input type="number" placeholder="Số lượng" value={newItem.quantity || ''} onChange={e => setNewItem(p => ({ ...p, quantity: parseFloat(e.target.value) || 0 }))} />
              <Input type="number" placeholder="Đơn giá" value={newItem.unit_price || ''} onChange={e => setNewItem(p => ({ ...p, unit_price: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="text-right text-sm text-muted-foreground">
              Thành tiền: <span className="font-semibold text-foreground">{formatCurrency(newItem.quantity * newItem.unit_price)}</span>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Nhà cung cấp:</p>
              <SupplierSelect value={newItem.supplier} onChange={(v) => setNewItem(p => ({ ...p, supplier: v }))} />
            </div>
            <Input placeholder="Ghi chú" value={newItem.notes} onChange={e => setNewItem(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Hủy</Button>
            <Button onClick={addTransaction} disabled={loading}>Thêm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Food items management dialog */}
      <Dialog open={showAddFoodDialog} onOpenChange={setShowAddFoodDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Quản lý danh sách thực phẩm
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add new food item form */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Thêm thực phẩm mới</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  placeholder="Tên thực phẩm *"
                  value={newFoodItem.name}
                  onChange={e => setNewFoodItem(p => ({ ...p, name: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="ĐVT (kg, lít...)"
                    value={newFoodItem.unit}
                    onChange={e => setNewFoodItem(p => ({ ...p, unit: e.target.value }))}
                  />
                  <Input
                    type="number"
                    placeholder="Giá mặc định"
                    value={newFoodItem.default_price || ''}
                    onChange={e => setNewFoodItem(p => ({ ...p, default_price: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <Button size="sm" onClick={addFoodItem} disabled={loading || !newFoodItem.name.trim()} className="w-full">
                  <Plus className="h-4 w-4 mr-1" />Thêm
                </Button>
              </CardContent>
            </Card>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm thực phẩm..."
                value={foodSearchQuery}
                onChange={e => setFoodSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Food items list */}
            {foodItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Chưa có thực phẩm nào</p>
            ) : (
              <div className="space-y-2">
                {foodItems
                  .filter(f => f.name.toLowerCase().includes(foodSearchQuery.toLowerCase()))
                  .map(f => (
                  <Card key={f.id} className="p-3">
                    {editingFoodItem?.id === f.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editingFoodItem.name}
                          onChange={e => setEditingFoodItem(p => p ? { ...p, name: e.target.value } : null)}
                          placeholder="Tên thực phẩm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={editingFoodItem.unit}
                            onChange={e => setEditingFoodItem(p => p ? { ...p, unit: e.target.value } : null)}
                            placeholder="ĐVT"
                          />
                          <Input
                            type="number"
                            value={editingFoodItem.default_price || ''}
                            onChange={e => setEditingFoodItem(p => p ? { ...p, default_price: parseFloat(e.target.value) || 0 } : null)}
                            placeholder="Giá mặc định"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={updateFoodItem} disabled={loading}>Lưu</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingFoodItem(null)}>Hủy</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{f.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.unit} {f.default_price > 0 && `• ${f.default_price.toLocaleString('vi-VN')}đ`}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingFoodItem(f)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteFoodItem(f.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">Tổng: {foodItems.length} thực phẩm</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplier management dialog */}
      <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Quản lý nhà cung cấp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add new supplier form */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Thêm nhà cung cấp</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  placeholder="Tên nhà cung cấp *"
                  value={newSupplier.name}
                  onChange={e => setNewSupplier(p => ({ ...p, name: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Số điện thoại"
                    value={newSupplier.phone}
                    onChange={e => setNewSupplier(p => ({ ...p, phone: e.target.value }))}
                  />
                  <Input
                    placeholder="Địa chỉ"
                    value={newSupplier.address}
                    onChange={e => setNewSupplier(p => ({ ...p, address: e.target.value }))}
                  />
                </div>
                <Input
                  placeholder="Ghi chú"
                  value={newSupplier.notes}
                  onChange={e => setNewSupplier(p => ({ ...p, notes: e.target.value }))}
                />
                <Button size="sm" onClick={addSupplier} disabled={loading || !newSupplier.name.trim()} className="w-full">
                  <Plus className="h-4 w-4 mr-1" />Thêm
                </Button>
              </CardContent>
            </Card>

            {/* Supplier list */}
            {suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Chưa có nhà cung cấp nào</p>
            ) : (
              <div className="space-y-2">
                {suppliers.map(s => (
                  <Card key={s.id} className="p-3">
                    {editingSupplier?.id === s.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editingSupplier.name}
                          onChange={e => setEditingSupplier(p => p ? { ...p, name: e.target.value } : null)}
                          placeholder="Tên"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={editingSupplier.phone || ''}
                            onChange={e => setEditingSupplier(p => p ? { ...p, phone: e.target.value } : null)}
                            placeholder="SĐT"
                          />
                          <Input
                            value={editingSupplier.address || ''}
                            onChange={e => setEditingSupplier(p => p ? { ...p, address: e.target.value } : null)}
                            placeholder="Địa chỉ"
                          />
                        </div>
                        <Input
                          value={editingSupplier.notes || ''}
                          onChange={e => setEditingSupplier(p => p ? { ...p, notes: e.target.value } : null)}
                          placeholder="Ghi chú"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={updateSupplier} disabled={loading}>Lưu</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingSupplier(null)}>Hủy</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{s.name}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            {s.phone && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />{s.phone}
                              </span>
                            )}
                            {s.address && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />{s.address}
                              </span>
                            )}
                          </div>
                          {s.notes && <p className="text-xs text-muted-foreground mt-0.5">{s.notes}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSupplier(s)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSupplier(s.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa mục</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-3">
              <Input placeholder="Tên thực phẩm" value={editingItem.item_name || ''} onChange={e => setEditingItem(p => p ? { ...p, item_name: e.target.value } : null)} />
              <div>
                <p className="text-sm font-medium mb-1">Nhà cung cấp:</p>
                <SupplierSelect value={editingItem.supplier || ''} onChange={(v) => setEditingItem(p => p ? { ...p, supplier: v } : null)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="ĐVT" value={editingItem.unit || ''} onChange={e => setEditingItem(p => p ? { ...p, unit: e.target.value } : null)} />
                <Input type="number" placeholder="Số lượng" value={editingItem.quantity || ''} onChange={e => setEditingItem(p => p ? { ...p, quantity: parseFloat(e.target.value) || 0 } : null)} />
                <Input type="number" placeholder="Đơn giá" value={editingItem.unit_price || ''} onChange={e => setEditingItem(p => p ? { ...p, unit_price: parseFloat(e.target.value) || 0 } : null)} />
              </div>
              <Input placeholder="Ghi chú" value={editingItem.notes || ''} onChange={e => setEditingItem(p => p ? { ...p, notes: e.target.value } : null)} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>Hủy</Button>
            <Button onClick={updateTransaction} disabled={loading}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy dialog */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sao chép từ ngày khác</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sao chép danh sách {transactionType === 'import' ? 'nhập' : 'xuất'} kho từ ngày khác sang ngày {format(selectedDate, 'dd/MM/yyyy')}.
          </p>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(copyFromDate, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={copyFromDate} onSelect={(d) => d && setCopyFromDate(d)} locale={vi} />
            </PopoverContent>
          </Popover>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>Hủy</Button>
            <Button onClick={copyFromOtherDate} disabled={loading}>
              <Copy className="h-4 w-4 mr-1" />Sao chép
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
