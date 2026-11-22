import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { productKeys, type Product } from '@/hooks/useProducts';

/** Product attributes and variants (featureslist §1); mirrors the tenant API. */
export type AttributeDisplayType = 'pills' | 'select' | 'color';

export interface AttributeValue {
  id: string;
  name: string;
  code: string | null;
  html_color: string | null;
  sort_order: number;
  is_active: boolean;
  variant_count?: number;
}

export interface ProductAttribute {
  id: string;
  name: string;
  display_type: AttributeDisplayType;
  sort_order: number;
  is_active: boolean;
  product_count: number;
  values: AttributeValue[];
}

export interface VariantLine {
  attribute_id: string;
  name: string;
  display_type: AttributeDisplayType;
  sort_order: number;
  values: Pick<AttributeValue, 'id' | 'name' | 'code' | 'html_color'>[];
}

export interface VariantConfig {
  product_id: string;
  has_variants: boolean;
  attributes: VariantLine[];
  variants: Product[];
  summary?: { created: number; archived: number; restored: number };
}

export interface VariantLineInput {
  attribute_id: string;
  value_ids: string[];
}

export const attributeKeys = {
  all: ['product-attributes'] as const,
  list: (archived: boolean) => ['product-attributes', archived] as const,
  variants: (productId: string) => ['products', 'variants', productId] as const,
};

/** Same key whatever order the values were picked in (backend products.variant_key). */
export function variantKey(valueIds: string[]): string {
  return [...valueIds].sort().join(',');
}

/** Every combination of one value per line. */
export function lineCombinations(lines: VariantLineInput[]): string[] {
  if (!lines.length || lines.some((l) => !l.value_ids.length)) return [];
  let acc: string[][] = [[]];
  for (const l of lines) acc = acc.flatMap((partial) => l.value_ids.map((v) => [...partial, v]));
  return acc.map(variantKey);
}

/** What saving would do, so the button can say "Create 4, archive 1" before anything changes. */
export function previewVariantChanges(lines: VariantLineInput[], variants: Pick<Product, 'is_active' | 'variant_values' | 'auto_archived'>[]) {
  const wanted = new Set(lineCombinations(lines));
  const existing = new Map(variants.map((v) => [variantKey((v.variant_values ?? []).map((x) => x.value_id)), v]));
  let create = 0;
  let restore = 0;
  let archive = 0;
  for (const key of wanted) {
    const v = existing.get(key);
    if (!v) create++;
    else if (!v.is_active && v.auto_archived === 'config') restore++;
  }
  for (const [key, v] of existing) if (v.is_active && !wanted.has(key)) archive++;
  return { total: wanted.size, create, archive, restore };
}

export function useProductAttributes(includeArchived = false) {
  return useQuery({
    queryKey: attributeKeys.list(includeArchived),
    queryFn: () => api.get<ProductAttribute[]>(`/product-attributes${includeArchived ? '?include_archived=true' : ''}`),
  });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all([qc.invalidateQueries({ queryKey: attributeKeys.all }), qc.invalidateQueries({ queryKey: productKeys.all })]);
}

export function useCreateAttribute() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { name: string; display_type?: AttributeDisplayType; values?: { name: string; code?: string; html_color?: string }[] }) =>
      api.post<ProductAttribute>('/product-attributes', input),
    onSuccess: invalidate,
  });
}

export function useUpdateAttribute() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Pick<ProductAttribute, 'name' | 'display_type' | 'sort_order' | 'is_active'>> }) =>
      api.patch<ProductAttribute>(`/product-attributes/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useArchiveAttribute() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api.delete<ProductAttribute>(`/product-attributes/${id}`), onSuccess: invalidate });
}

export function useAddAttributeValue() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ attributeId, input }: { attributeId: string; input: { name: string; code?: string | null; html_color?: string | null } }) =>
      api.post<AttributeValue>(`/product-attributes/${attributeId}/values`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateAttributeValue() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ attributeId, valueId, input }: {
      attributeId: string; valueId: string; input: Partial<Pick<AttributeValue, 'name' | 'code' | 'html_color' | 'sort_order' | 'is_active'>>;
    }) => api.patch<AttributeValue>(`/product-attributes/${attributeId}/values/${valueId}`, input),
    onSuccess: invalidate,
  });
}

export function useArchiveAttributeValue() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ attributeId, valueId }: { attributeId: string; valueId: string }) =>
      api.delete<AttributeValue>(`/product-attributes/${attributeId}/values/${valueId}`),
    onSuccess: invalidate,
  });
}

export function useProductVariants(productId: string | undefined) {
  return useQuery({
    queryKey: attributeKeys.variants(productId ?? ''),
    queryFn: () => api.get<VariantConfig>(`/products/${productId}/variants`),
    enabled: !!productId,
  });
}

export function useSaveVariants() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ productId, attributes }: { productId: string; attributes: VariantLineInput[] }) =>
      api.put<VariantConfig>(`/products/${productId}/variants`, { attributes }),
    onSuccess: invalidate,
  });
}
