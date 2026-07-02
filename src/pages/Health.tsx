import { useState, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useFeaturePermission } from '@/components/guards/FeatureGuard';
import { useToast } from '@/hooks/use-toast';
import { useImageExport } from '@/hooks/use-image-export';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClassFilterButtons } from '@/components/attendance/ClassFilterButtons';
import {
  Heart,
  Plus,
  Search,
  CalendarIcon,
  Pill,
  Stethoscope,
  Building2,
  Phone,
  Download,
  ImageIcon,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Edit,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  Filter,
} from 'lucide-react';
import { cn, vietnameseNameSortCompare } from '@/lib/utils';
import type { Student, Class, Medicine, HealthRecord, MedicineTransaction, HealthTreatmentType, Profile } from '@/types';
import { HealthRecordForm } from '@/components/health/HealthRecordForm';
import { HealthHistoryTab } from '@/components/health/HealthHistoryTab';
import { MedicineInventoryTab } from '@/components/health/MedicineInventoryTab';
const HealthExportDialog = lazy(() => import('@/components/health/HealthExportDialog').then(m => ({ default: m.HealthExportDialog })));

export default function Health() {
  const { user, isSchoolAdmin, isSuperAdmin, currentSchool } = useAuth();
  const { isFeatureEnabled } = useSchool();
  const { canCreate, canEdit, canDelete, canView } = useFeaturePermission('health');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const isAdmin = isSchoolAdmin() || isSuperAdmin;
  // Users with health permission can manage health records and medicines
  const canManageHealth = isAdmin || canCreate || canEdit;
  
  // Determine default active tab based on permissions
  // If user can't manage health, they can only view history
  const [activeTab, setActiveTab] = useState(canManageHealth ? 'record' : 'history');
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Fetch students
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students', currentSchool?.id],
    queryFn: async () => {
      if (!currentSchool?.id) return [];
      const { data, error } = await supabase
        .from('students')
        .select('*, class:classes(*)')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return (data as Student[]).sort((a, b) => vietnameseNameSortCompare(a.full_name, b.full_name));
    },
    enabled: !!currentSchool?.id,
  });

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ['classes', currentSchool?.id],
    queryFn: async () => {
      if (!currentSchool?.id) return [];
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .order('grade')
        .order('name');
      if (error) throw error;
      return data as Class[];
    },
    enabled: !!currentSchool?.id,
  });

  // Fetch medicines
  const { data: medicines = [] } = useQuery({
    queryKey: ['medicines', currentSchool?.id],
    queryFn: async () => {
      if (!currentSchool?.id) return [];
      const { data, error } = await supabase
        .from('medicines')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Medicine[];
    },
    enabled: !!currentSchool?.id,
  });

  return (
    <div className="space-y-4 md:space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500" />
            Quản lý sức khỏe
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Theo dõi và chăm sóc sức khỏe học sinh
          </p>
        </div>
        <Button onClick={() => setShowExportDialog(true)} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Xuất báo cáo
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn("grid w-full h-auto", canManageHealth ? "grid-cols-3" : "grid-cols-1")}>
          {canManageHealth && (
            <TabsTrigger value="record" className="text-xs sm:text-sm py-2">
              <Stethoscope className="h-4 w-4 mr-1.5" />
              Ghi nhận
            </TabsTrigger>
          )}
          <TabsTrigger value="history" className="text-xs sm:text-sm py-2">
            <CalendarIcon className="h-4 w-4 mr-1.5" />
            Lịch sử
          </TabsTrigger>
          {canManageHealth && (
            <TabsTrigger value="inventory" className="text-xs sm:text-sm py-2">
              <Package className="h-4 w-4 mr-1.5" />
              Kho thuốc
            </TabsTrigger>
          )}
        </TabsList>

        {canManageHealth && (
          <TabsContent value="record" className="mt-4">
            <HealthRecordForm 
              students={students}
              classes={classes}
              medicines={medicines}
              schoolId={currentSchool?.id || ''}
              userId={user?.id || ''}
              isAdmin={canManageHealth}
            />
          </TabsContent>
        )}

        <TabsContent value="history" className="mt-4">
          <HealthHistoryTab
            schoolId={currentSchool?.id || ''}
            students={students}
            classes={classes}
            isAdmin={canManageHealth}
            userId={user?.id || ''}
            canDelete={isAdmin || canDelete}
          />
        </TabsContent>

        {canManageHealth && (
          <TabsContent value="inventory" className="mt-4">
            <MedicineInventoryTab
              schoolId={currentSchool?.id || ''}
              isAdmin={canManageHealth}
              userId={user?.id || ''}
              canDelete={isAdmin || canDelete}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Export Dialog - lazy loaded, chỉ tải khi mở */}
      {showExportDialog && (
        <Suspense fallback={null}>
          <HealthExportDialog
            open={showExportDialog}
            onOpenChange={setShowExportDialog}
            schoolId={currentSchool?.id || ''}
            schoolName={currentSchool?.name || ''}
          />
        </Suspense>
      )}
    </div>
  );
}
