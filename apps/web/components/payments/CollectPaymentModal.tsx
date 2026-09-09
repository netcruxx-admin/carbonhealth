'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { apiError } from '@/lib/apiError';
import { formatINR } from '@/lib/money';
import { useUpdatePaymentMutation } from '@/store/api';
import { PaymentModeField, type CounterPaymentMode } from './PaymentModeField';

/**
 * Take the money for a bill that has already been raised.
 *
 * Settling is a separate act from billing: the bill exists from the moment the
 * appointment is booked, and this is the desk saying the money is now in hand.
 * It records *how* alongside the status, because a day-report that says ₹300
 * was collected but not whether it went in the drawer or through a card machine
 * cannot be reconciled against either.
 *
 * `online` is deliberately not offered. A Razorpay payment settles itself when
 * the gateway signature checks out — marking one paid by hand here would be the
 * desk asserting a fact about money it never handled.
 */
export function CollectPaymentModal({
  open,
  onClose,
  paymentId,
  amount,
  patientName,
  defaultMode = 'cash',
}: {
  open: boolean;
  onClose: () => void;
  paymentId: string;
  amount: number;
  patientName?: string;
  /** How the booking said it would be paid, pre-selected so the common case is
   *  one click. The desk can still change it — what was intended at booking and
   *  what actually happened at the counter are different facts. */
  defaultMode?: CounterPaymentMode;
}) {
  const [mode, setMode] = useState<CounterPaymentMode>(defaultMode);
  const [updatePayment, { isLoading }] = useUpdatePaymentMutation();

  useEffect(() => {
    if (open) setMode(defaultMode);
  }, [open, defaultMode]);

  if (!open) return null;

  async function collect() {
    try {
      await updatePayment({
        id: paymentId,
        body: { status: 'completed', paymentMethod: mode },
      }).unwrap();
      toast.success(`Collected ${formatINR(amount, { paise: false })}`);
      onClose();
    } catch (err) {
      toast.error(apiError(err, 'Could not record the payment'));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-semibold text-slate-900">Collect Payment</h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex items-baseline justify-between bg-slate-50 rounded-lg px-4 py-3">
            <div>
              <p className="text-xs text-slate-500">Amount due</p>
              {patientName && <p className="text-sm text-slate-700 mt-0.5">{patientName}</p>}
            </div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {formatINR(amount, { paise: false })}
            </p>
          </div>

          <PaymentModeField
            allowOnline={false}
            value={mode}
            onChange={setMode}
            label="Collected By"
            disabled={isLoading}
            note="Records the payment as collected. The day-report reconciles against this."
          />
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={collect}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition disabled:opacity-60"
          >
            {isLoading ? <Spinner size="sm" label="Recording…" /> : 'Mark Paid'}
          </button>
        </div>
      </div>
    </div>
  );
}
