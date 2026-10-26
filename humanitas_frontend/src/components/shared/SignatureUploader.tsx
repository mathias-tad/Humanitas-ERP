import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/context/AuthContext';
import { Upload, Trash2, CheckCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

interface SignatureUploaderProps {
  userId: string;
  readOnly?: boolean;
  label?: string;
}

export function SignatureUploader({ userId, readOnly = false, label = 'My Signature' }: SignatureUploaderProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['user-signature', userId],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`${API}/hrms/employees/${userId}/signature`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      return res.ok ? res.json() : { signature_url: null };
    },
  });

  const existingUrl: string | null = data?.signature_url ?? null;
  const displayUrl = preview ?? existingUrl;

  const deleteMut = useMutation({
    mutationFn: async () => {
      await fetch(`${API}/hrms/employees/${userId}/signature`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
    },
    onSuccess: () => {
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ['user-signature', userId] });
    },
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Preview locally
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload as base64 data URL (stored as-is — no S3 needed, base64 works in img tags)
    setUploading(true);
    try {
      const reader2 = new FileReader();
      reader2.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        await fetch(`${API}/hrms/employees/${userId}/signature`, {
          method: 'PUT',
          credentials: 'include',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ signature_url: dataUrl }),
        });
        queryClient.invalidateQueries({ queryKey: ['user-signature', userId] });
        setUploading(false);
      };
      reader2.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50 text-center">
        {displayUrl ? (
          <div className="space-y-3">
            <img
              src={displayUrl}
              alt="Signature"
              className="max-h-24 max-w-48 object-contain mx-auto"
            />
            {!readOnly && (
              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" /> Replace
                </button>
                <button
                  type="button"
                  onClick={() => deleteMut.mutate()}
                  className="text-xs text-red-500 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            )}
          </div>
        ) : (
          !readOnly ? (
            <div
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer space-y-2"
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto" />
              <p className="text-sm text-gray-500">Click to upload signature photo</p>
              <p className="text-xs text-gray-400">PNG, JPG, or GIF — max 2MB. Sign on white paper, photograph, upload.</p>
            </div>
          ) : <p className="text-sm text-gray-400">No signature on file.</p>
        )}
        {uploading && <p className="text-xs text-amber-600 mt-2">Uploading...</p>}
      </div>
      {!readOnly && (
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      )}
      {existingUrl && !readOnly && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Signature saved — will appear on generated documents
        </p>
      )}
    </div>
  );
}
