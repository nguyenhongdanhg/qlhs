import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ExcuseReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  onSave: (excused: boolean, reason: string) => void;
}

const COMMON_REASONS = [
  'Ốm, nghỉ tại nhà',
  'Có lịch khám bệnh',
  'Việc gia đình',
  'Đi thi/tập huấn',
  'Được phép về sớm',
];

export function ExcuseReasonDialog({ open, onOpenChange, studentName, onSave }: ExcuseReasonDialogProps) {
  const [excused, setExcused] = useState(true);
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const handleSave = () => {
    const finalReason = reason === 'custom' ? customReason : reason;
    onSave(excused, finalReason);
    onOpenChange(false);
    // Reset
    setExcused(true);
    setReason('');
    setCustomReason('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lý do vắng mặt</DialogTitle>
          <DialogDescription>
            Cập nhật lý do vắng mặt cho học sinh: <strong>{studentName}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Loại vắng</Label>
            <RadioGroup
              value={excused ? 'excused' : 'unexcused'}
              onValueChange={(v) => setExcused(v === 'excused')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excused" id="excused" />
                <Label htmlFor="excused" className="font-normal cursor-pointer">
                  Có phép (P)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unexcused" id="unexcused" />
                <Label htmlFor="unexcused" className="font-normal cursor-pointer">
                  Không phép (KP)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Lý do</Label>
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
              {COMMON_REASONS.map((r) => (
                <div key={r} className="flex items-center space-x-2">
                  <RadioGroupItem value={r} id={r} />
                  <Label htmlFor={r} className="font-normal cursor-pointer">
                    {r}
                  </Label>
                </div>
              ))}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="font-normal cursor-pointer">
                  Khác
                </Label>
              </div>
            </RadioGroup>
            {reason === 'custom' && (
              <Input
                placeholder="Nhập lý do khác..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="mt-2"
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSave}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
