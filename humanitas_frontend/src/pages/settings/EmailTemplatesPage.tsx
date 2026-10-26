import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/context/AuthContext';
import { Mail, Edit3, RotateCcw, Eye, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const API = import.meta.env.VITE_API_URL || '';

const TEMPLATE_VARIABLE_MAP: Record<string, string[]> = {
  'leave-approved':  ['{{employeeName}}', '{{leaveType}}', '{{startDate}}', '{{endDate}}', '{{approvedBy}}', '{{deepLink}}'],
  'leave-rejected':  ['{{employeeName}}', '{{leaveType}}', '{{startDate}}', '{{endDate}}', '{{reason}}', '{{deepLink}}'],
  'payroll-ready':   ['{{employeeName}}', '{{payPeriod}}', '{{netPay}}', '{{payDate}}', '{{deepLink}}'],
  'task-assigned':   ['{{employeeName}}', '{{taskTitle}}', '{{projectName}}', '{{dueDate}}', '{{assignedBy}}', '{{deepLink}}'],
  'document-expiry': ['{{employeeName}}', '{{documentName}}', '{{expiryDate}}', '{{daysRemaining}}', '{{deepLink}}'],
};

async function fetchTemplates() {
  const res = await fetch(`${API}/notifications/email-templates`, {
    credentials: 'include', headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
}

async function fetchPreview(key: string): Promise<string> {
  const res = await fetch(`${API}/notifications/email-templates/${key}/preview`, {
    credentials: 'include', headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch preview');
  const data = await res.json();
  return data.html || '';
}

async function saveTemplate(key: string, body: { subject: string; html_body: string; plain_text_body?: string }) {
  const res = await fetch(`${API}/notifications/email-templates/${key}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to save template');
  return res.json();
}

async function resetTemplate(key: string) {
  const res = await fetch(`${API}/notifications/email-templates/${key}/reset`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to reset template');
  return res.json();
}

interface TemplateRow {
  template_key: string;
  display_name: string;
  default_subject: string;
  available_variables: string;
  custom_subject: string | null;
  custom_html_body: string | null;
  custom_plain_text_body: string | null;
  custom_updated_at: string | null;
  is_customized: boolean;
}

interface EditorState {
  key: string;
  subject: string;
  html_body: string;
  plain_text_body: string;
  showPlainText: boolean;
  previewHtml: string | null;
  isLoadingPreview: boolean;
}

export default function EmailTemplatesPage() {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery<TemplateRow[]>({
    queryKey: ['email-templates'],
    queryFn: fetchTemplates,
  });

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [resetConfirmKey, setResetConfirmKey] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: (vars: { key: string; subject: string; html_body: string; plain_text_body?: string }) =>
      saveTemplate(vars.key, { subject: vars.subject, html_body: vars.html_body, plain_text_body: vars.plain_text_body }),
    onSuccess: () => {
      toast.success('Template saved successfully');
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      setEditor(null);
    },
    onError: () => toast.error('Failed to save template'),
  });

  const resetMutation = useMutation({
    mutationFn: resetTemplate,
    onSuccess: () => {
      toast.success('Template reset to system default');
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      setResetConfirmKey(null);
    },
    onError: () => toast.error('Failed to reset template'),
  });

  const openEditor = (t: TemplateRow) => {
    setEditor({
      key: t.template_key,
      subject: t.custom_subject || t.default_subject,
      html_body: t.custom_html_body || '',
      plain_text_body: t.custom_plain_text_body || '',
      showPlainText: false,
      previewHtml: null,
      isLoadingPreview: false,
    });
  };

  const insertVariable = (variable: string) => {
    if (!editor) return;
    setEditor((e) => e ? { ...e, html_body: e.html_body + variable } : e);
  };

  const loadPreview = async () => {
    if (!editor) return;
    setEditor((e) => e ? { ...e, isLoadingPreview: true } : e);
    try {
      const html = await fetchPreview(editor.key);
      setEditor((e) => e ? { ...e, previewHtml: html, isLoadingPreview: false } : e);
    } catch {
      toast.error('Preview failed');
      setEditor((e) => e ? { ...e, isLoadingPreview: false } : e);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Mail className="w-6 h-6 text-primary" />
          Email Notification Templates
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Customize the HTML email templates sent to users. Changes override the system defaults per tenant.
        </p>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.template_key}
              className="bg-white rounded-xl border p-5 space-y-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 text-sm truncate">{t.display_name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    Subject: {t.custom_subject || t.default_subject}
                  </p>
                </div>
                {t.is_customized && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                    Customized
                  </span>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => openEditor(t)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                {t.is_customized && (
                  <button
                    onClick={() => setResetConfirmKey(t.template_key)}
                    className="flex items-center gap-1.5 px-3 py-2 border text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {resetConfirmKey && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-semibold text-gray-900">Reset Template?</h3>
            <p className="text-sm text-gray-500">
              This will revert "{resetConfirmKey}" back to the system default. Your customizations will be lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setResetConfirmKey(null)}
                className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => resetMutation.mutate(resetConfirmKey)}
                disabled={resetMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60"
              >
                {resetMutation.isPending ? 'Resetting...' : 'Reset to Default'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Drawer */}
      {editor && (
        <div className="fixed inset-0 bg-black/40 flex items-stretch justify-end z-50">
          <div className="bg-white w-full max-w-2xl flex flex-col overflow-hidden shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900">Edit Template: {editor.key}</h2>
              <button onClick={() => setEditor(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Subject Line</label>
                <input
                  type="text"
                  value={editor.subject}
                  onChange={(e) => setEditor((s) => s ? { ...s, subject: e.target.value } : s)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Email subject..."
                />
              </div>

              {/* Variables */}
              {TEMPLATE_VARIABLE_MAP[editor.key] && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Available Variables (click to insert)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {TEMPLATE_VARIABLE_MAP[editor.key].map((v) => (
                      <button
                        key={v}
                        onClick={() => insertVariable(v)}
                        className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-mono hover:bg-blue-100 transition-colors"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* HTML Editor */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">HTML Body (content block only)</label>
                <textarea
                  value={editor.html_body}
                  onChange={(e) => setEditor((s) => s ? { ...s, html_body: e.target.value } : s)}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary focus:outline-none resize-none"
                  rows={14}
                  placeholder="Enter HTML content..."
                />
              </div>

              {/* Plain Text (collapsible) */}
              <div>
                <button
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                  onClick={() => setEditor((s) => s ? { ...s, showPlainText: !s.showPlainText } : s)}
                >
                  {editor.showPlainText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Plain Text Fallback (optional)
                </button>
                {editor.showPlainText && (
                  <textarea
                    value={editor.plain_text_body}
                    onChange={(e) => setEditor((s) => s ? { ...s, plain_text_body: e.target.value } : s)}
                    className="mt-2 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none"
                    rows={5}
                    placeholder="Plain text version..."
                  />
                )}
              </div>

              {/* Live Preview */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-700">Preview</label>
                  <button
                    onClick={loadPreview}
                    disabled={editor.isLoadingPreview}
                    className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {editor.isLoadingPreview ? 'Loading...' : 'Refresh Preview'}
                  </button>
                </div>
                {editor.previewHtml ? (
                  <iframe
                    srcDoc={editor.previewHtml}
                    className="w-full h-64 border rounded-lg"
                    title="Template Preview"
                  />
                ) : (
                  <div className="w-full h-24 border rounded-lg flex items-center justify-center text-gray-400 text-sm">
                    Click "Refresh Preview" to see a rendered preview
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setEditor(null)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  saveMutation.mutate({
                    key: editor.key,
                    subject: editor.subject,
                    html_body: editor.html_body,
                    plain_text_body: editor.plain_text_body || undefined,
                  })
                }
                disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
              >
                {saveMutation.isPending ? (
                  'Saving...'
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
