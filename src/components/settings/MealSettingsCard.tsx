import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UtensilsCrossed, Clock, Save } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MealSettings {
  id: string;
  school_id: string;
  breakfast_deadline_time: string;
  breakfast_deadline_offset: number;
  lunch_deadline_time: string;
  lunch_deadline_offset: number;
  dinner_deadline_time: string;
  dinner_deadline_offset: number;
  rice_per_student: number;
}

const DEFAULT_SETTINGS: Omit<MealSettings, 'id' | 'school_id'> = {
  breakfast_deadline_time: '20:00:00',
  breakfast_deadline_offset: -1, // day before
  lunch_deadline_time: '07:30:00',
  lunch_deadline_offset: 0, // same day
  dinner_deadline_time: '14:00:00',
  dinner_deadline_offset: 0, // same day
  rice_per_student: 0.2,
};

export function MealSettingsCard() {
  const { currentSchool } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<MealSettings | null>(null);
  
  // Form state
  const [breakfastTime, setBreakfastTime] = useState('20:00');
  const [breakfastOffset, setBreakfastOffset] = useState('-1');
  const [lunchTime, setLunchTime] = useState('07:30');
  const [lunchOffset, setLunchOffset] = useState('0');
  const [dinnerTime, setDinnerTime] = useState('14:00');
  const [dinnerOffset, setDinnerOffset] = useState('0');
  const [ricePerStudent, setRicePerStudent] = useState('0.2');

  useEffect(() => {
    if (currentSchool) {
      fetchSettings();
    }
  }, [currentSchool]);

  const fetchSettings = async () => {
    if (!currentSchool) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('meal_settings')
        .select('*')
        .eq('school_id', currentSchool.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
        // Parse times (format: HH:MM:SS)
        setBreakfastTime(data.breakfast_deadline_time.substring(0, 5));
        setBreakfastOffset(String(data.breakfast_deadline_offset));
        setLunchTime(data.lunch_deadline_time.substring(0, 5));
        setLunchOffset(String(data.lunch_deadline_offset));
        setDinnerTime(data.dinner_deadline_time.substring(0, 5));
        setDinnerOffset(String(data.dinner_deadline_offset));
        setRicePerStudent(String(data.rice_per_student));
      } else {
        // No settings exist yet, use defaults
        setBreakfastTime('20:00');
        setBreakfastOffset('-1');
        setLunchTime('07:30');
        setLunchOffset('0');
        setDinnerTime('14:00');
        setDinnerOffset('0');
        setRicePerStudent('0.2');
      }
    } catch (error) {
      console.error('Error fetching meal settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentSchool) return;
    setIsSaving(true);

    try {
      const settingsData = {
        school_id: currentSchool.id,
        breakfast_deadline_time: `${breakfastTime}:00`,
        breakfast_deadline_offset: parseInt(breakfastOffset),
        lunch_deadline_time: `${lunchTime}:00`,
        lunch_deadline_offset: parseInt(lunchOffset),
        dinner_deadline_time: `${dinnerTime}:00`,
        dinner_deadline_offset: parseInt(dinnerOffset),
        rice_per_student: parseFloat(ricePerStudent),
      };

      if (settings) {
        // Update existing
        const { error } = await supabase
          .from('meal_settings')
          .update(settingsData)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('meal_settings')
          .insert(settingsData);

        if (error) throw error;
      }

      toast({ title: 'Thành công', description: 'Đã lưu cài đặt bữa ăn' });
      fetchSettings();
    } catch (error: any) {
      console.error('Error saving meal settings:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể lưu cài đặt',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getOffsetLabel = (offset: string) => {
    const val = parseInt(offset);
    if (val === -1) return 'Hôm trước';
    if (val === 0) return 'Cùng ngày';
    return `${val} ngày trước`;
  };

  const getDeadlineDescription = (time: string, offset: string, mealName: string) => {
    const offsetLabel = parseInt(offset) === -1 ? 'hôm trước' : 'cùng ngày';
    return `${mealName}: Báo trước ${time} ${offsetLabel}`;
  };

  if (!currentSchool) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5" />
          Cài đặt bữa ăn
        </CardTitle>
        <CardDescription>
          Thiết lập thời gian deadline báo cơm và lượng gạo mỗi bữa
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Breakfast */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-warning" />
                Bữa sáng
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="breakfastTime">Giờ deadline</Label>
                  <Input
                    id="breakfastTime"
                    type="time"
                    value={breakfastTime}
                    onChange={(e) => setBreakfastTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="breakfastOffset">Ngày báo</Label>
                  <Select value={breakfastOffset} onValueChange={setBreakfastOffset}>
                    <SelectTrigger id="breakfastOffset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1">Hôm trước</SelectItem>
                      <SelectItem value="0">Cùng ngày</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {getDeadlineDescription(breakfastTime, breakfastOffset, 'Bữa sáng')}
              </p>
            </div>

            {/* Lunch */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-primary" />
                Bữa trưa
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lunchTime">Giờ deadline</Label>
                  <Input
                    id="lunchTime"
                    type="time"
                    value={lunchTime}
                    onChange={(e) => setLunchTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lunchOffset">Ngày báo</Label>
                  <Select value={lunchOffset} onValueChange={setLunchOffset}>
                    <SelectTrigger id="lunchOffset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1">Hôm trước</SelectItem>
                      <SelectItem value="0">Cùng ngày</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {getDeadlineDescription(lunchTime, lunchOffset, 'Bữa trưa')}
              </p>
            </div>

            {/* Dinner */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-info" />
                Bữa tối
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dinnerTime">Giờ deadline</Label>
                  <Input
                    id="dinnerTime"
                    type="time"
                    value={dinnerTime}
                    onChange={(e) => setDinnerTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dinnerOffset">Ngày báo</Label>
                  <Select value={dinnerOffset} onValueChange={setDinnerOffset}>
                    <SelectTrigger id="dinnerOffset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1">Hôm trước</SelectItem>
                      <SelectItem value="0">Cùng ngày</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {getDeadlineDescription(dinnerTime, dinnerOffset, 'Bữa tối')}
              </p>
            </div>

            {/* Rice per student */}
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <UtensilsCrossed className="h-4 w-4 text-success" />
                Lượng gạo mỗi học sinh
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={ricePerStudent}
                  onChange={(e) => setRicePerStudent(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">kg / bữa (trưa & tối)</span>
              </div>
            </div>

            {/* Save button */}
            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Lưu cài đặt
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
