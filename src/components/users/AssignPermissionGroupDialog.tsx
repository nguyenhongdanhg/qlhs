import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield } from 'lucide-react';

interface PermissionGroup {
  id: string;
  name: string;
  description: string | null;
}

interface AssignPermissionGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUserIds: string[];
  onComplete: () => void;
}

export default function AssignPermissionGroupDialog({
  open,
  onOpenChange,
  selectedUserIds,
  onComplete,
}: AssignPermissionGroupDialogProps) {
  const { currentSchool, user } = useAuth();
  const { refetchPermissions } = useSchool();
  const { toast } = useToast();

  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && currentSchool) {
      fetchGroups();
    }
  }, [open, currentSchool]);

  const fetchGroups = async () => {
    if (!currentSchool) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('permission_groups')
        .select('id, name, description')
        .eq('school_id', currentSchool.id)
        .order('name');

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleAssign = async () => {
    if (!currentSchool || selectedGroups.length === 0 || selectedUserIds.length === 0) return;

    setIsSaving(true);
    try {
      // Create user-group associations for all selected users and groups
      const associations = selectedUserIds.flatMap((userId) =>
        selectedGroups.map((groupId) => ({
          user_id: userId,
          group_id: groupId,
          school_id: currentSchool.id,
        }))
      );

      // First delete existing associations for these users (to avoid duplicates)
      await supabase
        .from('user_permission_groups')
        .delete()
        .eq('school_id', currentSchool.id)
        .in('user_id', selectedUserIds);

      // Insert new associations
      const { error } = await supabase.from('user_permission_groups').insert(associations);

      if (error) throw error;

      toast({
        title: 'Thành công',
        description: `Đã gán ${selectedGroups.length} nhóm quyền cho ${selectedUserIds.length} người dùng`,
      });

      // Refresh permissions if current user was affected
      if (user && selectedUserIds.includes(user.id)) {
        await refetchPermissions();
      }

      onOpenChange(false);
      setSelectedGroups([]);
      onComplete();
    } catch (error: any) {
      console.error('Error assigning groups:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể gán nhóm quyền',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gán nhóm quyền
          </DialogTitle>
          <DialogDescription>
            Chọn nhóm quyền để gán cho {selectedUserIds.length} người dùng đã chọn
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">Chưa có nhóm quyền nào</p>
            <p className="text-sm text-muted-foreground">
              Vui lòng tạo nhóm quyền trong tab "Nhóm quyền"
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-3">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleGroup(group.id)}
                >
                  <Checkbox
                    checked={selectedGroups.includes(group.id)}
                    onCheckedChange={() => toggleGroup(group.id)}
                  />
                  <div className="flex-1">
                    <Label className="cursor-pointer font-medium">{group.name}</Label>
                    {group.description && (
                      <p className="text-sm text-muted-foreground">{group.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex-1">
            {selectedGroups.length > 0 && (
              <Badge variant="secondary">
                Đã chọn {selectedGroups.length} nhóm
              </Badge>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleAssign}
            disabled={isSaving || selectedGroups.length === 0}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gán nhóm quyền
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
