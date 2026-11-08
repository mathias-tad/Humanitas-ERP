import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/context/AuthContext';
import {
  FileText,
  Upload,
  Plus,
  Search,
  BookOpen,
  Trash2,
  CheckCircle2,
  FileCheck,
  Shield,
  Layers,
  Sparkles,
  Eye,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

const API = import.meta.env.VITE_API_URL || '';

export interface KnowledgeDocument {
  id: string;
  company_id?: string;
  branch_id?: string;
  title: string;
  category: string;
  content_type: 'text' | 'file';
  file_name?: string;
  file_size?: number;
  summary?: string;
  metadata?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  chunk_count?: number;
  chunks?: {
    id: string;
    chunk_index: number;
    section_title?: string;
    chunk_text: string;
    page_number?: number;
    token_count?: number;
  }[];
}

const CATEGORIES = [
  { value: 'all', label: 'All Documents' },
  { value: 'company_policy', label: 'Company Policies', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'legal_proclamation', label: 'Labour Proclamations', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'employment_agreement', label: 'Employment Contracts', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: 'code_of_conduct', label: 'Code of Conduct', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'benefits_guide', label: 'Benefits & Insurance', color: 'bg-teal-100 text-teal-800 border-teal-300' },
  { value: 'disciplinary_rules', label: 'Disciplinary Rules', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  { value: 'custom', label: 'Custom Guidelines', color: 'bg-gray-100 text-gray-800 border-gray-300' },
];

export function CompanyKnowledgeVaultTab() {
  const qc = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [inspectDoc, setInspectDoc] = useState<KnowledgeDocument | null>(null);

  // Upload state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('company_policy');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Write state
  const [writeTitle, setWriteTitle] = useState('');
  const [writeCategory, setWriteCategory] = useState('company_policy');
  const [writeContent, setWriteContent] = useState('');
  const [writeSummary, setWriteSummary] = useState('');

  // Test retrieval state
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch documents
  const { data: documents = [], isLoading } = useQuery<KnowledgeDocument[]>({
    queryKey: ['ai-knowledge-vault-docs', selectedCategory, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      const res = await fetch(`${API}/ai/knowledge-vault/documents?${params.toString()}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load documents');
      return res.json();
    },
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('Please select a file to upload');
      if (!uploadTitle.trim()) throw new Error('Please enter a title');

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle.trim());
      formData.append('category', uploadCategory);

      const headers = getAuthHeaders();
      delete (headers as any)['Content-Type'];

      const res = await fetch(`${API}/ai/knowledge-vault/documents`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Upload failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`"${data.title}" indexed successfully with ${data.chunk_count} chunks!`);
      setIsUploadModalOpen(false);
      setUploadTitle('');
      setUploadFile(null);
      qc.invalidateQueries({ queryKey: ['ai-knowledge-vault-docs'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to upload document');
    },
  });

  // Write Mutation
  const writeMutation = useMutation({
    mutationFn: async () => {
      if (!writeTitle.trim()) throw new Error('Please provide a title');
      if (!writeContent.trim()) throw new Error('Please provide policy content');

      const res = await fetch(`${API}/ai/knowledge-vault/documents`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title: writeTitle.trim(),
          category: writeCategory,
          content_type: 'text',
          raw_text: writeContent.trim(),
          summary: writeSummary.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Creation failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Policy "${data.title}" saved and indexed with ${data.chunk_count} chunks!`);
      setIsWriteModalOpen(false);
      setWriteTitle('');
      setWriteContent('');
      setWriteSummary('');
      qc.invalidateQueries({ queryKey: ['ai-knowledge-vault-docs'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save policy');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API}/ai/knowledge-vault/documents/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Delete failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Document deleted');
      qc.invalidateQueries({ queryKey: ['ai-knowledge-vault-docs'] });
    },
    onError: () => toast.error('Failed to delete document'),
  });

  // Inspect Doc Query
  const { data: inspectedDocDetail, isLoading: isLoadingDetail } = useQuery<KnowledgeDocument>({
    queryKey: ['ai-knowledge-vault-doc', inspectDoc?.id],
    queryFn: async () => {
      if (!inspectDoc?.id) return null as any;
      const res = await fetch(`${API}/ai/knowledge-vault/documents/${inspectDoc.id}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load document details');
      return res.json();
    },
    enabled: !!inspectDoc?.id,
  });

  // Handle test search
  const handleTestSearch = async () => {
    if (!testQuery.trim()) return;
    try {
      setIsSearching(true);
      const res = await fetch(`${API}/ai/knowledge-vault/search`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ query: testQuery.trim(), limit: 4 }),
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setTestResults(data || []);
    } catch {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const totalDocs = documents.length;
  const activeDocs = documents.filter((d) => d.is_active).length;
  const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0);

  const getCategoryBadge = (catKey: string) => {
    const found = CATEGORIES.find((c) => c.value === catKey);
    return found ? (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${found.color}`}>
        {found.label}
      </span>
    ) : (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
        {catKey}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-600">
                <BookOpen className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Company Knowledge & Policy Vault
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 max-w-2xl">
              Upload official company handbooks, labour proclamations, signed employee agreements, and rules.
              The AI answers employee questions citing exact document sections with <strong>zero guessing</strong>.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsWriteModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 transition shadow-sm"
            >
              <Plus className="w-4 h-4 text-amber-500" /> Write Policy
            </button>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition shadow-sm"
            >
              <Upload className="w-4 h-4" /> Upload Document
            </button>
          </div>
        </div>

        {/* KPI Mini Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-amber-500/10">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-xl p-3 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500">Total Documents</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{totalDocs}</p>
          </div>
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-xl p-3 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500">Active Policies</p>
            <p className="text-lg font-bold text-emerald-600">{activeDocs}</p>
          </div>
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-xl p-3 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500">Indexed Chunks</p>
            <p className="text-lg font-bold text-indigo-600">{totalChunks}</p>
          </div>
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-xl p-3 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500">RAG Zero-Guessing</p>
            <p className="text-lg font-bold text-amber-600 flex items-center gap-1">
              <Shield className="w-4 h-4" /> Enforced
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {CATEGORIES.slice(0, 5).map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition ${
                selectedCategory === cat.value
                  ? 'bg-amber-500 text-white font-semibold'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
      </div>

      {/* Document Grid / Table */}
      {isLoading ? (
        <div className="p-12 text-center text-gray-500">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">No Knowledge Documents Yet</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Upload your first employee contract, company policy handbook, or labour proclamation to empower the AI assistant with verified knowledge.
          </p>
          <div className="flex justify-center gap-3 mt-4">
            <button
              onClick={() => setIsWriteModalOpen(true)}
              className="text-xs font-semibold px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200"
            >
              Write Policy
            </button>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="text-xs font-semibold px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
            >
              Upload Document
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                      {doc.content_type === 'file' ? (
                        <FileText className="w-5 h-5 text-amber-500" />
                      ) : (
                        <BookOpen className="w-5 h-5 text-indigo-500" />
                      )}
                    </span>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">
                        {doc.title}
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        {doc.content_type === 'file' ? `File: ${doc.file_name || 'Uploaded Document'}` : 'Direct Text Input'} • {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {getCategoryBadge(doc.category)}
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 mt-3 line-clamp-2">
                  {doc.summary || 'Official knowledge policy document indexed for AI retrieval.'}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
                    <Layers className="w-3.5 h-3.5 text-amber-500" />
                    {doc.chunk_count || 1} chunks
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Active in RAG
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setInspectDoc(doc)}
                    className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition"
                    title="Inspect chunks"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
                        deleteMutation.mutate(doc.id);
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Interactive AI Retrieval Simulator */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-gray-900 dark:text-white text-base">
            Test AI Policy Retrieval (Live Verification)
          </h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Test what excerpts and citations the AI will retrieve when an employee asks a legal or policy question.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. What is our probation period? or How many days notice for resignation?"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTestSearch()}
            className="flex-1 px-4 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
          <button
            onClick={handleTestSearch}
            disabled={isSearching || !testQuery.trim()}
            className="px-5 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-xl transition shadow-sm"
          >
            {isSearching ? 'Retrieving...' : 'Test Retrieval'}
          </button>
        </div>

        {testResults && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Retrieved {testResults.length} Verified Policy Chunk(s):
            </p>
            {testResults.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                No matching policy chunks found. Under the <strong>Zero-Guessing Rule</strong>, the AI will state that this is not covered and advise the employee to check with HR.
              </p>
            ) : (
              testResults.map((r, i) => (
                <div key={i} className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-400">
                    <span>
                      Citation: [{r.document_title}] • {r.section_title || 'General Clause'}
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      Match Score: {r.relevance_score}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 italic">
                    "{r.chunk_text}"
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-gray-900 dark:text-white">Upload Company Policy Document</h3>
              </div>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Document Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Employee Handbook 2026 or Labour Proclamation No. 1156"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Category</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  {CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Select File (PDF, DOCX, TXT) *</label>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setUploadFile(e.target.files[0]);
                      if (!uploadTitle) {
                        setUploadTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                      }
                    }
                  }}
                  className="w-full mt-1 px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-dashed border-amber-300 rounded-xl cursor-pointer"
                />
                {uploadFile && (
                  <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5" /> Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending || !uploadFile || !uploadTitle}
                className="px-5 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-xl shadow-sm"
              >
                {uploadMutation.isPending ? 'Extracting & Indexing...' : 'Upload & Index'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Write Policy Modal */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-gray-100 dark:border-gray-700 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-gray-900 dark:text-white">Write Company Policy / Guideline</h3>
              </div>
              <button onClick={() => setIsWriteModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Policy Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Remote Work Policy 2026"
                    value={writeTitle}
                    onChange={(e) => setWriteTitle(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Category</label>
                  <select
                    value={writeCategory}
                    onChange={(e) => setWriteCategory(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    {CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Executive Summary (Optional)</label>
                <input
                  type="text"
                  placeholder="Short description of this policy"
                  value={writeSummary}
                  onChange={(e) => setWriteSummary(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Full Policy Content *</label>
                  <span className="text-[11px] text-gray-400">Tip: Use SECTION 1:, ARTICLE 2:, etc. for auto-chunking</span>
                </div>
                <textarea
                  rows={10}
                  placeholder={`SECTION 1: PURPOSE\nThis policy defines...\n\nSECTION 2: ELIGIBILITY & PROBATION\nEmployees with 3+ months of service...`}
                  value={writeContent}
                  onChange={(e) => setWriteContent(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setIsWriteModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => writeMutation.mutate()}
                disabled={writeMutation.isPending || !writeTitle || !writeContent}
                className="px-5 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-xl shadow-sm"
              >
                {writeMutation.isPending ? 'Saving & Indexing...' : 'Save & Index Policy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Chunks Modal */}
      {inspectDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-gray-100 dark:border-gray-700 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base">
                  {inspectDoc.title}
                </h3>
                <p className="text-xs text-gray-500">
                  {inspectedDocDetail?.chunks?.length || 0} Indexed Knowledge Chunks
                </p>
              </div>
              <button onClick={() => setInspectDoc(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {isLoadingDetail ? (
                <p className="text-xs text-gray-500 text-center py-6">Loading indexed chunks...</p>
              ) : inspectedDocDetail?.chunks?.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-bold text-gray-800 dark:text-gray-200">
                    <span className="text-amber-600 font-semibold">
                      Chunk #{c.chunk_index}: {c.section_title || 'General Section'}
                    </span>
                    <span className="text-[10px] text-gray-400">~{c.token_count || 0} tokens</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {c.chunk_text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
