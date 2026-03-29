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
  ricePerStudent?: number;
}

const getMealConfig = (mealType: AttendanceType) => {
  switch (mealType) {
    case 'breakfast':
      return { title: 'BỮA SÁNG', icon: Coffee, color: '#f97316', bgColor: '#fff7ed' };
    case 'lunch':
      return { title: 'BỮA TRƯA', icon: UtensilsCrossed, color: '#22c55e', bgColor: '#f0fdf4' };
    case 'dinner':
      return { title: 'BỮA TỐI', icon: Moon, color: '#6366f1', bgColor: '#eef2ff' };
    default:
      return { title: 'BỮA ĂN', icon: UtensilsCrossed, color: '#6b7280', bgColor: '#f9fafb' };
  }
};

export const SingleMealImageCard = memo(forwardRef<HTMLDivElement, SingleMealImageCardProps>(
  ({ schoolName, date, reporter, mealType, total, present, absent, absentStudents, riceAmount }, ref) => {
    const baseTextStyle: React.CSSProperties = {
      letterSpacing: '0.01em',
      fontKerning: 'normal',
      textRendering: 'geometricPrecision',
      WebkitFontSmoothing: 'antialiased',
    };

    const config = getMealConfig(mealType);
    const Icon = config.icon;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

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
          width: '380px',
          backgroundColor: 'white',
          padding: '16px',
          fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
          fontSize: '13px',
          lineHeight: '1.4',
          ...baseTextStyle
        }}
      >
        {/* Compact Header with meal color */}
        <div style={{ 
          marginBottom: '12px', 
          textAlign: 'center', 
          borderBottom: `2px solid ${config.color}`, 
          paddingBottom: '10px' 
        }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>{schoolName}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Icon style={{ width: '18px', height: '18px', color: config.color }} />
            <span style={{ fontSize: '16px', fontWeight: 700, color: config.color }}>{config.title}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
            {format(date, 'EEEE, dd/MM/yyyy', { locale: vi })}
          </div>
        </div>

        {/* Compact Stats Row */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '12px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          padding: '10px'
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#374151' }}>{total}</div>
            <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>Tổng</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#e5e7eb' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>{present}</div>
            <div style={{ fontSize: '10px', color: '#16a34a', textTransform: 'uppercase' }}>Ăn</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#e5e7eb' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>{absent}</div>
            <div style={{ fontSize: '10px', color: '#dc2626', textTransform: 'uppercase' }}>Vắng</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#e5e7eb' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: config.color }}>{attendanceRate}%</div>
            <div style={{ fontSize: '10px', color: config.color, textTransform: 'uppercase' }}>Tỷ lệ</div>
          </div>
        </div>

        {/* Rice amount for lunch/dinner - compact */}
        {(mealType === 'lunch' || mealType === 'dinner') && riceAmount !== undefined && (
          <div style={{
            marginBottom: '12px',
            borderRadius: '6px',
            backgroundColor: '#fffbeb',
            padding: '8px',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '11px', color: '#92400e' }}>Lượng gạo:</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#b45309' }}>{riceAmount.toFixed(1)} kg</span>
            <span style={{ fontSize: '10px', color: '#d97706' }}>({present} × 0.2kg)</span>
          </div>
        )}

        {/* Absent students list - compact inline */}
        {absent > 0 && (
          <div style={{
            marginBottom: '12px',
            borderRadius: '6px',
            border: '1px solid #fecaca',
            backgroundColor: '#fef2f2',
            padding: '10px',
            fontSize: '12px'
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
              Danh sách vắng ({absent})
            </div>
            {Array.from(groupedByClass.entries())
              .sort((a, b) => (a[1][0]?.classGrade || 0) - (b[1][0]?.classGrade || 0))
              .map(([className, students], classIndex) => (
                <div key={className} style={{ marginTop: classIndex > 0 ? '4px' : 0 }}>
                  <span style={{ fontWeight: 600, color: '#991b1b', fontSize: '11px' }}>{className}:</span>
                  <span style={{ marginLeft: '4px', color: '#374151' }}>
                    {students.map((s, idx) => (
                      <span key={s.id}>
                        {s.name}
                        {s.excused ? (
                          <sup style={{ color: '#ca8a04', fontSize: '9px', marginLeft: '1px' }}>P</sup>
                        ) : (
                          <sup style={{ color: '#dc2626', fontSize: '9px', marginLeft: '1px' }}>K</sup>
                        )}
                        {s.mealGroup && (
                          <span style={{ color: '#9ca3af', fontSize: '10px' }}> M{s.mealGroup.replace(/[^0-9]/g, '')}</span>
                        )}
                        {idx < students.length - 1 && ', '}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            <div style={{ fontSize: '9px', color: '#9ca3af', textAlign: 'right', marginTop: '4px' }}>
              <sup style={{ color: '#ca8a04' }}>P</sup>=Phép, <sup style={{ color: '#dc2626' }}>K</sup>=Không phép
            </div>
          </div>
        )}

        {/* No absences message */}
        {absent === 0 && (
          <div style={{
            marginBottom: '12px',
            borderRadius: '6px',
            backgroundColor: '#f0fdf4',
            padding: '12px',
            textAlign: 'center',
            color: '#16a34a',
            fontWeight: 500,
            fontSize: '13px'
          }}>
            ✓ Đủ {total} học sinh
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

SingleMealImageCard.displayName = 'SingleMealImageCard';
