import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Users, User, ClipboardList, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';

type Category = 'dang' | 'chuyen_mon' | 'noi_tru' | 'doan_doi';

interface TaskRow {
  id: string;
  title: string;
  category: Category;
  status: 'pending' | 'done';
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Stat {
  total: number;
  done: number;
  pending: number;
  overdue: number;
}

const emptyStat = (): Stat => ({ total: 0, done: 0, pending: 0, overdue: 0 });

const CATEGORY_LABEL: Record<Category, string> = {
  dang: 'Đảng',
  chuyen_mon: 'Chuyên môn',
  noi_tru: 'Nội trú',
  doan_doi: 'Đoàn - Đội',
};

export function TaskStatsTab() {
  const { currentSchool } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [assignees, setAssignees] = useState<{ task_id: string; user_id: string }[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [groupMembers, setGroupMembers] = useState<{ group_id: string; user_id: string }[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!currentSchool) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [tRes, aRes, gRes, gmRes] = await Promise.all([
          supabase
            .from('tasks')
            .select('id, title, category, status, deadline, completed_at, created_at, assignee_id')
            .eq('school_id', currentSchool.id),
          supabase.from('task_assignees').select('task_id, user_id'),
          supabase
            .from('duty_groups')
            .select('id, name, display_order')
            .eq('school_id', currentSchool.id)
            .eq('is_active', true)
            .order('display_order', { ascending: true }),
          supabase.from('duty_group_members').select('group_id, user_id').eq('school_id', currentSchool.id),
        ]);

        if (cancelled) return;

        const taskRows = (tRes.data as any[]) || [];
        const assigneeRows = (aRes.data as any[]) || [];
        const groupRows = (gRes.data as any[]) || [];
        const groupMemberRows = (gmRes.data as any[]) || [];

        // Filter assignees to only include tasks in this school
        const taskIdSet = new Set(taskRows.map((t) => t.id));
        const filteredAssignees = assigneeRows.filter((a) => taskIdSet.has(a.task_id));

        // Backward compat: use assignee_id if no task_assignees rows
        const perTaskHasAssignees = new Set(filteredAssignees.map((a) => a.task_id));
        for (const t of taskRows) {
          if (!perTaskHasAssignees.has(t.id) && t.assignee_id) {
            filteredAssignees.push({ task_id: t.id, user_id: t.assignee_id });
          }
        }

        // Load profiles for all involved users
        const userIds = new Set<string>();
        filteredAssignees.forEach((a) => userIds.add(a.user_id));
        groupMemberRows.forEach((gm) => userIds.add(gm.user_id));

        const profileMap = new Map<string, string>();
        if (userIds.size > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', Array.from(userIds));
          (profs || []).forEach((p: any) => profileMap.set(p.id, p.full_name));
        }

        setTasks(taskRows);
        setAssignees(filteredAssignees);
        setGroups(groupRows);
        setGroupMembers(groupMemberRows);
        setProfiles(profileMap);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentSchool]);

  const isOverdue = (t: TaskRow) => {
    if (t.status === 'done') return false;
    if (!t.deadline) return false;
    return isBefore(parseISO(t.deadline), startOfDay(new Date()));
  };

  const overall = useMemo<Stat>(() => {
    const s = emptyStat();
    s.total = tasks.length;
    tasks.forEach((t) => {
      if (t.status === 'done') s.done++;
      else s.pending++;
      if (isOverdue(t)) s.overdue++;
    });
    return s;
  }, [tasks]);

  const byCategory = useMemo(() => {
    const map: Record<Category, Stat> = {
      dang: emptyStat(),
      chuyen_mon: emptyStat(),
      noi_tru: emptyStat(),
      doan_doi: emptyStat(),
    };
    tasks.forEach((t) => {
      const s = map[t.category];
      if (!s) return;
      s.total++;
      if (t.status === 'done') s.done++;
      else s.pending++;
      if (isOverdue(t)) s.overdue++;
    });
    return map;
  }, [tasks]);

  const byTeacher = useMemo(() => {
    const map = new Map<string, Stat & { name: string }>();
    for (const a of assignees) {
      const task = tasks.find((t) => t.id === a.task_id);
      if (!task) continue;
      const entry = map.get(a.user_id) || {
        ...emptyStat(),
        name: profiles.get(a.user_id) || 'Người dùng',
      };
      entry.total++;
      if (task.status === 'done') entry.done++;
      else entry.pending++;
      if (isOverdue(task)) entry.overdue++;
      map.set(a.user_id, entry);
    }
    return Array.from(map.entries())
      .map(([user_id, s]) => ({ user_id, ...s }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'vi'));
  }, [assignees, tasks, profiles]);

