import { useCallback, useState } from 'react';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';

export function useImageExport() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const captureElement = useCallback(async (element: HTMLElement): Promise<string | null> => {
    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error capturing element:', error);
      return null;
    }
  }, []);

  const downloadImage = useCallback((dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }, []);

  const shareImage = useCallback(async (dataUrl: string, title: string, text: string) => {
    try {
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'report.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          text,
          files: [file],
        });
        return true;
      } else {
        // Fallback: download the image
        downloadImage(dataUrl, `${title}.png`);
        toast({
          title: 'Đã tải ảnh',
          description: 'Trình duyệt không hỗ trợ chia sẻ. Ảnh đã được tải xuống.',
        });
        return false;
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
        // Fallback: download
        downloadImage(dataUrl, `${title}.png`);
      }
      return false;
    }
  }, [downloadImage, toast]);

  const exportAndShare = useCallback(async (
    elementRef: React.RefObject<HTMLElement>,
    title: string,
    description: string,
    mode: 'download' | 'share' = 'share'
  ) => {
    if (!elementRef.current) {
      toast({
        title: 'Lỗi',
        description: 'Không tìm thấy nội dung để xuất',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    try {
      const dataUrl = await captureElement(elementRef.current);
      if (!dataUrl) {
        throw new Error('Không thể chụp ảnh');
      }

      if (mode === 'download') {
        downloadImage(dataUrl, `${title}.png`);
        toast({
          title: 'Đã tải ảnh',
          description: 'Ảnh báo cáo đã được tải xuống',
        });
      } else {
        await shareImage(dataUrl, title, description);
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Lỗi xuất ảnh',
        description: error.message || 'Không thể xuất ảnh báo cáo',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [captureElement, downloadImage, shareImage, toast]);

  return {
    isExporting,
    exportAndShare,
    captureElement,
    downloadImage,
    shareImage,
  };
}
