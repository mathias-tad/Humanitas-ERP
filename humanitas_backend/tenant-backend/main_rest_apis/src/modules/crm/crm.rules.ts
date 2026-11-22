/** CRM rules (pure; tested in crm.rules.spec.ts). */

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

/** Status moves a person can make by hand; converting and losing have their own actions. */
const MANUAL: Record<LeadStatus, LeadStatus[]> = {
  new: ['contacted', 'qualified'],
  contacted: ['new', 'qualified'],
  qualified: ['new', 'contacted'],
  converted: [],
  lost: ['new', 'contacted', 'qualified'],
};

export function leadStatusProblem(from: LeadStatus, to: LeadStatus): string | null {
  if (from === to) return null;
  if (to === 'converted') return 'Use Convert to turn the lead into a contact and an opportunity';
  if (to === 'lost') return 'Use Mark as lost and give the reason';
  if (from === 'converted') return 'This lead is converted; work on its opportunity instead';
  return MANUAL[from].includes(to) ? null : `A ${from} lead cannot become ${to}`;
}

/** The win probability of a deal: its own, else its stage's. */
export function dealProbability(deal: { probability: number | string | null }, stage: { probability: number | string }): number {
  return deal.probability === null || deal.probability === undefined ? Number(stage.probability) : Number(deal.probability);
}

/** Expected revenue × probability, rounded half-up to cents. */
export function weighted(revenue: number | string, probability: number): number {
  const cents = Math.round(Number(revenue) * 100);
  return Math.round((cents * probability) / 100) / 100;
}

/** "2026-03" for a date; null when there is none. */
export function monthOf(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  const s = typeof date === 'string' ? date : date.toISOString();
  return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : null;
}

/** Weighted forecast per expected-close month (open deals), oldest month first; deals without a date go to "none". */
export function forecastByMonth(deals: { expected_close_date: string | null; expected_revenue: number | string; probability: number }[]) {
  const by = new Map<string, { month: string; count: number; revenue: number; weighted: number }>();
  for (const d of deals) {
    const month = monthOf(d.expected_close_date) ?? 'none';
    const row = by.get(month) ?? { month, count: 0, revenue: 0, weighted: 0 };
    row.count += 1;
    row.revenue = Math.round((row.revenue + Number(d.expected_revenue)) * 100) / 100;
    row.weighted = Math.round((row.weighted + weighted(d.expected_revenue, d.probability)) * 100) / 100;
    by.set(month, row);
  }
  return [...by.values()].sort((a, b) => (a.month === 'none' ? 1 : b.month === 'none' ? -1 : a.month.localeCompare(b.month)));
}

/** Days a deal has been in its stage, and whether that is longer than the stage allows. */
export function stuck(stageChangedAt: string | Date, rottingDays: number | null, now = new Date()): { days: number; stuck: boolean } {
  const days = Math.floor((now.getTime() - new Date(stageChangedAt).getTime()) / 86_400_000);
  return { days, stuck: rottingDays !== null && rottingDays !== undefined && days > rottingDays };
}

/** Which bucket a to-do falls in for "My activities". */
export function activityBucket(a: { due_at: string | Date; done_at: string | Date | null }, now = new Date()): 'done' | 'overdue' | 'today' | 'upcoming' {
  if (a.done_at) return 'done';
  const due = new Date(a.due_at);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
  if (due < startOfDay) return 'overdue';
  if (due < endOfDay) return 'today';
  return 'upcoming';
}
