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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

interface ExcuseReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  onSave: (excused: boolean, reason: string) => void;
}

export function ExcuseReasonDialog({ open, onOpenChange, studentName, onSave }: ExcuseReasonDialogProps) {
  const [excused, setExcused] = useState(true);
  const [reason, setReason] = useState('');

  const handleSave = () => {
    onSave(excused, reason);
    onOpenChange(false);
    // Reset
    setExcused(true);
    setReason('');
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
            <Label htmlFor="reason">Lý do</Label>
            <Textarea
              id="reason"
              placeholder="Nhập lý do vắng mặt..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px]"
            />
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
