import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SchoolMembership, Profile, AppRole } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  UserCog,
  Plus,
  Loader2,
  Search,
  Edit,
  UserX,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const { currentSchool, isSchoolAdmin } = useAuth();
  const { toast } = useToast();

  const [memberships, setMemberships] = useState<(SchoolMembership & { profile: Profile })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingMembership, setEditingMembership] = useState<SchoolMembership | null>(null);

  const [formData, setFormData] = useState({
    role: 'teacher' as AppRole,
    class_id: '',
  });

  useEffect(() => {
    if (!currentSchool) return;
    fetchMemberships();
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

  const filteredMemberships = memberships.filter((m) => {
    const name = m.profile?.full_name?.toLowerCase() || '';
    const email = m.profile?.username?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
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
          Quản lý người dùng và phân quyền trong trường
        </p>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên hoặc username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách người dùng</CardTitle>
          <CardDescription>{filteredMemberships.length} người dùng</CardDescription>
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
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Họ và tên</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead className="hidden md:table-cell">Lớp</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMemberships.map((membership) => (
                    <TableRow key={membership.id}>
                      <TableCell className="font-medium">
                        {membership.profile?.full_name || '-'}
                      </TableCell>
                      <TableCell>{membership.profile?.username || '-'}</TableCell>
                      <TableCell>
                        <Badge className={cn('border', roleColors[membership.role])}>
                          {roleLabels[membership.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {membership.class_id || '-'}
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
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(membership)}
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
                <Input
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                  placeholder="VD: 10A1"
                />
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
    </div>
  );
}
