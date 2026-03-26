import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, GripVertical, Calculator } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface FormulaColumn {
  id?: string;
  school_id: string;
  column_name: string;
  weight: number;
  display_order: number;
  is_active: boolean;
}

interface EmulationFormulaTabProps {
  schoolId: string;
  canEdit: boolean;
}

export function EmulationFormulaTab({ schoolId, canEdit }: EmulationFormulaTabProps) {
  const queryClient = useQueryClient();
  const [localColumns, setLocalColumns] = useState<FormulaColumn[] | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: savedColumns = [], isLoading } = useQuery({
    queryKey: ['emulation-formula-columns', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('emulation_formula_columns')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as FormulaColumn[];
    },
    enabled: !!schoolId,
  });

  const columns = localColumns ?? savedColumns;

  const initLocalIfNeeded = () => {
    if (!localColumns) {
      setLocalColumns([...savedColumns]);
    }
  };

  const addColumn = () => {
    initLocalIfNeeded();
    const current = localColumns ?? [...savedColumns];
    const newCol: FormulaColumn = {
      school_id: schoolId,
      column_name: `Cột ${current.length + 1}`,
      weight: 1,
      display_order: current.length,
      is_active: true,
    };
    setLocalColumns([...current, newCol]);
    setHasChanges(true);
  };

  const removeColumn = (index: number) => {
    initLocalIfNeeded();
    const current = localColumns ?? [...savedColumns];
    setLocalColumns(current.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const updateColumn = (index: number, field: keyof FormulaColumn, value: string | number) => {
    initLocalIfNeeded();
    const current = localColumns ?? [...savedColumns];
    const updated = [...current];
    updated[index] = { ...updated[index], [field]: value };
    setLocalColumns(updated);
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!localColumns) return;

      // Delete all existing columns for this school
      await supabase
        .from('emulation_formula_columns')
        .delete()
        .eq('school_id', schoolId);

      // Insert new columns
      if (localColumns.length > 0) {
        const toInsert = localColumns.map((col, i) => ({
          school_id: schoolId,
          column_name: col.column_name,
          weight: col.weight,
          display_order: i,
          is_active: true,
        }));
        const { error } = await supabase
          .from('emulation_formula_columns')
          .insert(toInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Đã lưu công thức thi đua' });
      setLocalColumns(null);
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['emulation-formula-columns'] });
    },
    onError: (error) => {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    },
  });

  // Build formula string
  const totalWeight = columns.reduce((sum, col) => sum + col.weight, 0);
  const formulaParts = columns.map((col) => {
    if (col.weight === 1) return col.column_name;
    return `${col.column_name} ×${col.weight}`;
  });
  const formulaString = columns.length > 0
    ? `(${formulaParts.join(' + ')}) ÷ ${totalWeight}`
    : 'Chưa có cột nào';

  // Default formula (currently hardcoded in the system)
  const defaultFormula = '(Học tập ×2 + Nề nếp + Nội trú) ÷ 4';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Công thức tính thi đua</CardTitle>
              <CardDescription>Thiết lập các cột điểm và hệ số tính trung bình</CardDescription>
            </div>
            {canEdit && hasChanges && (
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Lưu công thức
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current formula display */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Công thức hiện tại</span>
            </div>
            <p className="text-lg font-mono font-semibold text-foreground">
              {columns.length > 0 ? formulaString : defaultFormula}
            </p>
            {columns.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Đang sử dụng công thức mặc định. Thêm cột bên dưới để tùy chỉnh.
              </p>
            )}
          </div>

          {/* Column settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Các cột điểm</h3>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={addColumn}>
                  <Plus className="h-4 w-4 mr-1" />
                  Thêm cột
                </Button>
              )}
            </div>

            {columns.length === 0 && !isLoading && (
              <div className="text-center py-6 text-muted-foreground border rounded-lg border-dashed">
                <p className="text-sm">Chưa có cột tùy chỉnh nào</p>
                <p className="text-xs mt-1">Hệ thống đang sử dụng 3 cột mặc định: Học tập (×2), Nề nếp (×1), Nội trú (×1)</p>
              </div>
            )}

            {columns.map((col, index) => (
              <div
                key={col.id || `new-${index}`}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Tên cột</label>
                    {canEdit ? (
                      <Input
                        value={col.column_name}
                        onChange={(e) => updateColumn(index, 'column_name', e.target.value)}
                        placeholder="Tên cột điểm"
                        className="h-9"
                      />
                    ) : (
                      <p className="text-sm font-medium">{col.column_name}</p>
                    )}
                  </div>
                  <div className="w-[120px]">
                    <label className="text-xs text-muted-foreground mb-1 block">Hệ số</label>
                    {canEdit ? (
                      <Select
                        value={col.weight.toString()}
                        onValueChange={(v) => updateColumn(index, 'weight', parseFloat(v))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5].map((w) => (
                            <SelectItem key={w} value={w.toString()}>
                              ×{w}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">×{col.weight}</Badge>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => removeColumn(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Formula explanation */}
          {columns.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Giải thích công thức</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Tổng hệ số: <span className="font-semibold text-foreground">{totalWeight}</span></p>
                {columns.map((col, i) => (
                  <p key={i}>
                    • {col.column_name}: hệ số <span className="font-semibold text-foreground">×{col.weight}</span>
                    {col.weight > 1 && ` (điểm ${col.column_name} được nhân ${col.weight})`}
                  </p>
                ))}
                <p className="mt-2 font-medium text-foreground">
                  Điểm TB = {formulaString}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
