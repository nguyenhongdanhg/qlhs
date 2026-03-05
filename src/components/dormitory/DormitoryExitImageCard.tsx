import { forwardRef } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface ExitStudent {
  name: string;
  className: string;
  exitTime: string;
  returnTime: string;
  reason?: string;
}

interface DormitoryExitImageCardProps {
  schoolName: string;
  title: string;
  date: string;
  totalApproved: number;
  students: ExitStudent[];
}

export const DormitoryExitImageCard = forwardRef<HTMLDivElement, DormitoryExitImageCardProps>(
  ({ schoolName, title, date, totalApproved, students }, ref) => {
    // Group by class
    const groupedByClass = new Map<string, ExitStudent[]>();
    students.forEach(s => {
      if (!groupedByClass.has(s.className)) groupedByClass.set(s.className, []);
      groupedByClass.get(s.className)!.push(s);
    });

    const formattedDate = (() => {
      try { return format(new Date(date), 'EEEE, dd/MM/yyyy', { locale: vi }); }
      catch { return date; }
    })();

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
          ...baseTextStyle,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '12px', textAlign: 'center', borderBottom: '2px solid #7c3aed', paddingBottom: '10px' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px', ...baseTextStyle }}>{schoolName}</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#7c3aed', ...baseTextStyle }}>{title}</div>
          <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px', ...baseTextStyle }}>{formattedDate}</div>
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          backgroundColor: '#f5f3ff',
          borderRadius: '8px',
          padding: '10px',
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#7c3aed' }}>{totalApproved}</div>
            <div style={{ fontSize: '10px', color: '#7c3aed', textTransform: 'uppercase', ...baseTextStyle }}>HS ra ngoài</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#ddd6fe' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#374151' }}>{groupedByClass.size}</div>
            <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', ...baseTextStyle }}>Lớp</div>
          </div>
        </div>

        {/* Student list grouped by class */}
        {totalApproved > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#7c3aed',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              textTransform: 'uppercase',
              ...baseTextStyle,
            }}>
              <span style={{ width: '6px', height: '6px', backgroundColor: '#7c3aed', borderRadius: '50%' }} />
              Danh sách ra ngoài ({totalApproved})
            </div>
            <div style={{
              borderRadius: '6px',
              border: '1px solid #ddd6fe',
              backgroundColor: '#faf5ff',
              padding: '8px 10px',
              fontSize: '12px',
            }}>
              {Array.from(groupedByClass.entries())
                .sort((a, b) => a[0].localeCompare(b[0], 'vi'))
                .map(([className, classStudents], classIndex) => (
                  <div key={className} style={{ marginTop: classIndex > 0 ? '6px' : 0 }}>
                    <span style={{ fontWeight: 600, color: '#5b21b6', fontSize: '11px', ...baseTextStyle }}>
                      {className}:
                    </span>
                    <span style={{ marginLeft: '4px', color: '#374151', ...baseTextStyle }}>
                      {classStudents.map((s, idx) => (
                        <span key={idx}>
                          {s.name}
                          <span style={{ color: '#9ca3af', fontSize: '10px' }}>
                            {` (${s.exitTime}→${s.returnTime})`}
                          </span>
                          {s.reason && (
                            <span style={{ color: '#9ca3af', fontSize: '10px' }}>{` [${s.reason}]`}</span>
                          )}
                          {idx < classStudents.length - 1 && ', '}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {totalApproved === 0 && (
          <div style={{
            marginBottom: '12px',
            borderRadius: '6px',
            backgroundColor: '#f0fdf4',
            padding: '12px',
            textAlign: 'center',
            color: '#16a34a',
            fontWeight: 500,
            fontSize: '13px',
            ...baseTextStyle,
          }}>
            ✓ Không có học sinh ra ngoài
          </div>
        )}

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #e5e7eb',
          paddingTop: '8px',
          fontSize: '10px',
          color: '#9ca3af',
          textAlign: 'right',
          ...baseTextStyle,
        }}>
          Xuất lúc {format(new Date(), 'HH:mm dd/MM/yyyy')}
        </div>
      </div>
    );
  }
);

DormitoryExitImageCard.displayName = 'DormitoryExitImageCard';
