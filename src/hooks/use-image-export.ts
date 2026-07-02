import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// html2canvas (~50KB gzip) is dynamically imported on first use so pages that
// simply mount the hook (Boarding, Meals, EveningStudy…) don't pay the cost
// until the user actually presses "Xuất ảnh" / "Chia sẻ".
type Html2Canvas = typeof import('html2canvas').default;
let html2canvasPromise: Promise<Html2Canvas> | null = null;
const loadHtml2Canvas = (): Promise<Html2Canvas> => {
  if (!html2canvasPromise) {
    html2canvasPromise = import('html2canvas').then(m => m.default);
  }
  return html2canvasPromise;
};

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
      
      const html2canvas = await loadHtml2Canvas();
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
              // Force remove ALL overflow clipping - this fixes mobile export issues
              htmlEl.style.overflow = 'visible';
              htmlEl.style.overflowY = 'visible';
              htmlEl.style.overflowX = 'visible';
              htmlEl.style.maxHeight = 'none';
              htmlEl.style.height = 'auto';
              // Ensure text is fully visible
              htmlEl.style.textOverflow = 'unset';
              htmlEl.style.whiteSpace = 'normal';
              htmlEl.style.wordBreak = 'break-word';
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
