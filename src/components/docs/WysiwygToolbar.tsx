import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link, Quote, Minus, Table, Code, Type, ImagePlus, Undo2, Redo2,
  Columns2, Columns3, Palette, Highlighter, Subscript, Superscript, RemoveFormatting,
  ChevronDown, Trash2, Plus, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Maximize
} from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  editorRef: React.RefObject<HTMLDivElement>;
  onOpenIconPicker: () => void;
  onInsertImage: () => void;
}

const FONT_SIZES = [
  { label: '10px', value: '1' },
  { label: '12px', value: '2' },
  { label: '14px', value: '3' },
  { label: '16px', value: '4' },
  { label: '20px', value: '5' },
  { label: '24px', value: '6' },
  { label: '32px', value: '7' },
];

const HEADINGS = [
  { label: 'Đoạn văn', tag: 'p' },
  { label: 'Tiêu đề 1', tag: 'h1' },
  { label: 'Tiêu đề 2', tag: 'h2' },
  { label: 'Tiêu đề 3', tag: 'h3' },
  { label: 'Tiêu đề 4', tag: 'h4' },
];

const TEXT_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f43f5e',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0d9488',
  '#2563eb', '#4f46e5', '#9333ea', '#db2777', '#e11d48',
];

const BG_COLORS = [
  'transparent', '#fef3c7', '#fce7f3', '#dbeafe', '#d1fae5',
  '#fde68a', '#fbcfe8', '#bfdbfe', '#a7f3d0', '#fed7aa',
  '#fecaca', '#e9d5ff', '#c7d2fe', '#ccfbf1', '#f5f5f4',
];

// Save and restore selection across toolbar interactions
let savedSelection: Range | null = null;

function saveSelection(editor: HTMLDivElement) {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedSelection = range.cloneRange();
    }
  }
}

function restoreSelection(editor: HTMLDivElement) {
  if (savedSelection) {
    editor.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(savedSelection);
    }
  } else {
    editor.focus();
  }
}

