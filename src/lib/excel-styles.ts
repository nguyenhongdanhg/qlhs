import XLSX from 'xlsx-js-style';

// A4 landscape target width in Excel "character width" units
// A4 = 297mm wide, margins ~15mm each = 267mm usable ≈ 10.5" ≈ ~100 char widths
const A4_LANDSCAPE_TARGET_WIDTH = 100;
// A4 portrait
const A4_PORTRAIT_TARGET_WIDTH = 68;

// Scale column widths to fit within A4 page
export function fitColumnsToA4(
  ws: XLSX.WorkSheet,
  columnWidths: number[],
  landscape: boolean = true
): void {
  const targetWidth = landscape ? A4_LANDSCAPE_TARGET_WIDTH : A4_PORTRAIT_TARGET_WIDTH;
  const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);
  
  let scaledWidths: number[];
  if (totalWidth > targetWidth) {
    // Scale down proportionally, but keep minimum widths for readability
    const scale = targetWidth / totalWidth;
    scaledWidths = columnWidths.map(w => {
      const scaled = Math.round(w * scale * 10) / 10;
      return Math.max(scaled, 3); // minimum 3 chars wide
    });
  } else {
    scaledWidths = columnWidths;
  }
  
  ws['!cols'] = scaledWidths.map(w => ({ wch: w }));
  
  // Set margins and page setup for A4
  ws['!margins'] = {
    left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2,
  };
  
  // Page setup: landscape, fit to 1 page wide, A4 paper
  // @ts-ignore - xlsx-js-style supports these but types may not declare them
  ws['!pageSetup'] = {
    paperSize: 9, // A4
    orientation: landscape ? 'landscape' : 'portrait',
    fitToWidth: 1,
    fitToHeight: 0, // 0 = as many pages tall as needed
    scale: 100,
  };
}

// Professional Excel styling constants
export const ExcelColors = {
  // Header colors
  headerBg: '1565C0',        // Blue header
  headerText: 'FFFFFF',       // White text
  
  // Alternating row colors
  evenRowBg: 'FFFFFF',        // White
  oddRowBg: 'E8F4FD',         // Light blue
  
  // Special cells
  totalsBg: 'FFF3E0',         // Light orange for totals
  warningBg: 'FFCDD2',        // Light red for warnings
  warningText: 'C62828',      // Dark red text
  
  // Title rows
  titleBg: 'FFFFFF',          // White for title
  subtitleBg: 'F5F5F5',       // Light gray for subtitle
};

export const ExcelFonts = {
  title: { bold: true, sz: 14 },
  subtitle: { bold: true, sz: 11 },
  header: { bold: true, sz: 11, color: { rgb: ExcelColors.headerText } },
  cell: { sz: 10 },
  cellBold: { bold: true, sz: 10 },
  totals: { bold: true, sz: 11 },
};

export const ExcelBorders = {
  thin: {
    top: { style: 'thin', color: { rgb: 'BDBDBD' } },
    bottom: { style: 'thin', color: { rgb: 'BDBDBD' } },
    left: { style: 'thin', color: { rgb: 'BDBDBD' } },
    right: { style: 'thin', color: { rgb: 'BDBDBD' } },
  },
};

// Cell alignment types
export type CellAlign = 'left' | 'center' | 'right';

interface CellStyleOptions {
  align?: CellAlign;
  bgColor?: string;
  font?: {
    bold?: boolean;
    sz?: number;
    color?: { rgb: string };
  };
  border?: boolean;
  wrapText?: boolean;
}

// Create a styled cell
export function createStyledCell(value: any, options: CellStyleOptions = {}) {
  const { align = 'left', bgColor, font, border = true, wrapText = false } = options;
  
  const isNumber = typeof value === 'number';
  
  const cell: any = {
    v: value,
    t: isNumber ? 'n' : 's',
    s: {
      alignment: { 
        horizontal: align, 
        vertical: 'center',
        wrapText,
      },
    },
  };
  
  if (bgColor) {
    cell.s.fill = { fgColor: { rgb: bgColor } };
  }
  
  if (font) {
    cell.s.font = font;
  }
  
  if (border) {
    cell.s.border = ExcelBorders.thin;
  }
  
  return cell;
}

// Apply header row style
export function applyHeaderRowStyle(
  ws: XLSX.WorkSheet, 
  rowIndex: number, 
  numCols: number
): void {
  for (let col = 0; col < numCols; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: col });
    if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
    
    ws[cellRef].s = {
      fill: { fgColor: { rgb: ExcelColors.headerBg } },
      font: ExcelFonts.header,
      alignment: { horizontal: 'center', vertical: 'center' },
      border: ExcelBorders.thin,
    };
  }
}

// Apply data row style with alternating colors
export function applyDataRowStyle(
  ws: XLSX.WorkSheet,
  rowIndex: number,
  row: any[],
  rowIdx: number,
  columnAlignments: CellAlign[]
): void {
  const isOddRow = rowIdx % 2 === 1;
  const bgColor = isOddRow ? ExcelColors.oddRowBg : ExcelColors.evenRowBg;
  
  for (let col = 0; col < row.length; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: col });
    const cellValue = row[col];
    const isNumber = typeof cellValue === 'number';
    const isCheckmark = typeof cellValue === 'string' && 
      (cellValue === 'x' || cellValue === 'o' || cellValue === '-' || 
       cellValue.match(/^[xo-]{1,3}$/) || cellValue === '✓' || cellValue === '✗');
    
    if (!ws[cellRef]) {
      ws[cellRef] = { v: cellValue, t: isNumber ? 'n' : 's' };
    }
    
    // Determine alignment
    let align: CellAlign = columnAlignments[col] || 'left';
    
    // Override: numbers and checkmarks always center
    if (isNumber || isCheckmark) {
      align = 'center';
    }
    
    ws[cellRef].s = {
      fill: { fgColor: { rgb: bgColor } },
      font: ExcelFonts.cell,
      alignment: { horizontal: align, vertical: 'center' },
      border: ExcelBorders.thin,
    };
  }
}

