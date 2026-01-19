import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Student, Class } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import {
  Search,
  Plus,
  Loader2,
  Users,
  Home,
  Phone,
  Calendar,
  MapPin,
  User,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Students() {
  const { currentSchool, isSchoolAdmin } = useAuth();
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    student_code: '',
    full_name: '',
    class_id: '',
    gender: '',
    date_of_birth: '',
    phone: '',
    parent_phone: '',
    address: '',
    notes: '',
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
        date_of_birth: student.date_of_birth || '',
        phone: student.phone || '',
        parent_phone: student.parent_phone || '',
        address: student.address || '',
        notes: student.notes || '',
        is_boarding: student.is_boarding,
      });
    } else {
      setEditingStudent(null);
      setFormData({
        student_code: '',
        full_name: '',
        class_id: '',
        gender: '',
        date_of_birth: '',
        phone: '',
        parent_phone: '',
        address: '',
        notes: '',
        is_boarding: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleViewDetail = (student: Student) => {
    setSelectedStudent(student);
    setIsDetailOpen(true);
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
        date_of_birth: formData.date_of_birth || null,
        phone: formData.phone || null,
        parent_phone: formData.parent_phone || null,
        address: formData.address || null,
        notes: formData.notes || null,
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
      setIsDetailOpen(false);
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(-2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
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
          <h1 className="page-title flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Danh sách học sinh
          </h1>
          <p className="page-description">
            {filteredStudents.length} học sinh
          </p>
        </div>
        {isSchoolAdmin() && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Thêm học sinh
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="gender">Giới tính</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) =>
                        setFormData({ ...formData, gender: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Nam</SelectItem>
                        <SelectItem value="female">Nữ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="date_of_birth">Ngày sinh</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) =>
                        setFormData({ ...formData, date_of_birth: e.target.value })
                      }
                    />
                  </div>
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
                <div className="grid gap-2">
                  <Label htmlFor="address">Địa chỉ</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Địa chỉ nhà"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Ghi chú</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Ghi chú thêm..."
                    rows={2}
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

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên hoặc mã học sinh..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Class Filter Tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <Button
          variant={selectedClassFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedClassFilter('all')}
          className="whitespace-nowrap"
        >
          Tất cả
        </Button>
        {classes.map((cls) => (
          <Button
            key={cls.id}
            variant={selectedClassFilter === cls.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedClassFilter(cls.id)}
            className="whitespace-nowrap"
          >
            {cls.name}
          </Button>
        ))}
      </div>

      {/* Student Cards Grid */}
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStudents.map((student) => (
            <Card
              key={student.id}
              className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
              onClick={() => handleViewDetail(student)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar className="h-12 w-12 bg-primary/10">
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                    {getInitials(student.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{student.full_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {student.class?.name || 'Chưa xếp lớp'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {student.is_boarding && (
                      <Badge variant="secondary" className="status-present text-xs">
                        <Home className="mr-1 h-3 w-3" />
                        Nội trú
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Student Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedStudent && (
                <>
                  <Avatar className="h-12 w-12 bg-primary">
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                      {getInitials(selectedStudent.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">{selectedStudent.full_name}</div>
                    <div className="text-sm font-normal text-muted-foreground">
                      {selectedStudent.student_code}
                    </div>
                  </div>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-4 py-4">
              <div className="grid gap-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-muted-foreground">Lớp</div>
                    <div className="font-medium">{selectedStudent.class?.name || 'Chưa xếp lớp'}</div>
                  </div>
                </div>

                {selectedStudent.date_of_birth && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-muted-foreground">Ngày sinh</div>
                      <div className="font-medium">
                        {new Date(selectedStudent.date_of_birth).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 text-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-muted-foreground">Giới tính</div>
                    <div className="font-medium">
                      {selectedStudent.gender === 'male' ? 'Nam' : selectedStudent.gender === 'female' ? 'Nữ' : 'Không xác định'}
                    </div>
                  </div>
                </div>

                {selectedStudent.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-muted-foreground">SĐT học sinh</div>
                      <div className="font-medium">{selectedStudent.phone}</div>
                    </div>
                  </div>
                )}

                {selectedStudent.parent_phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-muted-foreground">SĐT phụ huynh</div>
                      <div className="font-medium">{selectedStudent.parent_phone}</div>
                    </div>
                  </div>
                )}

                {selectedStudent.address && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-muted-foreground">Địa chỉ</div>
                      <div className="font-medium">{selectedStudent.address}</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 text-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <Home className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-muted-foreground">Trạng thái</div>
                    <div className="font-medium">
                      {selectedStudent.is_boarding ? 'Nội trú' : 'Ngoại trú'}
                    </div>
                  </div>
                </div>

                {selectedStudent.notes && (
                  <div className="mt-2 rounded-lg bg-muted p-3">
                    <div className="text-sm text-muted-foreground mb-1">Ghi chú</div>
                    <div className="text-sm">{selectedStudent.notes}</div>
                  </div>
                )}
              </div>

              {isSchoolAdmin() && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsDetailOpen(false);
                      handleOpenDialog(selectedStudent);
                    }}
                  >
                    Chỉnh sửa
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(selectedStudent)}
                  >
                    Xóa
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
