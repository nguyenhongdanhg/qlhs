import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, X, Image, Video } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Reset form when dialog opens
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Lỗi', description: 'Vui lòng chọn file ảnh', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    const fileName = `${Date.now()}-${file.name}`;
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

  // Convert YouTube URL to embed URL
  const getYoutubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

          {/* Image upload */}
          <div>
            <Label className="flex items-center gap-2"><Image className="h-4 w-4" /> Ảnh minh họa</Label>
            <div className="mt-2 space-y-2">
              {imageUrl && (
                <div className="relative inline-block">
                  <img src={imageUrl} alt="Preview" className="max-h-40 rounded-lg border" />
                  <button
                    onClick={() => setImageUrl(null)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div>
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
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  {isUploading ? 'Đang tải...' : 'Tải ảnh lên'}
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
