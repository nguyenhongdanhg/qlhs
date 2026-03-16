import { useCallback, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link, Quote, Minus, Table, Code, Type, ImagePlus, Undo2, Redo2,
  Columns2, Columns3, Palette, Highlighter, Subscript, Superscript, RemoveFormatting,
  ChevronDown
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

export function WysiwygToolbar({ editorRef, onOpenIconPicker, onInsertImage }: Props) {
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkOpen, setLinkOpen] = useState(false);

  const exec = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
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
    editor.focus();
    let html = '<table class="guide-table" style="width:100%;border-collapse:collapse;margin:8px 0;">';
    html += '<tr>';
    for (let c = 0; c < cols; c++) html += `<th style="border:1px solid #d1d5db;padding:8px;background:#f3f4f6;">Cột ${c + 1}</th>`;
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
    editor.focus();
    const width = Math.floor(100 / numCols);
    let html = '<div style="display:flex;gap:16px;margin:8px 0;">';
    for (let i = 0; i < numCols; i++) {
      html += `<div style="flex:1;min-width:0;border:1px dashed #d1d5db;padding:12px;border-radius:6px;">Cột ${i + 1}</div>`;
    }
    html += '</div><p><br></p>';
    document.execCommand('insertHTML', false, html);
  }, [editorRef]);

  const ToolBtn = ({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-7 w-7 ${active ? 'bg-accent text-accent-foreground' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); onClick(); }}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onMouseDown={(e) => e.preventDefault()}>
                  <Type className="h-3.5 w-3.5" />
                  Kiểu
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Kiểu đoạn</p></TooltipContent>
          </Tooltip>
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

        {/* Font size selector */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onMouseDown={(e) => e.preventDefault()}>
                  Cỡ
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Cỡ chữ</p></TooltipContent>
          </Tooltip>
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
        <ToolBtn icon={<Bold className="h-3.5 w-3.5" />} label="Đậm (Ctrl+B)" onClick={() => exec('bold')} />
        <ToolBtn icon={<Italic className="h-3.5 w-3.5" />} label="Nghiêng (Ctrl+I)" onClick={() => exec('italic')} />
        <ToolBtn icon={<Underline className="h-3.5 w-3.5" />} label="Gạch chân (Ctrl+U)" onClick={() => exec('underline')} />
        <ToolBtn icon={<Strikethrough className="h-3.5 w-3.5" />} label="Gạch ngang" onClick={() => exec('strikeThrough')} />
        <ToolBtn icon={<Subscript className="h-3.5 w-3.5" />} label="Chỉ số dưới" onClick={() => exec('subscript')} />
        <ToolBtn icon={<Superscript className="h-3.5 w-3.5" />} label="Chỉ số trên" onClick={() => exec('superscript')} />

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Text color */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={(e) => e.preventDefault()}>
                  <Palette className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Màu chữ</p></TooltipContent>
          </Tooltip>
          <PopoverContent className="w-auto p-2" align="start">
            <p className="text-xs font-medium mb-1 text-muted-foreground">Màu chữ</p>
            <ColorGrid colors={TEXT_COLORS} onSelect={(c) => exec('foreColor', c)} />
          </PopoverContent>
        </Popover>

        {/* Background color */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={(e) => e.preventDefault()}>
                  <Highlighter className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Tô nền chữ</p></TooltipContent>
          </Tooltip>
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
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={(e) => e.preventDefault()}>
                  <Link className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Chèn liên kết</p></TooltipContent>
          </Tooltip>
          <PopoverContent className="w-72 p-2" align="start">
            <p className="text-xs font-medium mb-1 text-muted-foreground">URL liên kết</p>
            <div className="flex gap-1">
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="h-7 text-xs"
                onKeyDown={(e) => { if (e.key === 'Enter') insertLink(); }}
              />
              <Button size="sm" className="h-7 text-xs px-2" onClick={insertLink}>OK</Button>
            </div>
          </PopoverContent>
        </Popover>

        <ToolBtn icon={<Minus className="h-3.5 w-3.5" />} label="Đường kẻ ngang" onClick={() => exec('insertHorizontalRule')} />

        {/* Table */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={(e) => e.preventDefault()}>
                  <Table className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Chèn bảng</p></TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs">Chèn bảng</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => insertTable(2, 2)}>2 × 2</DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => insertTable(3, 3)}>3 × 3</DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => insertTable(4, 4)}>4 × 4</DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => insertTable(3, 5)}>3 × 5</DropdownMenuItem>
            <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onClick={() => insertTable(5, 3)}>5 × 3</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Columns */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={(e) => e.preventDefault()}>
                  <Columns2 className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Chèn cột</p></TooltipContent>
          </Tooltip>
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

        {/* Icon picker */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={(e) => { e.preventDefault(); onOpenIconPicker(); }}>
              <span className="text-sm">😀</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p>Chèn biểu tượng</p></TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Remove formatting */}
        <ToolBtn icon={<RemoveFormatting className="h-3.5 w-3.5" />} label="Xóa định dạng" onClick={() => exec('removeFormat')} />
      </div>
    </TooltipProvider>
  );
}
