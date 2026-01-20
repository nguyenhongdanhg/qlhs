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

    const formattedDate = format(new Date(date), 'dd/MM/yyyy', { locale: vi });

    return (
      <div
        ref={ref}
        style={{ 
          width: '400px',
          backgroundColor: 'white',
          padding: '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 500, color: '#4b5563', margin: 0 }}>{schoolName}</h2>
          <h1 style={{ marginTop: '4px', fontSize: '18px', fontWeight: 700, color: '#0284c7', marginBottom: 0 }}>{title}</h1>
          <p style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280', marginBottom: 0 }}>
            Ngày {formattedDate}{sessionLabel ? ` - ${sessionLabel}` : ''}
          </p>
        </div>

        {/* Summary Stats */}
        <div style={{ marginBottom: '16px', display: 'flex', textAlign: 'center' }}>
          <div style={{ flex: 1, borderRadius: '8px', backgroundColor: '#f3f4f6', padding: '12px', marginRight: '8px' }}>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Tổng số</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#374151' }}>{total}</div>
          </div>
          <div style={{ flex: 1, borderRadius: '8px', backgroundColor: '#f0fdf4', padding: '12px', marginRight: '8px' }}>
            <div style={{ fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 style={{ width: '12px', height: '12px', marginRight: '4px' }} />
              <span>Có mặt</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>{present}</div>
          </div>
          <div style={{ flex: 1, borderRadius: '8px', backgroundColor: '#fef2f2', padding: '12px' }}>
            <div style={{ fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle style={{ width: '12px', height: '12px', marginRight: '4px' }} />
              <span>Vắng</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>{absent}</div>
          </div>
        </div>

        {/* Absent Students List */}
        {absent > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center' }}>
              <AlertCircle style={{ width: '16px', height: '16px', color: '#ef4444', marginRight: '4px' }} />
              <span>Danh sách vắng ({absent})</span>
            </h3>
            <div style={{ borderRadius: '8px', border: '1px solid #e5e7eb', padding: '12px' }}>
              {Array.from(groupedByClass.entries())
                .sort((a, b) => a[0].localeCompare(b[0], 'vi'))
                .map(([className, students], classIndex) => (
                  <div key={className} style={{ marginTop: classIndex > 0 ? '8px' : 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280' }}>
                      Lớp {className} ({students.length})
                    </div>
                    <div style={{ marginLeft: '8px' }}>
                      {students.map((s, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', fontSize: '14px', marginTop: '2px' }}>
                          <span style={{ color: '#374151', marginRight: '8px' }}>{s.name}</span>
                          {s.excused ? (
                            <span style={{ borderRadius: '4px', backgroundColor: '#fef3c7', padding: '2px 6px', fontSize: '12px', color: '#a16207' }}>
                              P
                            </span>
                          ) : (
                            <span style={{ borderRadius: '4px', backgroundColor: '#fee2e2', padding: '2px 6px', fontSize: '12px', color: '#dc2626' }}>
                              KP
                            </span>
                          )}
                          {s.reason && (
                            <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '8px' }}>({s.reason})</span>
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
          <div style={{ marginBottom: '16px', borderRadius: '8px', backgroundColor: '#eff6ff', padding: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#2563eb' }}>Ghi chú</div>
            <div style={{ fontSize: '14px', color: '#1e40af' }}>{notes}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
          <p style={{ margin: 0 }}>Người báo cáo: {reporter}</p>
          <p style={{ margin: '4px 0 0 0' }}>Thời gian: {reportTime}</p>
        </div>
      </div>
    );
  }
);

ReportImageCard.displayName = 'ReportImageCard';
