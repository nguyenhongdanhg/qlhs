import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Student, Class } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Plus,
  Loader2,
  Users,
  Home,
  Phone,
  Edit,
  Trash2,
} from 'lucide-react';

export default function Students() {
  const { currentSchool, isSchoolAdmin } = useAuth();
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    student_code: '',
    full_name: '',
    class_id: '',
    gender: '',
    phone: '',
    parent_phone: '',
    is_boarding: true,
  });
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (!currentSchool) return;
    fetchData();
  }, [currentSchool]);

  const fetchData = async () => {
    if (!currentSchool) return;
    
    try {
      setIsLoading(true);

      // Fetch classes
      const { data: classesData } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .order('name');

      setClasses((classesData || []) as Class[]);

      // Fetch students with class info
      const { data: studentsData, error } = await supabase
        .from('students')
        .select(`
          *,
          class:classes(*)
        `)
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;

      setStudents((studentsData || []).map(s => ({
        ...s,
        class: s.class as unknown as Class
      })) as Student[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách học sinh',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.student_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass =
      selectedClassFilter === 'all' || student.class_id === selectedClassFilter;
    return matchesSearch && matchesClass;
  });

  const handleOpenDialog = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        student_code: student.student_code,
        full_name: student.full_name,
        class_id: student.class_id || '',
        gender: student.gender || '',
        phone: student.phone || '',
        parent_phone: student.parent_phone || '',
        is_boarding: student.is_boarding,
      });
    } else {
      setEditingStudent(null);
      setFormData({
        student_code: '',
        full_name: '',
        class_id: '',
        gender: '',
        phone: '',
        parent_phone: '',
        is_boarding: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentSchool) return;
    if (!formData.student_code || !formData.full_name) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng điền mã học sinh và họ tên',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const studentData = {
        school_id: currentSchool.id,
        student_code: formData.student_code,
        full_name: formData.full_name,
        class_id: formData.class_id || null,
        gender: (formData.gender as 'male' | 'female') || null,
        phone: formData.phone || null,
        parent_phone: formData.parent_phone || null,
        is_boarding: formData.is_boarding,
      };

      if (editingStudent) {
        const { error } = await supabase
          .from('students')
          .update(studentData)
          .eq('id', editingStudent.id);
        if (error) throw error;
        toast({ title: 'Thành công', description: 'Đã cập nhật học sinh' });
      } else {
        const { error } = await supabase.from('students').insert(studentData);
        if (error) throw error;
        toast({ title: 'Thành công', description: 'Đã thêm học sinh mới' });
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving student:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể lưu học sinh',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (student: Student) => {
    if (!confirm(`Bạn có chắc muốn xóa học sinh ${student.full_name}?`)) return;

    try {
      const { error } = await supabase
        .from('students')
        .update({ is_active: false })
        .eq('id', student.id);
      if (error) throw error;

      toast({ title: 'Thành công', description: 'Đã xóa học sinh' });
      fetchData();
    } catch (error) {
      console.error('Error deleting student:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa học sinh',
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

  return (
    <div className="content-wrapper animate-fade-in">
      <div className="page-header flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Quản lý học sinh</h1>
          <p className="page-description">
            {filteredStudents.length} học sinh
          </p>
        </div>
        {isSchoolAdmin() && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Thêm học sinh
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingStudent ? 'Sửa học sinh' : 'Thêm học sinh mới'}
                </DialogTitle>
                <DialogDescription>
                  Điền thông tin học sinh bên dưới
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="student_code">Mã học sinh *</Label>
                  <Input
                    id="student_code"
                    value={formData.student_code}
                    onChange={(e) =>
                      setFormData({ ...formData, student_code: e.target.value })
                    }
                    placeholder="VD: HS001"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="full_name">Họ và tên *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="class_id">Lớp</Label>
                  <Select
                    value={formData.class_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, class_id: value })
                    }
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
                <div className="grid gap-2">
                  <Label htmlFor="gender">Giới tính</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) =>
                      setFormData({ ...formData, gender: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn giới tính" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Nam</SelectItem>
                      <SelectItem value="female">Nữ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">SĐT học sinh</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="0901234567"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="parent_phone">SĐT phụ huynh</Label>
                  <Input
                    id="parent_phone"
                    value={formData.parent_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, parent_phone: e.target.value })
                    }
                    placeholder="0907654321"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_boarding"
                    checked={formData.is_boarding}
                    onChange={(e) =>
                      setFormData({ ...formData, is_boarding: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="is_boarding">Học sinh nội trú</Label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSaving}
                >
                  Hủy
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingStudent ? 'Cập nhật' : 'Thêm'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên hoặc mã học sinh..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Lọc theo lớp" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả lớp</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">Chưa có học sinh nào</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã HS</TableHead>
                  <TableHead>Họ và tên</TableHead>
                  <TableHead>Lớp</TableHead>
                  <TableHead className="hidden md:table-cell">Giới tính</TableHead>
                  <TableHead className="hidden lg:table-cell">SĐT</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  {isSchoolAdmin() && <TableHead className="w-[100px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-mono text-sm">
                      {student.student_code}
                    </TableCell>
                    <TableCell className="font-medium">{student.full_name}</TableCell>
                    <TableCell>{student.class?.name || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {student.gender === 'male' ? 'Nam' : student.gender === 'female' ? 'Nữ' : '-'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {student.phone || '-'}
                    </TableCell>
                    <TableCell>
                      {student.is_boarding ? (
                        <Badge variant="secondary" className="status-present">
                          <Home className="mr-1 h-3 w-3" />
                          Nội trú
                        </Badge>
                      ) : (
                        <Badge variant="outline">Ngoại trú</Badge>
                      )}
                    </TableCell>
                    {isSchoolAdmin() && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(student)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(student)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
