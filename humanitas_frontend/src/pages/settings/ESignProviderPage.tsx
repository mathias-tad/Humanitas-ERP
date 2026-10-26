import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/context/AuthContext';
import { Shield, CheckCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function ESignProviderPage() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: config } = useQuery({
    queryKey: ['esign-config'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`${API}/hrms/esign/config`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      return res.ok ? res.json() : { provider: 'none' };
    },
  });

  const [form, setForm] = useState({ provider: 'none', client_id: '', client_secret: '', account_id: '' });
  const [inited, setInited] = useState(false);
  if (config && !inited) {
    setForm({
      provider: config.provider ?? 'none',
      client_id: config.client_id ?? '',
      client_secret: '',
      account_id: config.account_id ?? '',
    });
    setInited(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      await fetch(`${API}/hrms/esign/config`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    },
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['esign-config'] });
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const providers = [
    {
      key: 'none',
      label: 'Physical Signature Upload',
      description: 'Employees upload a photo of their handwritten signature. Used directly in generated documents.',
    },
    {
      key: 'docusign',
      label: 'DocuSign',
      description: 'Connect your DocuSign account. Requires DocuSign Developer or Business Pro plan.',
    },
    {
      key: 'hellosign',
      label: 'HelloSign (Dropbox Sign)',
      description: 'Connect your HelloSign account for legally-binding e-signatures.',
    },
    {
      key: 'adobe',
      label: 'Adobe Acrobat Sign',
      description: 'Enterprise-grade e-signatures via Adobe Acrobat Sign API.',
    },
  ];

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">E-Signature Provider</h1>
        <p className="text-gray-500 text-sm mt-1">Configure how digital signatures are captured for generated documents.</p>
      </div>

      {/* Provider selector */}
      <div className="space-y-3">
        {providers.map((p) => (
          <label
            key={p.key}
            className={`flex items-start gap-3 border rounded-xl p-4 cursor-pointer transition-colors ${
              form.provider === p.key ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <input
              type="radio"
              name="provider"
              value={p.key}
              checked={form.provider === p.key}
              onChange={() => setForm((f) => ({ ...f, provider: p.key }))}
              className="mt-1"
            />
            <div>
              <p className="font-medium text-gray-800">{p.label}</p>
              <p className="text-sm text-gray-500">{p.description}</p>
              {p.key !== 'none' && (
                <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  Coming Soon — enter credentials to enable
                </span>
              )}
            </div>
          </label>
        ))}
      </div>

      {/* Credentials (only shown when 3rd party selected) */}
      {form.provider !== 'none' && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
            <Shield className="w-4 h-4" /> Provider Credentials (stored encrypted)
          </div>
          <div className="space-y-3">
            <input
              placeholder="Client ID / Integration Key"
              value={form.client_id}
              onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="password"
              placeholder="Client Secret (leave blank to keep existing)"
              value={form.client_secret}
              onChange={(e) => setForm((f) => ({ ...f, client_secret: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Account ID"
              value={form.account_id}
              onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending}
        className="bg-amber-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
      >
        {saved ? (
          <>
            <CheckCircle className="w-4 h-4" /> Saved!
          </>
        ) : (
          'Save Configuration'
        )}
      </button>
    </div>
  );
}
