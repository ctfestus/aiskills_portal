export type AccessStatus =
  | 'pending_deposit'
  | 'active'
  | 'overdue'
  | 'completed'
  | 'expired'
  | 'waived';

export interface AccessResult {
  access_status: AccessStatus;
  access_until: Date | null;
  grace_active: boolean;
}

export interface EnrollmentState {
  payment_plan: 'full' | 'flexible' | 'sponsored' | 'waived';
  total_fee: number;
  deposit_required: number;
  paid_total: number;
  bootcamp_ends_at: Date | null;
  post_bootcamp_access_months: number;
  installments: { due_date: Date; status: string }[];
  grace_period_days?: number | null;
}

export function computeAccess(e: EnrollmentState): AccessResult {
  if (e.payment_plan === 'waived' || e.payment_plan === 'sponsored') {
    return {
      access_status: 'waived',
      access_until: addMonths(e.bootcamp_ends_at, e.post_bootcamp_access_months),
      grace_active: false,
    };
  }

  if (e.paid_total <= 0) {
    return { access_status: 'pending_deposit', access_until: null, grace_active: false };
  }

  if (e.paid_total >= e.total_fee) {
    return {
      access_status: 'completed',
      access_until: addMonths(e.bootcamp_ends_at, e.post_bootcamp_access_months),
      grace_active: false,
    };
  }

  const nextUnpaid = e.installments
    .filter(i => i.status === 'unpaid' || i.status === 'partial')
    .sort((a, b) => a.due_date.getTime() - b.due_date.getTime())[0];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (nextUnpaid && nextUnpaid.due_date < today) {
    const graceDays = e.grace_period_days ?? 0;
    if (graceDays > 0) {
      const graceEnd = new Date(nextUnpaid.due_date);
      graceEnd.setDate(graceEnd.getDate() + graceDays);
      graceEnd.setHours(0, 0, 0, 0);
      if (today <= graceEnd) {
        return { access_status: 'active', access_until: graceEnd, grace_active: true };
      }
    }
    return { access_status: 'overdue', access_until: nextUnpaid.due_date, grace_active: false };
  }

  return {
    access_status: 'active',
    access_until: nextUnpaid?.due_date ?? null,
    grace_active: false,
  };
}

function addMonths(base: Date | null, months: number): Date | null {
  if (!base) return null;
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}
