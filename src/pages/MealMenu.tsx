import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MenuTemplateTab } from "@/components/meal-menu/MenuTemplateTab";
import { KitchenInventoryTab } from "@/components/meal-menu/KitchenInventoryTab";
import { KitchenStatisticsTab } from "@/components/meal-menu/KitchenStatisticsTab";
import { UtensilsCrossed, Package, BarChart3 } from "lucide-react";

const MealMenu = () => {
  const { currentMembership, isSuperAdmin, currentSchool } = useAuth();

  const schoolId = currentSchool?.id;

  const canEdit = useMemo(() => {
    if (isSuperAdmin) return true;
    if (!currentMembership) return false;
    const role = currentMembership.role;
    return role === 'admin' || role === 'kitchen' || role === 'accountant';
  }, [currentMembership, isSuperAdmin]);

  if (!schoolId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Không tìm thấy trường học</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Thực đơn & Kho bếp</h1>
        <p className="text-sm text-muted-foreground">Quản lý thực đơn bữa ăn và xuất nhập kho thực phẩm</p>
      </div>

      <Tabs defaultValue="menu" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="menu" className="flex items-center gap-1.5">
            <UtensilsCrossed className="h-4 w-4" />
            <span className="hidden sm:inline">Thực đơn</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Xuất nhập kho</span>
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Thống kê</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu">
          <MenuTemplateTab schoolId={schoolId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="inventory">
          <KitchenInventoryTab schoolId={schoolId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="statistics">
          <KitchenStatisticsTab schoolId={schoolId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MealMenu;
