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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Image,
  Link,
} from 'lucide-react';
import { cn, naturalSort } from '@/lib/utils';
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
  
  // Batch update dialog
  const [isBatchUpdateOpen, setIsBatchUpdateOpen] = useState(false);
  const [batchUpdateType, setBatchUpdateType] = useState<'class' | 'room' | 'meal'>('class');
  const [batchUpdateValue, setBatchUpdateValue] = useState('');
  
  // Filter state for room and meal (used when clicking from tabs)
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string | null>(null);
  const [selectedMealFilter, setSelectedMealFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('students');
  const [isBulkAvatarOpen, setIsBulkAvatarOpen] = useState(false);
  const [bulkAvatarText, setBulkAvatarText] = useState('');
  const [zoomAvatarUrl, setZoomAvatarUrl] = useState<string | null>(null);
  
  // Duplicate import state
  const [duplicateData, setDuplicateData] = useState<{
    newStudents: any[];
    duplicates: { existing: Student; imported: StudentImportRow; updates: Record<string, { old: any; new: any }> }[];
  } | null>(null);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [isImportingSave, setIsImportingSave] = useState(false);

  // Room and meal group lists derived from students - using natural sort
  const roomNumbers = useMemo(() => {
    const rooms = new Set<string>();
    students.forEach(s => s.room_number && rooms.add(s.room_number));
    return naturalSort(Array.from(rooms));
  }, [students]);
  
  const mealGroups = useMemo(() => {
    const groups = new Set<string>();
    students.forEach(s => s.meal_group && groups.add(s.meal_group));
    return naturalSort(Array.from(groups));
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
    avatar_url: '',
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
        .order('grade')
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
    const matchesRoom = !selectedRoomFilter || student.room_number === selectedRoomFilter;
    const matchesMeal = !selectedMealFilter || student.meal_group === selectedMealFilter;
    return matchesSearch && matchesClass && matchesRoom && matchesMeal;
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
        avatar_url: student.avatar_url || '',
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
        avatar_url: '',
        is_boarding: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleViewDetail = (student: Student) => {
    setSelectedStudent(student);
    setIsDetailOpen(true);
  };

  const generateStudentCode = () => `HS${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const handleSave = async () => {
    if (!currentSchool) return;
    if (!formData.full_name) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng điền họ tên học sinh',
        variant: 'destructive',
      });
      return;
    }

    const studentCode = formData.student_code || formData.cccd || generateStudentCode();

    setIsSaving(true);
    try {
      const studentData = {
        school_id: currentSchool.id,
        student_code: studentCode,
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
        avatar_url: formData.avatar_url || null,
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

    const classMap: Record<string, string> = {};
    classes.forEach(cls => {
      classMap[cls.name.toLowerCase()] = cls.id;
    });

    // Check for duplicates by cccd or full_name
    const duplicates: { existing: Student; imported: StudentImportRow; updates: Record<string, { old: any; new: any }> }[] = [];
    const newRows: StudentImportRow[] = [];

    for (const row of importData) {
      const existing = students.find(s => 
        (row.cccd && s.cccd === row.cccd) || 
        (row.full_name && s.full_name.toLowerCase() === row.full_name.toLowerCase() && row.class_name && s.class?.name?.toLowerCase() === row.class_name.toLowerCase())
      );

      if (existing) {
        const updates: Record<string, { old: any; new: any }> = {};
        const fieldMap: { key: keyof Student; importKey: keyof StudentImportRow; label: string; transform?: (v: string) => any }[] = [
          { key: 'phone', importKey: 'phone', label: 'SĐT' },
          { key: 'address', importKey: 'address', label: 'Địa chỉ' },
          { key: 'room_number', importKey: 'room_number', label: 'Phòng KTX' },
          { key: 'meal_group', importKey: 'meal_group', label: 'Mâm ăn' },
          { key: 'avatar_url', importKey: 'avatar_url', label: 'Link ảnh' },
          { key: 'cccd', importKey: 'cccd', label: 'CCCD' },
          { key: 'date_of_birth', importKey: 'date_of_birth', label: 'Ngày sinh' },
        ];

        for (const field of fieldMap) {
          const importVal = row[field.importKey];
          const existingVal = existing[field.key];
          if (importVal && importVal !== existingVal) {
            updates[field.key] = { old: existingVal || '(trống)', new: importVal };
          }
        }
        // Check gender
        if (row.gender && row.gender !== existing.gender) {
          updates['gender'] = { old: existing.gender === 'male' ? 'Nam' : existing.gender === 'female' ? 'Nữ' : '(trống)', new: row.gender === 'male' ? 'Nam' : 'Nữ' };
        }
        // Check class
        const newClassId = classMap[row.class_name?.toLowerCase()] || null;
        if (newClassId && newClassId !== existing.class_id) {
          updates['class_id'] = { old: existing.class?.name || '(trống)', new: row.class_name };
        }

        if (Object.keys(updates).length > 0) {
          duplicates.push({ existing, imported: row, updates });
        }
      } else {
        newRows.push(row);
      }
    }

    // Insert new students
    if (newRows.length > 0) {
      const studentsToInsert = newRows.map((row, index) => ({
        school_id: currentSchool.id,
        student_code: row.cccd || `HS${Date.now()}${index}`,
        full_name: row.full_name,
        date_of_birth: row.date_of_birth || null,
        gender: row.gender,
        class_id: classMap[row.class_name?.toLowerCase()] || null,
        cccd: row.cccd || null,
        phone: row.phone || null,
        address: row.address || null,
        room_number: row.room_number || null,
        meal_group: row.meal_group || null,
        avatar_url: row.avatar_url || null,
        is_boarding: true,
        is_active: true,
      }));

      const { error } = await supabase.from('students').insert(studentsToInsert);
      if (error) throw error;
    }

    // If there are duplicates, show the merge dialog
    if (duplicates.length > 0) {
      setDuplicateData({ newStudents: newRows, duplicates });
      setIsDuplicateDialogOpen(true);
      if (newRows.length > 0) {
        toast({ title: `Đã nhập ${newRows.length} học sinh mới`, description: `Phát hiện ${duplicates.length} học sinh trùng cần xác nhận cập nhật` });
      }
    } else {
      toast({ title: 'Thành công', description: `Đã nhập ${newRows.length} học sinh mới` });
    }

    fetchData();
  };

  const handleConfirmDuplicateUpdate = async () => {
    if (!duplicateData) return;
    setIsImportingSave(true);

    const classMap: Record<string, string> = {};
    classes.forEach(cls => {
      classMap[cls.name.toLowerCase()] = cls.id;
    });

    try {
      for (const dup of duplicateData.duplicates) {
        const updateData: Record<string, any> = {};
        for (const [key, val] of Object.entries(dup.updates)) {
          if (key === 'gender') {
            updateData[key] = dup.imported.gender;
          } else if (key === 'class_id') {
            updateData[key] = classMap[dup.imported.class_name?.toLowerCase()] || null;
          } else {
            updateData[key] = (dup.imported as any)[key] || null;
          }
        }

        if (Object.keys(updateData).length > 0) {
          const { error } = await supabase.from('students').update(updateData).eq('id', dup.existing.id);
          if (error) console.error('Error updating student:', dup.existing.full_name, error);
        }
      }

      toast({ title: 'Thành công', description: `Đã cập nhật ${duplicateData.duplicates.length} học sinh trùng` });
      setIsDuplicateDialogOpen(false);
      setDuplicateData(null);
      fetchData();
    } catch (error) {
      console.error('Error updating duplicates:', error);
      toast({ title: 'Lỗi', description: 'Không thể cập nhật học sinh trùng', variant: 'destructive' });
    } finally {
      setIsImportingSave(false);
    }
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
        // Update single class
        const { error } = await supabase
          .from('classes')
          .update({ name: newClassName.trim(), grade: parseInt(newClassGrade) })
          .eq('id', editingClass.id);
        if (error) throw error;
        toast({ title: 'Thành công', description: 'Đã cập nhật lớp' });
      } else {
        // Parse multiple class names separated by comma, space, or both
        const classNames = newClassName
          .split(/[,\s]+/)
          .map(name => name.trim())
          .filter(name => name.length > 0);

        if (classNames.length === 0) return;

        const classesToInsert = classNames.map(name => ({
          school_id: currentSchool.id,
          name: name,
          grade: parseInt(newClassGrade),
          school_year: new Date().getFullYear().toString(),
        }));

        const { error } = await supabase.from('classes').insert(classesToInsert);
        if (error) throw error;
        
        toast({ 
          title: 'Thành công', 
          description: `Đã thêm ${classNames.length} lớp: ${classNames.join(', ')}` 
        });
      }

      setNewClassName('');
      setNewClassGrade('1');
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

  // Quick update functions for single student
  const handleQuickUpdateClass = async (studentId: string, classId: string | null) => {
    try {
      const { error } = await supabase
        .from('students')
        .update({ class_id: classId })
        .eq('id', studentId);
      if (error) throw error;
      toast({ title: 'Thành công', description: 'Đã cập nhật lớp' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const handleQuickUpdateRoom = async (studentId: string, room: string) => {
    try {
      const { error } = await supabase
        .from('students')
        .update({ room_number: room || null })
        .eq('id', studentId);
      if (error) throw error;
      toast({ title: 'Thành công', description: 'Đã cập nhật phòng' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const handleQuickUpdateMeal = async (studentId: string, meal: string) => {
    try {
      const { error } = await supabase
        .from('students')
        .update({ meal_group: meal || null })
        .eq('id', studentId);
      if (error) throw error;
      toast({ title: 'Thành công', description: 'Đã cập nhật mâm ăn' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  // Batch update for selected students
  const handleBatchUpdate = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      let updateData: Record<string, any> = {};
      
      if (batchUpdateType === 'class') {
        updateData.class_id = batchUpdateValue === '__none__' ? null : batchUpdateValue || null;
      } else if (batchUpdateType === 'room') {
        updateData.room_number = batchUpdateValue || null;
      } else if (batchUpdateType === 'meal') {
        updateData.meal_group = batchUpdateValue || null;
      }

      const { error } = await supabase
        .from('students')
        .update(updateData)
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      const labels = { class: 'lớp', room: 'phòng', meal: 'mâm ăn' };
      toast({ 
        title: 'Thành công', 
        description: `Đã cập nhật ${labels[batchUpdateType]} cho ${selectedIds.size} học sinh` 
      });
      setIsBatchUpdateOpen(false);
      setBatchUpdateValue('');
      setSelectedIds(new Set());
      fetchData();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const openBatchUpdate = (type: 'class' | 'room' | 'meal') => {
    setBatchUpdateType(type);
    setBatchUpdateValue('');
    setIsBatchUpdateOpen(true);
  };

  const handleBulkAvatarUpdate = async () => {
    if (!bulkAvatarText.trim()) return;
    
    // Parse lines: "student_code URL" or "student_code,URL" or "student_code\tURL"
    const lines = bulkAvatarText.trim().split('\n').filter(l => l.trim());
    let updated = 0;
    let notFound: string[] = [];
    
    for (const line of lines) {
      const parts = line.trim().split(/[,\t]+|\s{2,}/);
      if (parts.length < 2) continue;
      
      const code = parts[0].trim();
      const url = parts.slice(1).join(' ').trim();
      if (!code || !url) continue;
      
      const student = students.find(s => s.student_code === code);
      if (student) {
        const { error } = await supabase
          .from('students')
          .update({ avatar_url: url })
          .eq('id', student.id);
        if (!error) updated++;
      } else {
        notFound.push(code);
      }
    }
    
    if (updated > 0) {
      toast({ title: 'Thành công', description: `Đã cập nhật ảnh cho ${updated} học sinh${notFound.length > 0 ? `. Không tìm thấy: ${notFound.join(', ')}` : ''}` });
      fetchData();
    } else {
      toast({ title: 'Lỗi', description: notFound.length > 0 ? `Không tìm thấy mã HS: ${notFound.join(', ')}` : 'Không có dữ liệu hợp lệ', variant: 'destructive' });
    }
    
    setIsBulkAvatarOpen(false);
    setBulkAvatarText('');
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
      <Tabs value={activeTab} onValueChange={(val) => {
        setActiveTab(val);
        setSelectedIds(new Set());
        // Reset filters when switching tabs
        if (val !== 'students') {
          setSelectedClassFilter('all');
          setSelectedRoomFilter(null);
          setSelectedMealFilter(null);
        }
      }} className="w-full">
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
                {(selectedClassFilter !== 'all' || selectedRoomFilter || selectedMealFilter) && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {selectedClassFilter !== 'all' && classes.find(c => c.id === selectedClassFilter)?.name}
                    {selectedRoomFilter && `Phòng ${selectedRoomFilter}`}
                    {selectedMealFilter && selectedMealFilter}
                  </Badge>
                )}
              </h1>
              <div className="flex items-center gap-2">
                <p className="page-description">
                  {selectedIds.size > 0 
                    ? `Đã chọn ${selectedIds.size}/${filteredStudents.length} học sinh` 
                    : `${filteredStudents.length} học sinh`}
                </p>
                {(selectedClassFilter !== 'all' || selectedRoomFilter || selectedMealFilter) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      setSelectedClassFilter('all');
                      setSelectedRoomFilter(null);
                      setSelectedMealFilter(null);
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                )}
              </div>
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
                <Button variant="outline" size="sm" onClick={() => setIsBulkAvatarOpen(true)}>
                  <Image className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Cập nhật ảnh</span>
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
                          <Label htmlFor="student_code">Mã HS</Label>
                          <Input
                            id="student_code"
                            value={formData.student_code}
                            onChange={(e) => setFormData({ ...formData, student_code: e.target.value })}
                            placeholder="Tự động từ CCCD"
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
                            onChange={(e) => {
                              const cccd = e.target.value;
                              const newData: typeof formData = { ...formData, cccd };
                              if (!formData.student_code || formData.student_code === formData.cccd) {
                                newData.student_code = cccd;
                              }
                              setFormData(newData);
                            }}
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

                      <div className="space-y-1.5">
                        <Label htmlFor="avatar_url">Link ảnh (URL)</Label>
                        <Input
                          id="avatar_url"
                          value={formData.avatar_url}
                          onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                          placeholder="https://..."
                        />
                        {formData.avatar_url && (
                          <div className="flex items-center gap-2 mt-1">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={formData.avatar_url} alt="Preview" className="object-cover" />
                              <AvatarFallback>?</AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">Xem trước</span>
                          </div>
                        )}
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
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {isSchoolAdmin() && (
                <>
                  <Button variant="outline" size="sm" onClick={handleSelectAll} className="shrink-0">
                    {selectedIds.size === filteredStudents.length && filteredStudents.length > 0 ? (
                      <><CheckSquare className="h-4 w-4 mr-1" /> Bỏ chọn</>
                    ) : (
                      <><Square className="h-4 w-4 mr-1" /> Chọn tất cả</>
                    )}
                  </Button>
                  {selectedIds.size > 0 && (
                    <>
                      <Badge variant="secondary" className="px-2">{selectedIds.size} đã chọn</Badge>
                      <Button variant="outline" size="sm" onClick={() => openBatchUpdate('class')}>
                        <GraduationCap className="h-4 w-4 mr-1" /> Đổi lớp
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openBatchUpdate('room')}>
                        <Building className="h-4 w-4 mr-1" /> Đổi phòng
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openBatchUpdate('meal')}>
                        <Utensils className="h-4 w-4 mr-1" /> Đổi mâm
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                        <Trash2 className="h-4 w-4 mr-1" /> Xóa
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
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
                    <Avatar
                      className={cn("h-10 w-10 bg-primary/10 flex-shrink-0", student.avatar_url && "cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all")}
                      onClick={(e) => { if (student.avatar_url) { e.stopPropagation(); setZoomAvatarUrl(student.avatar_url); } }}
                    >
                      {student.avatar_url && <AvatarImage src={student.avatar_url} alt={student.full_name} className="object-cover" />}
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
                      <Label>{editingClass ? 'Tên lớp' : 'Tên lớp (nhiều lớp cách nhau bởi dấu phẩy)'}</Label>
                      <Input
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        placeholder={editingClass ? "VD: 6A" : "VD: 6A, 6B, 6C"}
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
              const classStudents = students.filter(s => s.class_id === cls.id);
              const count = classStudents.length;
              return (
                <Card 
                  key={cls.id} 
                  className="hover:border-primary transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedClassFilter(cls.id);
                    setSelectedRoomFilter(null);
                    setSelectedMealFilter(null);
                    setActiveTab('students');
                  }}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{cls.name}</h3>
                      <p className="text-sm text-muted-foreground">Khối {cls.grade} • {count} học sinh</p>
                    </div>
                    {isSchoolAdmin() && (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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
                <Card 
                  key={room} 
                  className="hover:border-primary transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedRoomFilter(room);
                    setSelectedClassFilter('all');
                    setSelectedMealFilter(null);
                    setActiveTab('students');
                  }}
                >
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
                <Card 
                  key={group} 
                  className="hover:border-primary transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedMealFilter(group);
                    setSelectedClassFilter('all');
                    setSelectedRoomFilter(null);
                    setActiveTab('students');
                  }}
                >
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
                  <Avatar
                    className={cn("h-12 w-12 bg-primary", selectedStudent.avatar_url && "cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all")}
                    onClick={() => { if (selectedStudent.avatar_url) setZoomAvatarUrl(selectedStudent.avatar_url); }}
                  >
                    {selectedStudent.avatar_url && <AvatarImage src={selectedStudent.avatar_url} alt={selectedStudent.full_name} className="object-cover" />}
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
              {/* Quick Edit Section */}
              {isSchoolAdmin() && (
                <div className="space-y-3 pb-3 border-b">
                  <div className="text-xs font-medium text-muted-foreground">Cập nhật nhanh</div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-2">
                      <Label className="w-16 text-xs">Lớp</Label>
                      <Select
                        value={selectedStudent.class_id || '__none__'}
                        onValueChange={(value) => handleQuickUpdateClass(selectedStudent.id, value === '__none__' ? null : value)}
                      >
                        <SelectTrigger className="flex-1 h-8">
                          <SelectValue placeholder="Chọn lớp" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Chưa xếp</SelectItem>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="w-16 text-xs">Phòng</Label>
                      <Input
                        className="flex-1 h-8"
                        value={selectedStudent.room_number || ''}
                        placeholder="VD: P101"
                        list="room-quick-suggestions"
                        onBlur={(e) => {
                          if (e.target.value !== (selectedStudent.room_number || '')) {
                            handleQuickUpdateRoom(selectedStudent.id, e.target.value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleQuickUpdateRoom(selectedStudent.id, (e.target as HTMLInputElement).value);
                          }
                        }}
                      />
                      <datalist id="room-quick-suggestions">
                        {roomNumbers.map(r => <option key={r} value={r} />)}
                      </datalist>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="w-16 text-xs">Mâm ăn</Label>
                      <Input
                        className="flex-1 h-8"
                        value={selectedStudent.meal_group || ''}
                        placeholder="VD: Mâm 1"
                        list="meal-quick-suggestions"
                        onBlur={(e) => {
                          if (e.target.value !== (selectedStudent.meal_group || '')) {
                            handleQuickUpdateMeal(selectedStudent.id, e.target.value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleQuickUpdateMeal(selectedStudent.id, (e.target as HTMLInputElement).value);
                          }
                        }}
                      />
                      <datalist id="meal-quick-suggestions">
                        {mealGroups.map(m => <option key={m} value={m} />)}
                      </datalist>
                    </div>
                  </div>
                </div>
              )}

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

      {/* Batch Update Dialog */}
      <Dialog open={isBatchUpdateOpen} onOpenChange={setIsBatchUpdateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {batchUpdateType === 'class' && 'Đổi lớp cho học sinh đã chọn'}
              {batchUpdateType === 'room' && 'Đổi phòng cho học sinh đã chọn'}
              {batchUpdateType === 'meal' && 'Đổi mâm ăn cho học sinh đã chọn'}
            </DialogTitle>
            <DialogDescription>
              Áp dụng cho {selectedIds.size} học sinh đã chọn
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {batchUpdateType === 'class' && (
              <Select value={batchUpdateValue} onValueChange={setBatchUpdateValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn lớp mới" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Chưa xếp (bỏ lớp)</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {batchUpdateType === 'room' && (
              <Input
                value={batchUpdateValue}
                onChange={(e) => setBatchUpdateValue(e.target.value)}
                placeholder="Nhập phòng mới (VD: P101)"
                list="batch-room-suggestions"
              />
            )}
            {batchUpdateType === 'meal' && (
              <Input
                value={batchUpdateValue}
                onChange={(e) => setBatchUpdateValue(e.target.value)}
                placeholder="Nhập mâm ăn mới (VD: Mâm 1)"
                list="batch-meal-suggestions"
              />
            )}
            <datalist id="batch-room-suggestions">
              {roomNumbers.map(r => <option key={r} value={r} />)}
            </datalist>
            <datalist id="batch-meal-suggestions">
              {mealGroups.map(m => <option key={m} value={m} />)}
            </datalist>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBatchUpdateOpen(false)}>Hủy</Button>
            <Button onClick={handleBatchUpdate}>Cập nhật</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Avatar Update Dialog */}
      <Dialog open={isBulkAvatarOpen} onOpenChange={setIsBulkAvatarOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              Cập nhật ảnh hàng loạt
            </DialogTitle>
            <DialogDescription>
              Nhập mỗi dòng gồm: <strong>Mã học sinh</strong> và <strong>Link ảnh</strong>, cách nhau bởi dấu phẩy hoặc tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
              <p className="font-medium">Ví dụ:</p>
              <pre className="text-muted-foreground whitespace-pre-wrap">
{`HS001, https://example.com/photo1.jpg
HS002, https://example.com/photo2.jpg
HS003, https://example.com/photo3.jpg`}
              </pre>
            </div>
            <Textarea
              value={bulkAvatarText}
              onChange={(e) => setBulkAvatarText(e.target.value)}
              placeholder="Mã HS, Link ảnh (mỗi dòng 1 học sinh)"
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Hỗ trợ link Google Drive, Facebook, hoặc bất kỳ URL ảnh công khai nào.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsBulkAvatarOpen(false); setBulkAvatarText(''); }}>Hủy</Button>
            <Button onClick={handleBulkAvatarUpdate} disabled={!bulkAvatarText.trim()}>
              <Link className="h-4 w-4 mr-1" />
              Cập nhật
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zoom Avatar Dialog */}
      <Dialog open={!!zoomAvatarUrl} onOpenChange={() => setZoomAvatarUrl(null)}>
        <DialogContent className="max-w-lg p-2 bg-background">
          <DialogHeader className="sr-only">
            <DialogTitle>Ảnh học sinh</DialogTitle>
          </DialogHeader>
          {zoomAvatarUrl && (
            <img
              src={zoomAvatarUrl}
              alt="Ảnh học sinh"
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate Import Dialog */}
      <Dialog open={isDuplicateDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDuplicateDialogOpen(false);
          setDuplicateData(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Phát hiện học sinh trùng</DialogTitle>
            <DialogDescription>
              Có {duplicateData?.duplicates.length || 0} học sinh đã tồn tại với thông tin khác biệt. Bạn có muốn cập nhật?
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[50vh]">
            <div className="space-y-3 pr-4">
              {duplicateData?.duplicates.map((dup, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="font-medium text-sm">{dup.existing.full_name} {dup.existing.class?.name ? `(${dup.existing.class.name})` : ''}</div>
                  <div className="space-y-1">
                    {Object.entries(dup.updates).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-20">{
                          key === 'phone' ? 'SĐT' :
                          key === 'address' ? 'Địa chỉ' :
                          key === 'room_number' ? 'Phòng' :
                          key === 'meal_group' ? 'Mâm' :
                          key === 'avatar_url' ? 'Ảnh' :
                          key === 'cccd' ? 'CCCD' :
                          key === 'date_of_birth' ? 'Ngày sinh' :
                          key === 'gender' ? 'Giới tính' :
                          key === 'class_id' ? 'Lớp' : key
                        }:</span>
                        <span className="line-through text-muted-foreground">{String(val.old)}</span>
                        <span>→</span>
                        <span className="font-medium text-primary">{String(val.new)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDuplicateDialogOpen(false); setDuplicateData(null); }}>
              Bỏ qua
            </Button>
            <Button onClick={handleConfirmDuplicateUpdate} disabled={isImportingSave}>
              {isImportingSave && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cập nhật {duplicateData?.duplicates.length || 0} học sinh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
