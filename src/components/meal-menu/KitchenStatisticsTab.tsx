import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useImageExport } from "@/hooks/use-image-export";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon, Download, TrendingUp, TrendingDown, ChevronDown, Share2 } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { ExcelColors, ExcelFonts, ExcelBorders, applyProfessionalStyle, type CellAlign } from "@/lib/excel-styles";
import { KitchenStatsImageCard } from "./KitchenStatsImageCard";

interface KitchenTransaction {
  id: string;
  transaction_date: string;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  transaction_type: string;
  created_by: string | null;
  created_at: string | null;
}

interface Profile {
  id: string;
  full_name: string;
}

interface KitchenStatisticsTabProps {
  schoolId: string;
}

type RangeType = 'day' | 'week' | 'month' | 'custom';

export function KitchenStatisticsTab({ schoolId }: KitchenStatisticsTabProps) {
  const { toast } = useToast();
  const { user, currentSchool } = useAuth();
  const { exportAndShare, isExporting, captureElement, shareImage, downloadImage } = useImageExport();
  const [transactions, setTransactions] = useState<KitchenTransaction[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [rangeType, setRangeType] = useState<RangeType>('day');
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const importImageRef = useRef<HTMLDivElement>(null);
  const exportImageRef = useRef<HTMLDivElement>(null);

  const schoolName = currentSchool?.name || '';

  useEffect(() => {
    const now = new Date();
    if (rangeType === 'day') {
      setFromDate(now);
      setToDate(now);
    } else if (rangeType === 'week') {
      setFromDate(startOfWeek(now, { weekStartsOn: 1 }));
      setToDate(endOfWeek(now, { weekStartsOn: 1 }));
    } else if (rangeType === 'month') {
      setFromDate(startOfMonth(now));
      setToDate(endOfMonth(now));
    }
  }, [rangeType]);

  useEffect(() => {
    fetchTransactions();
  }, [schoolId, fromDate, toDate]);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('kitchen_transactions')
      .select('*')
      .eq('school_id', schoolId)
      .gte('transaction_date', format(fromDate, 'yyyy-MM-dd'))
      .lte('transaction_date', format(toDate, 'yyyy-MM-dd'))
      .order('transaction_date')
      .order('item_name');

    if (data) {
      setTransactions(data as KitchenTransaction[]);
      const creatorIds = [...new Set(data.filter(t => t.created_by).map(t => t.created_by!))];
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', creatorIds);
        if (profilesData) {
          const map = new Map<string, string>();
          profilesData.forEach((p: Profile) => map.set(p.id, p.full_name));
          setProfiles(map);
        }
      }
    }
    setLoading(false);
  };

  const { importStats, exportStats, importTotal, exportTotal } = useMemo(() => {
    const groupBy = (items: KitchenTransaction[]) => {
      const map = new Map<string, { item_name: string; unit: string; totalQty: number; totalAmount: number }>();
      items.forEach(t => {
        const key = `${t.item_name}|${t.unit}`;
        const existing = map.get(key) || { item_name: t.item_name, unit: t.unit, totalQty: 0, totalAmount: 0 };
        existing.totalQty += t.quantity;
        existing.totalAmount += t.quantity * t.unit_price;
        map.set(key, existing);
      });
      return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    };

    const imports = transactions.filter(t => t.transaction_type === 'import');
    const exports = transactions.filter(t => t.transaction_type === 'export');

    return {
      importStats: groupBy(imports),
      exportStats: groupBy(exports),
      importTotal: imports.reduce((s, t) => s + t.quantity * t.unit_price, 0),
      exportTotal: exports.reduce((s, t) => s + t.quantity * t.unit_price, 0),
    };
  }, [transactions]);

  const formatCurrency = (n: number) => n.toLocaleString('vi-VN') + 'đ';

  const dateLabel = rangeType === 'day'
    ? `Ngày ${format(fromDate, 'dd/MM/yyyy')}`
    : `${format(fromDate, 'dd/MM/yyyy')} → ${format(toDate, 'dd/MM/yyyy')}`;

  const currentUserName = user?.id ? profiles.get(user.id) || '' : '';

  const handleExportImage = async (type: 'import' | 'export') => {
    const ref = type === 'import' ? importImageRef : exportImageRef;
    if (!ref.current) return;

    try {
      const dataUrl = await captureElement(ref.current);
      if (!dataUrl) throw new Error('Không thể chụp ảnh');
      const title = `${type === 'import' ? 'Nhap_kho' : 'Xuat_kho'}_${format(fromDate, 'ddMMyyyy')}`;
      const text = `Thống kê ${type === 'import' ? 'nhập kho' : 'xuất kho'} - ${dateLabel}`;
      await shareImage(dataUrl, title, text);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast({ title: 'Lỗi xuất ảnh', description: error.message, variant: 'destructive' });
      }
    }
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rangeLabel = `${format(fromDate, 'dd/MM/yyyy')} - ${format(toDate, 'dd/MM/yyyy')}`;

    // === Sheet 1: Nhập kho ===
    const importHeaders = ['STT', 'Tên thực phẩm', 'ĐVT', 'Tổng SL', 'Tổng tiền'];
    const importData = [
      [`THỐNG KÊ NHẬP KHO`],
      [rangeLabel],
      [],
      importHeaders,
      ...importStats.map((item, idx) => [idx + 1, item.item_name, item.unit, item.totalQty, item.totalAmount]),
      ['', '', '', 'TỔNG:', importTotal],
    ];
    const wsImport = XLSX.utils.aoa_to_sheet(importData);
    wsImport['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 15 }];
    wsImport['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    ];
    const importColAligns: CellAlign[] = ['center', 'left', 'center', 'center', 'right'];
    applyProfessionalStyle(wsImport, {
      headerRowIndex: 3,
      dataStartRow: 4,
      dataRowCount: importStats.length,
      numCols: 5,
      columnAlignments: importColAligns,
      hasTotalsRow: true,
      totalsRowIndex: 4 + importStats.length,
      numTitleRows: 2,
    });
    XLSX.utils.book_append_sheet(wb, wsImport, 'Nhập kho');

    // === Sheet 2: Xuất kho ===
    const exportHeaders = ['STT', 'Tên thực phẩm', 'ĐVT', 'Tổng SL', 'Tổng tiền'];
    const exportData = [
      [`THỐNG KÊ XUẤT KHO`],
      [rangeLabel],
      [],
      exportHeaders,
      ...exportStats.map((item, idx) => [idx + 1, item.item_name, item.unit, item.totalQty, item.totalAmount]),
      ['', '', '', 'TỔNG:', exportTotal],
    ];
    const wsExport = XLSX.utils.aoa_to_sheet(exportData);
    wsExport['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 15 }];
    wsExport['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    ];
    applyProfessionalStyle(wsExport, {
      headerRowIndex: 3,
      dataStartRow: 4,
      dataRowCount: exportStats.length,
      numCols: 5,
      columnAlignments: importColAligns,
      hasTotalsRow: true,
      totalsRowIndex: 4 + exportStats.length,
      numTitleRows: 2,
    });
    XLSX.utils.book_append_sheet(wb, wsExport, 'Xuất kho');

    // === Sheet 3: Chi tiết ===
    const detailHeaders = ['STT', 'Ngày', 'Loại', 'Tên thực phẩm', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền', 'Người nhập', 'Thời gian nhập'];
    const detailData = [
      [`CHI TIẾT GIAO DỊCH`],
      [rangeLabel],
      [],
      detailHeaders,
      ...transactions.map((t, idx) => [
        idx + 1,
        format(new Date(t.transaction_date), 'dd/MM/yyyy'),
        t.transaction_type === 'import' ? 'Nhập' : 'Xuất',
        t.item_name,
        t.unit,
        t.quantity,
        t.unit_price,
        t.quantity * t.unit_price,
        t.created_by ? (profiles.get(t.created_by) || '') : '',
        t.created_at ? format(new Date(t.created_at), 'dd/MM/yyyy HH:mm') : '',
      ]),
    ];
    const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
    wsDetail['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 8 }, { wch: 25 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 18 }];
    wsDetail['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
    ];
    const detailColAligns: CellAlign[] = ['center', 'center', 'center', 'left', 'center', 'center', 'right', 'right', 'left', 'center'];
    applyProfessionalStyle(wsDetail, {
      headerRowIndex: 3,
      dataStartRow: 4,
      dataRowCount: transactions.length,
      numCols: 10,
      columnAlignments: detailColAligns,
      numTitleRows: 2,
    });
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi tiết');

    const fileName = `Thong-ke-kho_${format(fromDate, 'ddMMyyyy')}-${format(toDate, 'ddMMyyyy')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast({ title: "Đã xuất Excel" });
  };

  const StatsTable = ({ data, title, total, icon: Icon, type, isOpen, onToggle }: {
    data: typeof importStats; title: string; total: number; icon: typeof TrendingUp;
    type: 'import' | 'export';
    isOpen: boolean; onToggle: (open: boolean) => void;
  }) => (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-accent/30 transition-colors">
            <CardTitle className="text-base flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {title}
              <Badge variant="secondary" className="ml-auto">{formatCurrency(total)}</Badge>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  disabled={isExporting}
                  onClick={(e) => { e.stopPropagation(); handleExportImage(type); }}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            <div className="px-4 py-2 bg-muted/30 text-sm font-medium border-b">
              {title} - {dateLabel}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">STT</TableHead>
                  <TableHead>Tên thực phẩm</TableHead>
                  <TableHead className="w-16">ĐVT</TableHead>
                  <TableHead className="w-20 text-right">Tổng SL</TableHead>
                  <TableHead className="w-28 text-right">Tổng tiền</TableHead>
                  <TableHead className="w-28">Người nhập</TableHead>
                  <TableHead className="w-32">Thời gian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">Không có dữ liệu</TableCell>
                  </TableRow>
                ) : rangeType === 'day' ? (
                  transactions.filter(t => t.transaction_type === type).map((t, idx) => (
                    <TableRow key={t.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-medium">{t.item_name}</TableCell>
                      <TableCell>{t.unit}</TableCell>
                      <TableCell className="text-right">{t.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(t.quantity * t.unit_price)}</TableCell>
                      <TableCell className="text-xs">{t.created_by ? profiles.get(t.created_by) || '-' : '-'}</TableCell>
                      <TableCell className="text-xs">{t.created_at ? format(new Date(t.created_at), 'HH:mm dd/MM') : '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  data.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">{item.totalQty}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.totalAmount)}</TableCell>
                      <TableCell className="text-xs">-</TableCell>
                      <TableCell className="text-xs">-</TableCell>
                    </TableRow>
                  ))
                )}
                {((rangeType === 'day' ? transactions.filter(t => t.transaction_type === type).length : data.length) > 0) && (
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4} className="text-right">TỔNG:</TableCell>
                    <TableCell className="text-right text-primary">{formatCurrency(total)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={rangeType} onValueChange={(v) => setRangeType(v as RangeType)}>
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Hôm nay</SelectItem>
            <SelectItem value="week">Tuần này</SelectItem>
            <SelectItem value="month">Tháng này</SelectItem>
            <SelectItem value="custom">Tùy chọn</SelectItem>
          </SelectContent>
        </Select>

        {rangeType === 'custom' && (
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  {format(fromDate, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={fromDate} onSelect={(d) => d && setFromDate(d)} locale={vi} /></PopoverContent>
            </Popover>
            <span className="text-sm">→</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  {format(toDate, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate} onSelect={(d) => d && setToDate(d)} locale={vi} /></PopoverContent>
            </Popover>
          </div>
        )}

        <Button size="sm" variant="outline" onClick={exportExcel} className="ml-auto">
          <Download className="h-4 w-4 mr-1" />Xuất Excel
        </Button>
      </div>

      {/* Stats tables with collapsible */}
      <div className="space-y-3">
        <StatsTable
          data={importStats} title="Nhập kho" total={importTotal} icon={TrendingUp}
          type="import" isOpen={importOpen} onToggle={setImportOpen}
        />
        <StatsTable
          data={exportStats} title="Xuất kho" total={exportTotal} icon={TrendingDown}
          type="export" isOpen={exportOpen} onToggle={setExportOpen}
        />
      </div>

      {/* Hidden image cards for export */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <KitchenStatsImageCard
          ref={importImageRef}
          schoolName={schoolName}
          title="THỐNG KÊ NHẬP KHO"
          dateLabel={dateLabel}
          type="import"
          items={importStats}
          total={importTotal}
          reporter={currentUserName}
          reportTime={format(new Date(), 'HH:mm dd/MM/yyyy')}
        />
        <KitchenStatsImageCard
          ref={exportImageRef}
          schoolName={schoolName}
          title="THỐNG KÊ XUẤT KHO"
          dateLabel={dateLabel}
          type="export"
          items={exportStats}
          total={exportTotal}
          reporter={currentUserName}
          reportTime={format(new Date(), 'HH:mm dd/MM/yyyy')}
        />
      </div>
    </div>
  );
}
