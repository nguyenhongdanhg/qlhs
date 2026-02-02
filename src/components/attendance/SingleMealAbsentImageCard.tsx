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
      return { title: 'SÁNG', icon: Coffee, color: '#f97316' };
    case 'lunch':
      return { title: 'TRƯA', icon: UtensilsCrossed, color: '#22c55e' };
    case 'dinner':
      return { title: 'TỐI', icon: Moon, color: '#6366f1' };
    default:
      return { title: 'BỮA ĂN', icon: UtensilsCrossed, color: '#6b7280' };
  }
};

export const SingleMealAbsentImageCard = memo(forwardRef<HTMLDivElement, SingleMealAbsentImageCardProps>(
  ({ schoolName, date, reporter, mealType, absentStudents }, ref) => {
    const baseTextStyle: React.CSSProperties = {
      letterSpacing: '0.01em',
      fontKerning: 'normal',
      textRendering: 'geometricPrecision',
      WebkitFontSmoothing: 'antialiased',
    };

    const config = getMealConfig(mealType);
    const Icon = config.icon;

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
        <div style={{ marginBottom: '12px', textAlign: 'center', borderBottom: '2px solid #dc2626', paddingBottom: '10px' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>{schoolName}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Icon style={{ width: '16px', height: '16px', color: config.color }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#dc2626' }}>
              DS VẮNG BỮA {config.title} THEO MÂM
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
            {format(date, 'EEEE, dd/MM/yyyy', { locale: vi })}
          </div>
        </div>

        {/* Summary - Compact */}
        <div style={{
          marginBottom: '12px',
          backgroundColor: '#fef2f2',
          padding: '10px',
          borderRadius: '6px',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '12px', color: '#991b1b' }}>Tổng vắng:</span>
          <span style={{ fontSize: '22px', fontWeight: 700, color: '#b91c1c' }}>{absentStudents.length}</span>
          <span style={{ fontSize: '11px', color: '#dc2626' }}>học sinh</span>
        </div>

        {/* Absent list by meal group - Compact */}
        {absentStudents.length === 0 ? (
          <div style={{
            borderRadius: '6px',
            backgroundColor: '#f0fdf4',
            padding: '14px',
            textAlign: 'center',
            color: '#16a34a',
            fontWeight: 500,
            fontSize: '13px'
          }}>
            ✓ Không có học sinh vắng
          </div>
        ) : (
          <div style={{
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
            backgroundColor: '#fafafa',
            padding: '10px',
            fontSize: '12px'
          }}>
            {grouped.map(([mealGroup, groupStudents], idx) => (
              <div key={mealGroup} style={{ marginTop: idx > 0 ? '8px' : 0 }}>
                <div style={{
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '4px',
                  backgroundColor: '#f3f4f6',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11px'
                }}>
                  <span>{mealGroup}</span>
                  <span style={{
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 600
                  }}>
                    {groupStudents.length}
                  </span>
                </div>
                <div style={{ paddingLeft: '8px', fontSize: '11px', lineHeight: '1.5' }}>
                  {groupStudents
                    .sort((a, b) => {
                      if (a.classGrade !== b.classGrade) return a.classGrade - b.classGrade;
                      return a.className.localeCompare(b.className, 'vi');
                    })
                    .map((student, i) => (
                      <span key={student.id} style={{ color: '#374151' }}>
                        {student.name}
                        {student.excused && <sup style={{ color: '#ca8a04', fontSize: '9px' }}>P</sup>}
                        <span style={{ color: '#9ca3af', fontSize: '10px' }}> ({student.className})</span>
                        {i < groupStudents.length - 1 && ', '}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Note - Compact */}
        {absentStudents.length > 0 && absentStudents.some(s => s.excused) && (
          <div style={{
            marginTop: '8px',
            fontSize: '9px',
            color: '#9ca3af',
            textAlign: 'right'
          }}>
            <sup style={{ color: '#ca8a04' }}>P</sup> = Có phép
          </div>
        )}

        {/* Compact Footer */}
        <div style={{
          borderTop: '1px solid #e5e7eb',
          paddingTop: '8px',
          marginTop: '12px',
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

SingleMealAbsentImageCard.displayName = 'SingleMealAbsentImageCard';
