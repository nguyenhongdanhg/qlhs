import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, endOfWeek, addDays, isSameDay } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon, Edit2, Save, Plus, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const MEAL_LABELS: Record<string, string> = { breakfast: 'Sáng', lunch: 'Trưa', dinner: 'Tối' };
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;

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
  const [templates, setTemplates] = useState<MenuTemplate[]>([]);
  const [assignments, setAssignments] = useState<MenuAssignment[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<MenuTemplate | null>(null);
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date());
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<string>("template");

  const weekStart = startOfWeek(selectedWeekDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedWeekDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    fetchTemplates();
  }, [schoolId]);

  useEffect(() => {
    fetchAssignments();
  }, [schoolId, weekStart.toISOString()]);

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

  const saveTemplate = async (template: MenuTemplate) => {
    setLoading(true);
    const { error } = await supabase
      .from('weekly_menu_templates')
      .upsert({
        id: template.id || undefined,
        school_id: schoolId,
        day_of_week: template.day_of_week,
        meal_type: template.meal_type,
        dishes: template.dishes,
      }, { onConflict: 'school_id,day_of_week,meal_type' });

    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã lưu thực đơn mẫu" });
      fetchTemplates();
      setEditingTemplate(null);
    }
    setLoading(false);
  };

  const assignTemplateToWeek = async () => {
    setLoading(true);
    const upserts = templates.map(t => ({
      school_id: schoolId,
      menu_date: format(addDays(weekStart, t.day_of_week - 1), 'yyyy-MM-dd'),
      meal_type: t.meal_type,
      dishes: t.dishes,
      assigned_by: user?.id,
    }));

    if (upserts.length === 0) {
      toast({ title: "Chưa có thực đơn mẫu", description: "Vui lòng tạo thực đơn mẫu trước", variant: "destructive" });
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
      setShowAssignDialog(false);
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
          <TabsTrigger value="template">Thực đơn mẫu</TabsTrigger>
          <TabsTrigger value="weekly">Thực đơn tuần</TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Thực đơn mẫu hàng tuần</h3>
          </div>
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
                      const dishes = getTemplateDishes(dayIdx + 1, mealType);
                      return (
                        <td key={dayIdx} className="p-2 text-center">
                          {canEdit ? (
                            <button
                              onClick={() => setEditingTemplate({
                                ...templates.find(t => t.day_of_week === dayIdx + 1 && t.meal_type === mealType),
                                day_of_week: dayIdx + 1,
                                meal_type: mealType,
                                dishes: dishes,
                              })}
                              className="w-full min-h-[40px] p-1 text-xs rounded border border-dashed border-muted-foreground/30 hover:border-primary hover:bg-accent transition-colors text-left"
                            >
                              {dishes || <span className="text-muted-foreground italic">+ Thêm</span>}
                            </button>
                          ) : (
                            <span className="text-xs">{dishes || '-'}</span>
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
                  <Calendar
                    mode="single"
                    selected={selectedWeekDate}
                    onSelect={(d) => d && setSelectedWeekDate(d)}
                    locale={vi}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {canEdit && (
              <Button size="sm" onClick={() => setShowAssignDialog(true)}>
                <Copy className="h-4 w-4 mr-1" />
                Gán từ thực đơn mẫu
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
                      const dishes = getAssignmentDishes(day, mealType);
                      return (
                        <td key={dayIdx} className={cn("p-2 text-center", isSameDay(day, new Date()) && "bg-primary/5")}>
                          <span className="text-xs">{dishes || <span className="text-muted-foreground">-</span>}</span>
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

      {/* Edit template dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Sửa thực đơn - {editingTemplate ? `${DAY_LABELS[editingTemplate.day_of_week - 1]} / ${MEAL_LABELS[editingTemplate.meal_type]}` : ''}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={editingTemplate?.dishes || ''}
            onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, dishes: e.target.value } : null)}
            placeholder="Nhập thực đơn (VD: Xôi, Gà rán, Canh rau...)"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>Hủy</Button>
            <Button onClick={() => editingTemplate && saveTemplate(editingTemplate)} disabled={loading}>
              <Save className="h-4 w-4 mr-1" />Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gán thực đơn mẫu cho tuần</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Gán thực đơn mẫu cho tuần từ {format(weekStart, 'dd/MM/yyyy')} đến {format(weekEnd, 'dd/MM/yyyy')}?
            Thực đơn đã có sẽ được cập nhật.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Hủy</Button>
            <Button onClick={assignTemplateToWeek} disabled={loading}>
              <Check className="h-4 w-4 mr-1" />Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