  const byGroup = useMemo(() => {
    const list = groups.map((g) => {
      const memberIds = new Set(
        groupMembers.filter((gm) => gm.group_id === g.id).map((gm) => gm.user_id)
      );
      const s = emptyStat();
      const taskSet = new Set<string>();
      for (const a of assignees) {
        if (!memberIds.has(a.user_id)) continue;
        if (taskSet.has(a.task_id)) continue;
        taskSet.add(a.task_id);
        const task = tasks.find((t) => t.id === a.task_id);
        if (!task) continue;
        s.total++;
        if (task.status === 'done') s.done++;
        else s.pending++;
        if (isOverdue(task)) s.overdue++;
      }
      return { id: g.id, name: g.name, memberCount: memberIds.size, ...s };
    });
    return list;
  }, [groups, groupMembers, assignees, tasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard icon={ClipboardList} label="Tổng công việc" value={overall.total} color="text-primary" />
        <SummaryCard icon={CheckCircle2} label="Đã hoàn thành" value={overall.done} color="text-success" />
        <SummaryCard icon={Clock} label="Đang thực hiện" value={overall.pending} color="text-info" />
        <SummaryCard icon={AlertTriangle} label="Quá hạn" value={overall.overdue} color="text-destructive" />
      </div>

      {/* By category */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Theo lĩnh vực</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {(Object.keys(byCategory) as Category[]).map((c) => {
              const s = byCategory[c];
              return (
                <div key={c} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{CATEGORY_LABEL[c]}</span>
                    <span className="text-xs text-muted-foreground">{s.done}/{s.total}</span>
                  </div>
                  <Progress value={pct(s.done, s.total)} className="h-2" />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-xs">Đang: {s.pending}</Badge>
                    <Badge variant="outline" className="text-xs">Xong: {s.done}</Badge>
                    {s.overdue > 0 && (
                      <Badge variant="destructive" className="text-xs">Quá hạn: {s.overdue}</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="group" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="group" className="gap-1.5">
            <Users className="h-4 w-4" /> Theo nhóm
          </TabsTrigger>
          <TabsTrigger value="teacher" className="gap-1.5">
            <User className="h-4 w-4" /> Theo giáo viên
          </TabsTrigger>
        </TabsList>

        <TabsContent value="group">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Kết quả công việc theo nhóm trực</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">Nhóm</TableHead>
                      <TableHead className="text-center">Thành viên</TableHead>
                      <TableHead className="text-center">Tổng</TableHead>
                      <TableHead className="text-center">Hoàn thành</TableHead>
                      <TableHead className="text-center">Đang làm</TableHead>
                      <TableHead className="text-center">Quá hạn</TableHead>
                      <TableHead className="min-w-[140px]">Tỷ lệ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byGroup.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                          Chưa có nhóm trực nào
                        </TableCell>
                      </TableRow>
                    )}
                    {byGroup.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{g.name}</TableCell>
                        <TableCell className="text-center">{g.memberCount}</TableCell>
                        <TableCell className="text-center">{g.total}</TableCell>
                        <TableCell className="text-center text-success font-medium">{g.done}</TableCell>
                        <TableCell className="text-center">{g.pending}</TableCell>
                        <TableCell className="text-center">
                          {g.overdue > 0 ? (
                            <Badge variant="destructive" className="text-xs">{g.overdue}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={pct(g.done, g.total)} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground w-9 text-right">
                              {pct(g.done, g.total)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teacher">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Kết quả công việc theo giáo viên</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Giáo viên</TableHead>
                      <TableHead className="text-center">Tổng</TableHead>
                      <TableHead className="text-center">Hoàn thành</TableHead>
                      <TableHead className="text-center">Đang làm</TableHead>
                      <TableHead className="text-center">Quá hạn</TableHead>
                      <TableHead className="min-w-[140px]">Tỷ lệ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byTeacher.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                          Chưa có công việc nào được giao
                        </TableCell>
                      </TableRow>
                    )}
                    {byTeacher.map((t) => (
                      <TableRow key={t.user_id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-center">{t.total}</TableCell>
                        <TableCell className="text-center text-success font-medium">{t.done}</TableCell>
                        <TableCell className="text-center">{t.pending}</TableCell>
                        <TableCell className="text-center">
                          {t.overdue > 0 ? (
                            <Badge variant="destructive" className="text-xs">{t.overdue}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={pct(t.done, t.total)} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground w-9 text-right">
                              {pct(t.done, t.total)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg bg-muted p-2 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-semibold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
