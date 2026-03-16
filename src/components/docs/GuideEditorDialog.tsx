import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, X, Image, Video, Clipboard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const handleOpenChange = (open: boolean) => {
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
    onOpenChange(open);
  };

  // Upload a file (shared logic for file input, paste, and drag)
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
    const { data, error } = await supabase.storage
      .from('guide-images')
      .upload(fileName, file);

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

  // Handle paste from clipboard (Ctrl+V)
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await uploadFile(file);
        return;
      }
    }
  }, [uploadFile]);

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await uploadFile(file);
    }
  }, [uploadFile]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập tiêu đề', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const payload = {
      title: title.trim(),
      content: content.trim(),
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onPaste={handlePaste}>
        <DialogHeader>
          <DialogTitle>{section?.id ? 'Sửa mục hướng dẫn' : 'Thêm mục hướng dẫn'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

          <div>
            <Label>Nội dung (hỗ trợ HTML)</Label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Nhập nội dung... Hỗ trợ HTML: <h4>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>"
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Thẻ hỗ trợ: &lt;h4&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;a href="..."&gt;
            </p>
          </div>

          {/* Image upload with paste & drag support */}
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
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
                <iframe
                  src={getYoutubeEmbedUrl(videoUrl)!}
                  className="w-full h-full"
                  allowFullScreen
                  title="Video preview"
                />
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
  );
}
