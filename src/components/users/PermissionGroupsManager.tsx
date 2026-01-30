import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, Edit, Trash2, Users, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PermissionGroup {
  id: string;
  name: string;
  description: string | null;
  school_id: string;
  user_count?: number;
}

interface GroupPermission {
  feature_code: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface AppFeature {
  code: string;
  label: string;
  description: string | null;
}

const DEFAULT_GROUPS = [
  { name: 'Quản trị', description: 'Quản trị viên có toàn quyền' },
  { name: 'Giáo viên', description: 'Giáo viên bộ môn' },
  { name: 'Giáo viên chủ nhiệm', description: 'Giáo viên chủ nhiệm lớp' },
  { name: 'Kế toán', description: 'Kế toán trường' },
  { name: 'Nhà bếp', description: 'Nhân viên nhà bếp' },
  { name: 'QLNT', description: 'Quản lý nội trú' },
  { name: 'Văn phòng', description: 'Nhân viên văn phòng' },
  { name: 'Ban giám hiệu', description: 'Ban giám hiệu nhà trường' },
];

export default function PermissionGroupsManager() {
  const { currentSchool } = useAuth();
  const { toast } = useToast();

  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [features, setFeatures] = useState<AppFeature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<PermissionGroup | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [permissions, setPermissions] = useState<Record<string, GroupPermission>>({});

  useEffect(() => {
    if (currentSchool) {
      fetchData();
    }
  }, [currentSchool]);

  const fetchData = async () => {
    if (!currentSchool) return;
    setIsLoading(true);

    try {
      const [groupsRes, featuresRes, userGroupsRes] = await Promise.all([
        supabase
          .from('permission_groups')
          .select('*')
          .eq('school_id', currentSchool.id)
          .order('name'),
        supabase
          .from('app_features')
          .select('code, label, description')
          .eq('is_active', true)
          .order('display_order'),
        supabase
          .from('user_permission_groups')
          .select('group_id')
          .eq('school_id', currentSchool.id),
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (featuresRes.error) throw featuresRes.error;

      // Count users per group
      const userCounts: Record<string, number> = {};
      (userGroupsRes.data || []).forEach((ug) => {
        userCounts[ug.group_id] = (userCounts[ug.group_id] || 0) + 1;
      });

      // Add user count to each group
      const groupsWithCounts = (groupsRes.data || []).map((group) => ({
        ...group,
        user_count: userCounts[group.id] || 0,
      }));

      setGroups(groupsWithCounts);
      setFeatures(featuresRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải dữ liệu',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateDialog = () => {
    setEditingGroup(null);
    setFormData({ name: '', description: '' });
    setPermissions({});
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = async (group: PermissionGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
    });

    // Fetch existing permissions
    const { data } = await supabase
      .from('permission_group_permissions')
      .select('*')
      .eq('group_id', group.id);

    const perms: Record<string, GroupPermission> = {};
    (data || []).forEach((p) => {
      perms[p.feature_code] = {
        feature_code: p.feature_code,
        can_view: p.can_view || false,
        can_create: p.can_create || false,
        can_edit: p.can_edit || false,
        can_delete: p.can_delete || false,
      };
    });
    setPermissions(perms);
    setIsDialogOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!currentSchool || !formData.name.trim()) return;

    setIsSaving(true);
    try {
      let groupId = editingGroup?.id;

      if (editingGroup) {
        // Update existing group
        const { error } = await supabase
          .from('permission_groups')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
          })
          .eq('id', editingGroup.id);

        if (error) throw error;

        // Delete old permissions
        await supabase
          .from('permission_group_permissions')
          .delete()
          .eq('group_id', editingGroup.id);
      } else {
        // Create new group
        const { data, error } = await supabase
          .from('permission_groups')
          .insert({
            school_id: currentSchool.id,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
          })
          .select()
          .single();

        if (error) throw error;
        groupId = data.id;
      }

      // Insert new permissions
      const permissionsToInsert = Object.values(permissions)
        .filter((p) => p.can_view || p.can_create || p.can_edit || p.can_delete)
        .map((p) => ({
          group_id: groupId,
          feature_code: p.feature_code,
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
        }));

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from('permission_group_permissions')
          .insert(permissionsToInsert);

        if (error) throw error;
      }

      toast({
        title: 'Thành công',
        description: editingGroup ? 'Đã cập nhật nhóm quyền' : 'Đã tạo nhóm quyền mới',
      });

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving group:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể lưu nhóm quyền',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deletingGroup) return;

    try {
      // Delete permissions first
      await supabase
        .from('permission_group_permissions')
        .delete()
        .eq('group_id', deletingGroup.id);

      // Delete user associations
      await supabase
        .from('user_permission_groups')
        .delete()
        .eq('group_id', deletingGroup.id);

      // Delete group
      const { error } = await supabase
        .from('permission_groups')
        .delete()
        .eq('id', deletingGroup.id);

      if (error) throw error;

      toast({ title: 'Thành công', description: 'Đã xóa nhóm quyền' });
      setIsDeleteDialogOpen(false);
      setDeletingGroup(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa nhóm quyền',
        variant: 'destructive',
      });
    }
  };

