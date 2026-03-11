import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { School } from '@/types';
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
  Building2,
  Plus,
  Loader2,
  Users,
  GraduationCap,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  UserPlus,
  Settings2,
  LogOut,
  User,
  ChevronDown,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import CreateSchoolAdminDialog from '@/components/superadmin/CreateSchoolAdminDialog';
import SchoolFeaturesDialog from '@/components/superadmin/SchoolFeaturesDialog';

export default function SuperAdmin() {
  const { isSuperAdmin, profile, signOut } = useAuth();

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const { toast } = useToast();

  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminSchool, setAdminSchool] = useState<{ id: string; name: string } | null>(null);
  const [featuresDialogOpen, setFeaturesDialogOpen] = useState(false);
  const [featuresSchool, setFeaturesSchool] = useState<{ id: string; name: string } | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    phone: '',
    email: '',
  });

  // Stats
  const [stats, setStats] = useState({
    totalSchools: 0,
    activeSchools: 0,
    totalUsers: 0,
    totalStudents: 0,
  });

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchData();
  }, [isSuperAdmin]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch schools
      const { data: schoolsData } = await supabase
        .from('schools')
        .select('*')
        .order('name');

      const typedSchools = (schoolsData || []) as School[];
      setSchools(typedSchools);

      // Calculate stats
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: studentsCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      setStats({
        totalSchools: typedSchools.length,
        activeSchools: typedSchools.filter(s => s.is_active).length,
        totalUsers: usersCount || 0,
        totalStudents: studentsCount || 0,
      });
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

  const handleOpenDialog = (school?: School) => {
    if (school) {
      setEditingSchool(school);
      setFormData({
        code: school.code,
        name: school.name,
        address: school.address || '',
        phone: school.phone || '',
        email: school.email || '',
      });
    } else {
      setEditingSchool(null);
      setFormData({
        code: '',
        name: '',
        address: '',
        phone: '',
        email: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng điền mã và tên trường',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const schoolData = {
        code: formData.code.toLowerCase().replace(/\s/g, '-'),
        name: formData.name,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
      };

      if (editingSchool) {
        const { error } = await supabase
          .from('schools')
          .update(schoolData)
          .eq('id', editingSchool.id);
        if (error) throw error;
        toast({ title: 'Thành công', description: 'Đã cập nhật trường học' });
      } else {
        const { error } = await supabase.from('schools').insert(schoolData);
        if (error) throw error;
        toast({ title: 'Thành công', description: 'Đã tạo trường học mới' });
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving school:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể lưu trường học',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (school: School) => {
    try {
      const { error } = await supabase
        .from('schools')
        .update({ is_active: !school.is_active })
        .eq('id', school.id);

      if (error) throw error;

      toast({
        title: 'Thành công',
        description: `Đã ${school.is_active ? 'khóa' : 'kích hoạt'} trường ${school.name}`,
      });
      fetchData();
    } catch (error) {
      console.error('Error toggling school:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật trạng thái trường',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (school: School) => {
    if (!confirm(`Bạn có chắc muốn xóa trường ${school.name}? Tất cả dữ liệu liên quan sẽ bị xóa.`)) return;

    try {
      const { error } = await supabase.from('schools').delete().eq('id', school.id);
      if (error) throw error;

      toast({ title: 'Thành công', description: 'Đã xóa trường học' });
      fetchData();
    } catch (error: any) {
      console.error('Error deleting school:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa trường học',
        variant: 'destructive',
      });
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Bạn không có quyền truy cập trang này</p>
      </div>
    );
  }

  return (
    <div className="content-wrapper animate-fade-in">
      {/* Account Header */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-md">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Quản trị hệ thống</h1>
            <p className="text-sm text-muted-foreground">Quản lý trường học và người dùng toàn hệ thống</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {profile?.full_name ? getInitials(profile.full_name) : 'SA'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">{profile?.full_name}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground">Super Admin</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/settings">
                <User className="mr-2 h-4 w-4" />
                Tài khoản
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalSchools}</p>
              <p className="text-sm text-muted-foreground">Tổng trường</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-xl bg-success/10 p-3 text-success">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.activeSchools}</p>
              <p className="text-sm text-muted-foreground">Đang hoạt động</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-xl bg-info/10 p-3 text-info">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
              <p className="text-sm text-muted-foreground">Người dùng</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-xl bg-warning/10 p-3 text-warning">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalStudents}</p>
              <p className="text-sm text-muted-foreground">Học sinh</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schools Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Danh sách trường</CardTitle>
            <CardDescription>Quản lý các trường trong hệ thống</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Thêm trường
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSchool ? 'Sửa trường học' : 'Thêm trường học mới'}
                </DialogTitle>
                <DialogDescription>
                  Điền thông tin trường học
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">Mã trường *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="VD: thpt-nt-a"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Tên trường *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="THPT Nội trú A"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Địa chỉ</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Đường ABC, Quận XYZ"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Số điện thoại</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0281234567"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="lienhe@truong.edu.vn"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                  Hủy
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingSchool ? 'Cập nhật' : 'Thêm'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : schools.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">Chưa có trường nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã</TableHead>
                    <TableHead>Tên trường</TableHead>
                    <TableHead className="hidden md:table-cell">SĐT</TableHead>
                    <TableHead className="hidden lg:table-cell">Email</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schools.map((school) => (
                    <TableRow key={school.id}>
                      <TableCell className="font-mono text-sm">{school.code}</TableCell>
                      <TableCell className="font-medium">{school.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{school.phone || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell">{school.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={school.is_active ? 'default' : 'secondary'}>
                          {school.is_active ? 'Hoạt động' : 'Đã khóa'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Chức năng"
                            onClick={() => {
                              setFeaturesSchool({ id: school.id, name: school.name });
                              setFeaturesDialogOpen(true);
                            }}
                          >
                            <Settings2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Tạo Admin"
                            onClick={() => {
                              setAdminSchool({ id: school.id, name: school.name });
                              setAdminDialogOpen(true);
                            }}
                          >
                            <UserPlus className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(school)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(school)}
                          >
                            {school.is_active ? (
                              <XCircle className="h-4 w-4 text-destructive" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-success" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(school)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
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
      <CreateSchoolAdminDialog
        open={adminDialogOpen}
        onOpenChange={setAdminDialogOpen}
        school={adminSchool}
        onComplete={fetchData}
      />
      <SchoolFeaturesDialog
        open={featuresDialogOpen}
        onOpenChange={setFeaturesDialogOpen}
        school={featuresSchool}
      />
    </div>
  );
}

