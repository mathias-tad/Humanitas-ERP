import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { KPITile } from '@/components/design-system/KPITile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Upload,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Trash2,
  Send,
  Sparkles,
  Printer,
  Loader2,
  Check,
} from 'lucide-react';
import { useHrmsDocuments, type EmployeeDocument, type LetterTemplate } from '@/hooks/useHrmsDocuments';
import { useUsers } from '@/hooks/useUsers';
import { toast } from 'sonner';

export default function HRDocumentsPage() {
  const {
    useDocuments,
    useExpiringSummary,
    useTemplates,
    createDocument,
    isCreatingDocument,
    verifyDocument,
    isVerifyingDocument,
    deleteDocument,
    generateLetter,
    isGeneratingLetter,
  } = useHrmsDocuments();

  const { data: usersData } = useUsers();
  const users = Array.isArray(usersData) ? usersData : [];

  const [activeTab, setActiveTab] = useState<'vault' | 'letters' | 'expirations'>('vault');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedExpiry, setSelectedExpiry] = useState<string>('all');

  // Modals state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [verifyModalDoc, setVerifyModalDoc] = useState<EmployeeDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<EmployeeDocument | null>(null);

  // Upload Form state
  const [uploadUserId, setUploadUserId] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('contract');
  const [uploadDocType, setUploadDocType] = useState('employment_contract');
  const [uploadFileUrl, setUploadFileUrl] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadExpiryDate, setUploadExpiryDate] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');

  // Verify Form state
  const [verifyStatus, setVerifyStatus] = useState<'verified' | 'rejected'>('verified');
  const [verifyNotes, setVerifyNotes] = useState('');

  // Letter Generator state
  const [selectedTemplateCode, setSelectedTemplateCode] = useState('OFFER_LETTER');
  const [letterEmployeeId, setLetterEmployeeId] = useState('');
  const [letterCustomNotes, setLetterCustomNotes] = useState('');
  const [letterPreview, setLetterPreview] = useState<{ subject: string; renderedHtml: string; renderedText: string } | null>(null);
  const [savedToVaultSuccess, setSavedToVaultSuccess] = useState(false);

  // Queries
  const { data: documentsData, isLoading: loadingDocs } = useDocuments({
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
    verificationStatus: selectedStatus !== 'all' ? selectedStatus : undefined,
    expiringWithinDays: selectedExpiry !== 'all' ? selectedExpiry : undefined,
    search: search.trim() || undefined,
  });
  const documents = Array.isArray(documentsData) ? documentsData : [];

  const { data: expiringSummary, isLoading: loadingExpiring } = useExpiringSummary();
  const { data: templatesData } = useTemplates();
  const templates: LetterTemplate[] = Array.isArray(templatesData) ? templatesData : [];

  // Summary counts
  const totalDocsCount = documents.length;
  const verifiedCount = documents.filter((d) => d.verification_status === 'verified').length;
  const pendingCount = documents.filter((d) => d.verification_status === 'pending').length;
  const expiring90DaysCount = expiringSummary?.expiring90Days ?? 0;

  // Selected Template
  const activeTemplate = useMemo(() => {
    return templates.find((t) => t.code === selectedTemplateCode) || templates[0];
  }, [templates, selectedTemplateCode]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadUserId || !uploadTitle || !uploadFileUrl) {
      toast.error('Please fill in employee, title, and file link');
      return;
    }
    try {
      await createDocument({
        userId: uploadUserId,
        title: uploadTitle,
        category: uploadCategory,
        documentType: uploadDocType,
        fileUrl: uploadFileUrl,
        fileName: uploadFileName || `${uploadTitle.replace(/\s+/g, '_')}.pdf`,
        expiryDate: uploadExpiryDate || undefined,
        notes: uploadNotes || undefined,
      });
      toast.success('Document uploaded to vault successfully');
      setUploadModalOpen(false);
      setUploadTitle('');
      setUploadFileUrl('');
      setUploadFileName('');
      setUploadExpiryDate('');
      setUploadNotes('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload document');
    }
  };

  const handleVerifySubmit = async () => {
    if (!verifyModalDoc) return;
    try {
      await verifyDocument({
        id: verifyModalDoc.id,
        status: verifyStatus,
        notes: verifyNotes || undefined,
      });
      toast.success(`Document marked as ${verifyStatus}`);
      setVerifyModalDoc(null);
      setVerifyNotes('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify document');
    }
  };

  const handleDelete = async (doc: EmployeeDocument) => {
    if (!confirm(`Are you sure you want to remove "${doc.title}"?`)) return;
    try {
      await deleteDocument(doc.id);
      toast.success('Document deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete document');
    }
  };

  const handleGenerateLetter = async (saveToVault = false) => {
    if (!letterEmployeeId) {
      toast.error('Please select an employee');
      return;
    }
    try {
      setSavedToVaultSuccess(false);
      const res = await generateLetter({
        templateIdOrCode: selectedTemplateCode,
        employeeId: letterEmployeeId,
        customTokens: letterCustomNotes ? { '{{notes}}': letterCustomNotes } : undefined,
        saveToVault,
      });
      setLetterPreview({
        subject: res.subject,
        renderedHtml: res.renderedHtml,
        renderedText: res.renderedText,
      });
      if (saveToVault) {
        setSavedToVaultSuccess(true);
        toast.success('Official letter generated and saved to employee vault!');
      } else {
        toast.success('Letter drafted and preview generated');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate letter');
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Employee Document Vault & Dynamic Letter Templates"
        description="Secure credential storage, compliance expiration tracking, and one-click employee letter generation with automated token replacement."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('letters')}
              className="gap-2 shadow-sm"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Issue Official Letter</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setUploadModalOpen(true)}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Document</span>
            </Button>
          </div>
        }
      />

      {/* 4 Executive KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPITile
          title="Total Documents Tracked"
          value={loadingDocs ? '...' : totalDocsCount.toString()}
          icon={FileText}
          iconColor="text-blue-500"
          iconBg="bg-blue-500/10"
          subtitle="Active files across personnel"
        />
        <KPITile
          title="Verified Documents"
          value={loadingDocs ? '...' : verifiedCount.toString()}
          icon={ShieldCheck}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/10"
          subtitle="Audited and confirmed by HR"
        />
        <KPITile
          title="Pending Verification"
          value={loadingDocs ? '...' : pendingCount.toString()}
          icon={Clock}
          iconColor="text-amber-500"
          iconBg="bg-amber-500/10"
          subtitle="Requires HR compliance review"
        />
        <KPITile
          title="Expirations (90 Days)"
          value={loadingExpiring ? '...' : expiring90DaysCount.toString()}
          icon={AlertTriangle}
          iconColor="text-rose-500"
          iconBg="bg-rose-500/10"
          subtitle={`${expiringSummary?.expiredCount ?? 0} currently expired`}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <button
          onClick={() => setActiveTab('vault')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'vault'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Document Vault</span>
        </button>

        <button
          onClick={() => setActiveTab('letters')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'letters'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Dynamic Letter Generator</span>
        </button>

        <button
          onClick={() => setActiveTab('expirations')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'expirations'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span>Compliance & Expirations</span>
          {expiring90DaysCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-bold">
              {expiring90DaysCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: Document Vault */}
      {activeTab === 'vault' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by title, employee, or type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-input bg-background focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Categories</option>
                <option value="contract">Contracts</option>
                <option value="identification">Identification (KYC)</option>
                <option value="tax_legal">Tax & Legal</option>
                <option value="letter">Letters</option>
                <option value="certification">Certifications</option>
                <option value="disciplinary">Disciplinary</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending Review</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={selectedExpiry}
                onChange={(e) => setSelectedExpiry(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Expirations</option>
                <option value="30">Expiring in 30 Days</option>
                <option value="60">Expiring in 60 Days</option>
                <option value="90">Expiring in 90 Days</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          {/* Documents Data Table */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            {loadingDocs ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <h4 className="text-sm font-semibold text-foreground">No documents found</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  No files match your search criteria. Click "Upload Document" to register an employee credential.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border/50">
                    <tr>
                      <th className="py-3 px-4">Document Title</th>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Verification</th>
                      <th className="py-3 px-4">Expiry Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {documents.map((doc) => {
                      const empName = `${doc.first_name || ''} ${doc.last_name || ''}`.trim() || doc.email;
                      return (
                        <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="font-semibold text-foreground">{doc.title}</span>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {doc.document_type} • {doc.file_name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground">{empName}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {doc.department || 'General'} • {doc.position || 'Staff'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[11px] capitalize">
                              {doc.category.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {doc.verification_status === 'verified' && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px] gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Verified</span>
                              </Badge>
                            )}
                            {doc.verification_status === 'pending' && (
                              <button
                                onClick={() => {
                                  setVerifyModalDoc(doc);
                                  setVerifyStatus('verified');
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20"
                              >
                                <Clock className="h-3 w-3" />
                                <span>Review</span>
                              </button>
                            )}
                            {doc.verification_status === 'rejected' && (
                              <Badge variant="destructive" className="text-[11px] gap-1">
                                <XCircle className="h-3 w-3" />
                                <span>Rejected</span>
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {doc.expiry_status === 'no_expiry' && (
                              <span className="text-muted-foreground">Permanent</span>
                            )}
                            {doc.expiry_status === 'valid' && (
                              <span className="text-emerald-600 font-medium">
                                Valid until {new Date(doc.expiry_date!).toLocaleDateString()}
                              </span>
                            )}
                            {doc.expiry_status === 'expiring_soon' && (
                              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-[10px]">
                                Expiring in {doc.days_until_expiry} days
                              </Badge>
                            )}
                            {doc.expiry_status === 'expired' && (
                              <Badge variant="destructive" className="text-[10px]">
                                Expired
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (doc.file_url.startsWith('data:text/html')) {
                                    setPreviewDoc(doc);
                                  } else {
                                    window.open(doc.file_url, '_blank');
                                  }
                                }}
                                className="h-7 w-7 p-0"
                                title="View / Download"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(doc)}
                                className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Dynamic Letter Generator */}
      {activeTab === 'letters' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Template Selection */}
            <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">1. Select Letter Template</h3>
                <p className="text-xs text-muted-foreground">Standardized HR employment and certification letters</p>
              </div>

              <div className="space-y-2">
                {templates.map((tpl) => (
                  <button
                    key={tpl.code}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateCode(tpl.code);
                      setLetterPreview(null);
                      setSavedToVaultSuccess(false);
                    }}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      selectedTemplateCode === tpl.code
                        ? 'border-primary bg-primary/10 shadow-xs'
                        : 'border-border/60 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-foreground">{tpl.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono uppercase">
                        {tpl.code}
                      </Badge>
                    </div>
                    {tpl.description && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{tpl.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Employee Picker & Tokens */}
            <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">2. Target Employee & Custom Details</h3>
                <p className="text-xs text-muted-foreground">Tokens like salary, role, and department auto-populate</p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Select Employee *</label>
                  <select
                    value={letterEmployeeId}
                    onChange={(e) => {
                      setLetterEmployeeId(e.target.value);
                      setLetterPreview(null);
                      setSavedToVaultSuccess(false);
                    }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Choose an employee --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email} ({u.position || 'Staff'} • {u.department || 'General'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Custom Notes / Special Conditions</label>
                  <textarea
                    rows={3}
                    placeholder="Optional remarks appended to letter..."
                    value={letterCustomNotes}
                    onChange={(e) => setLetterCustomNotes(e.target.value)}
                    className="w-full rounded-md border border-input bg-background p-2.5 text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <Button
                    onClick={() => handleGenerateLetter(false)}
                    disabled={!letterEmployeeId || isGeneratingLetter}
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                  >
                    {isGeneratingLetter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    <span>Preview Draft</span>
                  </Button>
                  <Button
                    onClick={() => handleGenerateLetter(true)}
                    disabled={!letterEmployeeId || isGeneratingLetter}
                    size="sm"
                    className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isGeneratingLetter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span>Issue to Vault</span>
                  </Button>
                </div>

                {savedToVaultSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-600 font-semibold text-xs animate-fade-in">
                    <Check className="h-4 w-4" />
                    <span>Official document saved to employee's vault!</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Letter Preview Column (7 cols) */}
          <div className="lg:col-span-7">
            <div className="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4 min-h-[600px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Official Document Letterhead Preview</h3>
                    <p className="text-xs text-muted-foreground">
                      {activeTemplate ? activeTemplate.name : 'Letter Draft'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!letterPreview) {
                        toast.error('Please generate preview first');
                        return;
                      }
                      const printWin = window.open('', '_blank');
                      if (printWin) {
                        printWin.document.write(letterPreview.renderedHtml);
                        printWin.document.close();
                        printWin.focus();
                        printWin.print();
                      }
                    }}
                    className="gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Print PDF</span>
                  </Button>
                </div>

                {letterPreview ? (
                  <div
                    className="p-4 bg-surface-1 rounded-lg border border-border/50 text-xs overflow-auto max-h-[650px]"
                    dangerouslySetInnerHTML={{ __html: letterPreview.renderedHtml }}
                  />
                ) : (
                  <div className="text-center py-24 space-y-2">
                    <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                    <h4 className="text-sm font-semibold text-foreground">Ready to Generate</h4>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Select an employee on the left and click "Preview Draft" to inspect token replacement and official layout.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Compliance & Expirations */}
      {activeTab === 'expirations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1">
              <span className="text-xs font-semibold text-rose-600">Expired Credentials</span>
              <div className="text-2xl font-bold text-rose-700">{expiringSummary?.expiredCount ?? 0}</div>
              <p className="text-[11px] text-muted-foreground">Non-compliant passports/visas</p>
            </div>
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
              <span className="text-xs font-semibold text-amber-600">Expiring in 30 Days</span>
              <div className="text-2xl font-bold text-amber-700">{expiringSummary?.expiring30Days ?? 0}</div>
              <p className="text-[11px] text-muted-foreground">Urgent renewal required</p>
            </div>
            <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-1">
              <span className="text-xs font-semibold text-blue-600">Expiring in 60 Days</span>
              <div className="text-2xl font-bold text-blue-700">{expiringSummary?.expiring60Days ?? 0}</div>
              <p className="text-[11px] text-muted-foreground">Upcoming in 2 months</p>
            </div>
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
              <span className="text-xs font-semibold text-emerald-600">Total Tracked</span>
              <div className="text-2xl font-bold text-emerald-700">{expiringSummary?.totalActiveTracked ?? 0}</div>
              <p className="text-[11px] text-muted-foreground">Credentials with expiry dates</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4">
            <h3 className="text-base font-bold text-foreground">Upcoming Credential Expirations</h3>
            <div className="space-y-3">
              {expiringSummary?.upcomingExpiringDocuments.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-lg bg-surface-1 border border-border/50 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-amber-500/10 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">
                        {item.title} ({item.document_type})
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {item.first_name} {item.last_name} • {item.department || 'General'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-mono text-amber-600 font-bold">
                      {item.days_remaining <= 0
                        ? 'Expired'
                        : `${item.days_remaining} days remaining (${new Date(item.expiry_date).toLocaleDateString()})`}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.success(`Renewal reminder dispatched to ${item.first_name}`)}
                      className="text-xs gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Remind</span>
                    </Button>
                  </div>
                </div>
              ))}
              {(!expiringSummary || expiringSummary.upcomingExpiringDocuments.length === 0) && (
                <p className="text-xs text-muted-foreground italic py-4 text-center">
                  All employee credentials are in compliance. No upcoming expirations within 90 days.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-bold text-foreground">Upload Document to Vault</h3>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Target Employee *</label>
                <select
                  value={uploadUserId}
                  onChange={(e) => setUploadUserId(e.target.value)}
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Select employee --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Document Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Ethiopian Passport Scan, BSc Degree Certificate"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Category</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="contract">Contract</option>
                    <option value="identification">Identification</option>
                    <option value="tax_legal">Tax & Legal</option>
                    <option value="letter">Letter</option>
                    <option value="certification">Certification</option>
                    <option value="disciplinary">Disciplinary</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Document Type</label>
                  <input
                    type="text"
                    placeholder="e.g. passport, degree, nda"
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">File URL / Download Link *</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={uploadFileUrl}
                  onChange={(e) => setUploadFileUrl(e.target.value)}
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Expiration Date (Optional)</label>
                <input
                  type="date"
                  value={uploadExpiryDate}
                  onChange={(e) => setUploadExpiryDate(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/50">
                <Button type="button" variant="outline" size="sm" onClick={() => setUploadModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isCreatingDocument} className="gap-2">
                  {isCreatingDocument ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span>Save Document</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify Modal */}
      {verifyModalDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4 animate-scale-in">
            <h3 className="text-base font-bold text-foreground">Review & Verify Document</h3>
            <p className="text-xs text-muted-foreground">
              Review credential "{verifyModalDoc.title}" for {verifyModalDoc.first_name} {verifyModalDoc.last_name}.
            </p>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVerifyStatus('verified')}
                  className={`p-2.5 rounded-lg border text-center font-bold ${
                    verifyStatus === 'verified'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  ✓ Approve
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyStatus('rejected')}
                  className={`p-2.5 rounded-lg border text-center font-bold ${
                    verifyStatus === 'rejected'
                      ? 'border-rose-500 bg-rose-500/10 text-rose-600'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  ✕ Reject
                </button>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Verification Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Verified against original physical passport"
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button variant="outline" size="sm" onClick={() => setVerifyModalDoc(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleVerifySubmit} disabled={isVerifyingDocument}>
                {isVerifyingDocument ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Review'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* HTML Document View Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-3xl p-6 space-y-4 max-h-[90vh] flex flex-col animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-bold text-foreground">{previewDoc.title}</h3>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-auto flex-1 p-4 bg-surface-1 rounded-lg border border-border/50">
              <div
                dangerouslySetInnerHTML={{
                  __html: decodeURIComponent(previewDoc.file_url.replace('data:text/html;charset=utf-8,', '')),
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button variant="outline" size="sm" onClick={() => setPreviewDoc(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
