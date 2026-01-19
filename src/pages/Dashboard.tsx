import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Home, 
  CheckCircle2, 
  XCircle, 
  GraduationCap,
  TrendingUp,
  Calendar,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardStats } from '@/types';

export default function Dashboard() {
  const { currentSchool, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentSchool) return;

    const fetchStats = async () => {
      try {
        // Fetch students count
        const { count: totalStudents } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchool.id)
          .eq('is_active', true);

        const { count: boardingStudents } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchool.id)
          .eq('is_active', true)
          .eq('is_boarding', true);

        const { count: totalClasses } = await supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', currentSchool.id)
          .eq('is_active', true);

        // Fetch today's attendance
        const today = new Date().toISOString().split('T')[0];
        const { data: attendanceData } = await supabase
          .from('attendance_records')
          .select('status')
          .eq('school_id', currentSchool.id)
          .eq('attendance_date', today);

        const present = attendanceData?.filter(a => a.status === 'present').length || 0;
        const absent = attendanceData?.filter(a => a.status === 'absent').length || 0;
        const total = present + absent;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;

        setStats({
          totalStudents: totalStudents || 0,
          boardingStudents: boardingStudents || 0,
          totalClasses: totalClasses || 0,
          todayAttendance: {
            present,
            absent,
            rate,
          },
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [currentSchool]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
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
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">{getGreeting()}, {profile?.full_name?.split(' ').pop()}!</h1>
        <p className="page-description">
          Tổng quan hoạt động tại {currentSchool.name}
        </p>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="stat-card group hover:border-primary/50">
              <Users className="stat-card-icon text-primary" />
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Tổng học sinh
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.totalStudents || 0}</div>
                <p className="text-sm text-muted-foreground">
                  {stats?.boardingStudents || 0} học sinh nội trú
                </p>
              </CardContent>
            </Card>

            <Card className="stat-card group hover:border-accent/50">
              <Home className="stat-card-icon text-accent" />
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Nội trú
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.boardingStudents || 0}</div>
                <p className="text-sm text-muted-foreground">
                  học sinh đang ở nội trú
                </p>
              </CardContent>
            </Card>

            <Card className="stat-card group hover:border-success/50">
              <CheckCircle2 className="stat-card-icon text-success" />
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Có mặt hôm nay
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">
                  {stats?.todayAttendance.rate || 0}%
                </div>
                <p className="text-sm text-muted-foreground">
                  {stats?.todayAttendance.present || 0} có mặt / {stats?.todayAttendance.absent || 0} vắng
                </p>
              </CardContent>
            </Card>

            <Card className="stat-card group hover:border-warning/50">
              <GraduationCap className="stat-card-icon text-warning" />
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Lớp học
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.totalClasses || 0}</div>
                <p className="text-sm text-muted-foreground">
                  lớp đang hoạt động
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold">Thao tác nhanh</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Link to="/evening-study">
                <Card className="group cursor-pointer transition-all hover:border-primary hover:shadow-md">
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="rounded-xl bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Calendar className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Điểm danh tự học tối</h3>
                      <p className="text-sm text-muted-foreground">Ghi nhận học sinh tự học</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </CardContent>
                </Card>
              </Link>

              <Link to="/boarding">
                <Card className="group cursor-pointer transition-all hover:border-accent hover:shadow-md">
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="rounded-xl bg-accent/10 p-3 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                      <Home className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Điểm danh nội trú</h3>
                      <p className="text-sm text-muted-foreground">Kiểm tra học sinh nội trú</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </CardContent>
                </Card>
              </Link>

              <Link to="/students">
                <Card className="group cursor-pointer transition-all hover:border-success hover:shadow-md">
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="rounded-xl bg-success/10 p-3 text-success transition-colors group-hover:bg-success group-hover:text-success-foreground">
                      <Users className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Quản lý học sinh</h3>
                      <p className="text-sm text-muted-foreground">Xem danh sách học sinh</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
