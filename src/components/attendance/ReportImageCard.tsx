import { forwardRef } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface AbsentStudent {
  name: string;
  className: string;
  excused: boolean;
  reason: string;
}

interface ReportImageCardProps {
  schoolName: string;
  title: string;
  date: string;
  sessionLabel?: string;
  reporter: string;
  reportTime: string;
  total: number;
  present: number;
  absent: number;
  absentStudents: AbsentStudent[];
  notes?: string;
}

export const ReportImageCard = forwardRef<HTMLDivElement, ReportImageCardProps>(
  ({ schoolName, title, date, sessionLabel, reporter, reportTime, total, present, absent, absentStudents, notes }, ref) => {
    // Group absent students by class
    const groupedByClass = new Map<string, AbsentStudent[]>();
    absentStudents.forEach(student => {
      if (!groupedByClass.has(student.className)) {
        groupedByClass.set(student.className, []);
      }
      groupedByClass.get(student.className)!.push(student);
    });

    return (
      <div
        ref={ref}
        className="w-[400px] bg-white p-5 font-sans"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {/* Header */}
        <div className="mb-4 text-center">
          <h2 className="text-sm font-medium text-gray-600">{schoolName}</h2>
          <h1 className="mt-1 text-lg font-bold text-sky-600">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ngày {format(new Date(date), 'dd/MM/yyyy', { locale: vi })}
            {sessionLabel && ` - ${sessionLabel}`}
          </p>
        </div>

        {/* Summary Stats */}
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-gray-100 p-3">
            <div className="text-xs text-gray-500">Tổng số</div>
            <div className="text-xl font-bold text-gray-700">{total}</div>
          </div>
          <div className="rounded-lg bg-green-50 p-3">
            <div className="flex items-center justify-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              <span>Có mặt</span>
            </div>
            <div className="text-xl font-bold text-green-600">{present}</div>
          </div>
          <div className="rounded-lg bg-red-50 p-3">
            <div className="flex items-center justify-center gap-1 text-xs text-red-600">
              <XCircle className="h-3 w-3" />
              <span>Vắng</span>
            </div>
            <div className="text-xl font-bold text-red-600">{absent}</div>
          </div>
        </div>

        {/* Absent Students List */}
        {absent > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold text-gray-700">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Danh sách vắng ({absent})
            </h3>
            <div className="space-y-2 rounded-lg border border-gray-200 p-3">
              {Array.from(groupedByClass.entries())
                .sort((a, b) => a[0].localeCompare(b[0], 'vi'))
                .map(([className, students]) => (
                  <div key={className}>
                    <div className="text-xs font-medium text-gray-500">
                      Lớp {className} ({students.length})
                    </div>
                    <div className="ml-2 space-y-0.5">
                      {students.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className="text-gray-700">{s.name}</span>
                          {s.excused ? (
                            <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">
                              P
                            </span>
                          ) : (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                              KP
                            </span>
                          )}
                          {s.reason && (
                            <span className="text-xs text-gray-400">({s.reason})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {notes && (
          <div className="mb-4 rounded-lg bg-blue-50 p-3">
            <div className="text-xs font-medium text-blue-600">Ghi chú</div>
            <div className="text-sm text-blue-800">{notes}</div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t pt-3 text-center text-xs text-gray-400">
          <p>Người báo cáo: {reporter}</p>
          <p>Thời gian: {reportTime}</p>
        </div>
      </div>
    );
  }
);

ReportImageCard.displayName = 'ReportImageCard';
