import { useRef, memo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Share2, Loader2, Image } from 'lucide-react';
import { useImageExport } from '@/hooks/use-image-export';

// Import normally - the component is already memoized
import { MealReportImageCard } from './MealReportImageCard';
import { format } from 'date-fns';

interface AbsentStudent {
  id: string;
  name: string;
  className: string;
  classGrade: number;
  excused: boolean;
  reason: string;
  mealGroup?: string;
}

interface MealStats {
  total: number;
  present: number;
  absent: number;
  absentStudents: AbsentStudent[];
  hasReport: boolean;
}

interface ShareMealReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolName: string;
  date: Date;
  reporter: string;
  breakfast: MealStats;
  lunch: MealStats;
  dinner: MealStats;
  totalRice: number;
  lunchRice?: number;
  dinnerRice?: number;
  ricePerStudent?: number;
}

export const ShareMealReportDialog = memo(function ShareMealReportDialog({
  open,
  onOpenChange,
  schoolName,
  date,
  reporter,
  breakfast,
  lunch,
  dinner,
  totalRice,
  lunchRice,
  dinnerRice,
  ricePerStudent,
}: ShareMealReportDialogProps) {
  const imageRef = useRef<HTMLDivElement>(null);
  const { isExporting, exportAndShare } = useImageExport();

  const dateStr = format(date, 'yyyy-MM-dd');

  const handleDownload = () => {
    exportAndShare(
      imageRef,
      `ThongKeBuaAn_${dateStr}`,
      `Thống kê bữa ăn - ${dateStr}`,
      'download'
    );
  };

  const handleShare = () => {
    exportAndShare(
      imageRef,
      `ThongKeBuaAn_${dateStr}`,
      `Thống kê bữa ăn - ${dateStr}`,
      'share'
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Xuất ảnh thống kê bữa ăn
          </DialogTitle>
        </DialogHeader>

        {/* Preview - only render when dialog is open */}
        {open && (
          <div className="flex justify-center overflow-x-auto py-4">
            <div className="scale-[0.7] origin-top">
              <MealReportImageCard
                ref={imageRef}
                schoolName={schoolName}
                date={date}
                reporter={reporter}
                breakfast={breakfast}
                lunch={lunch}
                dinner={dinner}
                totalRice={totalRice}
                lunchRice={lunchRice}
                dinnerRice={dinnerRice}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDownload}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Tải ảnh
          </Button>
          <Button
            className="flex-1"
            onClick={handleShare}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4 mr-2" />
            )}
            Chia sẻ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
