import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, addDays, subDays } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon, Plus, Copy, Trash2, Edit2, ChevronLeft, ChevronRight } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface FoodItem {
  id: string;
  name: string;
  unit: string;
  default_price: number;
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [transactionType, setTransactionType] = useState<string>('import');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showAddFoodDialog, setShowAddFoodDialog] = useState(false);
  const [copyFromDate, setCopyFromDate] = useState<Date>(subDays(new Date(), 1));
  const [editingItem, setEditingItem] = useState<Partial<KitchenTransaction> | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [newItem, setNewItem] = useState({ item_name: '', unit: 'kg', quantity: 0, unit_price: 0, notes: '', supplier: '' });
  const [newFoodItem, setNewFoodItem] = useState({ name: '', unit: 'kg', default_price: 0 });

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  useEffect(() => {
    fetchFoodItems();
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
            <Button size="sm" variant="outline" onClick={() => setShowAddFoodDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />Thực phẩm
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
            <Input placeholder="Nhà cung cấp" value={newItem.supplier} onChange={e => setNewItem(p => ({ ...p, supplier: e.target.value }))} />
            <Input placeholder="Ghi chú" value={newItem.notes} onChange={e => setNewItem(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Hủy</Button>
            <Button onClick={addTransaction} disabled={loading}>Thêm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add food item dialog */}
      <Dialog open={showAddFoodDialog} onOpenChange={setShowAddFoodDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm thực phẩm mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Tên thực phẩm *" value={newFoodItem.name} onChange={e => setNewFoodItem(p => ({ ...p, name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="ĐVT (kg, lít...)" value={newFoodItem.unit} onChange={e => setNewFoodItem(p => ({ ...p, unit: e.target.value }))} />
              <Input type="number" placeholder="Giá mặc định" value={newFoodItem.default_price || ''} onChange={e => setNewFoodItem(p => ({ ...p, default_price: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFoodDialog(false)}>Hủy</Button>
            <Button onClick={addFoodItem} disabled={loading}>Thêm</Button>
          </DialogFooter>
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
              <Input placeholder="Nhà cung cấp" value={editingItem.supplier || ''} onChange={e => setEditingItem(p => p ? { ...p, supplier: e.target.value } : null)} />
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
