import { forwardRef } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface ExitRequestStudent {
  name: string;
  className: string;
  exitDate: string;
  exitTime: string;
  returnDate: string;
  returnTime: string;
  reason?: string;
  hasAttachment?: boolean;
}

interface ExitRequestImageCardProps {
  schoolName: string;
  requesterName: string;
  students: ExitRequestStudent[];
}

export const ExitRequestImageCard = forwardRef<HTMLDivElement, ExitRequestImageCardProps>(
  ({ schoolName, requesterName, students }, ref) => {
    const groupedByClass = new Map<string, ExitRequestStudent[]>();
    students.forEach(s => {
      const cls = s.className || 'Khác';
      if (!groupedByClass.has(cls)) groupedByClass.set(cls, []);
      groupedByClass.get(cls)!.push(s);
    });

    const fmtDate = (d: string) => {
      try { return format(new Date(d), 'dd/MM', { locale: vi }); }
      catch { return d; }
    };

    const base: React.CSSProperties = {
      letterSpacing: '0.01em',
      fontKerning: 'normal',
      textRendering: 'geometricPrecision',
      WebkitFontSmoothing: 'antialiased',
    };

    const fmtStudentTime = (s: ExitRequestStudent) => {
      const eDate = fmtDate(s.exitDate);
      const rDate = fmtDate(s.returnDate);
      const eTime = s.exitTime?.slice(0, 5) || '';
      const rTime = s.returnTime?.slice(0, 5) || '';
      const sameDate = eDate === rDate;
      if (sameDate) return `${eDate} ${eTime} → ${rTime}`;
      return `${eDate} ${eTime} → ${rDate} ${rTime}`;
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
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#7c3aed', marginBottom: '4px', ...base }}>ĐƠN XIN RA NGOÀI KTX</div>
          <div style={{ fontSize: '11px', color: '#6b7280', ...base }}>Tổng: {students.length} học sinh</div>
        </div>

        {/* Student list grouped by class */}
        <div style={{ marginBottom: '10px' }}>
          {Array.from(groupedByClass.entries())
            .sort((a, b) => a[0].localeCompare(b[0], 'vi'))
            .map(([className, classStudents], idx) => (
              <div key={className} style={{
                borderRadius: '6px', border: '1px solid #ddd6fe', backgroundColor: '#faf5ff',
                padding: '6px 8px', marginTop: idx > 0 ? '4px' : '0',
              }}>
                <div style={{ fontWeight: 600, color: '#5b21b6', fontSize: '11px', marginBottom: '3px', ...base }}>
                  {className} ({classStudents.length})
                </div>
                {classStudents.map((s, i) => (
                  <div key={i} style={{
                    paddingTop: i > 0 ? '3px' : '0',
                    borderTop: i > 0 ? '1px solid #ede9fe' : 'none',
                    marginTop: i > 0 ? '3px' : '0',
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', ...base }}>{s.name}</div>
                    <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '1px', ...base }}>
                      🕐 {fmtStudentTime(s)}
                    </div>
                    {s.reason && (
                      <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '1px', ...base }}>📝 {s.reason}</div>
                    )}
                  </div>
                ))}
              </div>
            ))}
        </div>

        {/* Footer */}
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