export function WysiwygToolbar({ editorRef, onOpenIconPicker, onInsertImage }: Props) {
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkOpen, setLinkOpen] = useState(false);
  const [tableSizeOpen, setTableSizeOpen] = useState(false);
  const [customTableRows, setCustomTableRows] = useState(3);
  const [customTableCols, setCustomTableCols] = useState(3);
  const [imgResizeOpen, setImgResizeOpen] = useState(false);
  const [imgWidth, setImgWidth] = useState('');
  const [imgHeight, setImgHeight] = useState('');

  const exec = useCallback((command: string, value?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    restoreSelection(editor);
    document.execCommand(command, false, value);
    // Save new selection after command
    saveSelection(editor);
  }, [editorRef]);

  // Save selection when user interacts with toolbar
  const onToolbarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (editorRef.current) saveSelection(editorRef.current);
  }, [editorRef]);

  const insertLink = useCallback(() => {
    if (linkUrl && linkUrl !== 'https://') {
      exec('createLink', linkUrl);
      setLinkUrl('https://');
      setLinkOpen(false);
    }
  }, [linkUrl, exec]);

  const insertTable = useCallback((rows: number, cols: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    restoreSelection(editor);
    let html = '<table style="width:100%;border-collapse:collapse;margin:8px 0;"><tr>';
    for (let c = 0; c < cols; c++) html += `<th style="border:1px solid #d1d5db;padding:8px;background:#f3f4f6;text-align:center;">Cột ${c + 1}</th>`;
    html += '</tr>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) html += '<td style="border:1px solid #d1d5db;padding:8px;">&nbsp;</td>';
      html += '</tr>';
    }
    html += '</table><p><br></p>';
    document.execCommand('insertHTML', false, html);
  }, [editorRef]);

  const insertColumns = useCallback((numCols: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    restoreSelection(editor);
    const width = Math.floor(100 / numCols);
    let html = '<div style="display:flex;gap:16px;margin:8px 0;">';
    for (let i = 0; i < numCols; i++) {
      html += `<div style="flex:1;min-width:0;border:1px dashed #d1d5db;padding:12px;border-radius:6px;">Cột ${i + 1}</div>`;
    }
    html += '</div><p><br></p>';
    document.execCommand('insertHTML', false, html);
  }, [editorRef]);

  // --- Table row/col operations ---
  const getSelectedCell = useCallback((): HTMLTableCellElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLTableCellElement) return node;
      node = node.parentNode;
    }
    return null;
  }, [editorRef]);

  const getSelectedTable = useCallback((): HTMLTableElement | null => {
    const cell = getSelectedCell();
    return cell?.closest('table') || null;
  }, [getSelectedCell]);

  const addRowAbove = useCallback(() => {
    const cell = getSelectedCell();
    if (!cell) return;
    const row = cell.closest('tr');
    if (!row) return;
    const newRow = row.cloneNode(true) as HTMLTableRowElement;
    newRow.querySelectorAll('td, th').forEach(c => { (c as HTMLElement).innerHTML = '&nbsp;'; });
    row.parentNode?.insertBefore(newRow, row);
  }, [getSelectedCell]);

  const addRowBelow = useCallback(() => {
    const cell = getSelectedCell();
    if (!cell) return;
    const row = cell.closest('tr');
    if (!row) return;
    const newRow = row.cloneNode(true) as HTMLTableRowElement;
    newRow.querySelectorAll('td, th').forEach(c => { (c as HTMLElement).innerHTML = '&nbsp;'; });
    row.parentNode?.insertBefore(newRow, row.nextSibling);
  }, [getSelectedCell]);

  const addColLeft = useCallback(() => {
    const cell = getSelectedCell();
    if (!cell) return;
    const table = cell.closest('table');
    if (!table) return;
    const colIdx = cell.cellIndex;
    table.querySelectorAll('tr').forEach(row => {
      const ref = row.cells[colIdx];
      if (ref) {
        const newCell = ref.cloneNode(false) as HTMLTableCellElement;
        newCell.innerHTML = '&nbsp;';
        newCell.style.cssText = ref.style.cssText;
        row.insertBefore(newCell, ref);
      }
    });
  }, [getSelectedCell]);

  const addColRight = useCallback(() => {
    const cell = getSelectedCell();
    if (!cell) return;
    const table = cell.closest('table');
    if (!table) return;
    const colIdx = cell.cellIndex;
    table.querySelectorAll('tr').forEach(row => {
      const ref = row.cells[colIdx];
      if (ref) {
        const newCell = ref.cloneNode(false) as HTMLTableCellElement;
        newCell.innerHTML = '&nbsp;';
        newCell.style.cssText = ref.style.cssText;
        row.insertBefore(newCell, ref.nextSibling);
      }
    });
  }, [getSelectedCell]);

  const deleteRow = useCallback(() => {
    const cell = getSelectedCell();
    if (!cell) return;
    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (!row || !table) return;
    if (table.rows.length <= 1) {
      table.remove();
    } else {
      row.remove();
    }
  }, [getSelectedCell]);

  const deleteCol = useCallback(() => {
    const cell = getSelectedCell();
    if (!cell) return;
    const table = cell.closest('table');
    if (!table) return;
    const colIdx = cell.cellIndex;
    if (table.rows[0]?.cells.length <= 1) {
      table.remove();
    } else {
      table.querySelectorAll('tr').forEach(row => {
        if (row.cells[colIdx]) row.deleteCell(colIdx);
      });
    }
  }, [getSelectedCell]);

  const deleteTable = useCallback(() => {
    const table = getSelectedTable();
    if (table) table.remove();
  }, [getSelectedTable]);

  // Table cell alignment
  const setCellAlign = useCallback((align: string) => {
    const cell = getSelectedCell();
    if (cell) {
      cell.style.textAlign = align;
    }
  }, [getSelectedCell]);

  const setCellVerticalAlign = useCallback((valign: string) => {
    const cell = getSelectedCell();
    if (cell) {
      cell.style.verticalAlign = valign;
    }
  }, [getSelectedCell]);

  // Image resize
  const getSelectedImage = useCallback((): HTMLImageElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    // Check if selection contains an image
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    if (container instanceof HTMLImageElement) return container;
    // Check if the selected node is an image
    if (container.nodeType === Node.ELEMENT_NODE) {
      const el = container as HTMLElement;
      const img = el.querySelector('img');
      if (img) return img;
    }
    // Check parent
    let node: Node | null = container;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLImageElement) return node;
      const parent = node.parentElement;
      if (parent) {
        const img = parent.querySelector('img');
        if (img && parent.contains(img)) return img;
      }
      node = node.parentNode;
    }
    return null;
  }, [editorRef]);

  const applyImageSize = useCallback(() => {
    const img = getSelectedImage();
    if (!img) return;
    if (imgWidth) img.style.width = imgWidth.includes('%') || imgWidth.includes('px') ? imgWidth : imgWidth + 'px';
    if (imgHeight) img.style.height = imgHeight.includes('%') || imgHeight.includes('px') ? imgHeight : imgHeight + 'px';
    setImgResizeOpen(false);
  }, [getSelectedImage, imgWidth, imgHeight]);

  // Insert special elements
  const insertCallout = useCallback((type: 'info' | 'warning' | 'success') => {
    const editor = editorRef.current;
    if (!editor) return;
    restoreSelection(editor);
    const colors = { info: '#dbeafe', warning: '#fef3c7', success: '#d1fae5' };
    const icons = { info: 'ℹ️', warning: '⚠️', success: '✅' };
    const html = `<div style="background:${colors[type]};padding:12px 16px;border-radius:8px;margin:8px 0;">${icons[type]} Nội dung ghi chú</div><p><br></p>`;
    document.execCommand('insertHTML', false, html);
  }, [editorRef]);

  const ToolBtn = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => { onToolbarMouseDown(e); onClick(); }}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom"><p>{label}</p></TooltipContent>
    </Tooltip>
  );

  const ColorGrid = ({ colors, onSelect }: { colors: string[]; onSelect: (c: string) => void }) => (
    <div className="grid grid-cols-5 gap-1">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
          style={{ background: color === 'transparent' ? 'repeating-conic-gradient(#d1d5db 0% 25%, transparent 0% 50%) 50% / 8px 8px' : color }}
          onMouseDown={(e) => { e.preventDefault(); onSelect(color); }}
        />
      ))}
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border rounded-t-md bg-muted/30 border-b-0">
        {/* Undo/Redo */}
        <ToolBtn icon={<Undo2 className="h-3.5 w-3.5" />} label="Hoàn tác" onClick={() => exec('undo')} />
        <ToolBtn icon={<Redo2 className="h-3.5 w-3.5" />} label="Làm lại" onClick={() => exec('redo')} />

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Heading selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onMouseDown={onToolbarMouseDown}>
              <Type className="h-3.5 w-3.5" /> Kiểu <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {HEADINGS.map((h) => (
              <DropdownMenuItem key={h.tag} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('formatBlock', `<${h.tag}>`)}>
                <span className={h.tag === 'p' ? 'text-sm' : h.tag === 'h1' ? 'text-xl font-bold' : h.tag === 'h2' ? 'text-lg font-bold' : h.tag === 'h3' ? 'text-base font-semibold' : 'text-sm font-semibold'}>
                  {h.label}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Font size */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onMouseDown={onToolbarMouseDown}>
              Cỡ <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {FONT_SIZES.map((s) => (
              <DropdownMenuItem key={s.value} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('fontSize', s.value)}>
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Text formatting */}
        <ToolBtn icon={<Bold className="h-3.5 w-3.5" />} label="Đậm" onClick={() => exec('bold')} />
        <ToolBtn icon={<Italic className="h-3.5 w-3.5" />} label="Nghiêng" onClick={() => exec('italic')} />
        <ToolBtn icon={<Underline className="h-3.5 w-3.5" />} label="Gạch chân" onClick={() => exec('underline')} />
        <ToolBtn icon={<Strikethrough className="h-3.5 w-3.5" />} label="Gạch ngang" onClick={() => exec('strikeThrough')} />
        <ToolBtn icon={<Subscript className="h-3.5 w-3.5" />} label="Chỉ số dưới" onClick={() => exec('subscript')} />
        <ToolBtn icon={<Superscript className="h-3.5 w-3.5" />} label="Chỉ số trên" onClick={() => exec('superscript')} />

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Text color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={onToolbarMouseDown}>
              <Palette className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <p className="text-xs font-medium mb-1 text-muted-foreground">Màu chữ</p>
            <ColorGrid colors={TEXT_COLORS} onSelect={(c) => exec('foreColor', c)} />
          </PopoverContent>
        </Popover>

        {/* BG color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={onToolbarMouseDown}>
              <Highlighter className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <p className="text-xs font-medium mb-1 text-muted-foreground">Màu nền</p>
            <ColorGrid colors={BG_COLORS} onSelect={(c) => exec('hiliteColor', c)} />
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Alignment */}
        <ToolBtn icon={<AlignLeft className="h-3.5 w-3.5" />} label="Căn trái" onClick={() => exec('justifyLeft')} />
        <ToolBtn icon={<AlignCenter className="h-3.5 w-3.5" />} label="Căn giữa" onClick={() => exec('justifyCenter')} />
        <ToolBtn icon={<AlignRight className="h-3.5 w-3.5" />} label="Căn phải" onClick={() => exec('justifyRight')} />
        <ToolBtn icon={<AlignJustify className="h-3.5 w-3.5" />} label="Căn đều" onClick={() => exec('justifyFull')} />

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Lists */}
        <ToolBtn icon={<List className="h-3.5 w-3.5" />} label="Danh sách" onClick={() => exec('insertUnorderedList')} />
        <ToolBtn icon={<ListOrdered className="h-3.5 w-3.5" />} label="Danh sách số" onClick={() => exec('insertOrderedList')} />
        <ToolBtn icon={<Quote className="h-3.5 w-3.5" />} label="Trích dẫn" onClick={() => exec('formatBlock', '<blockquote>')} />
        <ToolBtn icon={<Code className="h-3.5 w-3.5" />} label="Code" onClick={() => exec('formatBlock', '<pre>')} />

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Link */}
        <Popover open={linkOpen} onOpenChange={(o) => { if (o && editorRef.current) saveSelection(editorRef.current); setLinkOpen(o); }}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={onToolbarMouseDown}>
              <Link className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <p className="text-xs font-medium mb-1 text-muted-foreground">URL liên kết</p>
            <div className="flex gap-1">
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className="h-7 text-xs"
                onKeyDown={(e) => { if (e.key === 'Enter') insertLink(); }} />
              <Button size="sm" className="h-7 text-xs px-2" onClick={insertLink}>OK</Button>
            </div>
          </PopoverContent>
        </Popover>

        <ToolBtn icon={<Minus className="h-3.5 w-3.5" />} label="Đường kẻ ngang" onClick={() => exec('insertHorizontalRule')} />

        {/* Table insert */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={onToolbarMouseDown}>
              <Table className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs">Chèn bảng</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => insertTable(2, 2)}>2 × 2</DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => insertTable(3, 3)}>3 × 3</DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => insertTable(4, 4)}>4 × 4</DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => insertTable(3, 5)}>3 × 5</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => setTableSizeOpen(true)}>
              Tùy chỉnh...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Table edit operations */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-xs gap-0.5" onMouseDown={onToolbarMouseDown}>
              <Trash2 className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-xs">Thêm dòng/cột</DropdownMenuLabel>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={addRowAbove}>
              <ArrowUp className="h-4 w-4 mr-2" /> Thêm dòng phía trên
            </DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={addRowBelow}>
              <ArrowDown className="h-4 w-4 mr-2" /> Thêm dòng phía dưới
            </DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={addColLeft}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Thêm cột bên trái
            </DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={addColRight}>
              <ArrowRight className="h-4 w-4 mr-2" /> Thêm cột bên phải
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Xóa</DropdownMenuLabel>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={deleteRow} className="text-destructive">
              <Minus className="h-4 w-4 mr-2" /> Xóa dòng
            </DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={deleteCol} className="text-destructive">
              <Minus className="h-4 w-4 mr-2" /> Xóa cột
            </DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={deleteTable} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Xóa bảng
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Căn ô</DropdownMenuLabel>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => setCellAlign('left')}>
              <AlignLeft className="h-4 w-4 mr-2" /> Căn trái
            </DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => setCellAlign('center')}>
              <AlignCenter className="h-4 w-4 mr-2" /> Căn giữa
            </DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => setCellAlign('right')}>
              <AlignRight className="h-4 w-4 mr-2" /> Căn phải
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Căn dọc ô</DropdownMenuLabel>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => setCellVerticalAlign('top')}>
              ↑ Trên
            </DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => setCellVerticalAlign('middle')}>
              ↕ Giữa
            </DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => setCellVerticalAlign('bottom')}>
              ↓ Dưới
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Columns */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={onToolbarMouseDown}>
              <Columns2 className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs">Bố cục cột</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => insertColumns(2)}>
              <Columns2 className="h-4 w-4 mr-2" /> 2 cột
            </DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => insertColumns(3)}>
              <Columns3 className="h-4 w-4 mr-2" /> 3 cột
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Image */}
        <ToolBtn icon={<ImagePlus className="h-3.5 w-3.5" />} label="Chèn ảnh" onClick={onInsertImage} />

        {/* Image resize */}
        <Popover open={imgResizeOpen} onOpenChange={(o) => { if (o && editorRef.current) saveSelection(editorRef.current); setImgResizeOpen(o); }}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={onToolbarMouseDown}>
              <Maximize className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Kích thước ảnh (chọn ảnh trước)</p>
            <div className="flex gap-2 mb-2">
              <div>
                <Label className="text-xs">Rộng</Label>
                <Input value={imgWidth} onChange={e => setImgWidth(e.target.value)} placeholder="200px / 50%" className="h-7 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Cao</Label>
                <Input value={imgHeight} onChange={e => setImgHeight(e.target.value)} placeholder="auto" className="h-7 text-xs" />
              </div>
            </div>
            <Button size="sm" className="w-full h-7 text-xs" onClick={applyImageSize}>Áp dụng</Button>
          </PopoverContent>
        </Popover>

        {/* Icon picker */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={(e) => { onToolbarMouseDown(e); onOpenIconPicker(); }}>
              <span className="text-sm">😀</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p>Chèn biểu tượng</p></TooltipContent>
        </Tooltip>

        {/* Insert special blocks */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onMouseDown={onToolbarMouseDown}>
              <Plus className="h-3.5 w-3.5" /> Chèn <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => insertCallout('info')}>
              ℹ️ Khung thông tin
            </DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => insertCallout('warning')}>
              ⚠️ Khung cảnh báo
            </DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => insertCallout('success')}>
              ✅ Khung thành công
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => {
              if (editorRef.current) { restoreSelection(editorRef.current); document.execCommand('insertHTML', false, '<br/>'); }
            }}>
              ↵ Xuống dòng
            </DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => {
              if (editorRef.current) { restoreSelection(editorRef.current); document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;'); }
            }}>
              ⇥ Thụt đầu dòng
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Remove formatting */}
        <ToolBtn icon={<RemoveFormatting className="h-3.5 w-3.5" />} label="Xóa định dạng" onClick={() => exec('removeFormat')} />
      </div>

      {/* Custom table size dialog */}
      {tableSizeOpen && (
        <div className="flex items-center gap-2 p-2 border border-t-0 rounded-b-none bg-muted/20">
          <Label className="text-xs">Dòng:</Label>
          <Input type="number" min={1} max={20} value={customTableRows} onChange={e => setCustomTableRows(Number(e.target.value))} className="h-7 w-16 text-xs" />
          <Label className="text-xs">Cột:</Label>
          <Input type="number" min={1} max={10} value={customTableCols} onChange={e => setCustomTableCols(Number(e.target.value))} className="h-7 w-16 text-xs" />
          <Button size="sm" className="h-7 text-xs" onClick={() => { insertTable(customTableRows, customTableCols); setTableSizeOpen(false); }}>Chèn</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setTableSizeOpen(false)}>Hủy</Button>
        </div>
      )}
    </TooltipProvider>
  );
}
