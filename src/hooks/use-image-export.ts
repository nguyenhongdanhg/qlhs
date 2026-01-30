import { useCallback, useState } from 'react';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';

export function useImageExport() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const captureElement = useCallback(async (element: HTMLElement): Promise<string | null> => {
    try {
      // Clone the element to avoid modifying the original
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      document.body.appendChild(clone);
      
      // Wait for fonts and layout to settle
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(clone, {
        backgroundColor: '#ffffff',
        scale: 3, // Higher scale for better quality
        useCORS: true,
        logging: false,
        allowTaint: true,
        removeContainer: true,
        // Force pixel-perfect rendering
        imageTimeout: 0,
        onclone: (clonedDoc, clonedElement) => {
          // Ensure all text elements have proper styling and remove overflow clipping
          const allElements = clonedElement.querySelectorAll('*');
          allElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.style) {
              htmlEl.style.fontKerning = 'normal';
              htmlEl.style.textRendering = 'geometricPrecision';
              // Remove any overflow hidden/auto that might clip content
              if (htmlEl.style.overflow === 'hidden' || htmlEl.style.overflow === 'auto' || 
                  htmlEl.style.overflowY === 'auto' || htmlEl.style.overflowX === 'auto') {
                htmlEl.style.overflow = 'visible';
                htmlEl.style.overflowY = 'visible';
                htmlEl.style.overflowX = 'visible';
                htmlEl.style.maxHeight = 'none';
              }
            }
          });
        }
      });
      
      document.body.removeChild(clone);
      return canvas.toDataURL('image/png', 1.0);
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
