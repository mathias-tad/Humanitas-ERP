import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, Lock, Plus, Search, SquarePen, X } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useERPModules } from '@/context/ModuleContext';
import { errorMessage } from '@/lib/errors';
import { scopeKey } from '@/hooks/useProducts';
import { entityAccess, getEntity, pickerActions, type EntityOption } from './entityRegistry';
import { useRecordDrawer } from './RecordDrawer';

export interface EntityPickerProps {
  /** Registered entity type, e.g. "product" or "product_category". */
  type: string;
  value: string | null;
  /** Label of the current value (shown without a lookup). */
  valueLabel?: string | null;
  onChange: (id: string | null, record?: unknown) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  /** Hide these ids from the results (e.g. a category cannot be its own parent). */
  excludeIds?: string[];
  id?: string;
}

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Relation field with in-place creation (featureslist §29): type to search, "Create …" in one step,
 * "Create and edit …" in a side drawer, or "Search more…". Creation is offered only when the module
 * is subscribed and the user has the create permission.
 */
export function EntityPicker({
  type, value, valueLabel, onChange, placeholder, disabled, allowClear = true, excludeIds = [], id,
}: EntityPickerProps) {
  const def = getEntity(type);
  const { hasPermission } = useAuth();
  const { isModuleSubscribed } = useERPModules();
  const drawer = useRecordDrawer();
  const access = entityAccess(def, { hasPermission, isModuleSubscribed });

  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [label, setLabel] = useState<string | null>(valueLabel ?? null);
  const [creating, setCreating] = useState(false);
  const debounced = useDebounced(query);
  useEffect(() => setLabel(valueLabel ?? null), [valueLabel]);

  const results = useQuery({
    queryKey: ['entity-search', type, ...scopeKey(), debounced],
    queryFn: () => def!.search(debounced),
    enabled: !!def && access.canView && open,
  });

  const options = useMemo<EntityOption[]>(
    () => (results.data ?? []).map((r) => def!.toOption(r)).filter((o) => !excludeIds.includes(o.id)),
    [results.data, def, excludeIds],
  );

  if (!def) return <p className="text-xs text-destructive">Unknown record type “{type}”.</p>;

  const select = (option: EntityOption | null, record?: unknown) => {
    setLabel(option?.label ?? null);
    onChange(option?.id ?? null, record);
    setOpen(false);
    setMoreOpen(false);
    setQuery('');
  };

  const quickCreate = async (text: string) => {
    if (!def.quickCreate) return;
    setCreating(true);
    try {
      const record = await def.quickCreate(text);
      select(def.toOption(record), record);
      toast.success(`${def.label[0].toUpperCase()}${def.label.slice(1)} “${text}” created`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const createAndEdit = (text: string) => {
    setOpen(false);
    drawer.open({ type, mode: 'create', initial: { name: text }, onSaved: (record) => select(def.toOption(record), record) });
  };

  const actions = pickerActions(def, access, query, options);
  const unavailable = !access.available || !access.canView;

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || unavailable}
            className="w-full justify-between font-normal"
          >
            <span className={label ? '' : 'text-muted-foreground'}>
              {unavailable ? `No access to ${def.label}s` : label ?? placeholder ?? `Select ${def.label}…`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={`Search ${def.label}s…`} value={query} onValueChange={setQuery} />
            <CommandList>
              {results.isFetching && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                </div>
              )}
              <CommandEmpty>No {def.label}s found.</CommandEmpty>
              <CommandGroup>
                {actions.map((a, i) => {
                  if (a.kind === 'option') {
                    return (
                      <CommandItem key={a.option.id} value={`opt-${a.option.id}`} onSelect={() => select(a.option, (results.data ?? []).find((r) => def.toOption(r).id === a.option.id))}>
                        <Check className={`mr-2 h-4 w-4 ${a.option.id === value ? 'opacity-100' : 'opacity-0'}`} />
                        <span className="flex flex-col">
                          <span>{a.option.label}</span>
                          {a.option.description && <span className="text-xs text-muted-foreground">{a.option.description}</span>}
                        </span>
                      </CommandItem>
                    );
                  }
                  if (a.kind === 'quick-create') {
                    return (
                      <CommandItem key={`qc-${i}`} value="action-quick-create" disabled={creating} onSelect={() => quickCreate(a.text)}>
                        {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        {a.label}
                      </CommandItem>
                    );
                  }
                  if (a.kind === 'create-edit') {
                    return (
                      <CommandItem key={`ce-${i}`} value="action-create-edit" onSelect={() => createAndEdit(a.text)}>
                        <SquarePen className="mr-2 h-4 w-4" /> {a.label}
                      </CommandItem>
                    );
                  }
                  if (a.kind === 'search-more') {
                    return (
                      <CommandItem key={`sm-${i}`} value="action-search-more" onSelect={() => { setOpen(false); setMoreOpen(true); }}>
                        <Search className="mr-2 h-4 w-4" /> {a.label}
                      </CommandItem>
                    );
                  }
                  return (
                    <div key={`np-${i}`} className="flex items-start gap-2 px-2 py-1.5 text-xs text-muted-foreground" role="note">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0" /> {a.label}
                    </div>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {allowClear && value && !disabled && (
        <Button type="button" variant="ghost" size="icon" aria-label={`Clear ${def.label}`} onClick={() => select(null)}>
          <X className="h-4 w-4" />
        </Button>
      )}
      <SearchMoreDialog
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title={`Find a ${def.label}`}
        search={def.search}
        toOption={def.toOption}
        type={type}
        excludeIds={excludeIds}
        onPick={(o, r) => select(o, r)}
      />
    </div>
  );
}

function SearchMoreDialog({
  open, onOpenChange, title, search, toOption, type, excludeIds, onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  search: (q: string) => Promise<unknown[]>;
  toOption: (r: unknown) => EntityOption;
  type: string;
  excludeIds: string[];
  onPick: (o: EntityOption, r: unknown) => void;
}) {
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const res = useQuery({ queryKey: ['entity-search-more', type, ...scopeKey(), debounced], queryFn: () => search(debounced), enabled: open });
  const rows = (res.data ?? []).map((r) => ({ r, o: toOption(r) })).filter(({ o }) => !excludeIds.includes(o.id));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input autoFocus placeholder="Type to search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="max-h-80 overflow-y-auto divide-y rounded-md border">
          {rows.map(({ r, o }) => (
            <li key={o.id}>
              <button type="button" className="w-full text-left px-3 py-2 hover:bg-muted" onClick={() => onPick(o, r)}>
                <div className="text-sm">{o.label}</div>
                {o.description && <div className="text-xs text-muted-foreground">{o.description}</div>}
              </button>
            </li>
          ))}
          {!rows.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{res.isFetching ? 'Searching…' : 'Nothing found'}</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
