import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { scopeKey } from '@/hooks/useProducts';
import type { LabelTemplate, LabelTemplateInput } from '@/lib/labels';

/** Barcode and price label templates (featureslist §1); mirrors the tenant API. */
export const labelKeys = {
  all: ['label-templates'] as const,
  list: (archived: boolean) => ['label-templates', ...scopeKey(), archived] as const,
  prices: (listId: string | null, ids: string[]) => ['label-templates', 'prices', ...scopeKey(), listId, ids] as const,
};

export function useLabelTemplates(includeArchived = false) {
  return useQuery({
    queryKey: labelKeys.list(includeArchived),
    queryFn: () => api.get<LabelTemplate[]>(`/label-templates${includeArchived ? '?include_archived=true' : ''}`),
  });
}

export function useSaveLabelTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: LabelTemplateInput }) =>
      id ? api.patch<LabelTemplate>(`/label-templates/${id}`, input) : api.post<LabelTemplate>('/label-templates', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: labelKeys.all }),
  });
}

export function useArchiveLabelTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<LabelTemplate>(`/label-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: labelKeys.all }),
  });
}

export interface LabelPrices {
  price_list_id: string;
  price_list_name: string;
  currency: string;
  prices: Record<string, number>;
}

/** Prices of the products being labelled, on one price list (null: the default list). */
export function useLabelPrices(productIds: string[], priceListId: string | null, enabled: boolean) {
  const ids = [...new Set(productIds)].sort();
  return useQuery({
    queryKey: labelKeys.prices(priceListId, ids),
    queryFn: () =>
      api.post<LabelPrices>('/label-templates/prices', { product_ids: ids.slice(0, 500), ...(priceListId ? { price_list_id: priceListId } : {}) }),
    enabled: enabled && ids.length > 0,
    staleTime: 60 * 1000,
  });
}
