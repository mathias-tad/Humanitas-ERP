import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { getEntity } from './entityRegistry';
import { toast } from 'sonner';

/**
 * Stacked side drawers (featureslist §29): open any record — or a create form — on top of the
 * current page. Opening a drawer from inside a drawer keeps the first one mounted, so its
 * unsaved input survives; Esc closes only the top drawer.
 */
export interface DrawerRequest {
  type: string;
  mode: 'create' | 'edit';
  id?: string;
  title?: string;
  initial?: Record<string, unknown>;
  onSaved?: (record: unknown) => void;
}

interface DrawerItem extends DrawerRequest {
  key: number;
}

interface RecordDrawerApi {
  open: (req: DrawerRequest) => void;
  close: () => void;
  depth: number;
}

const Ctx = createContext<RecordDrawerApi | null>(null);
let nextKey = 1;

export function RecordDrawerProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<DrawerItem[]>([]);
  const open = useCallback((req: DrawerRequest) => setStack((s) => [...s, { ...req, key: nextKey++ }]), []);
  const close = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const value = useMemo(() => ({ open, close, depth: stack.length }), [open, close, stack.length]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {stack.map((item, index) => {
        const def = getEntity(item.type);
        const Form = def?.Form;
        const isTop = index === stack.length - 1;
        const title = item.title ?? `${item.mode === 'create' ? 'New' : 'Edit'} ${def?.label ?? item.type}`;
        return (
          <Sheet key={item.key} open onOpenChange={(o) => !o && isTop && close()}>
            <SheetContent
              side="right"
              className="w-full sm:max-w-xl overflow-y-auto"
              style={{ zIndex: 50 + index }}
              data-testid={`record-drawer-${index}`}
            >
              <SheetHeader>
                {stack.length > 1 && (
                  <nav aria-label="Open drawers" className="flex items-center gap-1 text-xs text-muted-foreground">
                    {index > 0 && (
                      <Button variant="ghost" size="sm" className="h-6 px-1" onClick={close} aria-label="Back">
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                    )}
                    {stack.slice(0, index + 1).map((s, i) => (
                      <span key={s.key}>
                        {i > 0 && ' / '}
                        {s.title ?? getEntity(s.type)?.label ?? s.type}
                      </span>
                    ))}
                  </nav>
                )}
                <SheetTitle>{title}</SheetTitle>
                <SheetDescription className="sr-only">{title}</SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                {Form ? (
                  <Form
                    mode={item.mode}
                    id={item.id}
                    initial={item.initial}
                    onCancel={close}
                    onSaved={(record) => {
                      item.onSaved?.(record);
                      close();
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No form is registered for “{item.type}”.</p>
                )}
              </div>
            </SheetContent>
          </Sheet>
        );
      })}
    </Ctx.Provider>
  );
}

const FALLBACK_DRAWER: RecordDrawerApi = {
  open: () => toast.error('This form could not open here. Please reload the page.'),
  close: () => {},
  depth: 0,
};

export function useRecordDrawer(): RecordDrawerApi {
  const ctx = useContext(Ctx);
  // Never crash a page: a missing provider is a wiring bug caught by src/test/providers-mounted.test.ts.
  if (!ctx) {
    console.error('useRecordDrawer must be used inside <RecordDrawerProvider>');
    return FALLBACK_DRAWER;
  }
  return ctx;
}
