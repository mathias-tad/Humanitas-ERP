import {
  BarChart3, Boxes, Car, ClipboardList, Contact, DollarSign, Factory, FileText, Package, PhoneCall, Puzzle,
  ShoppingCart, Store, Truck, Users, type LucideIcon,
} from 'lucide-react';
import type { ModuleCatalog } from './moduleCatalog';

/** Icon for each module key in the admin API catalog (featureslist §28). */
export const MODULE_ICONS: Record<string, LucideIcon> = {
  hrms: Users,
  pms: ClipboardList,
  products: Package,
  inventory: Boxes,
  purchasing: ShoppingCart,
  manufacturing: Factory,
  sales: BarChart3,
  crm: Contact,
  pos: DollarSign,
  ecommerce: Store,
  accounting: FileText,
  voip: PhoneCall,
  delivery: Truck,
  fleet: Car,
};

export const CATEGORY_LABELS: Record<string, string> = {
  people: 'People',
  operations: 'Operations',
  commercial: 'Sales & commerce',
  finance: 'Finance',
  communications: 'Communications',
  logistics: 'Logistics',
};

export interface ModuleCard {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: string;
  status: 'available' | 'coming_soon';
  /** Kept for the existing card markup; every module can be selected (coming-soon ones switch on when released). */
  comingSoon: boolean;
}

/**
 * Every module from the catalog, in catalog order (grouped by area). Falls back to the page's built-in
 * list while the catalog loads or if it cannot be reached, so the form always works.
 */
export function moduleCards(
  catalog: ModuleCatalog | null,
  fallback: { id: string; name: string; description: string; icon: unknown }[],
): ModuleCard[] {
  if (!catalog?.modules?.length) {
    return fallback.map((s) => ({
      id: s.id, name: s.name, description: s.description, icon: (s.icon as LucideIcon) ?? Puzzle,
      category: '', status: 'available', comingSoon: false,
    }));
  }
  return catalog.modules.map((m) => ({
    id: m.key,
    name: m.name,
    description: m.description,
    icon: MODULE_ICONS[m.key] ?? Puzzle,
    category: m.category,
    status: m.status,
    comingSoon: false,
  }));
}
