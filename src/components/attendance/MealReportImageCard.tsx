import { forwardRef, memo } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

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
  lunchRice?: number;
  dinnerRice?: number;
  ricePerStudent?: number;
}

export const MealReportImageCard = memo(forwardRef<HTMLDivElement, MealReportImageCardProps>(
  ({ schoolName, date, reporter, breakfast, lunch, dinner, totalRice, lunchRice, dinnerRice, ricePerStudent = 0.2 }, ref) => {
    const baseTextStyle: React.CSSProperties = {
      letterSpacing: '0.01em',
      fontKerning: 'normal',
      textRendering: 'geometricPrecision',
      WebkitFontSmoothing: 'antialiased',
    };

    const meals = [
      { key: 'breakfast', label: 'Sáng', stats: breakfast, color: '#f97316', bgColor: '#fff7ed' },
      { key: 'lunch', label: 'Trưa', stats: lunch, color: '#22c55e', bgColor: '#f0fdf4' },
      { key: 'dinner', label: 'Tối', stats: dinner, color: '#6366f1', bgColor: '#eef2ff' },
    ];

    // Combine all absent students for compact display
    const renderAbsentList = (stats: MealStats, mealLabel: string) => {
      if (!stats.hasReport || stats.absent === 0) return null;
      
      const groupedByClass = new Map<string, AbsentStudent[]>();
      stats.absentStudents.forEach(student => {
        if (!groupedByClass.has(student.className)) {
          groupedByClass.set(student.className, []);
        }
        groupedByClass.get(student.className)!.push(student);
      });

      return (
        <div style={{ marginBottom: '6px' }}>
          <div style={{ 
            fontWeight: 600, 
            fontSize: '11px', 
            color: '#991b1b',
            marginBottom: '2px',
            ...baseTextStyle 
          }}>
            {mealLabel} ({stats.absent}):
          </div>
          <div style={{ fontSize: '11px', lineHeight: '1.4', paddingLeft: '8px' }}>
            {Array.from(groupedByClass.entries())
              .sort((a, b) => (a[1][0]?.classGrade || 0) - (b[1][0]?.classGrade || 0))
              .map(([className, students]) => (
                <span key={className} style={{ marginRight: '6px' }}>
                  <span style={{ fontWeight: 500, color: '#4b5563' }}>{className}:</span>{' '}
                  {students.map((s, i) => (
                    <span key={s.id} style={{ color: '#374151' }}>
                      {s.name}
                      {s.excused && <sup style={{ color: '#ca8a04', fontSize: '9px' }}>P</sup>}
                      {i < students.length - 1 && ', '}
                    </span>
                  ))}
                  {' '}
                </span>
              ))}
          </div>
        </div>
      );
    };

    const totalPresent = breakfast.present + lunch.present + dinner.present;
    const totalAbsent = breakfast.absent + lunch.absent + dinner.absent;

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
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>{schoolName}</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#0284c7' }}>THỐNG KÊ BỮA ĂN</div>
          <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
            {format(date, 'EEEE, dd/MM/yyyy', { locale: vi })}
          </div>
        </div>

        {/* Compact Meal Stats Grid */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          marginBottom: '12px'
        }}>
          {meals.map(({ key, label, stats, color, bgColor }) => (
            <div key={key} style={{
              backgroundColor: bgColor,
              borderRadius: '6px',
              padding: '8px',
              textAlign: 'center',
              border: `1px solid ${color}20`
            }}>
              <div style={{ 
                fontSize: '11px', 
                fontWeight: 600, 
                color: color,
                marginBottom: '4px',
                textTransform: 'uppercase'
              }}>
                {label}
              </div>
              {stats.hasReport ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', fontSize: '11px' }}>
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>{stats.present}</span>
                    <span style={{ color: '#9ca3af' }}>/</span>
                    <span style={{ color: '#374151' }}>{stats.total}</span>
                  </div>
                  {stats.absent > 0 && (
                    <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '2px' }}>
                      -{stats.absent} vắng
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 500 }}>Chưa báo</div>
              )}
            </div>
          ))}
        </div>

        {/* Summary Row */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          backgroundColor: '#f8fafc',
          borderRadius: '6px',
          padding: '8px'
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a' }}>{totalPresent}</div>
            <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase' }}>Tổng suất</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#e5e7eb' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>{totalAbsent}</div>
            <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase' }}>Tổng vắng</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#e5e7eb' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#b45309' }}>{totalRice.toFixed(2)}</div>
            <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase' }}>kg gạo</div>
          </div>
        </div>

        {/* Rice Detail */}
        <div style={{
          marginBottom: '12px',
          backgroundColor: '#fffbeb',
          borderRadius: '6px',
          padding: '8px',
          fontSize: '11px',
          textAlign: 'center',
          color: '#92400e'
        }}>
          <span style={{ fontWeight: 500 }}>Chi tiết gạo:</span>{' '}
          Trưa {(lunchRice ?? lunch.present * ricePerStudent).toFixed(2)}kg ({lunch.present} suất) + 
          Tối {(dinnerRice ?? dinner.present * ricePerStudent).toFixed(2)}kg ({dinner.present} suất)
        </div>

        {/* Absent Students - Compact */}
        {(breakfast.absent > 0 || lunch.absent > 0 || dinner.absent > 0) && (
          <div style={{
            marginBottom: '12px',
            borderRadius: '6px',
            border: '1px solid #fecaca',
            backgroundColor: '#fef2f2',
            padding: '10px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#dc2626',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              textTransform: 'uppercase'
            }}>
              <span style={{ width: '6px', height: '6px', backgroundColor: '#dc2626', borderRadius: '50%' }} />
              Danh sách vắng
            </div>
            {renderAbsentList(breakfast, 'Sáng')}
            {renderAbsentList(lunch, 'Trưa')}
            {renderAbsentList(dinner, 'Tối')}
            <div style={{ fontSize: '9px', color: '#9ca3af', textAlign: 'right', marginTop: '4px' }}>
              <sup style={{ color: '#ca8a04' }}>P</sup>=Phép
            </div>
          </div>
        )}

        {/* Compact Footer */}
        <div style={{ 
          borderTop: '1px solid #e5e7eb', 
          paddingTop: '8px', 
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px', 
          color: '#9ca3af'
        }}>
          <span>Người báo: <span style={{ color: '#374151', fontWeight: 500 }}>{reporter}</span></span>
          <span>{format(new Date(), 'HH:mm dd/MM/yyyy', { locale: vi })}</span>
        </div>
      </div>
    );
  }
));

MealReportImageCard.displayName = 'MealReportImageCard';
