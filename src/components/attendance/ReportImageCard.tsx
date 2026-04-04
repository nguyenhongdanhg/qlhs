import { forwardRef } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

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

    const formattedDate = format(new Date(date), 'EEEE, dd/MM/yyyy', { locale: vi });
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    const baseTextStyle: React.CSSProperties = {
      letterSpacing: '0.01em',
      fontKerning: 'normal',
      textRendering: 'geometricPrecision',
      WebkitFontSmoothing: 'antialiased',
    };

    return (
      <div
        ref={ref}
        style={{ 
          width: '380px',
          backgroundColor: 'white',
          padding: '16px',
          fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
          fontSize: '13px',
          lineHeight: '1.4',
          ...baseTextStyle
        }}
      >
        {/* Compact Header */}
        <div style={{ marginBottom: '12px', textAlign: 'center', borderBottom: '2px solid #0284c7', paddingBottom: '10px' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px', ...baseTextStyle }}>{schoolName}</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#0284c7', ...baseTextStyle }}>{title}</div>
          <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px', ...baseTextStyle }}>
            {formattedDate}
          </div>
        </div>

        {/* Compact Stats Row */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '12px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          padding: '10px'
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#374151' }}>{total}</div>
            <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', ...baseTextStyle }}>Tổng</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#e5e7eb' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>{present}</div>
            <div style={{ fontSize: '10px', color: '#16a34a', textTransform: 'uppercase', ...baseTextStyle }}>Có mặt</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#e5e7eb' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>{absent}</div>
            <div style={{ fontSize: '10px', color: '#dc2626', textTransform: 'uppercase', ...baseTextStyle }}>Vắng</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#e5e7eb' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0284c7' }}>{attendanceRate}%</div>
            <div style={{ fontSize: '10px', color: '#0284c7', textTransform: 'uppercase', ...baseTextStyle }}>Tỷ lệ</div>
          </div>
        </div>

        {/* Absent Students List - Compact */}
        {absent > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: 600, 
              color: '#dc2626', 
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              textTransform: 'uppercase',
              ...baseTextStyle 
            }}>
              <span style={{ width: '6px', height: '6px', backgroundColor: '#dc2626', borderRadius: '50%' }} />
              Danh sách vắng ({absent})
            </div>
            <div style={{ 
              borderRadius: '6px', 
              border: '1px solid #fecaca', 
              backgroundColor: '#fef2f2',
              padding: '8px 10px',
              fontSize: '12px'
            }}>
              {Array.from(groupedByClass.entries())
                .sort((a, b) => a[0].localeCompare(b[0], 'vi'))
                .map(([className, students], classIndex) => (
                  <div key={className} style={{ marginTop: classIndex > 0 ? '6px' : 0 }}>
                    <span style={{ 
                      fontWeight: 600, 
                      color: '#991b1b',
                      fontSize: '11px',
                      ...baseTextStyle 
                    }}>
                      {className}:
                    </span>
                    <span style={{ marginLeft: '4px', color: '#374151', ...baseTextStyle }}>
                      {students.map((s, idx) => (
                        <span key={idx}>
                          {s.name}
                          {s.excused ? (
                            <sup style={{ color: '#ca8a04', fontSize: '9px', marginLeft: '1px' }}>P</sup>
                          ) : (
                            <sup style={{ color: '#dc2626', fontSize: '9px', marginLeft: '1px' }}>K</sup>
                          )}
                          {s.reason && (
                            <span style={{ color: '#9ca3af', fontSize: '10px' }}>{` (${s.reason})`}</span>
                          )}
                          {idx < students.length - 1 && ', '}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
            </div>
            {/* Legend */}
            <div style={{ 
              marginTop: '4px', 
              fontSize: '9px', 
              color: '#9ca3af', 
              textAlign: 'right',
              ...baseTextStyle 
            }}>
              <sup style={{ color: '#ca8a04' }}>P</sup>=Phép, <sup style={{ color: '#dc2626' }}>K</sup>=Không phép
            </div>
          </div>
        )}

        {/* No absences message */}
        {absent === 0 && (
          <div style={{
            marginBottom: '12px',
            borderRadius: '6px',
            backgroundColor: '#f0fdf4',
            padding: '12px',
            textAlign: 'center',
            color: '#16a34a',
            fontWeight: 500,
            fontSize: '13px',
            ...baseTextStyle
          }}>
            ✓ Đủ {total} học sinh
          </div>
        )}

        {/* Notes - Compact */}
        {notes && (
          <div style={{ 
            marginBottom: '12px', 
            borderRadius: '6px', 
            backgroundColor: '#eff6ff', 
            padding: '8px 10px',
            fontSize: '12px'
          }}>
            <span style={{ fontWeight: 600, color: '#1d4ed8', ...baseTextStyle }}>Ghi chú: </span>
            <span style={{ color: '#1e40af', ...baseTextStyle }}>{notes}</span>
          </div>
        )}

        {/* Compact Footer */}
        <div style={{ 
          borderTop: '1px solid #e5e7eb', 
          paddingTop: '8px', 
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px', 
          color: '#9ca3af',
          ...baseTextStyle
        }}>
          <span>Người báo: <span style={{ color: '#374151', fontWeight: 500 }}>{reporter}</span></span>
          <span>{reportTime}</span>
        </div>
      </div>
    );
  }
);

ReportImageCard.displayName = 'ReportImageCard';
