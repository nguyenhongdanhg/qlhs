import { forwardRef } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface ExitStudent {
  name: string;
  className: string;
  exitDate: string;
  exitTime: string;
  returnDate: string;
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
    const groupedByClass = new Map<string, ExitStudent[]>();
    students.forEach(s => {
      if (!groupedByClass.has(s.className)) groupedByClass.set(s.className, []);
      groupedByClass.get(s.className)!.push(s);
    });

    const formattedDate = (() => {
      try { return format(new Date(date), 'EEEE, dd/MM/yyyy', { locale: vi }); }
      catch { return date; }
    })();

    const base: React.CSSProperties = {
      letterSpacing: '0.01em',
      fontKerning: 'normal',
      textRendering: 'geometricPrecision',
      WebkitFontSmoothing: 'antialiased',
    };

    const formatDateTime = (d: string, t: string) => {
      const timePart = t?.slice(0, 5) || '';
      if (!d) return timePart;
      try {
        return `${timePart} ${format(new Date(d), 'dd/MM')}`;
      } catch {
        return `${timePart} ${d}`;
      }
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
          ...base,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '10px', textAlign: 'center', borderBottom: '2px solid #7c3aed', paddingBottom: '8px' }}>
          <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px', ...base }}>{schoolName}</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#7c3aed', ...base }}>{title}</div>
          <div style={{ fontSize: '11px', color: '#374151', marginTop: '2px', ...base }}>{formattedDate}</div>
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex', gap: '8px', marginBottom: '10px',
          backgroundColor: '#f5f3ff', borderRadius: '8px', padding: '8px',
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#7c3aed' }}>{totalApproved}</div>
            <div style={{ fontSize: '9px', color: '#7c3aed', textTransform: 'uppercase', ...base }}>HS ra ngoài</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#ddd6fe' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#374151' }}>{groupedByClass.size}</div>
            <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', ...base }}>Lớp</div>
          </div>
        </div>

        {/* Student list */}
        {totalApproved > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{
              fontSize: '10px', fontWeight: 600, color: '#7c3aed', marginBottom: '4px',
              display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', ...base,
            }}>
              <span style={{ width: '5px', height: '5px', backgroundColor: '#7c3aed', borderRadius: '50%', display: 'inline-block' }} />
              Danh sách ({totalApproved})
            </div>

            {Array.from(groupedByClass.entries())
              .sort((a, b) => a[0].localeCompare(b[0], 'vi'))
              .map(([className, classStudents], classIndex) => (
                <div key={className} style={{
                  borderRadius: '6px',
                  border: '1px solid #ddd6fe',
                  backgroundColor: '#faf5ff',
                  padding: '6px 8px',
                  marginTop: classIndex > 0 ? '4px' : '0',
                }}>
                  <div style={{ fontWeight: 600, color: '#5b21b6', fontSize: '11px', marginBottom: '2px', ...base }}>
                    {className} ({classStudents.length})
                  </div>
                  {classStudents.map((s, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      paddingTop: idx > 0 ? '2px' : '0',
                      borderTop: idx > 0 ? '1px solid #ede9fe' : 'none',
                      marginTop: idx > 0 ? '2px' : '0',
                    }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '12px', color: '#374151', ...base }}>{s.name}</span>
                        {s.reason && (
                          <div style={{ fontSize: '10px', color: '#9ca3af', ...base }}>{s.reason}</div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                        <div style={{ fontSize: '10px', color: '#6b7280', ...base }}>
                          {formatDateTime(s.exitDate, s.exitTime)} → {formatDateTime(s.returnDate, s.returnTime)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}

        {totalApproved === 0 && (
          <div style={{
            marginBottom: '10px', borderRadius: '6px', backgroundColor: '#f0fdf4',
            padding: '10px', textAlign: 'center', color: '#16a34a', fontWeight: 500, fontSize: '12px', ...base,
          }}>
            ✓ Không có học sinh ra ngoài
          </div>
        )}

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #e5e7eb', paddingTop: '6px',
          fontSize: '9px', color: '#9ca3af', textAlign: 'right', ...base,
        }}>
          Xuất lúc {format(new Date(), 'HH:mm dd/MM/yyyy')}
        </div>
      </div>
    );
  }
);

DormitoryExitImageCard.displayName = 'DormitoryExitImageCard';
