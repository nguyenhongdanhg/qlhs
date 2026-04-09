import { forwardRef } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface ExitRequestStudent {
  name: string;
  className: string;
  reason?: string;
}

interface ExitRequestImageCardProps {
  schoolName: string;
  requesterName: string;
  exitDate: string;
  returnDate: string;
  exitTime: string;
  returnTime: string;
  reason: string;
  students: ExitRequestStudent[];
}

export const ExitRequestImageCard = forwardRef<HTMLDivElement, ExitRequestImageCardProps>(
  ({ schoolName, requesterName, exitDate, returnDate, exitTime, returnTime, reason, students }, ref) => {
    const groupedByClass = new Map<string, ExitRequestStudent[]>();
    students.forEach(s => {
      if (!groupedByClass.has(s.className)) groupedByClass.set(s.className, []);
      groupedByClass.get(s.className)!.push(s);
    });

    const fmtDate = (d: string) => {
      try { return format(new Date(d), 'dd/MM/yyyy (EEEE)', { locale: vi }); }
      catch { return d; }
    };

    const base: React.CSSProperties = {
      letterSpacing: '0.01em',
      fontKerning: 'normal',
      textRendering: 'geometricPrecision',
      WebkitFontSmoothing: 'antialiased',
    };

    const sameDate = exitDate === returnDate;

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
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#7c3aed', marginBottom: '4px', ...base }}>ĐƠN XIN RA NGOÀI KTX</div>
        </div>

        {/* Info */}
        <div style={{
          marginBottom: '10px', backgroundColor: '#f5f3ff', borderRadius: '8px', padding: '8px 10px', fontSize: '12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ color: '#6b7280', ...base }}>📅 Ngày ra:</span>
            <span style={{ fontWeight: 600, color: '#374151', ...base }}>{fmtDate(exitDate)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ color: '#6b7280', ...base }}>🕐 Giờ ra:</span>
            <span style={{ fontWeight: 600, color: '#374151', ...base }}>{exitTime?.slice(0, 5)}</span>
          </div>
          {!sameDate && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: '#6b7280', ...base }}>📅 Ngày vào:</span>
              <span style={{ fontWeight: 600, color: '#374151', ...base }}>{fmtDate(returnDate)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ color: '#6b7280', ...base }}>🕐 Giờ vào:</span>
            <span style={{ fontWeight: 600, color: '#374151', ...base }}>{returnTime?.slice(0, 5)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#6b7280', ...base }}>👥 Số HS:</span>
            <span style={{ fontWeight: 700, color: '#7c3aed', fontSize: '13px', ...base }}>{students.length}</span>
          </div>
          {reason && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
              <span style={{ color: '#6b7280', ...base }}>📝 Lý do:</span>
              <span style={{ fontWeight: 500, color: '#374151', maxWidth: '220px', textAlign: 'right', ...base }}>{reason}</span>
            </div>
          )}
        </div>

        {/* Student list */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{
            fontSize: '10px', fontWeight: 600, color: '#7c3aed', marginBottom: '4px',
            display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', ...base,
          }}>
            <span style={{ width: '5px', height: '5px', backgroundColor: '#7c3aed', borderRadius: '50%', display: 'inline-block' }} />
            Danh sách học sinh ({students.length})
          </div>
          {Array.from(groupedByClass.entries())
            .sort((a, b) => a[0].localeCompare(b[0], 'vi'))
            .map(([className, classStudents], idx) => (
              <div key={className} style={{
                borderRadius: '6px', border: '1px solid #ddd6fe', backgroundColor: '#faf5ff',
                padding: '6px 8px', marginTop: idx > 0 ? '4px' : '0',
              }}>
                <div style={{ fontWeight: 600, color: '#5b21b6', fontSize: '11px', marginBottom: '2px', ...base }}>
                  {className}
                </div>
                {classStudents.map((s, i) => (
                  <div key={i} style={{
                    paddingTop: i > 0 ? '2px' : '0',
                    borderTop: i > 0 ? '1px solid #ede9fe' : 'none',
                    marginTop: i > 0 ? '2px' : '0',
                  }}>
                    <span style={{ fontSize: '12px', color: '#374151', ...base }}>{s.name}</span>
                    {s.reason && (
                      <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '4px', ...base }}>- {s.reason}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
        </div>

        {/* Requester + Footer */}
        <div style={{
          borderTop: '1px solid #e5e7eb', paddingTop: '6px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '10px', color: '#9ca3af', ...base,
        }}>
          <span>GVCN: <span style={{ fontWeight: 600, color: '#374151' }}>{requesterName}</span></span>
          <span>Xuất lúc {format(new Date(), 'HH:mm dd/MM/yyyy')}</span>
        </div>
      </div>
    );
  }
);

ExitRequestImageCard.displayName = 'ExitRequestImageCard';
