import { FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * There is no invoices API yet: billing runs through LemonSqueezy. This page used
 * to show hard-coded sample invoices, which looked like real revenue figures.
 */
export default function Invoices() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <p className="text-gray-500 mt-1">Billing history for tenant subscriptions</p>
      </div>
      <Card>
        <CardContent className="py-16 flex flex-col items-center text-center gap-3">
          <div className="p-3 rounded-full bg-gray-100">
            <FileText className="h-6 w-6 text-gray-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">No invoice data yet</h2>
          <p className="text-sm text-gray-500 max-w-md">
            Payments are processed by LemonSqueezy. Invoices and receipts are available in your
            LemonSqueezy dashboard until they are synced into this panel.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
