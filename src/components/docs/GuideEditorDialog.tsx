import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, X, Image, Video, Clipboard, Eye, Code } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RichTextToolbar } from './RichTextToolbar';
import { IconPickerDialog } from './IconPickerDialog';
import { WysiwygToolbar } from './WysiwygToolbar';

interface GuideSection {
  id?: string;
  title: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  display_order: number;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: GuideSection | null;
  onSaved: () => void;
}

export function GuideEditorDialog({ open, onOpenChange, section, onSaved }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineImageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wysiwygRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showHtmlSource, setShowHtmlSource] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Track if WYSIWYG content has been initialized
  const wysiwygInitialized = useRef(false);

  useEffect(() => {
    if (open && section) {
      setTitle(section.title);
      setContent(section.content);
      setImageUrl(section.image_url);
      setVideoUrl(section.video_url || '');
      setDisplayOrder(section.display_order);
      setIsActive(section.is_active);
    } else if (open) {
      setTitle('');
      setContent('');
      setImageUrl(null);
      setVideoUrl('');
      setDisplayOrder(0);
      setIsActive(true);
    }
    if (open) {
      setShowHtmlSource(false);
      wysiwygInitialized.current = false;
    }
  }, [open, section]);

  // Initialize WYSIWYG content only once when the editor mounts
  useEffect(() => {
    if (!showHtmlSource && wysiwygRef.current && !wysiwygInitialized.current) {
      wysiwygRef.current.innerHTML = content;
      wysiwygInitialized.current = true;
    }
  }, [showHtmlSource, content]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Lỗi', description: 'Vui lòng chọn file ảnh', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Lỗi', description: 'Ảnh không được vượt quá 5MB', variant: 'destructive' });
      return;
    }
    setIsUploading(true);
    const ext = file.name?.split('.').pop() || 'png';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage.from('guide-images').upload(fileName, file);
    if (error) {
      toast({ title: 'Lỗi upload', description: error.message, variant: 'destructive' });
    } else {
      const { data: urlData } = supabase.storage.from('guide-images').getPublicUrl(data.path);
      setImageUrl(urlData.publicUrl);
      toast({ title: 'Đã tải ảnh lên' });
    }
    setIsUploading(false);
  }, [toast]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadAndGetUrl = useCallback(async (file: File): Promise<string | null> => {
    if (!file.type.startsWith('image/')) return null;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Lỗi', description: 'Ảnh không được vượt quá 5MB', variant: 'destructive' });
      return null;
    }
    const ext = file.name?.split('.').pop() || 'png';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage.from('guide-images').upload(fileName, file);
    if (error) {
      toast({ title: 'Lỗi upload', description: error.message, variant: 'destructive' });
      return null;
    }
    const { data: urlData } = supabase.storage.from('guide-images').getPublicUrl(data.path);
    return urlData.publicUrl;
  }, [toast]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const isInTextarea = textareaRef.current && document.activeElement === textareaRef.current;
    const isInWysiwyg = wysiwygRef.current && wysiwygRef.current.contains(document.activeElement as Node);

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;

        if (isInWysiwyg || isInTextarea) {
          setIsUploading(true);
          const url = await uploadAndGetUrl(file);
          setIsUploading(false);
          if (url) {
            const imgTag = `<img src="${url}" alt="Ảnh minh họa" style="max-width:100%; border-radius:8px; margin:8px 0;" />`;
            if (isInWysiwyg) {
              wysiwygRef.current!.focus();
              document.execCommand('insertHTML', false, imgTag);
            } else if (isInTextarea) {
              const textarea = textareaRef.current!;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const newValue = content.substring(0, start) + imgTag + content.substring(end);
              setContent(newValue);
            }
            toast({ title: 'Đã chèn ảnh vào nội dung' });
          }
        } else {
          await uploadFile(file);
        }
        return;
      }
    }
  }, [uploadFile, content, uploadAndGetUrl, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) await uploadFile(file);
  }, [uploadFile]);

  // Table resize via drag on cell edges
  const handleTableResize = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const td = target.closest('td, th') as HTMLTableCellElement | null;
    if (!td) return;

    const rect = td.getBoundingClientRect();
    const isNearRight = e.clientX > rect.right - 6;
    const isNearBottom = e.clientY > rect.bottom - 6;

    if (!isNearRight && !isNearBottom) return;

    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = td.offsetWidth;
    const startHeight = td.offsetHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (isNearRight) {
        const newWidth = Math.max(30, startWidth + ev.clientX - startX);
        td.style.width = newWidth + 'px';
      }
      if (isNearBottom) {
        const newHeight = Math.max(20, startHeight + ev.clientY - startY);
        td.style.height = newHeight + 'px';
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };

    document.body.style.cursor = isNearRight ? 'col-resize' : 'row-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // Image drag resize
  const handleImageResize = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'IMG') return;
    const img = target as HTMLImageElement;
    const rect = img.getBoundingClientRect();
    const isNearCorner = e.clientX > rect.right - 12 && e.clientY > rect.bottom - 12;
    const isNearRight = e.clientX > rect.right - 8;
    const isNearBottom = e.clientY > rect.bottom - 8;

    if (!isNearCorner && !isNearRight && !isNearBottom) return;

    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = img.offsetWidth;
    const startHeight = img.offsetHeight;
    const ratio = startWidth / startHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (isNearCorner) {
        const dx = ev.clientX - startX;
        const newWidth = Math.max(50, startWidth + dx);
        img.style.width = newWidth + 'px';
        img.style.height = Math.round(newWidth / ratio) + 'px';
      } else if (isNearRight) {
        img.style.width = Math.max(50, startWidth + ev.clientX - startX) + 'px';
      } else if (isNearBottom) {
        img.style.height = Math.max(30, startHeight + ev.clientY - startY) + 'px';
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };

    document.body.style.cursor = isNearCorner ? 'nwse-resize' : isNearRight ? 'ew-resize' : 'ns-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const handleEditorMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    handleTableResize(e);
    handleImageResize(e);
  }, [handleTableResize, handleImageResize]);

  const handleIconSelect = useCallback((emoji: string) => {
    if (!showHtmlSource && wysiwygRef.current) {
      wysiwygRef.current.focus();
      document.execCommand('insertHTML', false, emoji);
      return;
    }
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent(prev => prev + emoji);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = content.substring(0, start) + emoji + content.substring(end);
    setContent(newValue);
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + emoji.length;
      textarea.setSelectionRange(pos, pos);
    });
  }, [content, showHtmlSource]);

  const getWysiwygContent = useCallback(() => {
    return wysiwygRef.current?.innerHTML || content;
  }, [content]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập tiêu đề', variant: 'destructive' });
      return;
    }
    const finalContent = (!showHtmlSource && wysiwygRef.current) ? wysiwygRef.current.innerHTML : content;
    setIsLoading(true);
    const payload = {
      title: title.trim(),
      content: finalContent.trim(),
      image_url: imageUrl || null,
      video_url: videoUrl.trim() || null,
      display_order: displayOrder,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (section?.id) {
      ({ error } = await supabase.from('guide_sections').update(payload).eq('id', section.id));
    } else {
      ({ error } = await supabase.from('guide_sections').insert(payload));
    }
    setIsLoading(false);
    if (error) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: section?.id ? 'Đã cập nhật' : 'Đã thêm mục mới' });
      onSaved();
      onOpenChange(false);
    }
  };

  const getYoutubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onPaste={handlePaste}>
          <DialogHeader>
            <DialogTitle>{section?.id ? 'Sửa mục hướng dẫn' : 'Thêm mục hướng dẫn'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title & Order */}
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div>
                <Label>Tiêu đề</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tiêu đề mục" />
              </div>
              <div>
                <Label>Thứ tự</Label>
                <Input type="number" value={displayOrder} onChange={e => setDisplayOrder(Number(e.target.value))} />
              </div>
            </div>

            {/* Content with Toolbar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>{showHtmlSource ? 'Nội dung (HTML)' : 'Nội dung'}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 h-7 text-xs"
                  onClick={() => {
                    if (!showHtmlSource && wysiwygRef.current) {
                      // Sync WYSIWYG → content state before switching to HTML
                      setContent(wysiwygRef.current.innerHTML);
                    }
                    wysiwygInitialized.current = false;
                    setShowHtmlSource(!showHtmlSource);
                  }}
                >
                  {showHtmlSource ? <Eye className="h-3 w-3" /> : <Code className="h-3 w-3" />}
                  {showHtmlSource ? 'Xem trước' : 'Sửa HTML'}
                </Button>
              </div>

              {showHtmlSource ? (
                <>
                  <RichTextToolbar
                    textareaRef={textareaRef as React.RefObject<HTMLTextAreaElement>}
                    value={content}
                    onChange={setContent}
                    onOpenIconPicker={() => setIconPickerOpen(true)}
                    onInsertImage={() => inlineImageInputRef.current?.click()}
                  />
                  <Textarea
                    ref={textareaRef}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Nhập nội dung HTML..."
                    rows={14}
                    className="font-mono text-sm rounded-t-none border-t-0"
                  />
                </>
              ) : (
                <>
                  <WysiwygToolbar
                    editorRef={wysiwygRef as React.RefObject<HTMLDivElement>}
                    onOpenIconPicker={() => setIconPickerOpen(true)}
                    onInsertImage={() => inlineImageInputRef.current?.click()}
                  />
                  <div
                    ref={wysiwygRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="min-h-[250px] p-4 border rounded-b-md bg-background prose prose-sm max-w-none text-foreground border-t-0
                      [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                      [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
                      [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2
                      [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-2
                      [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
                      [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
                      [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline
                      [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic
                      [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                      [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded [&_pre]:text-xs [&_pre]:overflow-x-auto
                      [&_hr]:my-4 [&_hr]:border-border
                      [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted [&_td]:border [&_td]:border-border [&_td]:p-2
                      [&_del]:line-through [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2
                      [&_img]:cursor-se-resize
                      focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-text
                      wysiwyg-table-resize"
                    onMouseDown={handleEditorMouseDown}
                  />
                </>
              )}
            </div>

            {/* Image upload */}
            <div>
              <Label className="flex items-center gap-2"><Image className="h-4 w-4" /> Ảnh minh họa</Label>
              <div
                ref={dropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`mt-2 rounded-lg border-2 border-dashed p-4 transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
              >
                {imageUrl ? (
                  <div className="relative inline-block">
                    <img src={imageUrl} alt="Preview" className="max-h-48 rounded-lg border" />
                    <button
                      onClick={() => setImageUrl(null)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Đang tải ảnh...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-3">
                          <Clipboard className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Ctrl+V để dán ảnh</span>
                        </div>
                        <p className="text-xs text-muted-foreground">hoặc kéo thả ảnh vào đây</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <input ref={inlineImageInputRef} type="file" accept="image/*" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsUploading(true);
                    const url = await uploadAndGetUrl(file);
                    setIsUploading(false);
                    if (url) {
                      const imgTag = `<img src="${url}" alt="Ảnh minh họa" style="max-width:100%; border-radius:8px; margin:8px 0;" />`;
                      if (!showHtmlSource && wysiwygRef.current) {
                        wysiwygRef.current.focus();
                        document.execCommand('insertHTML', false, imgTag);
                      } else {
                        const textarea = textareaRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const newValue = content.substring(0, start) + imgTag + content.substring(end);
                          setContent(newValue);
                        } else {
                          setContent(prev => prev + imgTag);
                        }
                      }
                      toast({ title: 'Đã chèn ảnh vào nội dung' });
                    }
                    if (inlineImageInputRef.current) inlineImageInputRef.current.value = '';
                  }} className="hidden" />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    <Upload className="h-4 w-4 mr-2" />
                    Chọn file ảnh
                  </Button>
                </div>
              </div>
            </div>

            {/* Video URL */}
            <div>
              <Label className="flex items-center gap-2"><Video className="h-4 w-4" /> Link video hướng dẫn (YouTube)</Label>
              <Input
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... hoặc https://youtu.be/..."
                className="mt-2"
              />
              {videoUrl && getYoutubeEmbedUrl(videoUrl) && (
                <div className="mt-2 rounded-lg overflow-hidden border aspect-video">
                  <iframe src={getYoutubeEmbedUrl(videoUrl)!} className="w-full h-full" allowFullScreen title="Video preview" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Hiển thị mục này</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {section?.id ? 'Cập nhật' : 'Thêm mới'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <IconPickerDialog
        open={iconPickerOpen}
        onOpenChange={setIconPickerOpen}
        onSelect={handleIconSelect}
      />
    </>
  );
}
