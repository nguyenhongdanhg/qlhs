import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Bold, Italic, Heading4, List, ListOrdered, Link, Quote,
  Minus, Table, Code, AlignLeft, Type, Strikethrough
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Props {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
  onOpenIconPicker: () => void;
}

interface ToolbarAction {
  icon: React.ReactNode;
  label: string;
  before: string;
  after: string;
  block?: boolean;
}

export function RichTextToolbar({ textareaRef, value, onChange, onOpenIconPicker }: Props) {
  const insertTag = useCallback((before: string, after: string, block?: boolean) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);
    const prefix = block && start > 0 && value[start - 1] !== '\n' ? '\n' : '';
    const suffix = block && end < value.length && value[end] !== '\n' ? '\n' : '';

    const replacement = `${prefix}${before}${selected || 'nội dung'}${after}${suffix}`;
    const newValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);

    // Restore cursor position
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + prefix.length + before.length;
      const cursorEnd = cursorPos + (selected || 'nội dung').length;
      textarea.setSelectionRange(cursorPos, cursorEnd);
    });
  }, [textareaRef, value, onChange]);

  const actions: (ToolbarAction | 'separator' | 'icon-picker')[] = [
    { icon: <Bold className="h-4 w-4" />, label: 'Đậm', before: '<strong>', after: '</strong>' },
    { icon: <Italic className="h-4 w-4" />, label: 'Nghiêng', before: '<em>', after: '</em>' },
    { icon: <Strikethrough className="h-4 w-4" />, label: 'Gạch ngang', before: '<del>', after: '</del>' },
    'separator',
    { icon: <Heading4 className="h-4 w-4" />, label: 'Tiêu đề H4', before: '<h4>', after: '</h4>', block: true },
    { icon: <Type className="h-4 w-4" />, label: 'Đoạn văn', before: '<p>', after: '</p>', block: true },
    { icon: <Quote className="h-4 w-4" />, label: 'Trích dẫn', before: '<blockquote>', after: '</blockquote>', block: true },
    'separator',
    { icon: <List className="h-4 w-4" />, label: 'Danh sách', before: '<ul>\n  <li>', after: '</li>\n  <li>mục 2</li>\n</ul>', block: true },
    { icon: <ListOrdered className="h-4 w-4" />, label: 'Danh sách số', before: '<ol>\n  <li>', after: '</li>\n  <li>mục 2</li>\n</ol>', block: true },
    'separator',
    { icon: <Link className="h-4 w-4" />, label: 'Liên kết', before: '<a href="https://">', after: '</a>' },
    { icon: <Code className="h-4 w-4" />, label: 'Code', before: '<code>', after: '</code>' },
    { icon: <Minus className="h-4 w-4" />, label: 'Đường kẻ', before: '<hr/>', after: '', block: true },
    { icon: <Table className="h-4 w-4" />, label: 'Bảng', before: '<table class="guide-table">\n  <tr><th>Cột 1</th><th>Cột 2</th></tr>\n  <tr><td>', after: '</td><td>...</td></tr>\n</table>', block: true },
    'separator',
    'icon-picker',
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border rounded-t-md bg-muted/30 border-b-0">
        {actions.map((action, i) => {
          if (action === 'separator') {
            return <Separator key={i} orientation="vertical" className="h-6 mx-1" />;
          }
          if (action === 'icon-picker') {
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onOpenIconPicker}
                  >
                    <span className="text-sm">😀</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Chèn biểu tượng</p></TooltipContent>
              </Tooltip>
            );
          }
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => insertTag(action.before, action.after, action.block)}
                >
                  {action.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>{action.label}</p></TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
