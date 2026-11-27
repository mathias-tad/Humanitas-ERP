import { api } from '@/lib/api';
import { registerEntity } from '@/components/platform/entityRegistry';
import { type TransferRow, type Warehouse } from '@/hooks/useInventory';
import { WarehouseForm } from './WarehouseForm';
import { TransferForm } from './TransferForm';

/**
 * Inventory registers its record types once (featureslist §29); Stock, Sales and Purchasing then
 * get warehouse and transfer search, one-step create and "Create & edit…" for free.
 */
registerEntity<Warehouse>({
  type: 'warehouse',
  label: 'warehouse',
  module: 'inventory',
  permissions: { view: 'view_warehouses', create: 'create_warehouses' },
  search: (query) =>
    api
      .get<{ data: Warehouse[] }>(`/inventory/warehouses${query.trim() ? `?search=${encodeURIComponent(query.trim())}&limit=20` : '?limit=20'}`)
      .then((r) => r.data),
  toOption: (w) => ({
    id: w.id,
    label: w.name,
    description: [w.code, w.city].filter(Boolean).join(' · ') || undefined,
  }),
  quickCreate: (text) => {
    // The code is the uppercase letters/digits of the name, capped at 16 (MoR item-code style).
    const code = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) || 'WH';
    return api.post<Warehouse>('/inventory/warehouses', { code, name: text });
  },
  Form: WarehouseForm,
});

registerEntity<TransferRow>({
  type: 'transfer',
  label: 'transfer',
  module: 'inventory',
  permissions: { view: 'view_transfers', create: 'create_transfers' },
  search: (query) =>
    api
      .get<{ data: TransferRow[] }>(`/inventory/transfers?limit=20${query.trim() ? `&search=${encodeURIComponent(query.trim())}` : ''}`)
      .then((r) => r.data),
  toOption: (t) => ({
    id: t.id,
    label: t.name,
    description: [
      t.partner_name,
      t.reason,
      t.state !== 'done' ? t.state : undefined,
    ].filter(Boolean).join(' · ') || undefined,
  }),
  Form: TransferForm,
});
