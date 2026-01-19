import { useEffect, useState, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  FileSpreadsheet,
  Download,
  CreditCard,
  UtensilsCrossed,
  Trash2,
  CheckSquare,
  Square,
  Building,
  GraduationCap,
  Utensils,
  Edit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExcelImportDialog } from '@/components/students/ExcelImportDialog';
import { exportStudentsToExcel, StudentImportRow } from '@/lib/excel-utils';

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
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Config dialogs
  const [isClassDialogOpen, setIsClassDialogOpen] = useState(false);
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [isMealDialogOpen, setIsMealDialogOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('1');
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  
  // Room and meal group lists derived from students
  const roomNumbers = useMemo(() => {
    const rooms = new Set<string>();
    students.forEach(s => s.room_number && rooms.add(s.room_number));
    return Array.from(rooms).sort();
  }, [students]);
  
  const mealGroups = useMemo(() => {
    const groups = new Set<string>();
    students.forEach(s => s.meal_group && groups.add(s.meal_group));
    return Array.from(groups).sort();
  }, [students]);

  // Form state with new fields
  const [formData, setFormData] = useState({
    student_code: '',
    full_name: '',
    class_id: '',
    gender: '',
    date_of_birth: '',
    phone: '',
    parent_phone: '',
    address: '',
    cccd: '',
    room_number: '',
    meal_group: '',
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

      const { data: classesData } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .order('name');

      setClasses((classesData || []) as Class[]);

      const { data: studentsData, error } = await supabase
        .from('students')
        .select(`*, class:classes(*)`)
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
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      student.full_name.toLowerCase().includes(query) ||
      student.student_code.toLowerCase().includes(query) ||
      student.room_number?.toLowerCase().includes(query) ||
      student.meal_group?.toLowerCase().includes(query);
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
        cccd: student.cccd || '',
        room_number: student.room_number || '',
        meal_group: student.meal_group || '',
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
        cccd: '',
        room_number: '',
        meal_group: '',
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
        cccd: formData.cccd || null,
        room_number: formData.room_number || null,
        meal_group: formData.meal_group || null,
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

  const handleExcelImport = async (importData: StudentImportRow[]) => {
    if (!currentSchool) throw new Error('Chưa chọn trường');

    // Map class names to class IDs
    const classMap: Record<string, string> = {};
    classes.forEach(cls => {
      classMap[cls.name.toLowerCase()] = cls.id;
    });

    const studentsToInsert = importData.map((row, index) => ({
      school_id: currentSchool.id,
      student_code: `HS${Date.now()}${index}`,
      full_name: row.full_name,
      date_of_birth: row.date_of_birth || null,
      gender: row.gender,
      class_id: classMap[row.class_name.toLowerCase()] || null,
      cccd: row.cccd || null,
      phone: row.phone || null,
      address: row.address || null,
      room_number: row.room_number || null,
      meal_group: row.meal_group || null,
      is_boarding: true,
      is_active: true,
    }));

    const { error } = await supabase.from('students').insert(studentsToInsert);
    if (error) throw error;

    fetchData();
  };

  const handleExportExcel = () => {
    exportStudentsToExcel(filteredStudents, classes, `danh-sach-hoc-sinh-${currentSchool?.name || ''}`);
    toast({ title: 'Thành công', description: 'Đã xuất file Excel' });
  };

  const handleDeleteAll = async () => {
    if (!currentSchool) return;
    if (!confirm(`Bạn có chắc muốn xóa TẤT CẢ ${students.length} học sinh? Hành động này không thể hoàn tác!`)) return;

    try {
      const { error } = await supabase
        .from('students')
        .update({ is_active: false })
        .eq('school_id', currentSchool.id);
      
      if (error) throw error;

      toast({ title: 'Thành công', description: `Đã xóa ${students.length} học sinh` });
      setSelectedIds(new Set());
      fetchData();
    } catch (error: any) {
      console.error('Error deleting all students:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa học sinh',
        variant: 'destructive',
      });
    }
  };

  // Selection handlers
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Bạn có chắc muốn xóa ${selectedIds.size} học sinh đã chọn?`)) return;

    try {
      const { error } = await supabase
        .from('students')
        .update({ is_active: false })
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast({ title: 'Thành công', description: `Đã xóa ${selectedIds.size} học sinh` });
      setSelectedIds(new Set());
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa học sinh',
        variant: 'destructive',
      });
    }
  };

  // Class management
  const handleSaveClass = async () => {
    if (!currentSchool || !newClassName.trim()) return;

    try {
      if (editingClass) {
        const { error } = await supabase
          .from('classes')
          .update({ name: newClassName, grade: parseInt(newClassGrade) })
          .eq('id', editingClass.id);
        if (error) throw error;
        toast({ title: 'Thành công', description: 'Đã cập nhật lớp' });
      } else {
        const { error } = await supabase.from('classes').insert({
          school_id: currentSchool.id,
          name: newClassName,
          grade: parseInt(newClassGrade),
          school_year: new Date().getFullYear().toString(),
        });
        if (error) throw error;
        toast({ title: 'Thành công', description: 'Đã thêm lớp mới' });
      }

      setNewClassName('');
      setNewClassGrade('10');
      setEditingClass(null);
      setIsClassDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteClass = async (cls: Class) => {
    if (!confirm(`Xóa lớp ${cls.name}? Các học sinh trong lớp sẽ được chuyển về "Chưa xếp".`)) return;

    try {
      await supabase.from('students').update({ class_id: null }).eq('class_id', cls.id);
      const { error } = await supabase.from('classes').update({ is_active: false }).eq('id', cls.id);
      if (error) throw error;

      toast({ title: 'Thành công', description: 'Đã xóa lớp' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
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
    <div className="content-wrapper animate-fade-in pb-20">
      <Tabs defaultValue="students" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="students" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Học sinh</span>
          </TabsTrigger>
          <TabsTrigger value="classes" className="flex items-center gap-1">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Lớp</span>
          </TabsTrigger>
          <TabsTrigger value="rooms" className="flex items-center gap-1">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Phòng KTX</span>
          </TabsTrigger>
          <TabsTrigger value="meals" className="flex items-center gap-1">
            <Utensils className="h-4 w-4" />
            <span className="hidden sm:inline">Mâm ăn</span>
          </TabsTrigger>
        </TabsList>

        {/* Students Tab */}
        <TabsContent value="students" className="mt-0">
          {/* Header */}
          <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="page-title flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                Danh sách học sinh
              </h1>
              <p className="page-description">
                {selectedIds.size > 0 
                  ? `Đã chọn ${selectedIds.size}/${filteredStudents.length} học sinh` 
                  : `${filteredStudents.length} học sinh`}
              </p>
            </div>
            {isSchoolAdmin() && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Nhập Excel</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                  <Download className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Xuất Excel</span>
                </Button>
                {selectedIds.size > 0 ? (
                  <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Xóa ({selectedIds.size})
                  </Button>
                ) : (
                  <Button variant="destructive" size="sm" onClick={handleDeleteAll} disabled={students.length === 0}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Xóa tất cả</span>
                  </Button>
                )}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => handleOpenDialog()}>
                      <Plus className="h-4 w-4 mr-1" />
                      Thêm
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingStudent ? 'Sửa học sinh' : 'Thêm học sinh mới'}
                      </DialogTitle>
                      <DialogDescription>
                        Điền thông tin học sinh bên dưới
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-3 py-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="student_code">Mã HS *</Label>
                          <Input
                            id="student_code"
                            value={formData.student_code}
                            onChange={(e) => setFormData({ ...formData, student_code: e.target.value })}
                            placeholder="HS001"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="full_name">Họ và tên *</Label>
                          <Input
                            id="full_name"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            placeholder="Nguyễn Văn A"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="date_of_birth">Ngày sinh</Label>
                          <Input
                            id="date_of_birth"
                            type="date"
                            value={formData.date_of_birth}
                            onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="gender">Giới tính</Label>
                          <Select
                            value={formData.gender}
                            onValueChange={(value) => setFormData({ ...formData, gender: value })}
                          >
                            <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Nam</SelectItem>
                              <SelectItem value="female">Nữ</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="class_id">Lớp</Label>
                          <Select
                            value={formData.class_id}
                            onValueChange={(value) => setFormData({ ...formData, class_id: value })}
                          >
                            <SelectTrigger><SelectValue placeholder="Chọn lớp" /></SelectTrigger>
                            <SelectContent>
                              {classes.map((cls) => (
                                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="cccd">CCCD</Label>
                          <Input
                            id="cccd"
                            value={formData.cccd}
                            onChange={(e) => setFormData({ ...formData, cccd: e.target.value })}
                            placeholder="001234567890"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="phone">SĐT học sinh</Label>
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="0901234567"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="room_number">Phòng KTX</Label>
                          <Input
                            id="room_number"
                            value={formData.room_number}
                            onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                            placeholder="P101"
                            list="room-suggestions"
                          />
                          <datalist id="room-suggestions">
                            {roomNumbers.map(r => <option key={r} value={r} />)}
                          </datalist>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="meal_group">Mâm ăn</Label>
                          <Input
                            id="meal_group"
                            value={formData.meal_group}
                            onChange={(e) => setFormData({ ...formData, meal_group: e.target.value })}
                            placeholder="Mâm 1"
                            list="meal-suggestions"
                          />
                          <datalist id="meal-suggestions">
                            {mealGroups.map(m => <option key={m} value={m} />)}
                          </datalist>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="parent_phone">SĐT phụ huynh</Label>
                        <Input
                          id="parent_phone"
                          value={formData.parent_phone}
                          onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                          placeholder="0907654321"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="address">Địa chỉ</Label>
                        <Input
                          id="address"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          placeholder="Địa chỉ nhà"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="notes">Ghi chú</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Ghi chú thêm..."
                          rows={2}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="is_boarding"
                          checked={formData.is_boarding}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_boarding: !!checked })}
                        />
                        <Label htmlFor="is_boarding" className="cursor-pointer">Học sinh nội trú</Label>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                        Hủy
                      </Button>
                      <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingStudent ? 'Cập nhật' : 'Thêm'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm tên, mã HS, phòng, mâm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Selection & Class Filter */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
            {isSchoolAdmin() && (
              <Button variant="outline" size="sm" onClick={handleSelectAll} className="shrink-0">
                {selectedIds.size === filteredStudents.length && filteredStudents.length > 0 ? (
                  <><CheckSquare className="h-4 w-4 mr-1" /> Bỏ chọn tất cả</>
                ) : (
                  <><Square className="h-4 w-4 mr-1" /> Chọn tất cả</>
                )}
              </Button>
            )}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin flex-1">
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
          </div>

          {/* Student Grid */}
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
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredStudents.map((student) => (
                <Card
                  key={student.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-sm active:scale-[0.98]",
                    selectedIds.has(student.id) ? "border-primary bg-primary/5" : "hover:border-primary"
                  )}
                  onClick={() => handleViewDetail(student)}
                >
                  <CardContent className="flex items-center gap-3 p-3">
                    {isSchoolAdmin() && (
                      <Checkbox
                        checked={selectedIds.has(student.id)}
                        onClick={(e) => handleToggleSelect(student.id, e)}
                        className="shrink-0"
                      />
                    )}
                    <Avatar className="h-10 w-10 bg-primary/10 flex-shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                        {getInitials(student.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{student.full_name}</h3>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {student.class?.name || 'Chưa xếp'}
                        </Badge>
                        {student.room_number && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            P.{student.room_number}
                          </Badge>
                        )}
                        {student.meal_group && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-orange-100 text-orange-700">
                            {student.meal_group}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Classes Tab */}
        <TabsContent value="classes" className="mt-0">
          <div className="page-header flex items-center justify-between">
            <div>
              <h1 className="page-title flex items-center gap-2">
                <GraduationCap className="h-6 w-6 text-primary" />
                Quản lý lớp
              </h1>
              <p className="page-description">{classes.length} lớp</p>
            </div>
            {isSchoolAdmin() && (
              <Dialog open={isClassDialogOpen} onOpenChange={setIsClassDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => { setEditingClass(null); setNewClassName(''); setNewClassGrade('10'); }}>
                    <Plus className="h-4 w-4 mr-1" />
                    Thêm lớp
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingClass ? 'Sửa lớp' : 'Thêm lớp mới'}</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-1.5">
                      <Label>Tên lớp</Label>
                      <Input
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        placeholder="VD: 10A1, 11B2..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Khối</Label>
                      <Select value={newClassGrade} onValueChange={setNewClassGrade}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
                            <SelectItem key={grade} value={grade.toString()}>
                              Khối {grade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsClassDialogOpen(false)}>Hủy</Button>
                    <Button onClick={handleSaveClass}>{editingClass ? 'Cập nhật' : 'Thêm'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => {
              const count = students.filter(s => s.class_id === cls.id).length;
              return (
                <Card key={cls.id} className="hover:border-primary transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{cls.name}</h3>
                      <p className="text-sm text-muted-foreground">Khối {cls.grade} • {count} học sinh</p>
                    </div>
                    {isSchoolAdmin() && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingClass(cls);
                          setNewClassName(cls.name);
                          setNewClassGrade(cls.grade.toString());
                          setIsClassDialogOpen(true);
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClass(cls)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {classes.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <GraduationCap className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">Chưa có lớp nào</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Rooms Tab */}
        <TabsContent value="rooms" className="mt-0">
          <div className="page-header">
            <h1 className="page-title flex items-center gap-2">
              <Building className="h-6 w-6 text-primary" />
              Phòng KTX
            </h1>
            <p className="page-description">{roomNumbers.length} phòng (lấy từ danh sách học sinh)</p>
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {roomNumbers.map((room) => {
              const count = students.filter(s => s.room_number === room).length;
              return (
                <Card key={room} className="hover:border-primary transition-colors">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{room}</div>
                    <p className="text-sm text-muted-foreground">{count} học sinh</p>
                  </CardContent>
                </Card>
              );
            })}
            {roomNumbers.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Building className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">Chưa có phòng nào. Thêm học sinh với phòng KTX để hiển thị.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Meal Groups Tab */}
        <TabsContent value="meals" className="mt-0">
          <div className="page-header">
            <h1 className="page-title flex items-center gap-2">
              <Utensils className="h-6 w-6 text-primary" />
              Mâm ăn
            </h1>
            <p className="page-description">{mealGroups.length} mâm (lấy từ danh sách học sinh)</p>
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {mealGroups.map((group) => {
              const count = students.filter(s => s.meal_group === group).length;
              return (
                <Card key={group} className="hover:border-primary transition-colors">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">{group}</div>
                    <p className="text-sm text-muted-foreground">{count} học sinh</p>
                  </CardContent>
                </Card>
              );
            })}
            {mealGroups.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Utensils className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">Chưa có mâm nào. Thêm học sinh với mâm ăn để hiển thị.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
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
            <div className="space-y-3 py-4">
              <div className="grid grid-cols-2 gap-3">
                <InfoItem icon={Users} label="Lớp" value={selectedStudent.class?.name || 'Chưa xếp'} />
                <InfoItem icon={User} label="Giới tính" value={selectedStudent.gender === 'male' ? 'Nam' : selectedStudent.gender === 'female' ? 'Nữ' : '-'} />
                <InfoItem icon={Calendar} label="Ngày sinh" value={selectedStudent.date_of_birth ? new Date(selectedStudent.date_of_birth).toLocaleDateString('vi-VN') : '-'} />
                <InfoItem icon={Home} label="Phòng KTX" value={selectedStudent.room_number || '-'} />
                <InfoItem icon={UtensilsCrossed} label="Mâm ăn" value={selectedStudent.meal_group || '-'} />
                <InfoItem icon={CreditCard} label="CCCD" value={selectedStudent.cccd || '-'} />
                <InfoItem icon={Phone} label="SĐT HS" value={selectedStudent.phone || '-'} />
                <InfoItem icon={Phone} label="SĐT PH" value={selectedStudent.parent_phone || '-'} />
              </div>

              {selectedStudent.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-muted-foreground">Địa chỉ: </span>
                    {selectedStudent.address}
                  </div>
                </div>
              )}

              {selectedStudent.notes && (
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground mb-1">Ghi chú</div>
                  <div className="text-sm">{selectedStudent.notes}</div>
                </div>
              )}

              {isSchoolAdmin() && (
                <div className="flex gap-2 pt-3 border-t">
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

      {/* Excel Import Dialog */}
      <ExcelImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={handleExcelImport}
      />
    </div>
  );
}

// Helper component for info items
function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted flex-shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium truncate">{value}</div>
      </div>
    </div>
  );
}
