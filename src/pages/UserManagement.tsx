import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SchoolMembership, Profile, AppRole, Class } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useToast } from '@/hooks/use-toast';
import {
  UserCog,
  Loader2,
  Search,
  Edit,
  UserX,
  CheckCircle,
  FileSpreadsheet,
  Shield,
  Users,
  KeyRound,
  Trash2,
  Mail,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ResetPasswordDialog from '@/components/users/ResetPasswordDialog';
import PermissionGroupsManager from '@/components/users/PermissionGroupsManager';
import UserImportDialog from '@/components/users/UserImportDialog';
import AssignPermissionGroupDialog from '@/components/users/AssignPermissionGroupDialog';

const roleLabels: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Quản trị viên',
  teacher: 'Giáo viên',
  class_teacher: 'GVCN',
  accountant: 'Kế toán',
  kitchen: 'Nhà bếp',
};

const roleColors: Record<AppRole, string> = {
  super_admin: 'bg-destructive/10 text-destructive border-destructive/20',
  admin: 'bg-primary/10 text-primary border-primary/20',
  teacher: 'bg-info/10 text-info border-info/20',
  class_teacher: 'bg-success/10 text-success border-success/20',
  accountant: 'bg-warning/10 text-warning border-warning/20',
  kitchen: 'bg-accent/10 text-accent border-accent/20',
};

