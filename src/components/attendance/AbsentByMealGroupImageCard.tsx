import { forwardRef, memo } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Coffee, UtensilsCrossed, Moon } from 'lucide-react';

interface AbsentStudent {
  id: string;
  name: string;
  className: string;
  classGrade: number;
  mealGroup?: string;
  excused: boolean;
}

interface AbsentByMealGroupImageCardProps {
  schoolName: string;
  date: Date;
  reporter: string;
  breakfastAbsent: AbsentStudent[];
  lunchAbsent: AbsentStudent[];
  dinnerAbsent: AbsentStudent[];
}

// Group students by meal group and sort
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

export const AbsentByMealGroupImageCard = memo(forwardRef<HTMLDivElement, AbsentByMealGroupImageCardProps>(
  ({ schoolName, date, reporter, breakfastAbsent, lunchAbsent, dinnerAbsent }, ref) => {
    const baseTextStyle: React.CSSProperties = {
      letterSpacing: '0.01em',
      fontKerning: 'normal',
      textRendering: 'geometricPrecision',
      WebkitFontSmoothing: 'antialiased',
    };

    const renderMealSection = (
      title: string,
      icon: React.ReactNode,
      students: AbsentStudent[],
      accentColor: string
    ) => {
      const grouped = groupByMealGroup(students);

      return (
        <div style={{ marginBottom: '8px' }}>
          {/* Meal header - compact */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            backgroundColor: '#f3f4f6',
            padding: '4px 8px',
            borderRadius: '4px',
            marginBottom: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {icon}
              <span style={{ fontWeight: 600, fontSize: '11px', color: '#374151', ...baseTextStyle }}>{title}</span>
            </div>
            <span style={{ 
              backgroundColor: students.length > 0 ? '#fef2f2' : '#f0fdf4',
              color: students.length > 0 ? '#dc2626' : '#16a34a',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 600,
              ...baseTextStyle
            }}>
              {students.length > 0 ? `${students.length} vắng` : '✓ Đủ'}
            </span>
          </div>

          {/* Meal group list - compact inline */}
          {students.length > 0 && (
            <div style={{ fontSize: '10px', paddingLeft: '4px' }}>
              {grouped.map(([mealGroup, groupStudents], idx) => (
                <div key={mealGroup} style={{ marginBottom: idx < grouped.length - 1 ? '4px' : 0 }}>
                  <span style={{ 
                    fontWeight: 600, 
                    color: accentColor,
                    ...baseTextStyle
                  }}>
                    {mealGroup}
                  </span>
                  <span style={{ color: '#6b7280' }}> ({groupStudents.length}): </span>
                  {groupStudents
                    .sort((a, b) => {
                      if (a.classGrade !== b.classGrade) return a.classGrade - b.classGrade;
                      return a.className.localeCompare(b.className, 'vi');
                    })
                    .map((student, i) => (
                      <span key={student.id} style={{ color: '#374151', ...baseTextStyle }}>
                        {student.name}
                        {student.excused && <sup style={{ color: '#ca8a04', fontSize: '8px' }}>P</sup>}
                        <span style={{ color: '#9ca3af', fontSize: '9px' }}> ({student.className})</span>
                        {i < groupStudents.length - 1 && ', '}
                      </span>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    const totalAbsent = breakfastAbsent.length + lunchAbsent.length + dinnerAbsent.length;

    return (
      <div
        ref={ref}
        style={{ 
          width: '380px',
          backgroundColor: 'white',
          padding: '14px',
          fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
          fontSize: '12px',
          lineHeight: '1.4',
          ...baseTextStyle
        }}
      >
        {/* Compact Header */}
        <div style={{ marginBottom: '10px', textAlign: 'center', borderBottom: '2px solid #dc2626', paddingBottom: '8px' }}>
          <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px', ...baseTextStyle }}>{schoolName}</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626', ...baseTextStyle }}>
            DS VẮNG THEO MÂM
          </div>
          <div style={{ fontSize: '11px', color: '#374151', marginTop: '2px', ...baseTextStyle }}>
            {format(date, 'EEEE, dd/MM/yyyy', { locale: vi })}
          </div>
        </div>

        {/* Compact Summary Bar */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '10px',
          backgroundColor: '#fef2f2',
          padding: '8px 12px',
          borderRadius: '6px'
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#f97316', ...baseTextStyle }}>Sáng</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#ea580c' }}>{breakfastAbsent.length}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#22c55e', ...baseTextStyle }}>Trưa</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#16a34a' }}>{lunchAbsent.length}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#6366f1', ...baseTextStyle }}>Tối</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#4f46e5' }}>{dinnerAbsent.length}</div>
            </div>
          </div>
          <div style={{ 
            textAlign: 'center',
            borderLeft: '1px solid #fecaca',
            paddingLeft: '12px'
          }}>
            <div style={{ fontSize: '9px', color: '#dc2626', ...baseTextStyle }}>Tổng</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#b91c1c' }}>{totalAbsent}</div>
          </div>
        </div>

        {/* Meal sections - compact */}
        <div style={{ 
          border: '1px solid #e5e7eb', 
          borderRadius: '6px', 
          padding: '8px',
          backgroundColor: '#fafafa'
        }}>
          {renderMealSection(
            'Sáng',
            <Coffee style={{ width: '12px', height: '12px', color: '#f97316' }} />,
            breakfastAbsent,
            '#ea580c'
          )}
          {renderMealSection(
            'Trưa',
            <UtensilsCrossed style={{ width: '12px', height: '12px', color: '#22c55e' }} />,
            lunchAbsent,
            '#16a34a'
          )}
          {renderMealSection(
            'Tối',
            <Moon style={{ width: '12px', height: '12px', color: '#6366f1' }} />,
            dinnerAbsent,
            '#4f46e5'
          )}
        </div>

        {/* Note - only show if there are excused students */}
        {(breakfastAbsent.some(s => s.excused) || lunchAbsent.some(s => s.excused) || dinnerAbsent.some(s => s.excused)) && (
          <div style={{ 
            marginTop: '6px',
            fontSize: '9px',
            color: '#9ca3af',
            textAlign: 'right',
            ...baseTextStyle
          }}>
            <sup style={{ color: '#ca8a04' }}>P</sup> = Có phép
          </div>
        )}

        {/* Compact Footer */}
        <div style={{ 
          borderTop: '1px solid #e5e7eb', 
          paddingTop: '8px', 
          marginTop: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '9px', 
          color: '#9ca3af' 
        }}>
          <span>Người báo: <span style={{ color: '#374151', fontWeight: 500 }}>{reporter}</span></span>
          <span>{format(new Date(), 'HH:mm dd/MM/yyyy', { locale: vi })}</span>
        </div>
      </div>
    );
  }
));

AbsentByMealGroupImageCard.displayName = 'AbsentByMealGroupImageCard';
