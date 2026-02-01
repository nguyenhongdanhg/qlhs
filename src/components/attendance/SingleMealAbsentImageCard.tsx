import { forwardRef, memo } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Coffee, UtensilsCrossed, Moon } from 'lucide-react';
import { AttendanceType } from '@/types';

interface AbsentStudent {
  id: string;
  name: string;
  className: string;
  classGrade: number;
  mealGroup?: string;
  excused: boolean;
}

interface SingleMealAbsentImageCardProps {
  schoolName: string;
  date: Date;
  reporter: string;
  mealType: AttendanceType;
  absentStudents: AbsentStudent[];
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

export const SingleMealAbsentImageCard = memo(forwardRef<HTMLDivElement, SingleMealAbsentImageCardProps>(
  ({ schoolName, date, reporter, mealType, absentStudents }, ref) => {
    const baseTextStyle: React.CSSProperties = {
      letterSpacing: '0.02em',
      wordSpacing: '0.1em',
      fontKerning: 'normal',
      textRendering: 'geometricPrecision',
      WebkitFontSmoothing: 'antialiased',
    };

    const config = getMealConfig(mealType);

    // Group students by meal group
    const groupByMealGroup = (students: AbsentStudent[]) => {
      const grouped = new Map<string, AbsentStudent[]>();
      students.forEach(student => {
        const group = student.mealGroup || 'Chưa phân mâm';
        if (!grouped.has(group)) {
          grouped.set(group, []);
        }
        grouped.get(group)!.push(student);
      });

      // Sort meal groups naturally
      return Array.from(grouped.entries()).sort((a, b) => {
        if (a[0] === 'Chưa phân mâm') return 1;
        if (b[0] === 'Chưa phân mâm') return -1;
        const numA = parseInt(a[0].match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b[0].match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
      });
    };

    const grouped = groupByMealGroup(absentStudents);

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
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626', margin: 0, ...baseTextStyle }}>
              DS VẮNG {config.title} THEO MÂM
            </h1>
          </div>
          <p style={{ marginTop: '8px', fontSize: '14px', color: '#6b7280', marginBottom: 0, ...baseTextStyle }}>
            Ngày {format(date, 'EEEE, dd/MM/yyyy', { locale: vi })}
          </p>
        </div>

        {/* Summary */}
        <div style={{
          marginBottom: '16px',
          backgroundColor: '#fef2f2',
          padding: '12px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '12px', color: '#dc2626', ...baseTextStyle }}>Tổng số vắng</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#b91c1c' }}>{absentStudents.length}</div>
        </div>

        {/* Absent list by meal group */}
        {absentStudents.length === 0 ? (
          <div style={{
            borderRadius: '8px',
            backgroundColor: '#f0fdf4',
            padding: '20px',
            textAlign: 'center',
            color: '#16a34a',
            fontWeight: 500,
            ...baseTextStyle
          }}>
            ✓ Không có học sinh vắng
          </div>
        ) : (
          <div style={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            padding: '12px',
            backgroundColor: '#fafafa'
          }}>
            {grouped.map(([mealGroup, groupStudents], idx) => (
              <div key={mealGroup} style={{ marginTop: idx > 0 ? '12px' : 0 }}>
                <div style={{
                  fontWeight: 600,
                  color: '#4b5563',
                  marginBottom: '6px',
                  backgroundColor: '#f3f4f6',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  ...baseTextStyle
                }}>
                  <span>{mealGroup}</span>
                  <span style={{
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    {groupStudents.length}
                  </span>
                </div>
                <div style={{ paddingLeft: '10px', fontSize: '12px' }}>
                  {groupStudents
                    .sort((a, b) => {
                      if (a.classGrade !== b.classGrade) return a.classGrade - b.classGrade;
                      return a.className.localeCompare(b.className, 'vi');
                    })
                    .map((student, i) => (
                      <span key={student.id} style={{ color: '#374151', ...baseTextStyle }}>
                        {student.name}
                        {student.excused && <sup style={{ color: '#ca8a04' }}>P</sup>}
                        <span style={{ color: '#9ca3af', fontSize: '10px' }}> ({student.className})</span>
                        {i < groupStudents.length - 1 && ', '}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Note */}
        {absentStudents.length > 0 && absentStudents.some(s => s.excused) && (
          <div style={{
            marginTop: '12px',
            padding: '8px',
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

SingleMealAbsentImageCard.displayName = 'SingleMealAbsentImageCard';
