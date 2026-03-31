import { forwardRef } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface ExitRequestStudent {
  name: string;
  className: string;
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
    const groupedByClass = new Map<string, string[]>();
    students.forEach(s => {
      if (!groupedByClass.has(s.className)) groupedByClass.set(s.className, []);
      groupedByClass.get(s.className)!.push(s.name);
    });

    const formatDate = (d: string) => {
      try { return format(new Date(d), 'EEEE, dd/MM/yyyy', { locale: vi }); }
      catch { return d; }
    };

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
          padding: '20px',
          fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
          fontSize: '13px',
          lineHeight: '1.5',
          ...baseTextStyle,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '14px', textAlign: 'center', borderBottom: '2px solid #7c3aed', paddingBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px', ...baseTextStyle }}>{schoolName}</div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: '#7c3aed', marginBottom: '2px', ...baseTextStyle }}>ĐƠN XIN RA NGOÀI KTX</div>
          <div style={{ fontSize: '12px', color: '#374151', ...baseTextStyle }}>
            {exitDate === returnDate ? formatDate(exitDate) : `${formatDate(exitDate)} → ${formatDate(returnDate)}`}
          </div>
        </div>

        {/* Info rows */}
        <div style={{
          marginBottom: '12px',
          backgroundColor: '#f5f3ff',
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#6b7280', ...baseTextStyle }}>Giờ ra:</span>
            <span style={{ fontWeight: 600, color: '#374151', ...baseTextStyle }}>{exitTime?.slice(0, 5)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#6b7280', ...baseTextStyle }}>Giờ vào:</span>
            <span style={{ fontWeight: 600, color: '#374151', ...baseTextStyle }}>{returnTime?.slice(0, 5)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#6b7280', ...baseTextStyle }}>Số HS:</span>
            <span style={{ fontWeight: 700, color: '#7c3aed', fontSize: '14px', ...baseTextStyle }}>{students.length}</span>
          </div>
          {reason && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', ...baseTextStyle }}>Lý do:</span>
              <span style={{ fontWeight: 500, color: '#374151', maxWidth: '220px', textAlign: 'right', ...baseTextStyle }}>{reason}</span>
            </div>
          )}
        </div>

        {/* Student list */}
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
            <span style={{ width: '6px', height: '6px', backgroundColor: '#7c3aed', borderRadius: '50%', display: 'inline-block' }} />
            Danh sách học sinh ({students.length})
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
              .map(([className, names], idx) => (
                <div key={className} style={{ marginTop: idx > 0 ? '4px' : 0 }}>
                  <span style={{ fontWeight: 600, color: '#5b21b6', fontSize: '11px', ...baseTextStyle }}>
                    {className}:
                  </span>
                  <span style={{ marginLeft: '4px', color: '#374151', ...baseTextStyle }}>
                    {names.join(', ')}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Requester */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#6b7280',
          marginBottom: '8px',
          ...baseTextStyle,
        }}>
          <span>GVCN đăng ký:</span>
          <span style={{ fontWeight: 600, color: '#374151' }}>{requesterName}</span>
        </div>

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

ExitRequestImageCard.displayName = 'ExitRequestImageCard';
