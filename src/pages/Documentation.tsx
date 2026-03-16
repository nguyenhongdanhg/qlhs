import { useState, useEffect } from 'react';
import { ArrowLeft, Printer, GraduationCap, Plus, Pencil, Trash2, GripVertical, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GuideEditorDialog } from '@/components/docs/GuideEditorDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface GuideSection {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  display_order: number;
  is_active: boolean;
}

const getYoutubeEmbedUrl = (url: string) => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
};

export default function Documentation() {
  const { toast } = useToast();
  const [sections, setSections] = useState<GuideSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<GuideSection | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchSections = async () => {
    const { data, error } = await supabase
      .from('guide_sections')
      .select('*')
      .order('display_order', { ascending: true });

    if (!error && data) setSections(data);
    setIsLoading(false);
  };

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('global_roles').select('role').eq('user_id', user.id).maybeSingle();
    if (data?.role === 'super_admin') setIsAdmin(true);
    // Also check school admin
    if (!data) {
      const { data: membership } = await supabase
        .from('school_memberships')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (membership) setIsAdmin(true);
    }
  };

  useEffect(() => {
    fetchSections();
    checkAdmin();
  }, []);

  const handleEdit = (section: GuideSection) => {
    setEditingSection(section);
    setEditorOpen(true);
  };

  const handleAdd = () => {
    setEditingSection(null);
    setEditorOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('guide_sections').delete().eq('id', deleteId);
    if (error) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Đã xóa mục' });
      fetchSections();
    }
    setDeleteId(null);
  };

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="print:hidden sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/auth" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Về trang đăng nhập
          </a>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button onClick={handleAdd} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Thêm mục
              </Button>
            )}
            <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
              <Printer className="h-4 w-4" />
              In / Tải PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 print:px-0 print:py-0">
        {/* Cover */}
        <div className="text-center mb-12 print:mb-8 print:pt-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6 print:mb-4">
            <GraduationCap className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3 print:text-3xl">
            QUẢN LÝ NỘI TRÚ / BÁN TRÚ
          </h1>
          <p className="text-lg text-muted-foreground mb-2">
            Ứng dụng thông tin quản lý học sinh
          </p>
          <p className="text-sm text-muted-foreground">
            Tài liệu giới thiệu tổng quan & Hướng dẫn sử dụng
          </p>
        </div>

        <Separator className="mb-10 print:mb-6" />

        {/* Dynamic Sections */}
        {sections.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p>Chưa có nội dung hướng dẫn nào.</p>
            {isAdmin && (
              <Button onClick={handleAdd} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Thêm mục đầu tiên
              </Button>
            )}
          </div>
        )}

        <div className="space-y-10">
          {sections.map((section, idx) => (
            <section key={section.id} className="print:break-inside-avoid relative group">
              {/* Admin controls */}
              {isAdmin && (
                <div className="print:hidden absolute -left-12 top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(section)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(section.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Mobile admin controls */}
              {isAdmin && (
                <div className="print:hidden flex gap-2 mb-2 lg:hidden">
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => handleEdit(section)}>
                    <Pencil className="h-3 w-3" /> Sửa
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs text-destructive" onClick={() => setDeleteId(section.id)}>
                    <Trash2 className="h-3 w-3" /> Xóa
                  </Button>
                </div>
              )}

              <h2 className="text-2xl font-bold text-foreground mb-4">
                {idx + 1}. {section.title}
              </h2>

              {/* HTML Content */}
              <div
                className="prose prose-sm max-w-none text-muted-foreground
                  [&_h4]:text-foreground [&_h4]:font-semibold [&_h4]:mt-4 [&_h4]:mb-2
                  [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
                  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
                  [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: section.content }}
              />

              {/* Image */}
              {section.image_url && (
                <div className="mt-4">
                  <img
                    src={section.image_url}
                    alt={section.title}
                    className="rounded-lg border max-w-full shadow-sm"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Video */}
              {section.video_url && getYoutubeEmbedUrl(section.video_url) && (
                <div className="mt-4 rounded-lg overflow-hidden border aspect-video max-w-xl print:hidden">
                  <iframe
                    src={getYoutubeEmbedUrl(section.video_url)!}
                    className="w-full h-full"
                    allowFullScreen
                    title={section.title}
                  />
                </div>
              )}

              {idx < sections.length - 1 && <Separator className="mt-8" />}
            </section>
          ))}
        </div>

        {/* Footer */}
        <Separator className="mb-6 mt-10" />
        <div className="text-center text-xs text-muted-foreground pb-10 print:pb-4">
          <p className="font-medium text-foreground mb-1">QUẢN LÝ NỘI TRÚ / BÁN TRÚ</p>
          <p>Thiết kế & phát triển bởi Thầy giáo Nguyễn Hồng Dân</p>
          <p>SĐT: 0888 770 699</p>
        </div>
      </div>

      {/* Editor Dialog */}
      <GuideEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        section={editingSection}
        onSaved={fetchSections}
      />

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa mục hướng dẫn?</AlertDialogTitle>
            <AlertDialogDescription>Mục này sẽ bị xóa vĩnh viễn và không thể khôi phục.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
