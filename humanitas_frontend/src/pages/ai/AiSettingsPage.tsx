import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/context/AuthContext';
import { Bot, Zap, FileText, Globe, Palette, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';

const API = import.meta.env.VITE_API_URL || '';

const TIERS = [
  { key: 'ai.help', label: 'AI Chat Help', description: 'Conversational assistant — answers questions, guides navigation', icon: Bot },
  { key: 'ai.actions', label: 'AI Actions', description: 'Execute system actions on behalf of users (create records, approve requests)', icon: Zap },
  { key: 'ai.documents', label: 'AI Document Engine', description: 'Generate professional PDF/DOCX documents from database data', icon: FileText },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'am', label: 'Amharic (አማርኛ)' },
  { value: 'ar', label: 'Arabic (العربية)' },
  { value: 'fr', label: 'French (Français)' },
  { value: 'es', label: 'Spanish (Español)' },
];

const FONTS = ['Inter', 'Roboto', 'Georgia', 'Times New Roman', 'Arial'];

export default function AiSettingsPage() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: async () => {
      const res = await fetch(`${API}/ai/settings`, { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const [tiers, setTiers] = useState<string[]>([]);
  const [maxRecords, setMaxRecords] = useState(50);
  const [language, setLanguage] = useState('en');
  const [brandingColor, setBrandingColor] = useState('#D4AF37');
  const [brandingFont, setBrandingFont] = useState('Inter');
  const [initialized, setInitialized] = useState(false);

  React.useEffect(() => {
    if (config && !initialized) {
      setTiers(config.ai_capability_tiers_enabled || []);
      setMaxRecords(config.max_action_records_per_bulk || 50);
      setLanguage(config.response_language || 'en');
      setBrandingColor(config.doc_branding_primary_color || '#D4AF37');
      setBrandingFont(config.doc_branding_font || 'Inter');
      setInitialized(true);
    }
  }, [config, initialized]);

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`${API}/ai/settings`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => { toast.success('AI settings saved'); qc.invalidateQueries({ queryKey: ['ai-settings'] }); },
    onError: () => toast.error('Failed to save settings'),
  });

  const toggleTier = (key: string) => {
    setTiers(prev => prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]);
  };

  const handleSave = () => {
    mutation.mutate({
      ai_capability_tiers_enabled: tiers,
      max_action_records_per_bulk: maxRecords,
      response_language: language,
      doc_branding_primary_color: brandingColor,
      doc_branding_font: brandingFont,
    });
  };

  if (isLoading) return <div className="p-8 text-gray-500">Loading AI settings...</div>;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Intelligence Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Configure AI capability tiers, language, and document branding</p>
        </div>
        <button onClick={handleSave} disabled={mutation.isPending}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-semibold disabled:opacity-50">
          <Save className="w-4 h-4" />{mutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Capability Tiers */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Capability Tiers</h2>
        <p className="text-xs text-gray-500 mb-4">Enable or disable specific AI features for this organization</p>
        <div className="space-y-3">
          {TIERS.map(tier => {
            const enabled = tiers.includes(tier.key);
            return (
              <div key={tier.key} className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${ enabled ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-gray-300' }`}
                onClick={() => toggleTier(tier.key)}>
                <div className="flex items-center gap-3">
                  <tier.icon className={`w-5 h-5 ${ enabled ? 'text-amber-600' : 'text-gray-400' }`} />
                  <div>
                    <p className="font-medium text-sm">{tier.label}</p>
                    <p className="text-xs text-gray-500">{tier.description}</p>
                  </div>
                </div>
                {enabled
                  ? <ToggleRight className="w-7 h-7 text-amber-500 flex-shrink-0" />
                  : <ToggleLeft className="w-7 h-7 text-gray-300 flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Limits */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Action Execution Limits</h2>
        <p className="text-xs text-gray-500 mb-4">Maximum records the AI can modify in a single bulk action</p>
        <div className="flex items-center gap-4">
          <input type="range" min={1} max={500} value={maxRecords} onChange={e => setMaxRecords(Number(e.target.value))}
            className="flex-1 accent-amber-500" />
          <span className="w-16 text-center font-bold text-gray-700 bg-gray-100 py-1 rounded-lg">{maxRecords}</span>
        </div>
      </div>

      {/* Language */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2"><Globe className="w-4 h-4" /> Response Language</h2>
        <p className="text-xs text-gray-500 mb-4">Preferred language for AI responses</p>
        <select value={language} onChange={e => setLanguage(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-full max-w-xs">
          {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </div>

      {/* Document Branding */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2"><Palette className="w-4 h-4" /> Document Branding</h2>
        <p className="text-xs text-gray-500 mb-4">Branding applied to AI-generated PDF and DOCX documents</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Primary Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={brandingColor} onChange={e => setBrandingColor(e.target.value)}
                className="h-10 w-16 border rounded cursor-pointer" />
              <span className="text-sm font-mono text-gray-600">{brandingColor}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Font Family</label>
            <select value={brandingFont} onChange={e => setBrandingFont(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm w-full">
              {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
