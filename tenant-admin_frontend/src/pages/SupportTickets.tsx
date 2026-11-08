import { useState, useEffect } from 'react';
import {
  LifeBuoy,
  Search,
  Bot,
  User,
  MessageSquare,
  Loader2,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

interface SupportTicket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  contact_email: string;
  contact_name?: string;
  tenant_id?: string;
  category: string;
  priority: string;
  status: string;
  created_by_type: 'tenant' | 'ai_on_behalf';
  ai_conversation_summary?: string;
  resolution_notes?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

interface TicketMetrics {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  createdByAi: number;
  createdByTenant: number;
}

export default function SupportTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [metrics, setMetrics] = useState<TicketMetrics>({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    createdByAi: 0,
    createdByTenant: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Detail Modal
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editStatus, setEditStatus] = useState('open');
  const [editResolution, setEditResolution] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [updating, setUpdating] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (originFilter !== 'all') params.created_by_type = originFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      if (search.trim()) params.search = search.trim();

      const [ticketList, metricsData] = await Promise.all([
        apiRequest<SupportTicket[]>('/admin/support-tickets', { params }),
        apiRequest<TicketMetrics>('/admin/support-tickets/metrics'),
      ]);

      setTickets(ticketList || []);
      if (metricsData) setMetrics(metricsData);
    } catch (err: any) {
      toast.error('Failed to load support tickets', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, originFilter, priorityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTickets();
  };

  const handleOpenDetail = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setEditStatus(ticket.status);
    setEditResolution(ticket.resolution_notes || '');
    setEditPriority(ticket.priority);
    setIsModalOpen(true);
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    setUpdating(true);
    try {
      await apiRequest(`/admin/support-tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: editStatus,
          resolution_notes: editResolution.trim() || undefined,
          priority: editPriority,
        }),
      });

      toast.success(`Ticket #${selectedTicket.ticket_number} updated`);
      setIsModalOpen(false);
      fetchTickets();
    } catch (err: any) {
      toast.error('Failed to update ticket', { description: err.message });
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Open</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">In Progress</Badge>;
      case 'resolved':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Resolved</Badge>;
      case 'closed':
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge className="bg-red-100 text-red-800 border-red-200 font-bold">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">High</Badge>;
      case 'medium':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <LifeBuoy className="w-6 h-6 text-blue-600" />
          Human Support Center & Tickets
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Review tenant support inquiries escalated from the Landing Page AI Copilot or submitted directly by prospective/active tenants.
        </p>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="p-3">
          <div className="text-xs font-medium text-gray-500">Total Tickets</div>
          <div className="text-xl font-bold text-gray-900 mt-1">{metrics.total}</div>
        </Card>
        <Card className="p-3 bg-amber-50/50 border-amber-200">
          <div className="text-xs font-medium text-amber-700">Open Tickets</div>
          <div className="text-xl font-bold text-amber-800 mt-1">{metrics.open}</div>
        </Card>
        <Card className="p-3 bg-blue-50/50 border-blue-200">
          <div className="text-xs font-medium text-blue-700">In Progress</div>
          <div className="text-xl font-bold text-blue-800 mt-1">{metrics.inProgress}</div>
        </Card>
        <Card className="p-3 bg-emerald-50/50 border-emerald-200">
          <div className="text-xs font-medium text-emerald-700">Resolved</div>
          <div className="text-xl font-bold text-emerald-800 mt-1">{metrics.resolved}</div>
        </Card>
        <Card className="p-3 bg-purple-50/50 border-purple-200">
          <div className="text-xs font-medium text-purple-700 flex items-center gap-1">
            <Bot className="w-3.5 h-3.5 text-purple-600" />
            AI on Behalf
          </div>
          <div className="text-xl font-bold text-purple-800 mt-1">{metrics.createdByAi}</div>
        </Card>
        <Card className="p-3 bg-sky-50/50 border-sky-200">
          <div className="text-xs font-medium text-sky-700 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-sky-600" />
            Tenant Direct
          </div>
          <div className="text-xl font-bold text-sky-800 mt-1">{metrics.createdByTenant}</div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="pt-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by ticket #, email, subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </form>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            {/* Origin Filter */}
            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger className="w-36 h-9 text-xs">
                <SelectValue placeholder="Origin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Origins</SelectItem>
                <SelectItem value="ai_on_behalf">🤖 AI on Behalf</SelectItem>
                <SelectItem value="tenant">👤 Tenant Direct</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-32 h-9 text-xs">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading support tickets...
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center p-12 text-gray-500">
              <LifeBuoy className="w-10 h-10 mx-auto text-gray-400 mb-2" />
              <p className="font-medium">No support tickets found</p>
              <p className="text-xs text-gray-400 mt-1">
                Tickets created by tenants or by the AI Copilot on their behalf will appear here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Subject & Category</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Origin / Submitter</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id} className="hover:bg-gray-50/80 cursor-pointer" onClick={() => handleOpenDetail(ticket)}>
                    <TableCell className="font-mono text-xs font-bold text-blue-600">
                      {ticket.ticket_number}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-900 line-clamp-1">{ticket.subject}</div>
                      <span className="text-[11px] text-gray-500 capitalize">
                        {ticket.category.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium text-gray-800">{ticket.contact_name || 'Guest'}</div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-gray-400" />
                        {ticket.contact_email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {ticket.created_by_type === 'ai_on_behalf' ? (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-200 gap-1 text-[11px] font-medium">
                          <Bot className="w-3 h-3 text-purple-600" />
                          AI on Behalf
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 gap-1 text-[11px] font-medium">
                          <User className="w-3 h-3 text-sky-600" />
                          Tenant Direct
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                    <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(ticket);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail / Resolution Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedTicket && (
            <form onSubmit={handleUpdateTicket} className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-blue-600">
                    {selectedTicket.ticket_number}
                  </span>
                  {selectedTicket.created_by_type === 'ai_on_behalf' ? (
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200 gap-1.5 text-xs py-1">
                      <Bot className="w-3.5 h-3.5 text-purple-600" />
                      Created by AI on behalf of tenant
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 gap-1.5 text-xs py-1">
                      <User className="w-3.5 h-3.5 text-sky-600" />
                      Submitted Directly by Tenant
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-lg text-left mt-1">{selectedTicket.subject}</DialogTitle>
                <DialogDescription className="text-left text-xs">
                  Submitted on {new Date(selectedTicket.created_at).toLocaleString()} by {selectedTicket.contact_name} ({selectedTicket.contact_email})
                </DialogDescription>
              </DialogHeader>

              {/* AI Conversation Summary Callout (if created by AI) */}
              {selectedTicket.created_by_type === 'ai_on_behalf' && selectedTicket.ai_conversation_summary && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3.5 text-xs text-purple-900 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5 text-purple-800">
                    <MessageSquare className="w-4 h-4 text-purple-600" />
                    AI Assistant Escalation Context:
                  </div>
                  <p className="font-mono whitespace-pre-wrap bg-white/70 p-2.5 rounded border border-purple-100 text-gray-700">
                    {selectedTicket.ai_conversation_summary}
                  </p>
                </div>
              )}

              {/* Issue Description */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  Tenant Inquiry Description
                </Label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap">
                  {selectedTicket.description}
                </div>
              </div>

              {/* Update Controls */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>Ticket Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={editPriority} onValueChange={setEditPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Resolution / Admin Notes */}
              <div className="space-y-2">
                <Label>Admin Resolution Notes & Response</Label>
                <textarea
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Record internal notes or resolution steps taken by the operations team..."
                  value={editResolution}
                  onChange={(e) => setEditResolution(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Close
                </Button>
                <Button type="submit" disabled={updating} className="bg-blue-600 hover:bg-blue-700">
                  {updating && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                  Save Status & Notes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
