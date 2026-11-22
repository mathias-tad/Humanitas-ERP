import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2, PieChart } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { useRecordDrawer } from '@/components/platform/RecordDrawer';
import '@/components/products/registerProductEntities';
import { useProductCategories } from '@/hooks/useProducts';
import { ISSUE_HELP, downloadGapsCsv, useProductReport, type CatalogIssue } from '@/hooks/useProductExtras';

const ALL = '__all__';
const TYPE_LABEL: Record<string, string> = { storable: 'Stock items', consumable: 'Consumables', service: 'Services' };
const BAND_COLOR: Record<string, string> = { negative: 'bg-red-500', low: 'bg-amber-500', fair: 'bg-yellow-400', good: 'bg-emerald-500', high: 'bg-sky-500' };

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Products -> Product Reports: catalog make-up, completeness, margins and gaps (featureslist §1). */
export default function ProductReportsPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const drawer = useRecordDrawer();
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const categories = useProductCategories();
  const q = useProductReport(categoryId);
  const r = q.data;

  const openGap = (issue: CatalogIssue) => navigate(`/products?issue=${issue}${categoryId ? `&category_id=${categoryId}` : ''}`);
  const maxCategory = Math.max(1, ...(r?.by_category ?? []).map((c) => c.count));
  const bandTotal = (r?.margins.bands ?? []).reduce((t, b) => t + b.count, 0);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Product Reports"
        description="What your catalog holds, its margins and what is missing. Stock and sales figures come with Inventory and Sales."
        actions={
          <div className="flex gap-2">
            <Select value={categoryId ?? ALL} onValueChange={(v) => setCategoryId(v === ALL ? undefined : v)}>
              <SelectTrigger className="w-56" aria-label="Category"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {(categories.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.full_path}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasPermission('export_product_reports') && (
              <Button variant="outline" onClick={() => downloadGapsCsv({ category_id: categoryId }).catch((e) => toast.error(errorMessage(e)))}>
                <Download className="mr-2 h-4 w-4" /> Export gaps
              </Button>
            )}
          </div>
        }
      />

      {q.isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>}
      {q.isError && <p className="text-sm text-destructive">{errorMessage(q.error)}</p>}
      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <Stat label="Products" value={r.totals.products} hint={`${r.totals.variants} variants`} />
            <Stat label="Sold items" value={r.totals.sellable} hint="Products and variants" />
            <Stat label="Kits / combos" value={`${r.totals.kits} / ${r.totals.combos}`} />
            <Stat label="Archived" value={r.totals.archived} />
            <Stat label="Added in 30 days" value={r.totals.added_30d} hint={`${r.totals.changed_30d} changed`} />
            <Stat label="Complete" value={`${r.completeness}%`} hint="Sold items with no gap" />
          </div>

          <section aria-label="Catalog gaps" className="space-y-3">
            <h2 className="text-base font-semibold">Gaps to fix</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {r.issues.map((i) => (
                <button key={i.key} type="button" onClick={() => openGap(i.key)} disabled={!i.count}
                  className={`rounded-lg border p-4 text-left transition-colors ${i.count ? 'hover:border-primary hover:bg-primary/5' : 'opacity-60'}`}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">{i.label}</span>
                    <span className={`text-xl font-semibold tabular-nums ${i.count ? 'text-amber-700' : 'text-emerald-700'}`}>{i.count}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{ISSUE_HELP[i.key]}</p>
                </button>
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Margins" className="space-y-3 rounded-lg border p-4">
              <h2 className="text-base font-semibold">Margins</h2>
              <p className="text-sm text-muted-foreground">
                {r.margins.priced_and_costed
                  ? `Average ${r.margins.avg_margin ?? '—'}%, median ${r.margins.median_margin ?? '—'}%, over ${r.margins.priced_and_costed} items with a price and a cost.`
                  : 'Add costs to your products to see margins.'}
              </p>
              {bandTotal > 0 && (
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Margin bands">
                  {r.margins.bands.filter((b) => b.count).map((b) => (
                    <div key={b.key} className={BAND_COLOR[b.key]} style={{ width: `${(b.count / bandTotal) * 100}%` }} title={`${b.label}: ${b.count}`} />
                  ))}
                </div>
              )}
              <ul className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-5">
                {r.margins.bands.map((b) => (
                  <li key={b.key} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${BAND_COLOR[b.key]}`} /> {b.label}: {b.count}</li>
                ))}
              </ul>
              {r.margins.lowest.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>Lowest margins</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Margin</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {r.margins.lowest.map((p) => (
                      <TableRow key={p.id} className="cursor-pointer" onClick={() => drawer.open({ type: 'product', mode: 'edit', id: p.id, title: 'Product' })}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(p.sales_price).toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(p.cost_price).toFixed(2)}</TableCell>
                        <TableCell className={`text-right tabular-nums ${Number(p.margin) < 0 ? 'text-destructive' : ''}`}>{Number(p.margin).toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>

            <section aria-label="By category" className="space-y-3 rounded-lg border p-4">
              <h2 className="text-base font-semibold">By category</h2>
              <ul className="space-y-2">
                {r.by_category.map((c) => (
                  <li key={c.id ?? 'none'} className="text-sm">
                    <div className="flex justify-between"><span>{c.name}</span><span className="tabular-nums text-muted-foreground">{c.count}{c.avg_price ? ` · avg ${Number(c.avg_price).toFixed(2)}` : ''}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${(c.count / maxCategory) * 100}%` }} /></div>
                  </li>
                ))}
                {!r.by_category.length && <li className="flex items-center gap-2 text-sm text-muted-foreground"><PieChart className="h-4 w-4" /> No products yet.</li>}
              </ul>
              <div className="flex flex-wrap gap-3 border-t pt-3 text-xs text-muted-foreground">
                {r.by_type.map((t) => <span key={t.key}>{TYPE_LABEL[t.key] ?? t.key}: {t.count}</span>)}
              </div>
            </section>
          </div>

          <section aria-label="Prices and media" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="Price lists" value={r.pricing.price_lists} />
            <Stat label="Price rules" value={r.pricing.price_rules} />
            <Stat label="Customers on lists" value={r.pricing.customers_on_lists} />
            <Stat label="Pictures" value={r.pricing.pictures} />
            <Stat label="Attachments" value={r.pricing.attachments} />
            <Stat label="Packagings" value={r.pricing.packagings} />
          </section>
        </>
      )}
    </div>
  );
}
