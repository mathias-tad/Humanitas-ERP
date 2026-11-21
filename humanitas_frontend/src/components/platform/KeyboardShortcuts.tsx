import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Keyboard } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { useERPModules } from '@/context/ModuleContext';
import { formatKeys, useActiveShortcuts, useShortcuts, type Shortcut } from '@/lib/shortcuts';

/** Lists every shortcut that works on the current screen, grouped (opened with ?). */
export function ShortcutHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const shortcuts = useActiveShortcuts();
  const groups = new Map<string, Shortcut[]>();
  for (const s of shortcuts) {
    const g = s.group ?? 'General';
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Keyboard className="h-4 w-4" /> Keyboard shortcuts</DialogTitle>
          <DialogDescription>Shortcuts for this screen. Single keys work when you are not typing in a field.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {[...groups.entries()].map(([group, items]) => (
            <section key={group}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</h3>
              <ul className="divide-y rounded-md border">
                {items.map((s) => (
                  <li key={s.keys} className="flex items-center justify-between gap-4 px-3 py-1.5 text-sm">
                    <span>{s.description}</span>
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{formatKeys(s.keys)}</kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Shortcuts available on every page of the app, plus the ? help window. Mounted once in the layout. */
export function GlobalShortcuts() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { isModuleSubscribed } = useERPModules();
  const [helpOpen, setHelpOpen] = useState(false);
  const shortcuts: Shortcut[] = [
    { keys: '?', description: 'Show keyboard shortcuts', group: 'General', run: () => setHelpOpen(true) },
    { keys: 'g h', description: 'Go to the dashboard', group: 'Go to', run: () => navigate('/dashboard') },
  ];
  if (isModuleSubscribed('products') && hasPermission('view_products')) {
    shortcuts.push({ keys: 'g p', description: 'Go to Products', group: 'Go to', run: () => navigate('/products') });
  }
  useShortcuts(shortcuts);
  return <ShortcutHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />;
}
