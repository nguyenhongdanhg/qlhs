import { forwardRef, memo } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Coffee, UtensilsCrossed, Moon, CheckCircle2, XCircle } from 'lucide-react';
import { AttendanceType } from '@/types';

interface AbsentStudent {
  id: string;
  name: string;
  className: string;
  classGrade: number;
  excused: boolean;
  reason?: string;
  mealGroup?: string;
}

interface SingleMealImageCardProps {
  schoolName: string;
  date: Date;
  reporter: string;
  mealType: AttendanceType;
  total: number;
  present: number;
  absent: number;
  absentStudents: AbsentStudent[];
  riceAmount?: number;
}

const getMealConfig = (mealType: AttendanceType) => {
  switch (mealType) {
    case 'breakfast':
      return {
        title: 'BỮA SÁNG',
        icon: <Coffee style={{ width: '20px', height: '20px', color: '#f97316' }} />,
        color: '#f97316',
        bgColor: '#fff7ed',
      };
    case 'lunch':
      return {
        title: 'BỮA TRƯA',
        icon: <UtensilsCrossed style={{ width: '20px', height: '20px', color: '#22c55e' }} />,
        color: '#22c55e',
        bgColor: '#f0fdf4',
      };
    case 'dinner':
      return {
        title: 'BỮA TỐI',
        icon: <Moon style={{ width: '20px', height: '20px', color: '#6366f1' }} />,
        color: '#6366f1',
        bgColor: '#eef2ff',
      };
    default:
      return {
        title: 'BỮA ĂN',
        icon: <UtensilsCrossed style={{ width: '20px', height: '20px', color: '#6b7280' }} />,
        color: '#6b7280',
        bgColor: '#f9fafb',
      };
  }
};

export const SingleMealImageCard = memo(forwardRef<HTMLDivElement, SingleMealImageCardProps>(
  ({ schoolName, date, reporter, mealType, total, present, absent, absentStudents, riceAmount }, ref) => {
    const baseTextStyle: React.CSSProperties = {
      letterSpacing: '0.02em',
      wordSpacing: '0.1em',
      fontKerning: 'normal',
      textRendering: 'geometricPrecision',
      WebkitFontSmoothing: 'antialiased',
    };

    const config = getMealConfig(mealType);

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
        style={{
          width: '400px',
          backgroundColor: 'white',
          padding: '20px',
          fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
          fontSize: '14px',
          lineHeight: '1.5',
          ...baseTextStyle
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 500, color: '#4b5563', margin: 0, ...baseTextStyle }}>{schoolName}</h2>
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {config.icon}
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: config.color, margin: 0, ...baseTextStyle }}>
              THỐNG KÊ {config.title}
            </h1>
          </div>
          <p style={{ marginTop: '8px', fontSize: '14px', color: '#6b7280', marginBottom: 0, ...baseTextStyle }}>
            Ngày {format(date, 'EEEE, dd/MM/yyyy', { locale: vi })}
          </p>
        </div>

        {/* Stats */}
        <div style={{
          marginBottom: '16px',
          display: 'flex',
          textAlign: 'center',
          fontSize: '14px'
        }}>
          <div style={{
            flex: 1,
            borderRadius: '8px',
            backgroundColor: '#f9fafb',
            padding: '12px',
            marginRight: '8px'
          }}>
            <div style={{ fontSize: '12px', color: '#6b7280', ...baseTextStyle }}>Tổng</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#374151' }}>{total}</div>
          </div>
          <div style={{
            flex: 1,
            borderRadius: '8px',
            backgroundColor: '#f0fdf4',
            padding: '12px',
            marginRight: '8px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#16a34a'
            }}>
              <CheckCircle2 style={{ width: '14px', height: '14px', marginRight: '4px' }} />
              <span style={baseTextStyle}>Ăn</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>{present}</div>
          </div>
          <div style={{
            flex: 1,
            borderRadius: '8px',
            backgroundColor: '#fef2f2',
            padding: '12px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#dc2626'
            }}>
              <XCircle style={{ width: '14px', height: '14px', marginRight: '4px' }} />
              <span style={baseTextStyle}>Vắng</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>{absent}</div>
          </div>
        </div>

        {/* Rice amount for lunch/dinner */}
        {(mealType === 'lunch' || mealType === 'dinner') && riceAmount !== undefined && (
          <div style={{
            marginBottom: '16px',
            borderRadius: '8px',
            backgroundColor: '#fffbeb',
            padding: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '12px', color: '#d97706', ...baseTextStyle }}>Lượng gạo</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#b45309' }}>{riceAmount.toFixed(1)} kg</div>
            <div style={{ fontSize: '11px', color: '#d97706', marginTop: '2px', ...baseTextStyle }}>
              ({present} suất × 0.2kg)
            </div>
          </div>
        )}

        {/* Absent students list */}
        {absent > 0 && (
          <div style={{
            borderRadius: '8px',
            backgroundColor: '#fef2f2',
            padding: '12px'
          }}>
            <div style={{
              marginBottom: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#dc2626',
              ...baseTextStyle
            }}>
              Danh sách vắng ({absent}):
            </div>
            <div style={{ fontSize: '12px' }}>
              {Array.from(groupedByClass.entries())
                .sort((a, b) => {
                  const gradeA = a[1][0]?.classGrade || 0;
                  const gradeB = b[1][0]?.classGrade || 0;
                  return gradeA - gradeB;
                })
                .map(([className, students], idx) => (
                  <div key={className} style={{ marginTop: idx > 0 ? '6px' : 0 }}>
                    <span style={{ fontWeight: 600, color: '#4b5563', ...baseTextStyle }}>{className}:</span>
                    {' '}
                    <span style={{ color: '#374151', ...baseTextStyle }}>
                      {students.map((s, i) => (
                        <span key={s.id}>
                          {s.name}
                          {s.excused && <sup style={{ color: '#ca8a04' }}>P</sup>}
                          {s.mealGroup && (
                            <span style={{ color: '#9ca3af', fontSize: '10px' }}> ({s.mealGroup})</span>
                          )}
                          {i < students.length - 1 && ', '}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* No absences message */}
        {absent === 0 && (
          <div style={{
            borderRadius: '8px',
            backgroundColor: '#f0fdf4',
            padding: '16px',
            textAlign: 'center',
            color: '#16a34a',
            fontWeight: 500,
            ...baseTextStyle
          }}>
            ✓ Không có học sinh vắng
          </div>
        )}

        {/* Note for excused */}
        {absent > 0 && absentStudents.some(s => s.excused) && (
          <div style={{
            marginTop: '8px',
            padding: '6px',
            backgroundColor: '#fffbeb',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#92400e',
            textAlign: 'center',
            ...baseTextStyle
          }}>
            <sup style={{ color: '#ca8a04' }}>P</sup> = Có phép
          </div>
        )}

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #e5e7eb',
          paddingTop: '12px',
          marginTop: '16px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#9ca3af'
        }}>
          <p style={{ margin: 0, ...baseTextStyle }}>Người báo cáo: {reporter}</p>
          <p style={{ margin: '4px 0 0 0', ...baseTextStyle }}>Xuất lúc: {format(new Date(), 'HH:mm dd/MM/yyyy', { locale: vi })}</p>
        </div>
      </div>
    );
  }
));

SingleMealImageCard.displayName = 'SingleMealImageCard';