// Apply totals row style
export function applyTotalsRowStyle(
  ws: XLSX.WorkSheet,
  rowIndex: number,
  numCols: number,
  columnAlignments: CellAlign[]
): void {
  for (let col = 0; col < numCols; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: col });
    if (!ws[cellRef]) continue;
    
    const cellValue = ws[cellRef].v;
    const isNumber = typeof cellValue === 'number';
    
    // Determine alignment: text left, numbers center
    let align: CellAlign = columnAlignments[col] || 'left';
    if (isNumber) {
      align = 'center';
    }
    
    ws[cellRef].s = {
      fill: { fgColor: { rgb: ExcelColors.totalsBg } },
      font: ExcelFonts.totals,
      alignment: { horizontal: align, vertical: 'center' },
      border: ExcelBorders.thin,
    };
  }
}

// Apply title row styles (merged header info)
export function applyTitleRowsStyle(
  ws: XLSX.WorkSheet,
  numTitleRows: number,
  numCols: number
): void {
  for (let row = 0; row < numTitleRows; row++) {
    const cellRef = XLSX.utils.encode_cell({ r: row, c: 0 });
    if (!ws[cellRef]) continue;
    
    ws[cellRef].s = {
      font: row === 0 ? ExcelFonts.title : ExcelFonts.subtitle,
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }
}

// Apply warning cell style (for absent markers)
export function applyWarningCellStyle(
  ws: XLSX.WorkSheet,
  rowIndex: number,
  colIndex: number
): void {
  const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
  if (!ws[cellRef]) return;
  
  ws[cellRef].s = {
    fill: { fgColor: { rgb: ExcelColors.warningBg } },
    font: { ...ExcelFonts.cell, color: { rgb: ExcelColors.warningText } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: ExcelBorders.thin,
  };
}

// Helper to determine column alignment based on content type
export function getColumnAlignments(headerRow: string[]): CellAlign[] {
  return headerRow.map((header) => {
    const lowerHeader = header.toLowerCase();
    
    // Text columns: left align
    if (
      lowerHeader.includes('họ') || 
      lowerHeader.includes('tên') ||
      lowerHeader.includes('lớp') ||
      lowerHeader.includes('ghi chú') ||
      lowerHeader.includes('lý do') ||
      lowerHeader.includes('người') ||
      lowerHeader.includes('trường') ||
      lowerHeader.includes('mâm') ||
      lowerHeader.includes('phòng')
    ) {
      return 'left';
    }
    
    // Everything else: center (numbers, dates, status, etc.)
    return 'center';
  });
}

// Full professional worksheet styling
export function applyProfessionalStyle(
  ws: XLSX.WorkSheet,
  options: {
    headerRowIndex: number;       // 0-indexed row where table header is
    dataStartRow: number;         // 0-indexed row where data starts
    dataRowCount: number;         // Number of data rows
    numCols: number;              // Total number of columns
    columnAlignments: CellAlign[]; // Alignment for each column
    hasTotalsRow?: boolean;       // Whether there's a totals row after data
    totalsRowIndex?: number;      // 0-indexed row for totals
    numTitleRows?: number;        // Number of title/info rows at top
    mealCellColumns?: number[];   // Columns that contain meal status (x/o/-)
  }
): void {
  const {
    headerRowIndex,
    dataStartRow,
    dataRowCount,
    numCols,
    columnAlignments,
    hasTotalsRow = false,
    totalsRowIndex,
    numTitleRows = 0,
    mealCellColumns = [],
  } = options;
  
  // Apply title rows style
  if (numTitleRows > 0) {
    applyTitleRowsStyle(ws, numTitleRows, numCols);
  }
  
  // Apply header row style
  applyHeaderRowStyle(ws, headerRowIndex, numCols);
  
  // Apply data rows with alternating colors
  for (let rowIdx = 0; rowIdx < dataRowCount; rowIdx++) {
    const actualRow = dataStartRow + rowIdx;
    const isOddRow = rowIdx % 2 === 1;
    const bgColor = isOddRow ? ExcelColors.oddRowBg : ExcelColors.evenRowBg;
    
    for (let col = 0; col < numCols; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: actualRow, c: col });
      if (!ws[cellRef]) continue;
      
      const cellValue = ws[cellRef].v;
      const isNumber = typeof cellValue === 'number';
      const isMealCell = mealCellColumns.includes(col);
      const hasAbsence = isMealCell && typeof cellValue === 'string' && cellValue.includes('o');
      
      // Determine alignment
      let align: CellAlign = columnAlignments[col] || 'left';
      if (isNumber || isMealCell) {
        align = 'center';
      }
      
      if (hasAbsence) {
        // Apply warning style for cells with absences
        ws[cellRef].s = {
          fill: { fgColor: { rgb: ExcelColors.warningBg } },
          font: { ...ExcelFonts.cell, color: { rgb: ExcelColors.warningText } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: ExcelBorders.thin,
        };
      } else {
        ws[cellRef].s = {
          fill: { fgColor: { rgb: bgColor } },
          font: ExcelFonts.cell,
          alignment: { horizontal: align, vertical: 'center' },
          border: ExcelBorders.thin,
        };
      }
    }
  }
  
  // Apply totals row style
  if (hasTotalsRow && totalsRowIndex !== undefined) {
    applyTotalsRowStyle(ws, totalsRowIndex, numCols, columnAlignments);
  }
}