export default function UserManagement() {
  const { currentSchool, isSchoolAdmin, profile: currentProfile } = useAuth();
  const { toast } = useToast();

  const [memberships, setMemberships] = useState<(SchoolMembership & { profile: Profile })[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingMembership, setEditingMembership] = useState<SchoolMembership | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isAssignGroupDialogOpen, setIsAssignGroupDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [singleResetUserId, setSingleResetUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    role: 'teacher' as AppRole,
    class_id: '',
  });

  useEffect(() => {
    if (!currentSchool) return;
    fetchMemberships();
    fetchClasses();
  }, [currentSchool]);

  const fetchMemberships = async () => {
    if (!currentSchool) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('school_memberships')
        .select(`
          *,
          profile:profiles(*)
        `)
        .eq('school_id', currentSchool.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMemberships((data || []).map(m => ({
        ...m,
        profile: m.profile as unknown as Profile
      })));
    } catch (error) {
      console.error('Error fetching memberships:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách người dùng',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClasses = async () => {
    if (!currentSchool) return;

    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .order('grade', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const getClassName = (classId: string | null) => {
    if (!classId) return '-';
    const cls = classes.find(c => c.id === classId);
    return cls?.name || classId;
  };

  const filteredMemberships = memberships.filter((m) => {
    const name = m.profile?.full_name?.toLowerCase() || '';
    const phone = m.profile?.phone?.toLowerCase() || '';
    const username = m.profile?.username?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return name.includes(query) || phone.includes(query) || username.includes(query);
  });

  const handleOpenEditDialog = (membership: SchoolMembership) => {
    setEditingMembership(membership);
    setFormData({
      role: membership.role,
      class_id: membership.class_id || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateMembership = async () => {
    if (!editingMembership) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('school_memberships')
        .update({
          role: formData.role,
          class_id: formData.role === 'class_teacher' ? formData.class_id || null : null,
        })
        .eq('id', editingMembership.id);

      if (error) throw error;

      toast({ title: 'Thành công', description: 'Đã cập nhật quyền người dùng' });
      setIsEditDialogOpen(false);
      fetchMemberships();
    } catch (error: any) {
      console.error('Error updating membership:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật quyền',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (membership: SchoolMembership) => {
    const newStatus = membership.status === 'active' ? 'suspended' : 'active';
    
    try {
      const { error } = await supabase
        .from('school_memberships')
        .update({ status: newStatus })
        .eq('id', membership.id);

      if (error) throw error;

      toast({
        title: 'Thành công',
        description: newStatus === 'active' ? 'Đã kích hoạt người dùng' : 'Đã khóa người dùng',
      });
      fetchMemberships();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật trạng thái',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUsers = async () => {
    if (!currentSchool || selectedUserIds.length === 0) return;

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-users', {
        body: {
          user_ids: selectedUserIds,
          school_id: currentSchool.id,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: 'Lỗi',
          description: data.error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Thành công',
        description: `Đã xóa ${data.deleted} tài khoản${data.failed > 0 ? `, ${data.failed} thất bại` : ''}`,
      });

      setSelectedUserIds([]);
      setIsDeleteDialogOpen(false);
      fetchMemberships();
    } catch (error: any) {
      console.error('Error deleting users:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa tài khoản',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.length === filteredMemberships.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredMemberships.map((m) => m.user_id));
    }
  };

  // Get email display (extract from phone.local or show real email)
  const getEmailDisplay = (profile: Profile | null) => {
    if (!profile) return '-';
    // If username exists and ends with @phone.local, it's a phone-based account
    // In that case, show "-" for email column since phone is shown separately
    return '-';
  };

  if (!currentSchool) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Vui lòng chọn trường để tiếp tục</p>
      </div>
    );
  }

  if (!isSchoolAdmin()) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Bạn không có quyền truy cập trang này</p>
      </div>
    );
  }

  return (
    <div className="content-wrapper animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <UserCog className="h-7 w-7 text-primary" />
          Quản lý người dùng
        </h1>
        <p className="page-description">
          Quản lý người dùng, nhóm quyền và phân quyền trong trường
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Người dùng
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Nhóm quyền
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* Search and Actions */}
          <Card>
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo tên, SĐT hoặc username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => setIsImportDialogOpen(true)}
                  className="flex-1 sm:flex-none"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Nhập Excel
                </Button>
                {selectedUserIds.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setIsResetPasswordDialogOpen(true)}
                      className="flex-1 sm:flex-none"
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Reset MK ({selectedUserIds.length})
                    </Button>
                    <Button
                      onClick={() => setIsAssignGroupDialogOpen(true)}
                      className="flex-1 sm:flex-none"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Gán quyền ({selectedUserIds.length})
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setIsDeleteDialogOpen(true)}
                      className="flex-1 sm:flex-none"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Xóa ({selectedUserIds.length})
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Users Table - Matching Import Template */}
          <Card>
            <CardHeader>
              <CardTitle>Danh sách người dùng</CardTitle>
              <CardDescription>
                {filteredMemberships.length} người dùng
                {selectedUserIds.length > 0 && ` • ${selectedUserIds.length} đã chọn`}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredMemberships.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <UserCog className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">Không có người dùng nào</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setIsImportDialogOpen(true)}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Nhập từ Excel
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={
                              selectedUserIds.length === filteredMemberships.length &&
                              filteredMemberships.length > 0
                            }
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead className="w-[60px]">STT</TableHead>
                        <TableHead>Họ và tên</TableHead>
                        <TableHead>Chức vụ</TableHead>
                        <TableHead className="hidden md:table-cell">Lớp CN</TableHead>
                        <TableHead className="hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            SĐT
                          </div>
                        </TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead className="w-[120px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMemberships.map((membership, index) => (
                        <TableRow key={membership.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedUserIds.includes(membership.user_id)}
                              onCheckedChange={() => toggleSelectUser(membership.user_id)}
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>
                              <p>{membership.profile?.full_name || '-'}</p>
                              <p className="text-xs text-muted-foreground md:hidden flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {membership.profile?.phone || '-'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('border', roleColors[membership.role])}>
                              {roleLabels[membership.role]}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {getClassName(membership.class_id)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {membership.profile?.phone || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={membership.status === 'active' ? 'default' : 'secondary'}>
                              {membership.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditDialog(membership)}
                                title="Sửa quyền"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSingleResetUserId(membership.user_id);
                                  setIsResetPasswordDialogOpen(true);
                                }}
                                title="Reset mật khẩu"
                              >
                                <KeyRound className="h-4 w-4 text-warning" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleStatus(membership)}
                                title={membership.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}
                              >
                                {membership.status === 'active' ? (
                                  <UserX className="h-4 w-4 text-destructive" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 text-success" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardContent className="pt-6">
              <PermissionGroupsManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa quyền người dùng</DialogTitle>
            <DialogDescription>
              Cập nhật vai trò và phân công cho người dùng
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Vai trò</Label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData({ ...formData, role: v as AppRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Quản trị viên</SelectItem>
                  <SelectItem value="teacher">Giáo viên</SelectItem>
                  <SelectItem value="class_teacher">Giáo viên chủ nhiệm</SelectItem>
                  <SelectItem value="accountant">Kế toán</SelectItem>
                  <SelectItem value="kitchen">Nhà bếp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.role === 'class_teacher' && (
              <div className="grid gap-2">
                <Label>Lớp chủ nhiệm</Label>
                <Select
                  value={formData.class_id}
                  onValueChange={(v) => setFormData({ ...formData, class_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn lớp" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>
              Hủy
            </Button>
            <Button onClick={handleUpdateMembership} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa tài khoản</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa {selectedUserIds.length} tài khoản đã chọn? 
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUsers}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xóa {selectedUserIds.length} tài khoản
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <UserImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImportComplete={fetchMemberships}
      />

      {/* Assign Permission Group Dialog */}
      <AssignPermissionGroupDialog
        open={isAssignGroupDialogOpen}
        onOpenChange={setIsAssignGroupDialogOpen}
        selectedUserIds={selectedUserIds}
        onComplete={() => {
          setSelectedUserIds([]);
          fetchMemberships();
        }}
      />

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        open={isResetPasswordDialogOpen}
        onOpenChange={(open) => {
          setIsResetPasswordDialogOpen(open);
          if (!open) {
            setSingleResetUserId(null);
          }
        }}
        selectedUserIds={singleResetUserId ? [singleResetUserId] : selectedUserIds}
        onResetComplete={() => {
          setSelectedUserIds([]);
          setSingleResetUserId(null);
        }}
      />
    </div>
  );
}
