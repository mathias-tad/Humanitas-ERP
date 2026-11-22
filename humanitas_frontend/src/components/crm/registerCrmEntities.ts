import { api } from '@/lib/api';
import { registerEntity } from '@/components/platform/entityRegistry';
import { formatMoney, leadWho, searchDeals, searchLeads, type Deal, type Lead } from '@/hooks/useCrm';
import { LeadForm } from './LeadForm';
import { OpportunityForm } from './OpportunityForm';

/** CRM records open in the side drawer from anywhere, and Ctrl+K finds them (featureslist §29). */
registerEntity<Lead>({
  type: 'crm_lead',
  label: 'lead',
  module: 'crm',
  permissions: { view: 'view_crm_leads', create: 'create_crm_leads' },
  search: searchLeads,
  toOption: (l) => ({ id: l.id, label: l.title, description: [l.code, leadWho(l)].join(' · ') }),
  quickCreate: (title) => api.post<Lead>('/crm/leads', { title, person_name: title }),
  Form: LeadForm,
});

registerEntity<Deal>({
  type: 'crm_opportunity',
  label: 'deal',
  module: 'crm',
  permissions: { view: 'view_crm_opportunities', create: 'create_crm_opportunities' },
  search: searchDeals,
  toOption: (d) => ({ id: d.id, label: d.name, description: [d.code, d.contact_name, `${formatMoney(d.expected_revenue)} · ${d.stage_name}`].filter(Boolean).join(' · ') }),
  quickCreate: (name) => api.post<Deal>('/crm/opportunities', { name }),
  Form: OpportunityForm,
});
