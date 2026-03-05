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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfWeek, endOfWeek, addDays, isSameDay, subWeeks, addWeeks } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2, Check, Copy, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const MEAL_LABELS: Record<string, string> = { breakfast: 'Sáng', lunch: 'Trưa', dinner: 'Tối' };
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;

const DISH_CATEGORIES = [
  { code: 'breakfast_food', label: 'Đồ ăn sáng' },
  { code: 'meat', label: 'Thịt' },
  { code: 'vegetable', label: 'Rau củ' },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  breakfast_food: 'Đồ ăn sáng',
  meat: 'Thịt',
  vegetable: 'Rau củ',
};

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
  const [activeSubTab, setActiveSubTab] = useState(canEdit ? "dishes" : "weekly");
  const [newDishName, setNewDishName] = useState("");
  const [newDishCategory, setNewDishCategory] = useState("breakfast_food");
  const [loading, setLoading] = useState(false);

  // Cell selection dialog
  const [showCellDialog, setShowCellDialog] = useState(false);
  const [cellDay, setCellDay] = useState(1);
  const [cellMeal, setCellMeal] = useState("breakfast");
  const [cellSelectedDishes, setCellSelectedDishes] = useState<string[]>([]);

  // Weekly view
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date());
  const weekStart = startOfWeek(selectedWeekDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedWeekDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Copy from week dialog
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [sourceWeekDate, setSourceWeekDate] = useState(subWeeks(new Date(), 1));
  const [sourceAssignments, setSourceAssignments] = useState<MenuAssignment[]>([]);

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
      .in('category', ['breakfast_food', 'meat', 'vegetable', 'dish'])
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
      category: newDishCategory,
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

  // Open cell dialog for template editing
  const openCellDialog = (dayOfWeek: number, mealType: string) => {
    if (!canEdit) return;
    setCellDay(dayOfWeek);
    setCellMeal(mealType);
    const existing = templates.find(t => t.day_of_week === dayOfWeek && t.meal_type === mealType);
    const currentDishes = existing?.dishes ? existing.dishes.split(', ').filter(Boolean) : [];
    setCellSelectedDishes(currentDishes);
    setShowCellDialog(true);
  };

  const toggleDishInCell = (dishName: string) => {
    setCellSelectedDishes(prev =>
      prev.includes(dishName) ? prev.filter(d => d !== dishName) : [...prev, dishName]
    );
  };

  const removeDishFromTemplate = async (dayOfWeek: number, mealType: string, dishName: string) => {
    const existing = templates.find(t => t.day_of_week === dayOfWeek && t.meal_type === mealType);
    if (!existing) return;
    const currentDishes = existing.dishes.split(', ').filter(Boolean);
    const updatedDishes = currentDishes.filter(d => d !== dishName);
    await supabase.from('weekly_menu_templates').upsert({
      id: existing.id,
      school_id: schoolId,
      day_of_week: dayOfWeek,
      meal_type: mealType,
      dishes: updatedDishes.join(', '),
    }, { onConflict: 'school_id,day_of_week,meal_type' });
    fetchTemplates();
    toast({ title: `Đã xóa "${dishName}"` });
  };

  const saveCellDishes = async () => {
    setLoading(true);
    const existing = templates.find(t => t.day_of_week === cellDay && t.meal_type === cellMeal);
    const dishesStr = cellSelectedDishes.join(', ');

    await supabase.from('weekly_menu_templates').upsert({
      id: existing?.id || undefined,
      school_id: schoolId,
      day_of_week: cellDay,
      meal_type: cellMeal,
      dishes: dishesStr,
    }, { onConflict: 'school_id,day_of_week,meal_type' });

    toast({ title: "Đã lưu thực đơn mẫu" });
    fetchTemplates();
    setShowCellDialog(false);
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

  // Copy from another week
  const openCopyDialog = () => {
    setSourceWeekDate(subWeeks(selectedWeekDate, 1));
    setShowCopyDialog(true);
    fetchSourceAssignments(subWeeks(selectedWeekDate, 1));
  };

  const fetchSourceAssignments = async (date: Date) => {
    const srcStart = startOfWeek(date, { weekStartsOn: 1 });
    const srcEnd = endOfWeek(date, { weekStartsOn: 1 });
    const { data } = await supabase
      .from('menu_assignments')
      .select('*')
      .eq('school_id', schoolId)
      .gte('menu_date', format(srcStart, 'yyyy-MM-dd'))
      .lte('menu_date', format(srcEnd, 'yyyy-MM-dd'));
    setSourceAssignments(data || []);
  };

  const copyFromWeek = async () => {
    if (sourceAssignments.length === 0) {
      toast({ title: "Tuần nguồn chưa có thực đơn", variant: "destructive" });
      return;
    }
    setLoading(true);
    const srcStart = startOfWeek(sourceWeekDate, { weekStartsOn: 1 });

    const upserts = sourceAssignments.map(a => {
      const srcDate = new Date(a.menu_date + 'T00:00:00');
      const dayDiff = Math.round((srcDate.getTime() - srcStart.getTime()) / (1000 * 60 * 60 * 24));
      return {
        school_id: schoolId,
        menu_date: format(addDays(weekStart, dayDiff), 'yyyy-MM-dd'),
        meal_type: a.meal_type,
        dishes: a.dishes,
        assigned_by: user?.id,
      };
    });

    const { error } = await supabase
      .from('menu_assignments')
      .upsert(upserts, { onConflict: 'school_id,menu_date,meal_type' });

    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã sao chép thực đơn" });
      fetchAssignments();
    }
    setShowCopyDialog(false);
    setLoading(false);
  };

  const getTemplateDishes = (dayOfWeek: number, mealType: string) => {
    return templates.find(t => t.day_of_week === dayOfWeek && t.meal_type === mealType)?.dishes || '';
  };

  const getAssignmentDishes = (date: Date, mealType: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return assignments.find(a => a.menu_date === dateStr && a.meal_type === mealType)?.dishes || '';
  };

  // Group dishes by category
  const groupedDishes = DISH_CATEGORIES.map(cat => ({
    ...cat,
    items: dishes.filter(d => d.category === cat.code),
  }));

  // Also include 'dish' category items in breakfast_food for backwards compatibility
  const legacyDishes = dishes.filter(d => d.category === 'dish');
  if (legacyDishes.length > 0) {
    const bfGroup = groupedDishes.find(g => g.code === 'breakfast_food');
    if (bfGroup) {
      bfGroup.items = [...bfGroup.items, ...legacyDishes];
    }
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          {canEdit && <TabsTrigger value="dishes">Danh sách món ăn</TabsTrigger>}
          {canEdit && <TabsTrigger value="template">Thực đơn mẫu</TabsTrigger>}
          <TabsTrigger value="weekly">Thực đơn tuần</TabsTrigger>
        </TabsList>

        {/* Tab 1: Dish list - only for editors */}
        {canEdit && (
          <TabsContent value="dishes" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Danh sách món ăn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nhập tên món (VD: Xôi, Gà rán...)"
                    value={newDishName}
                    onChange={e => setNewDishName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addDish()}
                    className="flex-1"
                  />
                  <Select value={newDishCategory} onValueChange={setNewDishCategory}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISH_CATEGORIES.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addDish} disabled={loading} size="sm">
                    <Plus className="h-4 w-4 mr-1" />Thêm
                  </Button>
                </div>

                {DISH_CATEGORIES.map(cat => {
                  const items = dishes.filter(d => d.category === cat.code || (cat.code === 'breakfast_food' && d.category === 'dish'));
                  if (items.length === 0) return null;
                  return (
                    <div key={cat.code}>
                      <p className="text-sm font-medium mb-1">{cat.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {items.map(dish => (
                          <Badge key={dish.id} variant="secondary" className="text-sm py-1.5 px-3 gap-2">
                            {dish.name}
                            <button onClick={() => deleteDish(dish.id)} className="text-destructive hover:text-destructive/80">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {dishes.length === 0 && (
                  <p className="text-sm text-muted-foreground">Chưa có món ăn nào. Hãy thêm món ăn mới.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Tab 2: Template grid - only for editors */}
        {canEdit && (
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
                          <td
                            key={dayIdx}
                            className={cn(
                              "p-2 text-center cursor-pointer hover:bg-accent/50 transition-colors border",
                              canEdit && "hover:ring-1 hover:ring-primary/30"
                            )}
                            onClick={() => openCellDialog(dayIdx + 1, mealType)}
                          >
                             <div className="text-xs min-h-[40px] flex items-center justify-center">
                              {dishesStr ? (
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {dishesStr.split(', ').map((d, i) => (
                                    <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                                      {d}
                                      {canEdit && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeDishFromTemplate(dayIdx + 1, mealType, d);
                                          }}
                                          className="text-destructive hover:text-destructive/80"
                                        >
                                          <Trash2 className="h-2.5 w-2.5" />
                                        </button>
                                      )}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">+ Thêm món</span>
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
            <p className="text-xs text-muted-foreground">
              💡 Nhấn vào ô trong bảng để chọn món ăn cho bữa đó
            </p>
          </TabsContent>
        )}

        {/* Tab 3: Weekly assignments - visible to all */}
        <TabsContent value="weekly" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setSelectedWeekDate(subWeeks(selectedWeekDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
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
              <Button variant="ghost" size="icon" onClick={() => setSelectedWeekDate(addWeeks(selectedWeekDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={openCopyDialog}>
                  <Copy className="h-4 w-4 mr-1" />
                  Sao chép từ tuần khác
                </Button>
                <Button size="sm" onClick={assignTemplateToWeek} disabled={loading}>
                  <Check className="h-4 w-4 mr-1" />
                  Lên từ mẫu
                </Button>
              </div>
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

      {/* Cell dish selection dialog */}
      <Dialog open={showCellDialog} onOpenChange={setShowCellDialog}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {DAY_LABELS[cellDay - 1]} - Bữa {MEAL_LABELS[cellMeal]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {groupedDishes.map(group => {
              if (group.items.length === 0) return null;
              return (
                <div key={group.code}>
                  <p className="text-sm font-semibold mb-2 text-primary">{group.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map(dish => (
                      <label key={dish.id} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md hover:bg-accent/50">
                        <Checkbox
                          checked={cellSelectedDishes.includes(dish.name)}
                          onCheckedChange={() => toggleDishInCell(dish.name)}
                        />
                        {dish.name}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            {dishes.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa có món ăn. Hãy thêm ở tab "Danh sách món ăn".</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCellDialog(false)}>Hủy</Button>
            <Button onClick={saveCellDishes} disabled={loading}>
              <Check className="h-4 w-4 mr-1" />Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy from week dialog */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sao chép thực đơn từ tuần khác</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Chọn tuần nguồn:</p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => {
                  const d = subWeeks(sourceWeekDate, 1);
                  setSourceWeekDate(d);
                  fetchSourceAssignments(d);
                }}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      {format(startOfWeek(sourceWeekDate, { weekStartsOn: 1 }), 'dd/MM')} - {format(endOfWeek(sourceWeekDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={sourceWeekDate} onSelect={(d) => {
                      if (d) {
                        setSourceWeekDate(d);
                        fetchSourceAssignments(d);
                      }
                    }} locale={vi} />
                  </PopoverContent>
                </Popover>
                <Button variant="ghost" size="icon" onClick={() => {
                  const d = addWeeks(sourceWeekDate, 1);
                  setSourceWeekDate(d);
                  fetchSourceAssignments(d);
                }}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {sourceAssignments.length > 0
                  ? `Tuần nguồn có ${sourceAssignments.length} mục thực đơn`
                  : 'Tuần nguồn chưa có thực đơn'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>Hủy</Button>
            <Button onClick={copyFromWeek} disabled={loading || sourceAssignments.length === 0}>
              <Copy className="h-4 w-4 mr-1" />Sao chép
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
