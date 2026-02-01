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

// Flexible report interface to support both legacy SavedReport and database HistoryRecord
interface ReportData {
  id?: string;
  date: string;
  session?: string;
  sessionLabel?: string;
  total: number;
  present: number;
  absent: number;
  reporter?: string;
  reporterName?: string; // For HistoryRecord
  time?: string;
  reportedAt?: string; // For HistoryRecord
  notes?: string;
  absentStudents: {
    id?: string;
    name: string;
    className: string;
    excused: boolean;
    reason: string;
  }[];
}

interface ShareReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ReportData;
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
  
  // Normalize fields to support both legacy SavedReport and HistoryRecord formats
  const sessionLabel = report.sessionLabel || 'Nội trú';
  const reporter = report.reporter || report.reporterName || '';
  const reportTime = report.time || (report.reportedAt ? new Date(report.reportedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');
  
  const handleDownload = () => {
    exportAndShare(
      imageRef,
      `${title}_${report.date}_${sessionLabel}`,
      `${title} - ${sessionLabel} - ${report.date}`,
      'download'
    );
  };

  const handleShare = () => {
    exportAndShare(
      imageRef,
      `${title}_${report.date}_${sessionLabel}`,
      `${title} - ${sessionLabel} - ${report.date}`,
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
              sessionLabel={sessionLabel}
              reporter={reporter}
              reportTime={reportTime}
              total={report.total}
              present={report.present}
              absent={report.absent}
              absentStudents={report.absentStudents}
              notes={report.notes || ''}
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
