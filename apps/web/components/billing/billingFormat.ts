/** Formatting and invoice printing shared by both billing reports.
 *
 *  One copy, because a pharmacy bill and a consultation bill are the same
 *  document to the person holding it — the money, the method and the invoice
 *  number should not be formatted two different ways depending on the tab. */

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export { formatINR as fmtCurrency } from '@/lib/money';

export function methodLabel(method: string): string {
  switch (method.toLowerCase()) {
    case 'cash': return 'Cash';
    case 'upi': case 'qr': return 'UPI';
    case 'card': return 'Card';
    case 'razorpay': return 'Online';
    default: return method || '—';
  }
}

export function methodBadgeClass(method: string): string {
  switch (method.toLowerCase()) {
    case 'cash': return 'bg-green-100 text-green-700';
    case 'upi': case 'qr': return 'bg-violet-100 text-violet-700';
    case 'card': return 'bg-blue-100 text-blue-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}
