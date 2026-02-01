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

export const AbsentByMealGroupImageCard = memo(forwardRef<HTMLDivElement, AbsentByMealGroupImageCardProps>(
  ({ schoolName, date, reporter, breakfastAbsent, lunchAbsent, dinnerAbsent }, ref) => {
    const baseTextStyle: React.CSSProperties = {
      letterSpacing: '0.02em',
      wordSpacing: '0.1em',
      fontKerning: 'normal',
      textRendering: 'geometricPrecision',
      WebkitFontSmoothing: 'antialiased',
    };

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

    const renderMealSection = (
      title: string,
      icon: React.ReactNode,
      students: AbsentStudent[],
      bgColor: string,
      textColor: string
    ) => {
      const grouped = groupByMealGroup(students);

      return (
        <div style={{ 
          borderRadius: '8px', 
          border: '1px solid #e5e7eb', 
          padding: '10px',
          marginBottom: '10px',
          backgroundColor: '#fafafa'
        }}>
          <div style={{ 
            marginBottom: '8px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '8px' }}>{icon}</span>
              <span style={{ fontWeight: 600, color: '#374151', ...baseTextStyle }}>{title}</span>
            </div>
            <span style={{ 
              borderRadius: '4px', 
              backgroundColor: bgColor, 
              padding: '2px 8px', 
              fontSize: '12px', 
              fontWeight: 600, 
              color: textColor,
              ...baseTextStyle
            }}>
              {students.length} vắng
            </span>
          </div>

          {students.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '8px', 
              color: '#9ca3af', 
              fontSize: '12px',
              ...baseTextStyle
            }}>
              Không có học sinh vắng
            </div>
          ) : (
            <div style={{ fontSize: '12px' }}>
              {grouped.map(([mealGroup, groupStudents], idx) => (
                <div key={mealGroup} style={{ marginTop: idx > 0 ? '8px' : 0 }}>
                  <div style={{ 
                    fontWeight: 600, 
                    color: '#4b5563', 
                    marginBottom: '4px',
                    backgroundColor: '#f3f4f6',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    ...baseTextStyle
                  }}>
                    {mealGroup} ({groupStudents.length})
                  </div>
                  <div style={{ paddingLeft: '8px' }}>
                    {groupStudents
                      .sort((a, b) => {
                        if (a.classGrade !== b.classGrade) return a.classGrade - b.classGrade;
                        // Then sort by class name naturally (6A, 6B, 6C...)
                        if (a.className !== b.className) return a.className.localeCompare(b.className, 'vi', { numeric: true });
                        // Then by student name
                        return a.name.localeCompare(b.name, 'vi');
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
        </div>
      );
    };

    return (
      <div
        ref={ref}
        style={{ 
          width: '420px',
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
          <h1 style={{ marginTop: '4px', fontSize: '18px', fontWeight: 700, color: '#dc2626', marginBottom: 0, ...baseTextStyle }}>
            DANH SÁCH VẮNG THEO MÂM
          </h1>
          <p style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280', marginBottom: 0, ...baseTextStyle }}>
            Ngày {format(date, 'EEEE, dd/MM/yyyy', { locale: vi })}
          </p>
        </div>

        {/* Summary */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-around', 
          marginBottom: '16px',
          backgroundColor: '#fef2f2',
          padding: '10px',
          borderRadius: '8px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#f97316', ...baseTextStyle }}>Sáng</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#ea580c' }}>{breakfastAbsent.length}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#22c55e', ...baseTextStyle }}>Trưa</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a' }}>{lunchAbsent.length}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#6366f1', ...baseTextStyle }}>Tối</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#4f46e5' }}>{dinnerAbsent.length}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#dc2626', ...baseTextStyle }}>Tổng</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#b91c1c' }}>
              {breakfastAbsent.length + lunchAbsent.length + dinnerAbsent.length}
            </div>
          </div>
        </div>

        {/* Meal sections */}
        {renderMealSection(
          'Bữa sáng',
          <Coffee style={{ width: '16px', height: '16px', color: '#f97316' }} />,
          breakfastAbsent,
          '#ffedd5',
          '#ea580c'
        )}
        {renderMealSection(
          'Bữa trưa',
          <UtensilsCrossed style={{ width: '16px', height: '16px', color: '#22c55e' }} />,
          lunchAbsent,
          '#dcfce7',
          '#16a34a'
        )}
        {renderMealSection(
          'Bữa tối',
          <Moon style={{ width: '16px', height: '16px', color: '#6366f1' }} />,
          dinnerAbsent,
          '#e0e7ff',
          '#4f46e5'
        )}

        {/* Note */}
        <div style={{ 
          marginTop: '8px',
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

        {/* Footer */}
        <div style={{ 
          borderTop: '1px solid #e5e7eb', 
          paddingTop: '12px', 
          marginTop: '12px',
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

AbsentByMealGroupImageCard.displayName = 'AbsentByMealGroupImageCard';
