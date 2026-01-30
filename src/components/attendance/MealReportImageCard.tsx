import { forwardRef, memo, useMemo } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Coffee, UtensilsCrossed, Moon, CheckCircle2, XCircle } from 'lucide-react';

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
}

export const MealReportImageCard = memo(forwardRef<HTMLDivElement, MealReportImageCardProps>(
  ({ schoolName, date, reporter, breakfast, lunch, dinner, totalRice, lunchRice, dinnerRice }, ref) => {
    const baseTextStyle: React.CSSProperties = {
      letterSpacing: '0.02em',
      wordSpacing: '0.1em',
      fontKerning: 'normal',
      textRendering: 'geometricPrecision',
      WebkitFontSmoothing: 'antialiased',
    };

    const renderMealSection = (
      title: string,
      icon: React.ReactNode,
      stats: MealStats,
      showMealGroup: boolean = false
    ) => {
      // Group absent students by class
      const groupedByClass = new Map<string, AbsentStudent[]>();
      stats.absentStudents.forEach(student => {
        if (!groupedByClass.has(student.className)) {
          groupedByClass.set(student.className, []);
        }
        groupedByClass.get(student.className)!.push(student);
      });

      return (
        <div style={{ 
          borderRadius: '8px', 
          border: '1px solid #e5e7eb', 
          padding: '12px',
          marginBottom: '12px'
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
            {stats.hasReport ? (
              <span style={{ 
                borderRadius: '4px', 
                backgroundColor: '#dcfce7', 
                padding: '2px 8px', 
                fontSize: '12px', 
                fontWeight: 500, 
                color: '#15803d',
                ...baseTextStyle
              }}>
                {'Đã báo cáo'}
              </span>
            ) : (
              <span style={{ 
                borderRadius: '4px', 
                backgroundColor: '#fee2e2', 
                padding: '2px 8px', 
                fontSize: '12px', 
                fontWeight: 500, 
                color: '#b91c1c',
                ...baseTextStyle
              }}>
                {'Chưa báo cáo'}
              </span>
            )}
          </div>

          {stats.hasReport && (
            <>
              {/* Stats row */}
              <div style={{ 
                marginBottom: '8px', 
                display: 'flex', 
                textAlign: 'center', 
                fontSize: '14px' 
              }}>
                <div style={{ 
                  flex: 1, 
                  borderRadius: '4px', 
                  backgroundColor: '#f9fafb', 
                  padding: '6px',
                  marginRight: '8px'
                }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', ...baseTextStyle }}>{'Tổng'}</div>
                  <div style={{ fontWeight: 700, color: '#374151' }}>{stats.total}</div>
                </div>
                <div style={{ 
                  flex: 1, 
                  borderRadius: '4px', 
                  backgroundColor: '#f0fdf4', 
                  padding: '6px',
                  marginRight: '8px'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '12px', 
                    color: '#16a34a' 
                  }}>
                    <CheckCircle2 style={{ width: '12px', height: '12px', marginRight: '4px' }} />
                    <span style={baseTextStyle}>{'Ăn'}</span>
                  </div>
                  <div style={{ fontWeight: 700, color: '#16a34a' }}>{stats.present}</div>
                </div>
                <div style={{ 
                  flex: 1, 
                  borderRadius: '4px', 
                  backgroundColor: '#fef2f2', 
                  padding: '6px' 
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '12px', 
                    color: '#dc2626' 
                  }}>
                    <XCircle style={{ width: '12px', height: '12px', marginRight: '4px' }} />
                    <span style={baseTextStyle}>{'Vắng'}</span>
                  </div>
                  <div style={{ fontWeight: 700, color: '#dc2626' }}>{stats.absent}</div>
                </div>
              </div>

              {/* Absent students */}
              {stats.absent > 0 && (
                <div style={{ 
                  borderRadius: '4px', 
                  backgroundColor: '#fef2f2', 
                  padding: '8px' 
                }}>
                  <div style={{ 
                    marginBottom: '4px', 
                    fontSize: '12px', 
                    fontWeight: 500, 
                    color: '#dc2626',
                    ...baseTextStyle
                  }}>
                    {'Vắng'}{` (${stats.absent}):`}
                  </div>
                  <div style={{ fontSize: '12px' }}>
                    {Array.from(groupedByClass.entries())
                      .sort((a, b) => {
                        const gradeA = a[1][0]?.classGrade || 0;
                        const gradeB = b[1][0]?.classGrade || 0;
                        return gradeA - gradeB;
                      })
                      .map(([className, students], idx) => (
                        <div key={className} style={{ marginTop: idx > 0 ? '4px' : 0 }}>
                          <span style={{ fontWeight: 500, color: '#4b5563', ...baseTextStyle }}>{className}{':'}</span>
                          {' '}
                          <span style={{ color: '#374151', ...baseTextStyle }}>
                            {students.map((s, i) => (
                              <span key={s.id}>
                                {s.name}
                                {s.excused && <sup style={{ color: '#ca8a04' }}>{'P'}</sup>}
                                {showMealGroup && s.mealGroup && (
                                  <span style={{ color: '#9ca3af' }}>{`(${s.mealGroup})`}</span>
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
            </>
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
          <h1 style={{ marginTop: '4px', fontSize: '18px', fontWeight: 700, color: '#0284c7', marginBottom: 0, ...baseTextStyle }}>{'THỐNG KÊ BỮA ĂN'}</h1>
          <p style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280', marginBottom: 0, ...baseTextStyle }}>
            {'Ngày '}{format(date, 'EEEE, dd/MM/yyyy', { locale: vi })}
          </p>
        </div>

        {/* Meal sections */}
        <div style={{ marginBottom: '16px' }}>
        {renderMealSection(
            'Bữa sáng',
            <Coffee style={{ width: '16px', height: '16px', color: '#f97316' }} />,
            breakfast,
            true
          )}
          {renderMealSection(
            'Bữa trưa',
            <UtensilsCrossed style={{ width: '16px', height: '16px', color: '#22c55e' }} />,
            lunch,
            true
          )}
          {renderMealSection(
            'Bữa tối',
            <Moon style={{ width: '16px', height: '16px', color: '#6366f1' }} />,
            dinner,
            true
          )}
        </div>

        {/* Rice summary */}
        <div style={{ 
          marginBottom: '16px', 
          borderRadius: '8px', 
          backgroundColor: '#fffbeb', 
          padding: '12px', 
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: '12px', color: '#d97706', ...baseTextStyle }}>{'Tổng lượng gạo (trưa + tối)'}</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#b45309' }}>{totalRice.toFixed(1)}{' kg'}</div>
          <div style={{ fontSize: '12px', color: '#f59e0b', ...baseTextStyle }}>
            {'(Trưa: '}{(lunchRice ?? lunch.present * 0.2).toFixed(1)}{'kg / Tối: '}{(dinnerRice ?? dinner.present * 0.2).toFixed(1)}{'kg)'}
          </div>
          <div style={{ fontSize: '11px', color: '#d97706', marginTop: '4px', ...baseTextStyle }}>
            {'('}{lunch.present}{' suất trưa + '}{dinner.present}{' suất tối) × 0.2kg'}
          </div>
        </div>

        {/* Footer */}
        <div style={{ 
          borderTop: '1px solid #e5e7eb', 
          paddingTop: '12px', 
          textAlign: 'center', 
          fontSize: '12px', 
          color: '#9ca3af' 
        }}>
          <p style={{ margin: 0, ...baseTextStyle }}>{'Người báo cáo: '}{reporter}</p>
          <p style={{ margin: '4px 0 0 0', ...baseTextStyle }}>{'Xuất lúc: '}{format(new Date(), 'HH:mm dd/MM/yyyy', { locale: vi })}</p>
        </div>
      </div>
    );
  }
));

MealReportImageCard.displayName = 'MealReportImageCard';
