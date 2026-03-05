import { forwardRef } from 'react';

interface StatsItem {
  item_name: string;
  unit: string;
  unit_price: number;
  supplier: string;
  totalQty: number;
  totalAmount: number;
}

interface KitchenStatsImageCardProps {
  schoolName: string;
  title: string;
  dateLabel: string;
  type: 'import' | 'export';
  items: StatsItem[];
  total: number;
  reporter?: string;
  reportTime: string;
}

const baseTextStyle: React.CSSProperties = {
  letterSpacing: '0.01em',
  fontKerning: 'normal',
  textRendering: 'geometricPrecision',
  WebkitFontSmoothing: 'antialiased',
};

export const KitchenStatsImageCard = forwardRef<HTMLDivElement, KitchenStatsImageCardProps>(
  ({ schoolName, title, dateLabel, type, items, total, reporter, reportTime }, ref) => {
    const accentColor = type === 'import' ? '#0284c7' : '#dc2626';
    const bgAccent = type === 'import' ? '#f0f9ff' : '#fef2f2';
    const borderAccent = type === 'import' ? '#bae6fd' : '#fecaca';

    const formatCurrency = (n: number) => n.toLocaleString('vi-VN') + 'đ';

    return (
      <div
        ref={ref}
        style={{
          width: '440px',
          backgroundColor: 'white',
          padding: '16px',
          fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
          fontSize: '13px',
          lineHeight: '1.4',
          ...baseTextStyle,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '12px', textAlign: 'center', borderBottom: `2px solid ${accentColor}`, paddingBottom: '10px' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px', ...baseTextStyle }}>{schoolName}</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: accentColor, ...baseTextStyle }}>{title}</div>
          <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px', ...baseTextStyle }}>{dateLabel}</div>
        </div>

        {/* Summary */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          padding: '10px',
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#374151' }}>{items.length}</div>
            <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', ...baseTextStyle }}>Mặt hàng</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#e5e7eb' }} />
          <div style={{ flex: 2, textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: accentColor }}>{formatCurrency(total)}</div>
            <div style={{ fontSize: '10px', color: accentColor, textTransform: 'uppercase', ...baseTextStyle }}>Tổng tiền</div>
          </div>
        </div>

        {/* Items table */}
        {items.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: accentColor,
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              textTransform: 'uppercase',
              ...baseTextStyle,
            }}>
              <span style={{ width: '6px', height: '6px', backgroundColor: accentColor, borderRadius: '50%' }} />
              Chi tiết ({items.length} mặt hàng)
            </div>
            <div style={{
              borderRadius: '6px',
              border: `1px solid ${borderAccent}`,
              backgroundColor: bgAccent,
              overflow: 'hidden',
            }}>
              {/* Table header */}
              <div style={{
                display: 'flex',
                padding: '6px 10px',
                backgroundColor: accentColor,
                color: 'white',
                fontSize: '10px',
                fontWeight: 600,
                ...baseTextStyle,
              }}>
                <div style={{ width: '24px', textAlign: 'center' }}>STT</div>
                <div style={{ flex: 1, paddingLeft: '6px' }}>Tên TP</div>
                <div style={{ width: '60px', paddingLeft: '4px' }}>NCC</div>
                <div style={{ width: '30px', textAlign: 'center' }}>ĐVT</div>
                <div style={{ width: '55px', textAlign: 'right' }}>Đơn giá</div>
                <div style={{ width: '35px', textAlign: 'right' }}>SL</div>
                <div style={{ width: '70px', textAlign: 'right' }}>T.tiền</div>
              </div>
              {/* Table rows */}
              {items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    padding: '4px 10px',
                    fontSize: '10px',
                    borderBottom: idx < items.length - 1 ? `1px solid ${borderAccent}` : 'none',
                    backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.6)',
                    ...baseTextStyle,
                  }}
                >
                  <div style={{ width: '24px', textAlign: 'center', color: '#6b7280' }}>{idx + 1}</div>
                  <div style={{ flex: 1, paddingLeft: '6px', fontWeight: 500 }}>{item.item_name}</div>
                  <div style={{ width: '60px', paddingLeft: '4px', color: '#6b7280', fontSize: '9px' }}>{item.supplier || '-'}</div>
                  <div style={{ width: '30px', textAlign: 'center', color: '#6b7280' }}>{item.unit}</div>
                  <div style={{ width: '55px', textAlign: 'right', color: '#6b7280' }}>{formatCurrency(item.unit_price)}</div>
                  <div style={{ width: '35px', textAlign: 'right' }}>{item.totalQty}</div>
                  <div style={{ width: '70px', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(item.totalAmount)}</div>
                </div>
              ))}
              {/* Total row */}
              <div style={{
                display: 'flex',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: type === 'import' ? '#e0f2fe' : '#fee2e2',
                borderTop: `1px solid ${borderAccent}`,
                ...baseTextStyle,
              }}>
                <div style={{ flex: 1, textAlign: 'right', paddingRight: '8px' }}>TỔNG CỘNG:</div>
                <div style={{ width: '70px', textAlign: 'right', color: accentColor }}>{formatCurrency(total)}</div>
              </div>
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div style={{
            marginBottom: '12px',
            borderRadius: '6px',
            backgroundColor: '#f8fafc',
            padding: '12px',
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '13px',
            ...baseTextStyle,
          }}>
            Không có dữ liệu
          </div>
        )}

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #e5e7eb',
          paddingTop: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#9ca3af',
          ...baseTextStyle,
        }}>
          {reporter && <span>Người xuất: <span style={{ color: '#374151', fontWeight: 500 }}>{reporter}</span></span>}
          <span>{reportTime}</span>
        </div>
      </div>
    );
  }
);

KitchenStatsImageCard.displayName = 'KitchenStatsImageCard';
