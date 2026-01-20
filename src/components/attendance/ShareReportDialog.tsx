import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Share2, Loader2, Image } from 'lucide-react';
import { ReportImageCard } from './ReportImageCard';
import { useImageExport } from '@/hooks/use-image-export';

interface SavedReport {
  id: string;
  date: string;
  session: string;
  sessionLabel: string;
  total: number;
  present: number;
  absent: number;
  reporter: string;
  time: string;
  notes: string;
  absentStudents: {
    name: string;
    className: string;
    excused: boolean;
    reason: string;
  }[];
}

interface ShareReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: SavedReport;
  schoolName: string;
  title: string;
}

export function ShareReportDialog({
  open,
  onOpenChange,
  report,
  schoolName,
  title,
}: ShareReportDialogProps) {
  const imageRef = useRef<HTMLDivElement>(null);
  const { isExporting, exportAndShare } = useImageExport();
  
  const handleDownload = () => {
    exportAndShare(
      imageRef,
      `${title}_${report.date}_${report.sessionLabel}`,
      `${title} - ${report.sessionLabel} - ${report.date}`,
      'download'
    );
  };

  const handleShare = () => {
    exportAndShare(
      imageRef,
      `${title}_${report.date}_${report.sessionLabel}`,
      `${title} - ${report.sessionLabel} - ${report.date}`,
      'share'
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Xuất ảnh báo cáo
          </DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="flex justify-center overflow-x-auto py-4">
          <div className="scale-75 origin-top">
            <ReportImageCard
              ref={imageRef}
              schoolName={schoolName}
              title={title}
              date={report.date}
              sessionLabel={report.sessionLabel}
              reporter={report.reporter}
              reportTime={report.time}
              total={report.total}
              present={report.present}
              absent={report.absent}
              absentStudents={report.absentStudents}
              notes={report.notes}
            />
          </div>
        </div>

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
}
