import type { Appointment } from '@/lib/types';
import { formatINR } from '@/lib/money';

/**
 * Paid / unpaid on an appointment, in one place.
 *
 * Three states, not two. "No bill" is genuinely different from "unpaid": a
 * visit booked before the hospital priced its visit types, or one whose price
 * was zero, never had a bill raised at all — calling that unpaid would send the
 * desk chasing money nobody ever asked for.
 */
export function PaymentBadge({
  appointment,
  onCollect,
}: {
  appointment: Appointment;
  /** Given only to someone who may settle a bill. When present and the bill is
   *  outstanding, the badge becomes the button to collect it — the desk acts on
   *  the row it is already reading rather than crossing to the Billing screen. */
  onCollect?: () => void;
}) {
  const status = appointment.paymentStatus ?? '';
  const amount = appointment.paymentAmount ?? 0;
  const amountLabel = amount > 0 ? formatINR(amount, { paise: false }) : '';

  if (!status) {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
        No bill
      </span>
    );
  }

  if (status === 'completed') {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        Paid{amountLabel && ` · ${amountLabel}`}
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        Failed{amountLabel && ` · ${amountLabel}`}
      </span>
    );
  }

  const unpaidLabel = `Unpaid${amountLabel ? ` · ${amountLabel}` : ''}`;

  if (onCollect) {
    return (
      <button
        type="button"
        onClick={onCollect}
        title="Collect payment"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 hover:text-amber-800 transition"
      >
        {unpaidLabel}
        <span aria-hidden className="opacity-60">›</span>
      </button>
    );
  }

  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      {unpaidLabel}
    </span>
  );
}
