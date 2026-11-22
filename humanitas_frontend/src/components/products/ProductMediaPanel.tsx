import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FileText, ImagePlus, Loader2, Paperclip, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import {
  ATTACHMENT_ACCEPT, IMAGE_ACCEPT, MAX_MEDIA_BYTES, fileSizeText, mediaUrl, moveId,
  useProductMedia, useRemoveProductMedia, useReorderProductMedia, useUpdateProductMedia, useUploadProductMedia, type ProductMedia,
} from '@/hooks/useProductExtras';

/** A product's pictures (the main one is its image everywhere) and attachments (spec sheets, certificates). */
export function ProductMediaPanel({ productId, readOnly }: { productId: string; readOnly?: boolean }) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('edit_products') && !readOnly;
  const media = useProductMedia(productId);
  const upload = useUploadProductMedia(productId);
  const update = useUpdateProductMedia(productId);
  const remove = useRemoveProductMedia(productId);
  const reorder = useReorderProductMedia(productId);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const all = media.data ?? [];
  const images = all.filter((m) => m.kind === 'image');
  const files = all.filter((m) => m.kind === 'attachment');

  const send = async (list: FileList | File[] | null, kind: 'image' | 'attachment') => {
    const chosen = Array.from(list ?? []);
    if (!chosen.length) return;
    const tooBig = chosen.filter((f) => f.size > MAX_MEDIA_BYTES);
    if (tooBig.length) toast.error(`${tooBig.map((f) => f.name).join(', ')}: larger than 5 MB`);
    const ok = chosen.filter((f) => f.size <= MAX_MEDIA_BYTES && (kind === 'attachment' || f.type.startsWith('image/')));
    if (!ok.length) return;
    try {
      await upload.mutateAsync({ files: ok, kind });
      toast.success(ok.length === 1 ? `${ok[0].name} added` : `${ok.length} files added`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const run = async (p: Promise<unknown>, ok: string) => {
    try {
      await p;
      toast.success(ok);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const move = (m: ProductMedia, by: -1 | 1) => {
    const ids = moveId(images.map((x) => x.id), m.id, by);
    reorder.mutate([...ids, ...files.map((f) => f.id)], { onError: (e) => toast.error(errorMessage(e)) });
  };

  if (media.isLoading) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>;
  if (media.isError) return <p className="text-sm text-destructive">{errorMessage(media.error)}</p>;

  return (
    <div className="space-y-6">
      <section aria-label="Pictures" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Pictures</h3>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => imageInput.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ImagePlus className="mr-1 h-3 w-3" />} Add pictures
            </Button>
          )}
          <input ref={imageInput} type="file" accept={IMAGE_ACCEPT} multiple hidden aria-label="Choose pictures"
            onChange={(e) => { send(e.target.files, 'image'); e.target.value = ''; }} />
        </div>
        <div
          className={`grid grid-cols-2 gap-3 rounded-md sm:grid-cols-3 ${dragOver ? 'outline outline-2 outline-primary' : ''}`}
          onDragOver={(e) => { if (canEdit) { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (canEdit) send(e.dataTransfer.files, 'image'); }}
        >
          {images.map((m, i) => (
            <figure key={m.id} className="group relative overflow-hidden rounded-md border bg-muted/30">
              <img src={mediaUrl(m.file_path)} alt={m.title ?? m.file_name} className="aspect-square w-full object-contain" loading="lazy" />
              {m.is_primary && <Badge className="absolute left-1 top-1">Main</Badge>}
              <figcaption className="truncate px-2 py-1 text-xs text-muted-foreground" title={m.file_name}>{m.title ?? m.file_name}</figcaption>
              {canEdit && (
                <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  {!m.is_primary && (
                    <Button size="icon" variant="secondary" className="h-7 w-7" aria-label="Set as main picture" title="Set as main picture"
                      onClick={() => run(update.mutateAsync({ id: m.id, input: { is_primary: true } }), 'Main picture changed')}><Star className="h-3 w-3" /></Button>
                  )}
                  <Button size="icon" variant="secondary" className="h-7 w-7" aria-label="Move earlier" disabled={i === 0} onClick={() => move(m, -1)}><ArrowUp className="h-3 w-3" /></Button>
                  <Button size="icon" variant="secondary" className="h-7 w-7" aria-label="Move later" disabled={i === images.length - 1} onClick={() => move(m, 1)}><ArrowDown className="h-3 w-3" /></Button>
                  <Button size="icon" variant="secondary" className="h-7 w-7" aria-label="Remove picture"
                    onClick={() => run(remove.mutateAsync(m.id), 'Picture removed')}><Trash2 className="h-3 w-3" /></Button>
                </div>
              )}
            </figure>
          ))}
          {!images.length && (
            <div className="col-span-full rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
              {canEdit ? 'No pictures yet. Add or drop JPEG, PNG, WebP or GIF files (up to 5 MB); the first is the main picture.' : 'No pictures.'}
            </div>
          )}
        </div>
      </section>

      <section aria-label="Attachments" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Attachments</h3>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
              <Paperclip className="mr-1 h-3 w-3" /> Attach file
            </Button>
          )}
          <input ref={fileInput} type="file" accept={ATTACHMENT_ACCEPT} multiple hidden aria-label="Choose files"
            onChange={(e) => { send(e.target.files, 'attachment'); e.target.value = ''; }} />
        </div>
        <ul className="divide-y rounded-md border">
          {files.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a href={mediaUrl(m.file_path)} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary underline-offset-2 hover:underline">
                {m.title ?? m.file_name}
              </a>
              <span className="text-xs text-muted-foreground">{fileSizeText(m.file_size)}</span>
              {canEdit && (
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Remove ${m.file_name}`}
                  onClick={() => run(remove.mutateAsync(m.id), 'Attachment removed')}><Trash2 className="h-3 w-3" /></Button>
              )}
            </li>
          ))}
          {!files.length && <li className="px-3 py-4 text-center text-sm text-muted-foreground">Spec sheets, certificates and manuals (PDF, Word, Excel, text) go here.</li>}
        </ul>
      </section>
    </div>
  );
}
