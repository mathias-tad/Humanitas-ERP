import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBasicUsers } from '@/hooks/useUsers';
import { useCrmList } from '@/hooks/useCrm';

const NONE = '__none__';

/** Owner / assignee: people in the current company. */
export function UserSelect({ id, value, onChange, placeholder = 'Nobody', allowNone = true, disabled }: {
  id?: string; value: string | null | undefined; onChange: (v: string | null) => void; placeholder?: string; allowNone?: boolean; disabled?: boolean;
}) {
  const users = useBasicUsers().data ?? [];
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>{placeholder}</SelectItem>}
        {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** Lead source or lost reason from CRM Set-up. */
export function CrmListSelect({ id, kind, value, onChange, placeholder, disabled }: {
  id?: string; kind: 'sources' | 'lost-reasons'; value: string | null | undefined; onChange: (v: string | null) => void; placeholder: string; disabled?: boolean;
}) {
  const items = useCrmList(kind).data ?? [];
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** "Mark as lost": the reason (required) and a note. */
export function LoseDialog({ open, title, onClose, onConfirm, busy }: {
  open: boolean; title: string; onClose: () => void; onConfirm: (reasonId: string, note: string) => void; busy?: boolean;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Why was it lost? The reason feeds the reports.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lose-reason">Reason *</Label>
            <CrmListSelect id="lose-reason" kind="lost-reasons" value={reason} onChange={setReason} placeholder="Choose a reason" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lose-note">Note</Label>
            <Textarea id="lose-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Went with a cheaper supplier" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={!reason || busy} onClick={() => reason && onConfirm(reason, note)}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Mark as lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
