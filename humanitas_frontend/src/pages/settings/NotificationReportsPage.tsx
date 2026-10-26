import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getAuthHeaders } from '@/context/AuthContext';
import { API_BASE_URL } from '@/config/api.config';
import { BarChart2, Users, Mail, Bell, AlertCircle, ArrowLeft, Copy, Check, Webhook, Send } from 'lucide-react';
import { toast } from 'sonner';

const API = import.meta.env.VITE_API_URL || API_BASE_URL;

export default function NotificationReportsPage() {
  const [days, setDays] = useState(30);

  const { data: deliveryStats } = useQuery({
    queryKey: ['notif-delivery-stats', days],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`${API}/notifications/reports/delivery-stats?days=${days}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      return res.ok ? res.json() : {};
    },
  });

  const { data: prefDist } = useQuery({
    queryKey: ['notif-pref-dist'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`${API}/notifications/reports/preference-distribution`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      return res.ok ? res.json() : {};
    },
  });

  const { data: channelSummary = [] } = useQuery({
    queryKey: ['notif-channel-summary', days],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`${API}/notifications/reports/channel-summary?days=${days}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      return res.ok ? res.json() : [];
    },
  });

  const { data: emailAnalytics } = useQuery({
    queryKey: ['notif-email-analytics', days],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`${API}/notifications/reports/email-analytics?days=${days}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      return res.ok ? res.json() : {};
    },
  });

  const { data: bouncedEmails = [], refetch: refetchBounced } = useQuery({
    queryKey: ['notif-bounced-emails'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`${API}/notifications/reports/bounced-emails?limit=25`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      return res.ok ? res.json() : [];
    },
  });

  const bounceWebhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/notifications/email/webhook/bounce`
    : '/api/notifications/email/webhook/bounce';
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(bounceWebhookUrl);
    setCopiedWebhook(true);
    toast.success('Bounce webhook URL copied to clipboard');
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleSimulateBounce = async () => {
    setIsSimulating(true);
    try {
      await fetch(`${API}/notifications/email/webhook/bounce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          messageId: 'sim-' + Date.now(),
          reason: 'Simulated hard bounce: User mailbox inactive or unreachable',
          email: 'sample.bounce@example.com',
        }),
      });
      toast.success('Simulated bounce event recorded successfully');
      refetchBounced();
    } catch {
      toast.error('Failed to simulate bounce');
    } finally {
      setIsSimulating(false);
    }
  };

  const totalSent = deliveryStats?.total_sent ?? deliveryStats?.summary?.total_sent ?? 0;
  const delivered = deliveryStats?.total_delivered ?? deliveryStats?.delivered ?? deliveryStats?.summary?.delivered ?? 0;
  const failed = deliveryStats?.total_failed ?? deliveryStats?.failed ?? deliveryStats?.summary?.failed ?? 0;
  const deliveryRate =
    deliveryStats?.delivery_rate !== undefined
      ? `${deliveryStats.delivery_rate}%`
      : totalSent > 0
      ? `${Math.round((delivered * 100) / totalSent)}%`
      : '—';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/settings/notifications"
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            title="Back to Preferences"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notification Reports</h1>
            <p className="text-gray-500 text-sm">Delivery rates, preference distribution, and channel analytics</p>
          </div>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Delivery Stats KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Sent',
            value: totalSent,
            icon: Bell,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            label: 'Delivered',
            value: delivered,
            icon: BarChart2,
            color: 'text-green-600',
            bg: 'bg-green-50',
          },
          {
            label: 'Failed',
            value: failed,
            icon: AlertCircle,
            color: 'text-red-500',
            bg: 'bg-red-50',
          },
          {
            label: 'Delivery Rate',
            value: deliveryRate,
            icon: Mail,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preference Distribution */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> User Preference Distribution
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ['Email Only', prefDist?.email_only ?? 0],
            ['Push Only', prefDist?.push_only ?? 0],
            ['Both', prefDist?.both ?? 0],
            ['None', prefDist?.none ?? 0],
          ].map(([label, count]) => (
            <div key={label} className="text-center p-3 rounded-lg bg-gray-50 border border-gray-100">
              <p className="text-3xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Email Engagement & Deliverability (Opens & Bounces) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" /> Email Open & Bounce Analytics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-blue-50/50 border border-blue-100">
            <p className="text-3xl font-bold text-gray-900">{emailAnalytics?.total_emails_sent ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Total Emails</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-50/50 border border-green-100">
            <p className="text-3xl font-bold text-green-700">{emailAnalytics?.opened_count ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">
              Opened ({emailAnalytics?.open_rate_percent ?? 0}%)
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-50/50 border border-amber-100">
            <p className="text-3xl font-bold text-amber-700">{emailAnalytics?.bounced_count ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">
              Bounced ({emailAnalytics?.bounce_rate_percent ?? 0}%)
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-purple-50/50 border border-purple-100">
            <p className="text-3xl font-bold text-purple-700">{emailAnalytics?.delivery_rate_percent ?? 100}%</p>
            <p className="text-xs text-gray-500 mt-1">Deliverability Rate</p>
          </div>
        </div>
      </div>

      {/* Channel Summary Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Channel Performance</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Channel', 'Sent', 'Delivered', 'Failed', 'Rate'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {channelSummary.map((row: any) => (
              <tr key={row.channel} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium capitalize text-gray-800">{row.channel}</td>
                <td className="px-4 py-3 text-gray-700">{row.sent}</td>
                <td className="px-4 py-3 text-green-600 font-medium">{row.delivered}</td>
                <td className="px-4 py-3 text-red-500 font-medium">{row.failed}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {row.sent > 0 ? `${Math.round((row.delivered * 100) / row.sent)}%` : '—'}
                </td>
              </tr>
            ))}
            {!channelSummary.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No delivery data yet for the selected period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Email Bounce Webhook Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-semibold text-gray-800">Email Bounce Webhook Integration</h2>
              <p className="text-xs text-gray-500">
                Configure this endpoint in your email provider (SendGrid, Mailgun, AWS SES, Postmark) to automatically record bounces.
              </p>
            </div>
          </div>
          <button
            onClick={handleSimulateBounce}
            disabled={isSimulating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {isSimulating ? 'Sending...' : 'Simulate Test Bounce'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={bounceWebhookUrl}
            className="flex-1 bg-gray-50 border border-gray-200 text-gray-700 font-mono text-xs px-3 py-2 rounded-lg select-all"
          />
          <button
            onClick={handleCopyWebhook}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors shrink-0"
          >
            {copiedWebhook ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedWebhook ? 'Copied' : 'Copy URL'}
          </button>
        </div>
      </div>

      {/* Bounced Emails Activity Log */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" /> Bounced Emails Log
          </h2>
          <span className="text-xs text-gray-500">Recent {bouncedEmails.length} records</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Recipient', 'Category / Template', 'Reason', 'Bounced Date'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bouncedEmails.map((item: any) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{item.recipient_email || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-600 font-mono">{item.template_name || item.category || 'email'}</td>
                <td className="px-4 py-3 text-xs text-red-600 max-w-xs truncate" title={item.error_message}>
                  {item.error_message || 'Delivery bounced by remote server'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {item.sent_at ? new Date(item.sent_at).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
            {!bouncedEmails.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No bounced emails detected. Your deliverability health is optimal!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
