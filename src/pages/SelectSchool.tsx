import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap, Building2, ChevronRight, LogOut } from 'lucide-react';

export default function SelectSchool() {
  const navigate = useNavigate();
  const { memberships, selectSchool, signOut, profile, isSuperAdmin } = useAuth();

  const handleSelectSchool = (membership: typeof memberships[0]) => {
    if (membership.school) {
      selectSchool(membership.school);
      navigate('/dashboard');
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Quản trị viên',
      teacher: 'Giáo viên',
      class_teacher: 'Giáo viên chủ nhiệm',
      accountant: 'Kế toán',
      kitchen: 'Nhà bếp',
    };
    return labels[role] || role;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4">
      <Card className="w-full max-w-lg animate-scale-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <GraduationCap className="h-9 w-9 text-primary-foreground" />
          </div>
          <CardTitle className="font-heading text-2xl">Chọn trường học</CardTitle>
          <CardDescription>
            Xin chào, {profile?.full_name}! Vui lòng chọn trường để tiếp tục.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {isSuperAdmin && (
            <button
              onClick={() => navigate('/superadmin')}
              className="w-full flex items-center gap-4 rounded-xl border-2 border-primary bg-primary/5 p-4 text-left transition-all hover:bg-primary/10"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Quản trị hệ thống</h3>
                <p className="text-sm text-muted-foreground">Super Admin</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          )}

          {memberships.map((membership) => (
            <button
              key={membership.id}
              onClick={() => handleSelectSchool(membership)}
              className="w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all hover:border-primary hover:bg-muted/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">
                  {membership.school?.name || 'Unknown School'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {getRoleLabel(membership.role)}
                  {membership.class_id && ` • ${membership.class_id}`}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          ))}

          <div className="pt-4">
            <Button
              variant="ghost"
              onClick={signOut}
              className="w-full text-muted-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Đăng xuất
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
