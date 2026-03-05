import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfWeek, endOfWeek, addDays, isSameDay } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2, Save, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const MEAL_LABELS: Record<string, string> = { breakfast: 'Sáng', lunch: 'Trưa', dinner: 'Tối' };
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;

interface FoodItem {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
}

interface MenuTemplate {
  id?: string;
  day_of_week: number;
  meal_type: string;
  dishes: string;
}

interface MenuAssignment {
  id?: string;
  menu_date: string;
  meal_type: string;
  dishes: string;
}

interface MenuTemplateTabProps {
  schoolId: string;
  canEdit: boolean;
}

export function MenuTemplateTab({ schoolId, canEdit }: MenuTemplateTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dishes, setDishes] = useState<FoodItem[]>([]);
  const [templates, setTemplates] = useState<MenuTemplate[]>([]);
  const [assignments, setAssignments] = useState<MenuAssignment[]>([]);
  const [activeSubTab, setActiveSubTab] = useState("dishes");
  const [newDishName, setNewDishName] = useState("");
  const [loading, setLoading] = useState(false);

  // Assign dialog state
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedDish, setSelectedDish] = useState<FoodItem | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string>("breakfast");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // Weekly view
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date());
  const weekStart = startOfWeek(selectedWeekDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedWeekDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    fetchDishes();
    fetchTemplates();
  }, [schoolId]);

  useEffect(() => {
    fetchAssignments();
  }, [schoolId, weekStart.toISOString()]);

  const fetchDishes = async () => {
    const { data } = await supabase
      .from('food_items')
      .select('*')
      .eq('school_id', schoolId)
      .eq('category', 'dish')
      .eq('is_active', true)
      .order('name');
    if (data) setDishes(data as FoodItem[]);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('weekly_menu_templates')
      .select('*')
      .eq('school_id', schoolId)
      .order('day_of_week')
      .order('meal_type');
    if (data) setTemplates(data);
  };

  const fetchAssignments = async () => {
    const { data } = await supabase
      .from('menu_assignments')
      .select('*')
      .eq('school_id', schoolId)
      .gte('menu_date', format(weekStart, 'yyyy-MM-dd'))
      .lte('menu_date', format(weekEnd, 'yyyy-MM-dd'));
    if (data) setAssignments(data);
  };

  const addDish = async () => {
    if (!newDishName.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('food_items').insert({
      school_id: schoolId,
      name: newDishName.trim(),
      category: 'dish',
    });
    if (error) {
      toast({ title: "Lỗi", description: error.message.includes('duplicate') ? "Món ăn đã tồn tại" : error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã thêm món" });
      setNewDishName("");
      fetchDishes();
    }
    setLoading(false);
  };

  const deleteDish = async (id: string) => {
    const { error } = await supabase.from('food_items').update({ is_active: false }).eq('id', id);
    if (!error) fetchDishes();
  };

  const openAssignDialog = (dish: FoodItem) => {
    setSelectedDish(dish);
    setSelectedMealType("breakfast");
    // Pre-select days where this dish is already assigned
    const existingDays = templates
      .filter(t => t.dishes.includes(dish.name))
      .reduce((acc, t) => {
        if (t.meal_type === "breakfast") acc.push(t.day_of_week);
        return acc;
      }, [] as number[]);
    setSelectedDays(existingDays);
    setShowAssignDialog(true);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const saveAssignment = async () => {
    if (!selectedDish) return;
    setLoading(true);

    // For each selected day, upsert the template adding this dish
    for (const dayOfWeek of selectedDays) {
      const existing = templates.find(t => t.day_of_week === dayOfWeek && t.meal_type === selectedMealType);
      const currentDishes = existing?.dishes || '';
      const dishList = currentDishes ? currentDishes.split(', ').filter(Boolean) : [];
      if (!dishList.includes(selectedDish.name)) {
        dishList.push(selectedDish.name);
      }

      await supabase.from('weekly_menu_templates').upsert({
        id: existing?.id || undefined,
        school_id: schoolId,
        day_of_week: dayOfWeek,
        meal_type: selectedMealType,
        dishes: dishList.join(', '),
      }, { onConflict: 'school_id,day_of_week,meal_type' });
    }

    // Remove dish from unselected days
    const allDays = [1, 2, 3, 4, 5, 6, 7];
    const unselectedDays = allDays.filter(d => !selectedDays.includes(d));
    for (const dayOfWeek of unselectedDays) {
      const existing = templates.find(t => t.day_of_week === dayOfWeek && t.meal_type === selectedMealType);
      if (existing && existing.dishes.includes(selectedDish.name)) {
        const dishList = existing.dishes.split(', ').filter(d => d !== selectedDish.name);
        await supabase.from('weekly_menu_templates').update({
          dishes: dishList.join(', '),
        }).eq('id', existing.id!);
      }
    }

    toast({ title: "Đã lưu thực đơn mẫu" });
    fetchTemplates();
    setShowAssignDialog(false);
    setLoading(false);
  };

  const assignTemplateToWeek = async () => {
    setLoading(true);
    const upserts = templates.filter(t => t.dishes.trim()).map(t => ({
      school_id: schoolId,
      menu_date: format(addDays(weekStart, t.day_of_week - 1), 'yyyy-MM-dd'),
      meal_type: t.meal_type,
      dishes: t.dishes,
      assigned_by: user?.id,
    }));

    if (upserts.length === 0) {
      toast({ title: "Chưa có thực đơn mẫu", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('menu_assignments')
      .upsert(upserts, { onConflict: 'school_id,menu_date,meal_type' });

    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã gán thực đơn cho tuần" });
      fetchAssignments();
    }
    setLoading(false);
  };

  const getTemplateDishes = (dayOfWeek: number, mealType: string) => {
    return templates.find(t => t.day_of_week === dayOfWeek && t.meal_type === mealType)?.dishes || '';
  };

  const getAssignmentDishes = (date: Date, mealType: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return assignments.find(a => a.menu_date === dateStr && a.meal_type === mealType)?.dishes || '';
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="dishes">Danh sách món ăn</TabsTrigger>
          <TabsTrigger value="template">Thực đơn mẫu</TabsTrigger>
          <TabsTrigger value="weekly">Thực đơn tuần</TabsTrigger>
        </TabsList>

        {/* Tab 1: Dish list */}
        <TabsContent value="dishes" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Danh sách món ăn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canEdit && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nhập tên món (VD: Xôi, Gà rán...)"
                    value={newDishName}
                    onChange={e => setNewDishName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addDish()}
                  />
                  <Button onClick={addDish} disabled={loading} size="sm">
                    <Plus className="h-4 w-4 mr-1" />Thêm
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {dishes.map(dish => (
                  <Badge key={dish.id} variant="secondary" className="text-sm py-1.5 px-3 gap-2">
                    {canEdit ? (
                      <button onClick={() => openAssignDialog(dish)} className="hover:underline">
                        {dish.name}
                      </button>
                    ) : (
                      dish.name
                    )}
                    {canEdit && (
                      <button onClick={() => deleteDish(dish.id)} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
                {dishes.length === 0 && (
                  <p className="text-sm text-muted-foreground">Chưa có món ăn nào. Hãy thêm món ăn mới.</p>
                )}
              </div>
              {canEdit && dishes.length > 0 && (
                <p className="text-xs text-muted-foreground">💡 Nhấn vào tên món để gán vào thực đơn mẫu</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Template grid */}
        <TabsContent value="template" className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left font-medium w-20">Bữa</th>
                  {DAY_LABELS.map((day, i) => (
                    <th key={i} className="p-2 text-center font-medium min-w-[120px]">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEAL_TYPES.map(mealType => (
                  <tr key={mealType} className="border-b">
                    <td className="p-2 font-medium">
                      <Badge variant="outline">{MEAL_LABELS[mealType]}</Badge>
                    </td>
                    {DAY_LABELS.map((_, dayIdx) => {
                      const dishesStr = getTemplateDishes(dayIdx + 1, mealType);
                      return (
                        <td key={dayIdx} className="p-2 text-center">
                          <div className="text-xs min-h-[40px] flex items-center justify-center">
                            {dishesStr ? (
                              <div className="flex flex-wrap gap-1 justify-center">
                                {dishesStr.split(', ').map((d, i) => (
                                  <Badge key={i} variant="secondary" className="text-[10px]">{d}</Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canEdit && (
            <p className="text-xs text-muted-foreground">
              💡 Vào tab "Danh sách món ăn", nhấn vào tên món để gán cho các ngày/bữa trong tuần
            </p>
          )}
        </TabsContent>

        {/* Tab 3: Weekly assignments */}
        <TabsContent value="weekly" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Thực đơn tuần</h3>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    {format(weekStart, 'dd/MM')} - {format(weekEnd, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={selectedWeekDate} onSelect={(d) => d && setSelectedWeekDate(d)} locale={vi} />
                </PopoverContent>
              </Popover>
            </div>
            {canEdit && (
              <Button size="sm" onClick={assignTemplateToWeek} disabled={loading}>
                <Check className="h-4 w-4 mr-1" />
                Lên thực đơn từ mẫu
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left font-medium w-20">Bữa</th>
                  {weekDays.map((day, i) => (
                    <th key={i} className={cn("p-2 text-center font-medium min-w-[120px]", isSameDay(day, new Date()) && "bg-primary/10")}>
                      <div>{DAY_LABELS[i]}</div>
                      <div className="text-xs text-muted-foreground">{format(day, 'dd/MM')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEAL_TYPES.map(mealType => (
                  <tr key={mealType} className="border-b">
                    <td className="p-2 font-medium">
                      <Badge variant="outline">{MEAL_LABELS[mealType]}</Badge>
                    </td>
                    {weekDays.map((day, dayIdx) => {
                      const dishesStr = getAssignmentDishes(day, mealType);
                      return (
                        <td key={dayIdx} className={cn("p-2 text-center", isSameDay(day, new Date()) && "bg-primary/5")}>
                          {dishesStr ? (
                            <div className="flex flex-wrap gap-1 justify-center">
                              {dishesStr.split(', ').map((d, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">{d}</Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Assign dish dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gán món: {selectedDish?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Chọn bữa ăn:</p>
              <div className="flex gap-2">
                {MEAL_TYPES.map(mt => (
                  <Button
                    key={mt}
                    size="sm"
                    variant={selectedMealType === mt ? "default" : "outline"}
                    onClick={() => {
                      setSelectedMealType(mt);
                      // Update selected days for this meal type
                      const existingDays = templates
                        .filter(t => t.meal_type === mt && t.dishes.includes(selectedDish?.name || ''))
                        .map(t => t.day_of_week);
                      setSelectedDays(existingDays);
                    }}
                  >
                    {MEAL_LABELS[mt]}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Gán cho các ngày:</p>
              <div className="grid grid-cols-4 gap-2">
                {DAY_LABELS.map((label, idx) => (
                  <label key={idx} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedDays.includes(idx + 1)}
                      onCheckedChange={() => toggleDay(idx + 1)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Hủy</Button>
            <Button onClick={saveAssignment} disabled={loading}>
              <Save className="h-4 w-4 mr-1" />Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
