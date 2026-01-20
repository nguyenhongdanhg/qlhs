import { forwardRef } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Coffee, UtensilsCrossed, Moon, CheckCircle2, XCircle } from 'lucide-react';

interface AbsentStudent {
  id: string;
  name: string;
  className: string;
  classGrade: number;
  excused: boolean;
  reason: string;
  mealGroup?: string;
}

interface MealStats {
  total: number;
  present: number;
  absent: number;
  absentStudents: AbsentStudent[];
  hasReport: boolean;
}

interface MealReportImageCardProps {
  schoolName: string;
  date: Date;
  reporter: string;
  breakfast: MealStats;
  lunch: MealStats;
  dinner: MealStats;
  totalRice: number;
}

export const MealReportImageCard = forwardRef<HTMLDivElement, MealReportImageCardProps>(
  ({ schoolName, date, reporter, breakfast, lunch, dinner, totalRice }, ref) => {
    const renderMealSection = (
      title: string,
      icon: React.ReactNode,
      stats: MealStats,
      showMealGroup: boolean = false
    ) => {
      // Group absent students by class
      const groupedByClass = new Map<string, AbsentStudent[]>();
      stats.absentStudents.forEach(student => {
        if (!groupedByClass.has(student.className)) {
          groupedByClass.set(student.className, []);
        }
        groupedByClass.get(student.className)!.push(student);
      });

      return (
        <div className="rounded-lg border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <span className="font-semibold text-gray-700">{title}</span>
            </div>
            {stats.hasReport ? (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Đã báo cáo
              </span>
            ) : (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                Chưa báo cáo
              </span>
            )}
          </div>

          {stats.hasReport && (
            <>
              {/* Stats row */}
              <div className="mb-2 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded bg-gray-50 p-1.5">
                  <div className="text-xs text-gray-500">Tổng</div>
                  <div className="font-bold text-gray-700">{stats.total}</div>
                </div>
                <div className="rounded bg-green-50 p-1.5">
                  <div className="flex items-center justify-center gap-0.5 text-xs text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Ăn</span>
                  </div>
                  <div className="font-bold text-green-600">{stats.present}</div>
                </div>
                <div className="rounded bg-red-50 p-1.5">
                  <div className="flex items-center justify-center gap-0.5 text-xs text-red-600">
                    <XCircle className="h-3 w-3" />
                    <span>Vắng</span>
                  </div>
                  <div className="font-bold text-red-600">{stats.absent}</div>
                </div>
              </div>

              {/* Absent students */}
              {stats.absent > 0 && (
                <div className="rounded bg-red-50/50 p-2">
                  <div className="mb-1 text-xs font-medium text-red-600">
                    Vắng ({stats.absent}):
                  </div>
                  <div className="max-h-24 space-y-1 overflow-y-auto text-xs">
                    {Array.from(groupedByClass.entries())
                      .sort((a, b) => {
                        const gradeA = a[1][0]?.classGrade || 0;
                        const gradeB = b[1][0]?.classGrade || 0;
                        return gradeA - gradeB;
                      })
                      .map(([className, students]) => (
                        <div key={className}>
                          <span className="font-medium text-gray-600">{className}:</span>{' '}
                          <span className="text-gray-700">
                            {students.map((s, i) => (
                              <span key={s.id}>
                                {s.name}
                                {s.excused && <sup className="text-yellow-600">P</sup>}
                                {showMealGroup && s.mealGroup && (
                                  <span className="text-gray-400">({s.mealGroup})</span>
                                )}
                                {i < students.length - 1 && ', '}
                              </span>
                            ))}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      );
    };

    return (
      <div
        ref={ref}
        className="w-[420px] bg-white p-5 font-sans"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {/* Header */}
        <div className="mb-4 text-center">
          <h2 className="text-sm font-medium text-gray-600">{schoolName}</h2>
          <h1 className="mt-1 text-lg font-bold text-sky-600">THỐNG KÊ BỮA ĂN</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ngày {format(date, 'EEEE, dd/MM/yyyy', { locale: vi })}
          </p>
        </div>

        {/* Meal sections */}
        <div className="mb-4 space-y-3">
          {renderMealSection(
            'Bữa sáng',
            <Coffee className="h-4 w-4 text-orange-500" />,
            breakfast
          )}
          {renderMealSection(
            'Bữa trưa',
            <UtensilsCrossed className="h-4 w-4 text-green-500" />,
            lunch,
            true
          )}
          {renderMealSection(
            'Bữa tối',
            <Moon className="h-4 w-4 text-indigo-500" />,
            dinner,
            true
          )}
        </div>

        {/* Rice summary */}
        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-center">
          <div className="text-xs text-amber-600">Tổng lượng gạo (trưa + tối)</div>
          <div className="text-xl font-bold text-amber-700">{totalRice.toFixed(1)} kg</div>
          <div className="text-xs text-amber-500">
            ({lunch.present + dinner.present} suất × 0.2kg)
          </div>
        </div>

        {/* Footer */}
        <div className="border-t pt-3 text-center text-xs text-gray-400">
          <p>Người báo cáo: {reporter}</p>
          <p>Xuất lúc: {format(new Date(), 'HH:mm dd/MM/yyyy', { locale: vi })}</p>
        </div>
      </div>
    );
  }
);

MealReportImageCard.displayName = 'MealReportImageCard';
