import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings2 } from 'lucide-react';

interface AppFeature {
  id: string;
  code: string;
  label: string;
  description: string | null;
  icon_name: string | null;
  display_order: number | null;
  is_active: boolean | null;
}

interface SchoolFeaturesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  school: { id: string; name: string } | null;
}

export default function SchoolFeaturesDialog({ open, onOpenChange, school }: SchoolFeaturesDialogProps) {
  const { toast } = useToast();
  const [features, setFeatures] = useState<AppFeature[]>([]);
  const [enabledCodes, setEnabledCodes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [savingCode, setSavingCode] = useState<string | null>(null);

  useEffect(() => {
    if (open && school) {
      fetchData();
    }
  }, [open, school]);

  const fetchData = async () => {
    if (!school) return;
    setIsLoading(true);
    try {
      const [featuresRes, schoolFeaturesRes] = await Promise.all([
        supabase.from('app_features').select('*').eq('is_active', true).order('display_order'),
        supabase.from('school_features').select('feature_code, is_enabled').eq('school_id', school.id),
      ]);

      setFeatures((featuresRes.data || []) as AppFeature[]);

      const enabled = new Set<string>();
      (schoolFeaturesRes.data || []).forEach((sf: any) => {
        if (sf.is_enabled) enabled.add(sf.feature_code);
      });
      setEnabledCodes(enabled);
    } catch (error) {
      console.error('Error fetching features:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (featureCode: string, checked: boolean) => {
    if (!school) return;
    setSavingCode(featureCode);
    try {
      // Upsert: insert or update
      const { error } = await supabase
        .from('school_features')
        .upsert(
          { school_id: school.id, feature_code: featureCode, is_enabled: checked },
          { onConflict: 'school_id,feature_code' }
        );

      if (error) throw error;

      setEnabledCodes(prev => {
        const next = new Set(prev);
        if (checked) next.add(featureCode);
        else next.delete(featureCode);
        return next;
      });

      toast({
        title: checked ? 'Đã bật' : 'Đã tắt',
        description: `${features.find(f => f.code === featureCode)?.label || featureCode}`,
      });
    } catch (error: any) {
      console.error('Error toggling feature:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật chức năng',
        variant: 'destructive',
      });
    } finally {
      setSavingCode(null);
    }
  };

  // Core features that should always be enabled
  const coreFeatures = new Set(['dashboard', 'settings']);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Chức năng trường
          </DialogTitle>
          <DialogDescription>
            {school?.name} — Bật/tắt các chức năng cho trường này
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
            {features.map((feature) => {
              const isCore = coreFeatures.has(feature.code);
              const isEnabled = isCore || enabledCodes.has(feature.code);
              const isSaving = savingCode === feature.code;

              return (
                <div
                  key={feature.id}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={feature.code}
                      checked={isEnabled}
                      disabled={isCore || isSaving}
                      onCheckedChange={(checked) => handleToggle(feature.code, !!checked)}
                    />
                    <Label
                      htmlFor={feature.code}
                      className="cursor-pointer font-medium text-sm"
                    >
                      {feature.label}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    {isCore && (
                      <Badge variant="outline" className="text-xs">
                        Mặc định
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