  const handleCreateDefaultGroups = async () => {
    if (!currentSchool) return;

    setIsSaving(true);
    try {
      const groupsToCreate = DEFAULT_GROUPS.map((g) => ({
        school_id: currentSchool.id,
        name: g.name,
        description: g.description,
      }));

      const { error } = await supabase.from('permission_groups').insert(groupsToCreate);

      if (error) throw error;

      toast({ title: 'Thành công', description: 'Đã tạo các nhóm quyền mặc định' });
      fetchData();
    } catch (error: any) {
      console.error('Error creating default groups:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể tạo nhóm quyền mặc định',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = (featureCode: string, field: keyof GroupPermission) => {
    setPermissions((prev) => {
      const current = prev[featureCode] || {
        feature_code: featureCode,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      };
      return {
        ...prev,
        [featureCode]: {
          ...current,
          [field]: !current[field],
        },
      };
    });
  };

  const toggleAllPermissions = (featureCode: string, checked: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [featureCode]: {
        feature_code: featureCode,
        can_view: checked,
        can_create: checked,
        can_edit: checked,
        can_delete: checked,
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Nhóm quyền</h3>
          <p className="text-sm text-muted-foreground">
            Quản lý các nhóm quyền và phân quyền truy cập
          </p>
        </div>
        <div className="flex gap-2">
          {groups.length === 0 && (
            <Button variant="outline" onClick={handleCreateDefaultGroups} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tạo nhóm mặc định
            </Button>
          )}
          <Button onClick={handleOpenCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm nhóm
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">Chưa có nhóm quyền nào</p>
            <p className="text-sm text-muted-foreground">
              Nhấn "Tạo nhóm mặc định" để tạo các nhóm quyền cơ bản
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {group.description || 'Không có mô tả'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenEditDialog(group)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        setDeletingGroup(group);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{group.user_count || 0} người dùng</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Sửa nhóm quyền' : 'Thêm nhóm quyền mới'}</DialogTitle>
            <DialogDescription>
              Thiết lập tên và quyền truy cập cho nhóm
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Tên nhóm *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="VD: Giáo viên"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Mô tả</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả ngắn về nhóm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Phân quyền tính năng</Label>
              <ScrollArea className="h-[300px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Tính năng</TableHead>
                      <TableHead className="text-center w-[80px]">Tất cả</TableHead>
                      <TableHead className="text-center w-[60px]">Xem</TableHead>
                      <TableHead className="text-center w-[60px]">Thêm</TableHead>
                      <TableHead className="text-center w-[60px]">Sửa</TableHead>
                      <TableHead className="text-center w-[60px]">Xóa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {features.map((feature) => {
                      const perm = permissions[feature.code] || {
                        can_view: false,
                        can_create: false,
                        can_edit: false,
                        can_delete: false,
                      };
                      const allChecked = perm.can_view && perm.can_create && perm.can_edit && perm.can_delete;

                      return (
                        <TableRow key={feature.code}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{feature.label}</p>
                              <p className="text-xs text-muted-foreground">{feature.description}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={allChecked}
                              onCheckedChange={(checked) =>
                                toggleAllPermissions(feature.code, checked as boolean)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm.can_view}
                              onCheckedChange={() => togglePermission(feature.code, 'can_view')}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm.can_create}
                              onCheckedChange={() => togglePermission(feature.code, 'can_create')}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm.can_edit}
                              onCheckedChange={() => togglePermission(feature.code, 'can_edit')}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm.can_delete}
                              onCheckedChange={() => togglePermission(feature.code, 'can_delete')}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Hủy
            </Button>
            <Button onClick={handleSaveGroup} disabled={isSaving || !formData.name.trim()}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingGroup ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa nhóm quyền "{deletingGroup?.name}"? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
