import { useRef, useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Share2, Loader2, BarChart3, Users } from 'lucide-react';
import { useImageExport } from '@/hooks/use-image-export';
import { SingleMealImageCard } from './SingleMealImageCard';
import { SingleMealAbsentImageCard } from './SingleMealAbsentImageCard';
import { format } from 'date-fns';
import { AttendanceType } from '@/types';

interface AbsentStudent {
  id: string;
  name: string;
  className: string;
  classGrade: number;
  excused: boolean;
  reason?: string;
  mealGroup?: string;
}

interface ShareSingleMealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolName: string;
  date: Date;
  reporter: string;
  mealType: AttendanceType;
  total: number;
  present: number;
  absent: number;
  absentStudents: AbsentStudent[];
  ricePerStudent?: number;
}

const getMealLabel = (mealType: AttendanceType) => {
  switch (mealType) {
    case 'breakfast': return 'Sáng';
    case 'lunch': return 'Trưa';
    case 'dinner': return 'Tối';
    default: return 'Bữa ăn';
  }
};

export const ShareSingleMealDialog = memo(function ShareSingleMealDialog({
  open,
  onOpenChange,
  schoolName,
  date,
  reporter,
  mealType,
  total,
  present,
  absent,
  absentStudents,
  ricePerStudent = 0.2,
}: ShareSingleMealDialogProps) {
  const statsImageRef = useRef<HTMLDivElement>(null);
  const absentImageRef = useRef<HTMLDivElement>(null);
  const { isExporting, exportAndShare } = useImageExport();
  const [activeTab, setActiveTab] = useState('stats');

  const dateStr = format(date, 'yyyy-MM-dd');
  const mealLabel = getMealLabel(mealType);
  const riceAmount = (mealType === 'lunch' || mealType === 'dinner') ? present * ricePerStudent : undefined;

  const handleDownload = () => {
    const ref = activeTab === 'stats' ? statsImageRef : absentImageRef;
    const prefix = activeTab === 'stats' ? 'ThongKe' : 'DSVang';
    exportAndShare(
      ref,
      `${prefix}_Bua${mealLabel}_${dateStr}`,
      `${activeTab === 'stats' ? 'Thống kê' : 'DS vắng'} bữa ${mealLabel.toLowerCase()} - ${dateStr}`,
      'download'
    );
  };

  const handleShare = () => {
    const ref = activeTab === 'stats' ? statsImageRef : absentImageRef;
    const prefix = activeTab === 'stats' ? 'ThongKe' : 'DSVang';
    exportAndShare(
      ref,
      `${prefix}_Bua${mealLabel}_${dateStr}`,
      `${activeTab === 'stats' ? 'Thống kê' : 'DS vắng'} bữa ${mealLabel.toLowerCase()} - ${dateStr}`,
      'share'
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Xuất ảnh bữa {mealLabel.toLowerCase()}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stats" className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              Thống kê
            </TabsTrigger>
            <TabsTrigger value="absent" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              DS theo mâm
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-4">
            {open && (
              <div className="flex justify-center overflow-x-auto py-2">
                <div className="scale-[0.75] origin-top">
                  <SingleMealImageCard
                    ref={statsImageRef}
                    schoolName={schoolName}
                    date={date}
                    reporter={reporter}
                    mealType={mealType}
                    total={total}
                    present={present}
                    absent={absent}
                    absentStudents={absentStudents}
                    riceAmount={riceAmount}
                    ricePerStudent={ricePerStudent}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="absent" className="mt-4">
            {open && (
              <div className="flex justify-center overflow-x-auto py-2">
                <div className="scale-[0.75] origin-top">
                  <SingleMealAbsentImageCard
                    ref={absentImageRef}
                    schoolName={schoolName}
                    date={date}
                    reporter={reporter}
                    mealType={mealType}
                    absentStudents={absentStudents}
                  />
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
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
