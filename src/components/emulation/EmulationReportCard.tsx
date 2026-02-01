import { forwardRef } from 'react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

interface ClassScore {
  class_name: string;
  academic_score: number;
  discipline_score: number;
  boarding_score: number;
  average_score: number;
  rank: number;
  notes?: string;
}

interface EmulationReportCardProps {
  schoolName: string;
  weekNumber: number;
  dateRange?: { start: string; end: string };
  schoolYear: string;
  classScores: ClassScore[];
  reportType?: 'week' | 'month' | 'year';
  periodLabel?: string;
}

const getRankDisplay = (rank: number) => {
  if (rank === 0) return { text: '-', color: '#9ca3af', bgColor: 'transparent', borderColor: 'transparent', shadow: 'none' };
  if (rank === 1) return { text: '1', color: '#ffffff', bgColor: 'linear-gradient(135deg, #fbbf24, #f59e0b)', borderColor: '#d97706', shadow: '0 2px 8px rgba(251, 191, 36, 0.5)' }; // Gold
  if (rank === 2) return { text: '2', color: '#ffffff', bgColor: 'linear-gradient(135deg, #d1d5db, #9ca3af)', borderColor: '#6b7280', shadow: '0 2px 8px rgba(156, 163, 175, 0.5)' }; // Silver
  if (rank === 3) return { text: '3', color: '#ffffff', bgColor: 'linear-gradient(135deg, #d97706, #b45309)', borderColor: '#92400e', shadow: '0 2px 8px rgba(180, 83, 9, 0.5)' }; // Bronze
  return { text: rank.toString(), color: '#374151', bgColor: 'transparent', borderColor: 'transparent', shadow: 'none' };
};

export const EmulationReportCard = forwardRef<HTMLDivElement, EmulationReportCardProps>(
  ({ schoolName, weekNumber, dateRange, schoolYear, classScores, reportType = 'week', periodLabel }, ref) => {
    const formatDate = (dateStr: string) => {
      try {
        return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: vi });
      } catch {
        return dateStr;
      }
    };

    const getTitle = () => {
      if (reportType === 'week') {
        return `BẢNG THI ĐUA TUẦN ${weekNumber}`;
      } else if (reportType === 'month') {
        return `THỐNG KÊ THI ĐUA ${periodLabel || 'THÁNG'}`;
      } else {
        return `THỐNG KÊ THI ĐUA NĂM HỌC ${schoolYear}`;
      }
    };

    return (
      <div
        ref={ref}
        style={{
          fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif",
          backgroundColor: '#ffffff',
          padding: '24px',
          width: '800px',
          fontSize: '14px',
          lineHeight: '1.4',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#1e40af', marginBottom: '4px' }}>
            {schoolName}
          </div>
          <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#dc2626', marginBottom: '4px' }}>
            {getTitle()}
          </div>
          {dateRange && (
            <div style={{ fontSize: '13px', color: '#6b7280' }}>
              Từ {formatDate(dateRange.start)} đến {formatDate(dateRange.end)}
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
            Năm học: {schoolYear}
          </div>
        </div>

        {/* Table */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'center', width: '40px' }}>STT</th>
              <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'left' }}>Lớp</th>
              <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'center', width: '70px' }}>Học tập</th>
              <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'center', width: '70px' }}>Nề nếp</th>
              <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'center', width: '70px' }}>Nội trú</th>
              <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'center', width: '70px' }}>TB</th>
              <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'center', width: '60px' }}>Xếp hạng</th>
              <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'left' }}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {classScores.map((cls, index) => (
              <tr key={cls.class_name} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                <td style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'center' }}>{index + 1}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '6px', fontWeight: '500' }}>{cls.class_name}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'center' }}>{cls.academic_score.toFixed(1)}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'center' }}>{cls.discipline_score.toFixed(1)}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'center' }}>{cls.boarding_score.toFixed(1)}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#2563eb' }}>
                  {cls.average_score.toFixed(2)}
                </td>
                <td style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'center' }}>
                  {(() => {
                    const rankInfo = getRankDisplay(cls.rank);
                    if (rankInfo.bgColor === 'transparent') {
                      return <span style={{ fontWeight: 600, color: rankInfo.color }}>{rankInfo.text}</span>;
                    }
                    return (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: rankInfo.bgColor,
                        border: `2px solid ${rankInfo.borderColor}`,
                        boxShadow: rankInfo.shadow,
                        color: rankInfo.color,
                        fontWeight: 700,
                        fontSize: '13px',
                      }}>
                        {rankInfo.text}
                      </span>
                    );
                  })()}
                </td>
                <td style={{ border: '1px solid #d1d5db', padding: '6px', fontSize: '12px', color: '#6b7280' }}>
                  {cls.notes || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ marginTop: '12px', fontSize: '11px', color: '#9ca3af' }}>
          * Công thức: TB = (Học tập × 2 + Nề nếp + Nội trú) ÷ 4
        </div>
        <div style={{ marginTop: '8px', textAlign: 'right', fontSize: '11px', color: '#9ca3af' }}>
          Xuất lúc: {format(new Date(), 'HH:mm dd/MM/yyyy', { locale: vi })}
        </div>
      </div>
    );
  }
);

EmulationReportCard.displayName = 'EmulationReportCard';
