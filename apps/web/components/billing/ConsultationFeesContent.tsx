'use client';

import { useState } from 'react';
import { Check, Loader2, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateConsultationFeeMutation,
  useDeleteConsultationFeeMutation,
  useListConsultationFeesQuery,
  useUpdateConsultationFeeMutation,
} from '@/store/api';
import { apiError } from '@/lib/apiError';
import type { ConsultationFee } from '@/lib/types';
import { fmtCurrency } from './billingFormat';

/** One row, editable in place. Prices change often enough that a modal per edit
 *  would be the slowest part of the job. */
function FeeRow({ fee, hospitalId }: { fee: ConsultationFee; hospitalId?: string }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(fee.amount));
  const [label, setLabel] = useState(fee.label);
  const [updateFee, { isLoading: saving }] = useUpdateConsultationFeeMutation();
  const [deleteFee] = useDeleteConsultationFeeMutation();

  async function save() {
    const parsed = Number(amount);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      await updateFee({ id: fee.id, body: { amount: parsed, label: label.trim() }, hospitalId }).unwrap();
      toast.success('Fee updated');
      setEditing(false);
    } catch (err) {
      toast.error(apiError(err, 'Could not update the fee'));
    }
  }

  async function toggleActive() {
    try {
      await updateFee({ id: fee.id, body: { active: !fee.active }, hospitalId }).unwrap();
    } catch (err) {
      toast.error(apiError(err, 'Could not update the fee'));
    }
  }

  async function remove() {
    try {
      await deleteFee({ id: fee.id, hospitalId }).unwrap();
      toast.success('Fee removed');
    } catch (err) {
      toast.error(apiError(err, 'Could not remove the fee'));
    }
  }

  return (
    <tr className="border-b hover:bg-slate-50 transition">
      <td className="py-3 px-4">
        {editing ? (
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1 text-sm w-48 focus:outline-none focus:border-cyan-500"
          />
        ) : (
          <p className="text-sm font-medium text-slate-900">{fee.label}</p>
        )}
        <p className="text-xs text-slate-400 font-mono">{fee.visitType}</p>
      </td>
      <td className="py-3 px-4 text-right">
        {editing ? (
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1 text-sm w-28 text-right focus:outline-none focus:border-cyan-500"
          />
        ) : (
          <span className={`text-sm tabular-nums font-semibold ${fee.amount > 0 ? 'text-slate-900' : 'text-amber-600'}`}>
            {fee.amount > 0 ? fmtCurrency(fee.amount) : 'Not set'}
          </span>
        )}
      </td>
      <td className="py-3 px-4">
        <button
          onClick={toggleActive}
          className={`px-2 py-0.5 rounded-full text-xs font-medium transition ${
            fee.active
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {fee.active ? 'Offered' : 'Retired'}
        </button>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1">
          {editing ? (
            <>
              <button
                onClick={save}
                disabled={saving}
                title="Save"
                className="p-1.5 rounded text-green-600 hover:bg-green-50 transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { setEditing(false); setAmount(String(fee.amount)); setLabel(fee.label); }}
                title="Cancel"
                className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700 px-2 py-1"
              >
                Edit
              </button>
              <button
                onClick={remove}
                title="Remove"
                className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * The hospital's price list. Only reachable with `fees.manage`.
 *
 * `hospitalId` is how the same screen serves both holders of that permission.
 * A hospital admin omits it and edits their own tenant, resolved from their
 * token. A superadmin names the hospital they opened, because they have no
 * home tenant of their own — see the Fees dialog on the Hospitals screen.
 */
export function ConsultationFeesContent({ hospitalId }: { hospitalId?: string } = {}) {
  const { data: fees = [], isLoading } = useListConsultationFeesQuery({
    includeInactive: true,
    hospitalId,
  });
  const [createFee, { isLoading: creating }] = useCreateConsultationFeeMutation();
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');

  async function add() {
    const label = newLabel.trim();
    const parsed = Number(newAmount || 0);
    if (!label) {
      toast.error('Give the visit type a name');
      return;
    }
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      await createFee({ label, amount: parsed, hospitalId }).unwrap();
      toast.success('Visit type added');
      setAdding(false);
      setNewLabel('');
      setNewAmount('');
    } catch (err) {
      toast.error(apiError(err, 'Could not add the visit type'));
    }
  }

  if (isLoading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const unpriced = fees.filter((f) => f.active && f.amount <= 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        What this hospital charges for each kind of visit. The price is set here, not per
        doctor, so it is the same whoever the patient is seen by — and booking reads it
        from here, so nobody can be billed a number that was never published.
      </p>

      {unpriced.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          {unpriced.map((f) => f.label).join(', ')} {unpriced.length === 1 ? 'has' : 'have'} no
          price set. Booking will refuse {unpriced.length === 1 ? 'it' : 'them'} until you set one.
        </div>
      )}

      <div className="bg-white rounded-xl shadow">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Visit Types</h3>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-brand-teal text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4" />
              Add Visit Type
            </button>
          )}
        </div>

        {adding && (
          <div className="px-6 py-4 border-b bg-slate-50 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Health Check"
                autoFocus
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹)</label>
              <input
                type="number"
                min="0"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="0"
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-32 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              onClick={add}
              disabled={creating}
              className="bg-cyan-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-cyan-700 transition disabled:opacity-60"
            >
              {creating ? 'Adding…' : 'Add'}
            </button>
            <button
              onClick={() => { setAdding(false); setNewLabel(''); setNewAmount(''); }}
              className="text-sm text-slate-500 px-3 py-1.5 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                <th className="py-3 px-4">Visit Type</th>
                <th className="py-3 px-4 text-right">Fee</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => (
                <FeeRow key={fee.id} fee={fee} hospitalId={hospitalId} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
