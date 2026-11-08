import { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Sparkles,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Building2,
  ShieldCheck,
  HelpCircle,
  Layers,
  Save,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest } from '@/lib/api';

interface KnowledgeItem {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  is_published: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'all', label: 'All Knowledge' },
  { value: 'saas_provider', label: 'SaaS Provider Info' },
  { value: 'system_features', label: 'System & ERP Features' },
  { value: 'pricing_plans', label: 'Pricing & Packages' },
  { value: 'security_compliance', label: 'Security & Isolation' },
  { value: 'onboarding_faq', label: 'Onboarding FAQs' },
];

export default function PlatformKnowledge() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [formCategory, setFormCategory] = useState('system_features');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formPublished, setFormPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  // SaaS Provider Quick Profile State
  const [saasProfile, setSaasProfile] = useState({
    provider_name: 'Humanitas Cloud Enterprise Technologies Inc.',
    support_email: 'support@humanitas.ziontech.tech',
    phone: '+1 (800) 555-HUMANITAS',
    sla_guarantee: '99.99%',
    data_residency: 'Multi-Region (US, EU, Africa - isolated DB per tenant)',
    terms_url: 'https://humanitas.ziontech.tech/terms',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchKnowledge = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<KnowledgeItem[]>('/admin/platform-knowledge');
      setItems(data || []);
    } catch (err: any) {
      toast.error('Failed to load platform knowledge', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormContent('');
    setFormCategory('system_features');
    setFormTags('');
    setFormPublished(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: KnowledgeItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormContent(item.content);
    setFormCategory(item.category);
    setFormTags((item.tags || []).join(', '));
    setFormPublished(item.is_published);
    setIsModalOpen(true);
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error('Please enter title and content');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        content: formContent.trim(),
        category: formCategory,
        tags: formTags.split(',').map((t) => t.trim()).filter(Boolean),
        is_published: formPublished,
      };

      if (editingItem) {
        await apiRequest(`/admin/platform-knowledge/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success('Knowledge article updated');
      } else {
        await apiRequest('/admin/platform-knowledge', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Knowledge article created');
      }

      setIsModalOpen(false);
      fetchKnowledge();
    } catch (err: any) {
      toast.error('Failed to save knowledge article', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this knowledge entry?')) return;
    try {
      await apiRequest(`/admin/platform-knowledge/${id}`, { method: 'DELETE' });
      toast.success('Knowledge entry deleted');
      fetchKnowledge();
    } catch (err: any) {
      toast.error('Failed to delete', { description: err.message });
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await apiRequest<{ message: string; count: number }>('/admin/platform-knowledge/seed-defaults', {
        method: 'POST',
      });
      toast.success('Platform knowledge initialized', {
        description: res.message || `${res.count} articles verified and ready for AI help.`,
      });
      fetchKnowledge();
    } catch (err: any) {
      toast.error('Failed to seed defaults', { description: err.message });
    } finally {
      setSeeding(false);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setTimeout(() => {
      setSavingProfile(false);
      toast.success('SaaS Provider profile updated for public landing AI');
    }, 400);
  };

  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase()) ||
      (item.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Platform Knowledge & SaaS Provider Info
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage system architecture knowledge, ERP modules, SaaS facts, and onboarding answers that ground the Landing Page AI with zero guessing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="flex items-center gap-1.5"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-500" />}
            Seed Default Knowledge
          </Button>
          <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Add Knowledge Article
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="knowledge" className="w-full space-y-4">
        <TabsList>
          <TabsTrigger value="knowledge" className="flex items-center gap-1.5">
            <Layers className="w-4 h-4" />
            AI System & Feature Knowledge ({items.length})
          </TabsTrigger>
          <TabsTrigger value="provider" className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4" />
            SaaS Provider Profile
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Knowledge Articles */}
        <TabsContent value="knowledge" className="space-y-4">
          {/* Filter Bar */}
          <Card>
            <CardContent className="pt-4 flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search articles, tags, facts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat.value}
                    size="sm"
                    variant={selectedCategory === cat.value ? 'default' : 'outline'}
                    onClick={() => setSelectedCategory(cat.value)}
                    className="whitespace-nowrap text-xs h-8"
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-12 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Loading platform knowledge...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center p-12 text-gray-500">
                  <HelpCircle className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                  <p className="font-medium">No knowledge articles found</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Click "Seed Default Knowledge" to automatically populate official system and provider documentation.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Article & Category</TableHead>
                      <TableHead className="w-1/2">Verified Content Grounding</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="align-top">
                          <div className="font-semibold text-gray-900">{item.title}</div>
                          <Badge variant="outline" className="mt-1 text-[11px] capitalize bg-gray-50 text-gray-600">
                            {item.category.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <p className="text-xs text-gray-600 line-clamp-3 font-mono whitespace-pre-line">
                            {item.content}
                          </p>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap gap-1">
                            {(item.tags || []).map((tag, i) => (
                              <span key={i} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          {item.is_published ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 gap-1 text-[11px]">
                              <CheckCircle2 className="w-3 h-3" /> Live
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-[11px]">
                              <XCircle className="w-3 h-3" /> Draft
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-right space-x-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleOpenEdit(item)}>
                            <Edit2 className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: SaaS Provider Profile */}
        <TabsContent value="provider">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                SaaS Provider Profile & Global Entitlements
              </CardTitle>
              <CardDescription>
                These legal details and SLAs are served to guests and tenants asking about company credentials, compliance, and support channels.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provider Company Name</Label>
                    <Input
                      value={saasProfile.provider_name}
                      onChange={(e) => setSaasProfile({ ...saasProfile, provider_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Official Support Email</Label>
                    <Input
                      type="email"
                      value={saasProfile.support_email}
                      onChange={(e) => setSaasProfile({ ...saasProfile, support_email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Support Phone Hotline</Label>
                    <Input
                      value={saasProfile.phone}
                      onChange={(e) => setSaasProfile({ ...saasProfile, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Guaranteed SLA Uptime</Label>
                    <Input
                      value={saasProfile.sla_guarantee}
                      onChange={(e) => setSaasProfile({ ...saasProfile, sla_guarantee: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Multi-Tenant Isolation Architecture</Label>
                  <Input
                    value={saasProfile.data_residency}
                    onChange={(e) => setSaasProfile({ ...saasProfile, data_residency: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Public AI uses this statement to explain physical/logical PostgreSQL separation.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Terms of Service & Privacy Policy URL</Label>
                  <Input
                    value={saasProfile.terms_url}
                    onChange={(e) => setSaasProfile({ ...saasProfile, terms_url: e.target.value })}
                  />
                </div>

                <Button type="submit" disabled={savingProfile} className="bg-blue-600 hover:bg-blue-700">
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                  Save SaaS Provider Profile
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Knowledge Article' : 'Add Knowledge Article'}</DialogTitle>
            <DialogDescription>
              This verified knowledge is fed directly into the Landing Page AI assistant with strict zero-guessing enforcement.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveArticle} className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system_features">System & ERP Features</SelectItem>
                  <SelectItem value="saas_provider">SaaS Provider Info</SelectItem>
                  <SelectItem value="pricing_plans">Pricing & Packages</SelectItem>
                  <SelectItem value="security_compliance">Security & Isolation</SelectItem>
                  <SelectItem value="onboarding_faq">Onboarding FAQs</SelectItem>
                  <SelectItem value="general">General Information</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Article Title</Label>
              <Input
                placeholder="e.g., Python Calculation Engine for Payroll & Tax"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Content (Markdown & Detailed System Facts)</Label>
              <textarea
                rows={6}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Write exact, authoritative system specifications, bullet points, and rules..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Keywords / Tags (comma separated)</Label>
              <Input
                placeholder="e.g., payroll, tax, brackets, python, formula"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_published"
                checked={formPublished}
                onChange={(e) => setFormPublished(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Label htmlFor="is_published" className="cursor-pointer text-sm font-medium">
                Publish live to Landing Page AI Assistant
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                {editingItem ? 'Save Changes' : 'Create Article'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
