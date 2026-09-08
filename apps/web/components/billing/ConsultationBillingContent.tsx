'use client';

import { useState } from 'react';
import {
  Banknote,
  Clock,
  CreditCard,
  IndianRupee,
  Loader2,
  Printer,
  QrCode,
  Receipt,
  ReceiptText,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetConsultationBillingSummaryQuery,
  useLazyGetInvoiceQuery,
  useUpdatePaymentMutation,
} from '@/store/api';
import { apiError } from '@/lib/apiError';
import type { ConsultationBillingRow } from '@/lib/types';
import { buildInvoiceHtml, fmtCurrency, fmtTime, methodBadgeClass, methodLabel, todayIso } from './billingFormat';

/** How money is taken at the counter. Mirrors pricing.COUNTER_PAYMENT_MODES on
 *  the server — online payments settle themselves through the gateway. */
const COUNTER_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
];

function KpiCard({
  label, amount, count, icon, tint,
}: {
  label: string;
  amount: number;
  count?: number;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${tint}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-slate-900 leading-tight tabular-nums">
          {fmtCurrency(amount)}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
        {count !== undefined && (
          <p className="text-xs text-slate-400">{count} bill{count !== 1 ? 's' : ''}</p>
        )}
      </div>
    </div>
  );
}

function Row({
  row, onPrint, canCollect,
}: {
  row: ConsultationBillingRow;
  onPrint: (id: string) => void;
  canCollect: boolean;
}) {
  const collected = row.status === 'completed';
  const [collecting, setCollecting] = useState(false);
  const [method, setMethod] = useState('cash');
  const [updatePayment, { isLoading: saving }] = useUpdatePaymentMutation();

  async function collect() {
    try {
      // Status and method together: "paid" without saying how is not something
      // the day-report can reconcile against a cash drawer.
      await updatePayment({
        id: row.paymentId,
        body: { status: 'completed', paymentMethod: method },
      }).unwrap();
      toast.success(`Collected ${fmtCurrency(row.amount)}`);
      setCollecting(false);
    } catch (err) {
      toast.error(apiError(err, 'Could not record the payment'));
    }
  }
  return (
    <tr className="border-b hover:bg-slate-50 transition">
      <td className="py-3 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">
        {row.invoiceNumber}
      </td>
      <td className="py-3 px-4 text-sm text-slate-500 whitespace-nowrap">{fmtTime(row.createdAt)}</td>
      <td className="py-3 px-4">
        <p className="text-sm font-medium text-slate-900">{row.patientName || '—'}</p>
        {row.patientPhone && <p className="text-xs text-slate-400">{row.patientPhone}</p>}
      </td>
      <td className="py-3 px-4">
        <p className="text-sm text-slate-800">{row.doctorName || '—'}</p>
        {row.departmentName && <p className="text-xs text-slate-400">{row.departmentName}</p>}
      </td>
      <td className="py-3 px-4">
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          {row.visitTypeLabel || row.visitType || '—'}
        </span>
      </td>
      <td className="py-3 px-4 text-right text-sm font-semibold tabular-nums text-slate-900">
        {fmtCurrency(row.amount)}
      </td>
      <td className="py-3 px-4">
        {collected ? (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${methodBadgeClass(row.paymentMethod)}`}>
            {methodLabel(row.paymentMethod)}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            Pending
          </span>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center justify-end gap-2">
          {!collected && canCollect && (
            collecting ? (
              <>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-cyan-500"
                >
                  {COUNTER_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <button
                  onClick={collect}
                  disabled={saving}
                  className="text-xs font-medium bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 transition disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Confirm'}
                </button>
                <button
                  onClick={() => setCollecting(false)}
                  className="text-xs text-slate-500 px-1.5 py-1 hover:text-slate-700"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setCollecting(true)}
                className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-100 transition"
              >
                Mark Paid
              </button>
            )
          )}
          <button
            onClick={() => onPrint(row.paymentId)}
            title="Print invoice"
            className="p-1.5 rounded text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

/** The front desk's day-report: what was billed for consultations, what was
 *  collected, and what is still outstanding.
 *
 *  `canCollect` gates settling a bill from here — the same `payments.manage`
 *  the endpoint enforces. A viewer without it still sees what is outstanding;
 *  they just cannot say it has been paid. */
export function ConsultationBillingContent({ canCollect = false }: { canCollect?: boolean } = {}) {
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [fetchInvoice] = useLazyGetInvoiceQuery();

  const { data: summary, isLoading, isFetching } = useGetConsultationBillingSummaryQuery(
    { date: selectedDate },
    { refetchOnMountOrArgChange: true },
  );

  const isToday = selectedDate === todayIso();

  async function handlePrint(paymentId: string) {
    try {
      const invoice = await fetchInvoice(paymentId).unwrap();
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(buildInvoiceHtml(invoice));
      win.document.close();
      win.print();
    } catch {
      // silent — the user can retry
    }
  }

  if (isLoading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="consultation-billing-date" className="text-sm font-medium text-slate-700">
            Date
          </label>
          <input
            id="consultation-billing-date"
            type="date"
            value={selectedDate}
            max={todayIso()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          {isToday && (
            <span className="text-xs font-medium bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full">
              Today
            </span>
          )}
        </div>
        {isFetching && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total Collected"
          amount={summary?.total ?? 0}
          count={summary?.billCount}
          icon={<IndianRupee className="w-5 h-5" />}
          tint="text-cyan-600 bg-cyan-50"
        />
        <KpiCard
          label="Cash"
          amount={summary?.cashTotal ?? 0}
          icon={<Banknote className="w-5 h-5" />}
          tint="text-green-600 bg-green-50"
        />
        <KpiCard
          label="UPI / QR"
          amount={summary?.upiTotal ?? 0}
          icon={<QrCode className="w-5 h-5" />}
          tint="text-violet-600 bg-violet-50"
        />
        <KpiCard
          label="Card"
          amount={summary?.cardTotal ?? 0}
          icon={<CreditCard className="w-5 h-5" />}
          tint="text-blue-600 bg-blue-50"
        />
        {/* Billed but not collected. The number the desk works down before close
            of day, so it sits with the takings rather than inside the table. */}
        <KpiCard
          label="Pending Collection"
          amount={summary?.pendingTotal ?? 0}
          icon={<Clock className="w-5 h-5" />}
          tint="text-amber-600 bg-amber-50"
        />
      </div>

      <div className="bg-white rounded-xl shadow">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <ReceiptText className="w-4 h-4 text-slate-500" />
          <h3 className="font-semibold text-slate-900">
            Consultations — {selectedDate}
            {summary && summary.billCount > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({summary.billCount} transaction{summary.billCount !== 1 ? 's' : ''})
              </span>
            )}
          </h3>
        </div>

        {!summary || summary.rows.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No consultation bills for this date.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  <th className="py-3 px-4">Invoice</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Doctor</th>
                  <th className="py-3 px-4">Visit Type</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Print</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <Row key={row.paymentId} row={row} onPrint={handlePrint} canCollect={canCollect} />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-slate-50">
                  <td colSpan={5} className="py-3 px-4 text-sm font-semibold text-slate-700 text-right">
                    Collected
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-bold text-slate-900 tabular-nums">
                    {fmtCurrency(summary.total)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
