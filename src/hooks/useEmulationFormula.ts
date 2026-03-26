import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FormulaColumn {
  id: string;
  school_id: string;
  column_name: string;
  weight: number;
  display_order: number;
  is_active: boolean;
}

export type FormulaType = 'weighted_average' | 'sum' | 'average';

export interface FormulaConfig {
  columns: FormulaColumn[];
  formulaType: FormulaType;
  isCustom: boolean;
}

// Default columns when no custom formula is configured
export const DEFAULT_COLUMNS: { column_name: string; weight: number; key: string }[] = [
  { column_name: 'Học tập', weight: 2, key: 'academic_score' },
  { column_name: 'Nề nếp', weight: 1, key: 'discipline_score' },
  { column_name: 'Nội trú', weight: 1, key: 'boarding_score' },
];

export function useEmulationFormula(schoolId?: string) {
  const { data: savedColumns = [] } = useQuery({
    queryKey: ['emulation-formula-columns', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('emulation_formula_columns')
        .select('*')
        .eq('school_id', schoolId!)
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as FormulaColumn[];
    },
    enabled: !!schoolId,
  });

  const { data: formulaConfigData } = useQuery({
    queryKey: ['emulation-formula-config', schoolId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('emulation_formula_config')
        .select('*')
        .eq('school_id', schoolId!)
        .maybeSingle();
      if (error) throw error;
      return data as { formula_type: FormulaType } | null;
    },
    enabled: !!schoolId,
  });

  const isCustom = savedColumns.length > 0;
  const formulaType: FormulaType = formulaConfigData?.formula_type ?? 'weighted_average';

  // Calculate score using the configured formula
  const calculateScore = (scores: Record<string, number>): number => {
    if (!isCustom) {
      // Default formula: (academic * 2 + discipline + boarding) / 4
      const academic = scores['academic_score'] ?? 0;
      const discipline = scores['discipline_score'] ?? 0;
      const boarding = scores['boarding_score'] ?? 0;
      return (academic * 2 + discipline + boarding) / 4;
    }

    const values = savedColumns.map(col => {
      const val = scores[col.id] ?? 0;
      return { value: val, weight: col.weight };
    });

    switch (formulaType) {
      case 'sum':
        return values.reduce((sum, v) => sum + v.value * v.weight, 0);
      case 'average':
        if (values.length === 0) return 0;
        return values.reduce((sum, v) => sum + v.value, 0) / values.length;
      case 'weighted_average':
      default: {
        const totalWeight = values.reduce((sum, v) => sum + v.weight, 0);
        if (totalWeight === 0) return 0;
        return values.reduce((sum, v) => sum + v.value * v.weight, 0) / totalWeight;
      }
    }
  };

  // Build formula description string
  const getFormulaString = (): string => {
    if (!isCustom) return '(Học tập ×2 + Nề nếp + Nội trú) ÷ 4';
    
    const parts = savedColumns.map(col => {
      if (col.weight === 1) return col.column_name;
      return `${col.column_name} ×${col.weight}`;
    });
    const totalWeight = savedColumns.reduce((s, c) => s + c.weight, 0);

    switch (formulaType) {
      case 'sum':
        return parts.join(' + ');
      case 'average':
        return `(${savedColumns.map(c => c.column_name).join(' + ')}) ÷ ${savedColumns.length}`;
      case 'weighted_average':
      default:
        return `(${parts.join(' + ')}) ÷ ${totalWeight}`;
    }
  };

  return {
    columns: savedColumns,
    formulaType,
    isCustom,
    calculateScore,
    getFormulaString,
  };
}
