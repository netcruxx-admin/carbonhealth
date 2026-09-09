'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { useDashboardGuard } from '@/hooks/useDashboardGuard';
import {
  useGetDoctorQuery,
  useGetPatientQuery,
  useGetTestOrderQuery,
  useListTestResultsQuery,
  useGetPrintHeaderQuery,
} from '@/store/api';
import { ORDER_STATUS_LABEL, FLAG_STYLE, FLAG_LABEL, isAbnormal } from '@/lib/lab';
import { fmtDate } from '@/lib/date';
import { PrintSheet } from '@/components/print/PrintSheet';
import { Spinner } from '@/components/ui/spinner';

export default function LabReportPrintPage() {
  const params = useParams();
  const orderId = params.orderId as string;

  // The API returns 404 for an order the caller isn't entitled to, so there is
  // no separate access check here.
  const session = useDashboardGuard();
  const { data: order, isLoading, isError } = useGetTestOrderQuery(orderId, {
    skip: !orderId || !session,
  });
  const { data: results = [] } = useListTestResultsQuery({ orderId }, { skip: !order });
  const { data: patient } = useGetPatientQuery(order?.patientId ?? '', { skip: !order });
  const { data: doctor } = useGetDoctorQuery(order?.doctorId ?? '', { skip: !order });
  const { data: header } = useGetPrintHeaderQuery(undefined, { skip: !session });

  const patientUser = patient?.user ?? null;
  const doctorUser = doctor?.user ?? null;

  const anyAbnormal = useMemo(
    () => results.some((r) => r.parameters.some((p) => isAbnormal(p.flag))),
    [results],
  );

  if (!session) return null;

  if (isLoading) {
    return <Spinner variant="page" label="Loading report…" />;
  }

  if (!order || isError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-slate-600">Report not found.</p>
        <button onClick={() => window.close()} className="font-semibold text-cyan-600">
          Close
        </button>
      </div>
    );
  }

  const reportedAt = results[0]?.reportedAt ? fmtDate(results[0].reportedAt) : '—';
  const reportedBy = results[0]?.reportedBy ?? '—';

  return (
    <PrintSheet
      header={header ?? { name: '' }}
      docLabel="Lab Report"
      docNumber={order.id}
    >
      <div className="grid gap-x-8 gap-y-2 border-b pb-5 text-sm sm:grid-cols-2">
        <Field label="Patient" value={patientUser?.name ?? '—'} />
        <Field label="Referred by" value={doctorUser ? `Dr. ${doctorUser.name}` : '—'} />
        <Field
          label="Gender / DOB"
          value={`${
            patient?.gender
              ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
              : '—'
          } · ${fmtDate(patient?.dateOfBirth)}`}
        />
        <Field label="Ordered on" value={fmtDate(order.orderedAt)} />
        <Field label="Phone" value={patient?.phone || '—'} />
        <Field label="Status" value={ORDER_STATUS_LABEL[order.status]} />
        {order.clinicalNote && (
          <div className="sm:col-span-2">
            <Field label="Clinical note" value={order.clinicalNote} />
          </div>
        )}
      </div>

      {anyAbnormal && (
        <div className="no-print mt-5 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> This report contains one or more results
          outside the reference range.
        </div>
      )}

      <div className="space-y-6 py-6">
        {results.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            Results are not yet available for this order.
          </p>
        ) : (
          results.map((res) => (
            <div key={res.id}>
              <h3 className="mb-2 font-bold text-slate-900">{res.testName}</h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-slate-200 text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Parameter</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Result</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Unit</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Reference Range</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.parameters.map((p, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 text-slate-800">{p.name}</td>
                        <td
                          className={`px-3 py-2 font-semibold ${
                            isAbnormal(p.flag) ? 'text-red-600' : 'text-slate-900'
                          }`}
                        >
                          {p.value || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{p.unit || '—'}</td>
                        <td className="px-3 py-2 text-slate-500">{p.referenceRange || '—'}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${FLAG_STYLE[p.flag]}`}
                          >
                            {FLAG_LABEL[p.flag]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {res.remarks && (
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-semibold">Remarks:</span> {res.remarks}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t pt-5 text-sm">
        <div>
          <p className="text-xs text-slate-500">Reported by</p>
          <p className="font-semibold text-slate-900">{reportedBy}</p>
          <p className="text-xs text-slate-500">{reportedAt}</p>
        </div>
        <p className="max-w-xs text-right text-xs text-slate-400">
          Values should be interpreted in clinical context by your physician.
        </p>
      </div>
    </PrintSheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-slate-500">{label}</span>
      <p className="font-medium text-slate-900">{value}</p>
    </div>
  );
}
