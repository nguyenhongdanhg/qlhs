import { useRef, memo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Share2, Loader2, Users } from 'lucide-react';
import { useImageExport } from '@/hooks/use-image-export';
import { AbsentByMealGroupImageCard } from './AbsentByMealGroupImageCard';
import { format } from 'date-fns';

interface AbsentStudent {
  id: string;
  name: string;
  className: string;
  classGrade: number;
  mealGroup?: string;
  excused: boolean;
}

interface ShareAbsentByMealGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolName: string;
  date: Date;
  reporter: string;
  breakfastAbsent: AbsentStudent[];
  lunchAbsent: AbsentStudent[];
  dinnerAbsent: AbsentStudent[];
}

export const ShareAbsentByMealGroupDialog = memo(function ShareAbsentByMealGroupDialog({
  open,
  onOpenChange,
  schoolName,
  date,
  reporter,
  breakfastAbsent,
  lunchAbsent,
  dinnerAbsent,
}: ShareAbsentByMealGroupDialogProps) {
  const imageRef = useRef<HTMLDivElement>(null);
  const { isExporting, exportAndShare } = useImageExport();

  const dateStr = format(date, 'yyyy-MM-dd');

  const handleDownload = () => {
    exportAndShare(
      imageRef,
      `DSVang_TheoMam_${dateStr}`,
      `Danh sách vắng theo mâm - ${dateStr}`,
      'download'
    );
  };

  const handleShare = () => {
    exportAndShare(
      imageRef,
      `DSVang_TheoMam_${dateStr}`,
      `Danh sách vắng theo mâm - ${dateStr}`,
      'share'
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Xuất ảnh danh sách vắng theo mâm
          </DialogTitle>
        </DialogHeader>

        {/* Preview - only render when dialog is open */}
        {open && (
          <div className="flex justify-center overflow-x-auto py-4">
            <div className="scale-[0.65] origin-top">
              <AbsentByMealGroupImageCard
                ref={imageRef}
                schoolName={schoolName}
                date={date}
                reporter={reporter}
                breakfastAbsent={breakfastAbsent}
                lunchAbsent={lunchAbsent}
                dinnerAbsent={dinnerAbsent}
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
