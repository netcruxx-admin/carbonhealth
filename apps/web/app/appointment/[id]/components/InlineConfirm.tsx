'use client';

import { Spinner } from '@/components/ui/spinner';

// Replaces the old ConfirmActionModal/ConfirmDeleteModal popups: the same
// confirm/cancel choice, rendered in place instead of over a backdrop.
export function InlineConfirmBar({
  message,
  confirmLabel = 'Delete',
  tone = 'bg-red-600 hover:bg-red-700',
  loading,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel?: string;
  tone?: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap bg-red-50/50 rounded-lg px-4 py-3 border border-red-100">
      <p className="text-sm text-slate-700">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition text-sm disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-white rounded-lg font-semibold transition text-sm disabled:opacity-50 ${tone}`}
        >
          {loading ? <Spinner size="sm" label="Working…" /> : confirmLabel}
        </button>
      </div>
    </div>
  );
}
