'use client';

import { Banknote, CreditCard, Smartphone, Globe } from 'lucide-react';

/**
 * How a booking is being paid for — one control, used by every screen that
 * books an appointment.
 *
 * It lives here rather than inside a booking form because "which modes does
 * this hospital take" is one answer, and it was previously three: the admin
 * booking page offered cash or online, the superadmin pages and the follow-up
 * modal offered nothing at all, and the pharmacy counter offered cash/card/upi.
 * A follow-up booked by a doctor then produced an appointment with no bill
 * behind it, which the day-report had no way to show.
 *
 * The three counter modes are what the desk can take in person; the server
 * raises a *pending* payment for them and the desk marks it paid once the money
 * is actually in hand. `online` is not one of them — it is the Razorpay flow,
 * which confirms the booking only after the gateway signature checks out — so
 * screens that cannot run a checkout (a superadmin booking into someone else's
 * hospital, a doctor scheduling a follow-up mid-consult) pass `allowOnline={false}`
 * and offer the counter modes alone.
 */
export type CounterPaymentMode = 'cash' | 'card' | 'upi';
export type PaymentMode = CounterPaymentMode | 'online';

export const counterPaymentModes: CounterPaymentMode[] = ['cash', 'card', 'upi'];

export function isCounterMode(mode: PaymentMode): mode is CounterPaymentMode {
  return mode !== 'online';
}

const MODES: { value: PaymentMode; label: string; icon: typeof Banknote; hint: string }[] = [
  {
    value: 'cash',
    label: 'Cash',
    icon: Banknote,
    hint: 'A pending payment is raised. Mark it paid once the cash is collected at the counter.',
  },
  {
    value: 'card',
    label: 'Card',
    icon: CreditCard,
    hint: 'A pending payment is raised. Mark it paid once the card is charged at the counter.',
  },
  {
    value: 'upi',
    label: 'UPI / QR',
    icon: Smartphone,
    hint: 'A pending payment is raised. Mark it paid once the UPI transfer shows up.',
  },
  {
    value: 'online',
    label: 'Online',
    icon: Globe,
    hint: 'A Razorpay checkout will open. The appointment is confirmed only after the payment succeeds.',
  },
];

/** Hiding the online option narrows what the caller can be handed back, so a
 *  counter-only screen never has to widen its state to a mode it cannot use. */
type PaymentModeFieldProps = {
  disabled?: boolean;
  label?: string;
  /** Replaces the per-mode hint where a screen has something more specific to say. */
  note?: string;
} & (
  | { allowOnline?: true; value: PaymentMode; onChange: (mode: PaymentMode) => void }
  | { allowOnline: false; value: CounterPaymentMode; onChange: (mode: CounterPaymentMode) => void }
);

export function PaymentModeField(props: PaymentModeFieldProps) {
  const { value, allowOnline = true, disabled = false, label = 'Payment Mode', note } = props;
  // Safe by construction: with `allowOnline` false the online button is never
  // rendered, so this only ever fires with a mode the caller accepts.
  const onChange = props.onChange as (mode: PaymentMode) => void;

  const modes = allowOnline ? MODES : MODES.filter((m) => isCounterMode(m.value));
  const hint = note ?? MODES.find((m) => m.value === value)?.hint;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className={`grid gap-2 ${modes.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        {modes.map((mode) => {
          const Icon = mode.icon;
          const selected = value === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(mode.value)}
              className={`flex items-center gap-2 justify-center px-3 py-2.5 rounded-lg border-2 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                selected
                  ? 'border-cyan-600 bg-cyan-50 text-cyan-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {mode.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
