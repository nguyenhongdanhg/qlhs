import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Profile } from '@/types';
import {
  Users,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Save,
  Loader2,
  UserPlus,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DutyGroup {
  id: string;
  school_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  members?: DutyGroupMember[];
}

interface DutyGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  school_id: string;
  profile?: Profile;
}

interface DutyShift {
  id: string;
  school_id: string;
  name: string;
  start_time: string;
  end_time: string;
  display_order: number;
  is_active: boolean;
}

export default function DutyGroupsShiftsSettings() {
  const { currentSchool } = useAuth();
  const { toast } = useToast();

  // Groups state
  const [groups, setGroups] = useState<DutyGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DutyGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Group members
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<DutyGroup | null>(null);
  const [allMembers, setAllMembers] = useState<Profile[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  // Shifts state
  const [shifts, setShifts] = useState<DutyShift[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [editingShift, setEditingShift] = useState<DutyShift | null>(null);
  const [shiftName, setShiftName] = useState('');
  const [shiftStartTime, setShiftStartTime] = useState('06:00');
  const [shiftEndTime, setShiftEndTime] = useState('18:00');

  const getInitials = (name: string) =>
    name.split(' ').slice(-2).map(n => n[0]).join('').toUpperCase();

  // Fetch groups with members
  const fetchGroups = async () => {
    if (!currentSchool) return;
    setIsLoadingGroups(true);
    try {
      const { data: groupsData, error } = await supabase
        .from('duty_groups')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('display_order');

      if (error) throw error;

      // Fetch members for each group
      const { data: membersData } = await supabase
        .from('duty_group_members')
        .select('*, profile:profiles(*)')
        .eq('school_id', currentSchool.id);

      const groupsWithMembers = (groupsData || []).map(g => ({
        ...g,
        members: (membersData || [])
          .filter(m => m.group_id === g.id)
          .map(m => ({ ...m, profile: m.profile as unknown as Profile })),
      }));

      setGroups(groupsWithMembers);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  // Fetch shifts
  const fetchShifts = async () => {
    if (!currentSchool) return;
    setIsLoadingShifts(true);
    try {
      const { data, error } = await supabase
        .from('duty_shifts')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('display_order');

      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setIsLoadingShifts(false);
    }
  };

  // Fetch all school members
  const fetchAllMembers = async () => {
    if (!currentSchool) return;
    try {
      const { data } = await supabase
        .from('school_memberships')
        .select('user_id, profile:profiles(*)')
        .eq('school_id', currentSchool.id)
        .eq('status', 'active');

      setAllMembers(
        (data || []).map(d => d.profile as unknown as Profile).filter(Boolean)
      );
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  useEffect(() => {
    if (currentSchool) {
      fetchGroups();
      fetchShifts();
      fetchAllMembers();
    }
  }, [currentSchool]);

  // ===== GROUP CRUD =====
  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupName('');
    setShowGroupDialog(true);
  };

  const openEditGroup = (group: DutyGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setShowGroupDialog(true);
  };

  const saveGroup = async () => {
    if (!currentSchool || !groupName.trim()) return;
    setIsSaving(true);
    try {
      if (editingGroup) {
        const { error } = await supabase
          .from('duty_groups')
          .update({ name: groupName.trim() })
          .eq('id', editingGroup.id);
        if (error) throw error;
      } else {
        const maxOrder = groups.length > 0 ? Math.max(...groups.map(g => g.display_order)) + 1 : 0;
        const { error } = await supabase
          .from('duty_groups')
          .insert({
            school_id: currentSchool.id,
            name: groupName.trim(),
            display_order: maxOrder,
          });
        if (error) throw error;
      }
      setShowGroupDialog(false);
      fetchGroups();
      toast({ title: 'Thành công', description: editingGroup ? 'Đã cập nhật nhóm trực' : 'Đã tạo nhóm trực mới' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('duty_groups').delete().eq('id', groupId);
      if (error) throw error;
      fetchGroups();
      toast({ title: 'Thành công', description: 'Đã xóa nhóm trực' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // ===== GROUP MEMBERS =====
  const openGroupMembers = (group: DutyGroup) => {
    setSelectedGroup(group);
    setSelectedMemberIds(group.members?.map(m => m.user_id) || []);
    setMemberSearch('');
    setShowMembersDialog(true);
  };

  const saveGroupMembers = async () => {
    if (!currentSchool || !selectedGroup) return;
    setIsSaving(true);
    try {
      // Delete existing members
      await supabase
        .from('duty_group_members')
        .delete()
        .eq('group_id', selectedGroup.id);

      // Insert new members
      if (selectedMemberIds.length > 0) {
        const entries = selectedMemberIds.map(userId => ({
          group_id: selectedGroup.id,
          user_id: userId,
          school_id: currentSchool.id,
        }));
        const { error } = await supabase.from('duty_group_members').insert(entries);
        if (error) throw error;
      }

      setShowMembersDialog(false);
      fetchGroups();
      toast({ title: 'Thành công', description: `Đã cập nhật ${selectedMemberIds.length} thành viên cho nhóm "${selectedGroup.name}"` });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // ===== SHIFT CRUD =====
  const openCreateShift = () => {
    setEditingShift(null);
    setShiftName('');
    setShiftStartTime('06:00');
    setShiftEndTime('18:00');
    setShowShiftDialog(true);
  };

  const openEditShift = (shift: DutyShift) => {
    setEditingShift(shift);
    setShiftName(shift.name);
    setShiftStartTime(shift.start_time);
    setShiftEndTime(shift.end_time);
    setShowShiftDialog(true);
  };

  const saveShift = async () => {
    if (!currentSchool || !shiftName.trim()) return;
    setIsSaving(true);
    try {
      if (editingShift) {
        const { error } = await supabase
          .from('duty_shifts')
          .update({ name: shiftName.trim(), start_time: shiftStartTime, end_time: shiftEndTime })
          .eq('id', editingShift.id);
        if (error) throw error;
      } else {
        const maxOrder = shifts.length > 0 ? Math.max(...shifts.map(s => s.display_order)) + 1 : 0;
        const { error } = await supabase
          .from('duty_shifts')
          .insert({
            school_id: currentSchool.id,
            name: shiftName.trim(),
            start_time: shiftStartTime,
            end_time: shiftEndTime,
            display_order: maxOrder,
          });
        if (error) throw error;
      }
      setShowShiftDialog(false);
      fetchShifts();
      toast({ title: 'Thành công', description: editingShift ? 'Đã cập nhật ca trực' : 'Đã tạo ca trực mới' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteShift = async (shiftId: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('duty_shifts').delete().eq('id', shiftId);
      if (error) throw error;
      fetchShifts();
      toast({ title: 'Thành công', description: 'Đã xóa ca trực' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredMembers = allMembers.filter(m =>
    !memberSearch || m.full_name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ===== DUTY GROUPS ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Nhóm trực
            </CardTitle>
            <Button size="sm" onClick={openCreateGroup} className="gap-1">
              <Plus className="h-4 w-4" />
              Thêm nhóm
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingGroups ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Chưa có nhóm trực nào. Tạo nhóm để phân công theo nhóm.
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map((group, idx) => (
                <div
                  key={group.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Nhóm {idx + 1}
                      </Badge>
                      <span className="font-medium">{group.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {group.members?.length || 0} người
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openGroupMembers(group)}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEditGroup(group)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Xóa nhóm trực?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Xóa nhóm "{group.name}" và tất cả thành viên trong nhóm?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteGroup(group.id)} className="bg-destructive hover:bg-destructive/90">
                              Xóa
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Members list */}
                  {group.members && group.members.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {group.members.map(member => (
                        <div
                          key={member.id}
                          className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2.5 py-1"
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {getInitials(member.profile?.full_name || '?')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">
                            {member.profile?.full_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== DUTY SHIFTS ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Ca trực
            </CardTitle>
            <Button size="sm" onClick={openCreateShift} className="gap-1">
              <Plus className="h-4 w-4" />
              Thêm ca
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingShifts ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Chưa có ca trực nào. Tạo ca trực để phân công theo giờ.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-center">STT</TableHead>
                  <TableHead>Tên ca</TableHead>
                  <TableHead className="text-center">Giờ bắt đầu</TableHead>
                  <TableHead className="text-center">Giờ kết thúc</TableHead>
                  <TableHead className="w-20 text-center">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift, idx) => (
                  <TableRow key={shift.id}>
                    <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{shift.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{shift.start_time}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{shift.end_time}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditShift(shift)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xóa ca trực?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Xóa ca "{shift.name}"? Hành động này không thể hoàn tác.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteShift(shift.id)} className="bg-destructive hover:bg-destructive/90">
                                Xóa
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ===== CREATE/EDIT GROUP DIALOG ===== */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Sửa nhóm trực' : 'Tạo nhóm trực'}</DialogTitle>
            <DialogDescription>
              {editingGroup ? 'Cập nhật tên nhóm trực' : 'Đặt tên cho nhóm trực mới'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Tên nhóm</Label>
              <Input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="VD: Nhóm 1, Nhóm A..."
                onKeyDown={e => e.key === 'Enter' && saveGroup()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupDialog(false)}>Hủy</Button>
            <Button onClick={saveGroup} disabled={!groupName.trim() || isSaving} className="gap-1">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingGroup ? 'Cập nhật' : 'Tạo nhóm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== GROUP MEMBERS DIALOG ===== */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thành viên - {selectedGroup?.name}</DialogTitle>
            <DialogDescription>
              Chọn giáo viên/nhân sự thuộc nhóm trực này
            </DialogDescription>
          </DialogHeader>

          <Input
            placeholder="Tìm theo tên..."
            value={memberSearch}
            onChange={e => setMemberSearch(e.target.value)}
            className="mb-2"
          />

          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {filteredMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Không tìm thấy thành viên
              </p>
            ) : (
              filteredMembers.map(member => {
                const isSelected = selectedMemberIds.includes(member.id);
                return (
                  <div
                    key={member.id}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                      isSelected ? 'bg-primary/5 border border-primary/30' : 'hover:bg-muted/50 border border-transparent'
                    )}
                    onClick={() => {
                      setSelectedMemberIds(prev =>
                        prev.includes(member.id)
                          ? prev.filter(id => id !== member.id)
                          : [...prev, member.id]
                      );
                    }}
                  >
                    <Checkbox checked={isSelected} />
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {getInitials(member.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{member.full_name}</span>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMembersDialog(false)}>Hủy</Button>
            <Button onClick={saveGroupMembers} disabled={isSaving} className="gap-1">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Lưu ({selectedMemberIds.length} người)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== CREATE/EDIT SHIFT DIALOG ===== */}
      <Dialog open={showShiftDialog} onOpenChange={setShowShiftDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Sửa ca trực' : 'Tạo ca trực'}</DialogTitle>
            <DialogDescription>
              {editingShift ? 'Cập nhật thông tin ca trực' : 'Thiết lập ca trực mới với khung giờ'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tên ca</Label>
              <Input
                value={shiftName}
                onChange={e => setShiftName(e.target.value)}
                placeholder="VD: Ca sáng, Ca chiều, Ca tối..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Giờ bắt đầu</Label>
                <Input
                  type="time"
                  value={shiftStartTime}
                  onChange={e => setShiftStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Giờ kết thúc</Label>
                <Input
                  type="time"
                  value={shiftEndTime}
                  onChange={e => setShiftEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShiftDialog(false)}>Hủy</Button>
            <Button onClick={saveShift} disabled={!shiftName.trim() || isSaving} className="gap-1">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingShift ? 'Cập nhật' : 'Tạo ca'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
