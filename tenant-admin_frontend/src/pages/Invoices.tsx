import { useState } from 'react';
import {
  FileText,
  Search,
  Download,
  Eye,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockInvoices, mockTenants } from '@/data/mock-data';

const statusColors = {
  pending: 'warning',
  paid: 'success',
  failed: 'destructive',
  refunded: 'secondary',
} as const;

export default function Invoices() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const getTenantName = (tenantId: string) => {
    const tenant = mockTenants.find((t) => t.id === tenantId);
    return tenant?.company_name || 'Unknown';
  };

  const allInvoices = mockInvoices;

  const filteredInvoices = allInvoices.filter((invoice) => {
    const tenantName = getTenantName(invoice.tenant_id);
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenantName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalRevenue = allInvoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + i.total, 0);

  const pendingAmount = allInvoices
    .filter((i) => i.status === 'pending')
    .reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 mt-1">Manage billing and invoices</p>
        </div>
        <Button className="gap-2" variant="outline">
          <Download className="h-4 w-4" />
          Export All
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Revenue (Paid)</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${totalRevenue.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-100">
                <Calendar className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Payments</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${pendingAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-900">{allInvoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by invoice number or tenant..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg">All Invoices ({filteredInvoices.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Billing Period</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <FileText className="h-4 w-4 text-gray-600" />
                        </div>
                        <span className="font-medium">{invoice.invoice_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getTenantName(invoice.tenant_id)}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(invoice.billing_period_start).toLocaleDateString()} -{' '}
                      {new Date(invoice.billing_period_end).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{invoice.user_count}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">${invoice.total.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{invoice.currency}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[invoice.status]} className="capitalize">
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="h-4 w-4 text-gray-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="h-4 w-4 text-gray-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredInvoices.length === 0 && (
            <div className="p-8 text-center text-gray-500">No invoices found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
