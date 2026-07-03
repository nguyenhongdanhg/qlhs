import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList,
  Wallet,
  Cake,
  Bell,
  AlertTriangle,
} from 'lucide-react';
import {
  format,
  parseISO,
  differenceInCalendarDays,
  addYears,
  isValid,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Chu kỳ nâng lương mặc định (năm). Có thể tuỳ chỉnh sau.
const SALARY_RAISE_YEARS = 3;

interface TaskAlert {
  id: string;
  title: string;
  deadline: string;
  daysLeft: number;
  assignee?: string;
}

interface SalaryAlert {
  id: string;
  name: string;
  raiseDate: string;
  daysLeft: number;
}

interface BirthdayAlert {
  id: string;
  name: string;
  kind: 'teacher' | 'student';
  className?: string;
}

export function DashboardAlerts() {
  const { currentSchool } = useAuth();
  const [tasks, setTasks] = useState<TaskAlert[]>([]);
  const [salaries, setSalaries] = useState<SalaryAlert[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSchool) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const in2Days = format(new Date(today.getTime() + 2 * 86400000), 'yyyy-MM-dd');
      const mm = format(today, 'MM');
      const dd = format(today, 'dd');

      try {
        const [tasksRes, teachersRes, studentsRes, classesRes] = await Promise.all([
          supabase
            .from('tasks')
            .select('id, title, deadline, assignee:profiles!tasks_assignee_id_fkey(full_name)')
            .eq('school_id', currentSchool.id)
            .eq('status', 'pending')
            .not('deadline', 'is', null)
            .gte('deadline', todayStr)
            .lte('deadline', in2Days)
            .order('deadline', { ascending: true }),
          supabase
            .from('teachers')
            .select('id, full_name, birthday, salary_effective_date')
            .eq('school_id', currentSchool.id),
          supabase
            .from('students')
            .select('id, full_name, date_of_birth, class_id')
            .eq('school_id', currentSchool.id)
            .eq('is_active', true),
          supabase
            .from('classes')
            .select('id, name')
            .eq('school_id', currentSchool.id),
        ]);

        if (cancelled) return;

        // Tasks
        const tArr: TaskAlert[] = ((tasksRes.data as any[]) || []).map((t) => ({
          id: t.id,
          title: t.title,
          deadline: t.deadline,
          daysLeft: differenceInCalendarDays(parseISO(t.deadline), today),
          assignee: t.assignee?.full_name,
        }));
        setTasks(tArr);

        // Salary raise (assume 3-year cycle from salary_effective_date)
        const sArr: SalaryAlert[] = [];
        const bArr: BirthdayAlert[] = [];
        for (const tc of (teachersRes.data as any[]) || []) {
          // Salary
          if (tc.salary_effective_date) {
            const eff = parseISO(tc.salary_effective_date);
            if (isValid(eff)) {
              // Find next raise date >= today
              let next = addYears(eff, SALARY_RAISE_YEARS);
              while (differenceInCalendarDays(next, today) < 0) {
                next = addYears(next, SALARY_RAISE_YEARS);
              }
              const days = differenceInCalendarDays(next, today);
              if (days <= 5 && days >= 0) {
                sArr.push({
                  id: tc.id,
                  name: tc.full_name,
                  raiseDate: format(next, 'yyyy-MM-dd'),
                  daysLeft: days,
                });
              }
            }
          }
          // Birthday
          if (tc.birthday) {
            const b = parseISO(tc.birthday);
            if (isValid(b) && format(b, 'MM') === mm && format(b, 'dd') === dd) {
              bArr.push({ id: tc.id, name: tc.full_name, kind: 'teacher' });
            }
          }
        }
        setSalaries(sArr.sort((a, b) => a.daysLeft - b.daysLeft));

        // Student birthdays
        const classMap = new Map<string, string>(
          ((classesRes.data as any[]) || []).map((c) => [c.id, c.name])
        );
        for (const st of (studentsRes.data as any[]) || []) {
          if (!st.date_of_birth) continue;
          const b = parseISO(st.date_of_birth);
          if (isValid(b) && format(b, 'MM') === mm && format(b, 'dd') === dd) {
            bArr.push({
              id: st.id,
              name: st.full_name,
              kind: 'student',
              className: st.class_id ? classMap.get(st.class_id) : undefined,
            });
          }
        }
        setBirthdays(bArr);
      } catch (e) {
        console.error('DashboardAlerts error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentSchool?.id]);

  const totalCount = tasks.length + salaries.length + birthdays.length;

  if (loading || totalCount === 0) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Ngày hôm nay có gì?
          <Badge variant="secondary" className="ml-1">{totalCount}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.length > 0 && (
          <Section
            icon={<ClipboardList className="h-4 w-4 text-orange-600" />}
            title="Công việc sắp đến hạn"
            color="orange"
          >
            {tasks.map((t) => (
              <Link
                key={t.id}
                to="/tasks"
                className="flex items-center justify-between gap-2 rounded-md bg-background/60 px-3 py-2 hover:bg-background transition"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  {t.assignee && (
                    <div className="text-xs text-muted-foreground truncate">
                      Người thực hiện: {t.assignee}
                    </div>
                  )}
                </div>
                <Badge
                  className={cn(
                    'shrink-0',
                    t.daysLeft === 0
                      ? 'bg-red-500 hover:bg-red-600'
                      : t.daysLeft <= 1
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'bg-amber-500 hover:bg-amber-600'
                  )}
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {t.daysLeft === 0 ? 'Hôm nay' : `Còn ${t.daysLeft} ngày`}
                </Badge>
              </Link>
            ))}
          </Section>
        )}

        {salaries.length > 0 && (
          <Section
            icon={<Wallet className="h-4 w-4 text-emerald-600" />}
            title="Sắp đến ngày xét nâng lương"
            color="emerald"
          >
            {salaries.map((s) => (
              <Link
                key={s.id}
                to="/teachers"
                className="flex items-center justify-between gap-2 rounded-md bg-background/60 px-3 py-2 hover:bg-background transition"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Ngày xét: {format(parseISO(s.raiseDate), 'dd/MM/yyyy', { locale: vi })}
                  </div>
                </div>
                <Badge className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
                  {s.daysLeft === 0 ? 'Hôm nay' : `Còn ${s.daysLeft} ngày`}
                </Badge>
              </Link>
            ))}
          </Section>
        )}

        {birthdays.length > 0 && (
          <Section
            icon={<Cake className="h-4 w-4 text-pink-600" />}
            title="🎉 Chúc mừng sinh nhật hôm nay"
            color="pink"
          >
            {birthdays.map((b) => (
              <div
                key={`${b.kind}-${b.id}`}
                className="flex items-center justify-between gap-2 rounded-md bg-background/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{b.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.kind === 'teacher'
                      ? 'Giáo viên'
                      : `Học sinh${b.className ? ` · Lớp ${b.className}` : ''}`}
                  </div>
                </div>
                <Badge className="bg-pink-500 hover:bg-pink-600 shrink-0">
                  <Cake className="h-3 w-3 mr-1" />
                  Sinh nhật
                </Badge>
              </div>
            ))}
          </Section>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: 'orange' | 'emerald' | 'pink';
  children: React.ReactNode;
}) {
  const border = {
    orange: 'border-l-orange-500',
    emerald: 'border-l-emerald-500',
    pink: 'border-l-pink-500',
  }[color];
  return (
    <div className={cn('border-l-4 pl-3 space-y-1.5', border)}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
