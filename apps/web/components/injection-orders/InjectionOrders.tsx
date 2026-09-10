'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Syringe, Plus, X, Search, AlertTriangle } from 'lucide-react';
import { apiError } from '@/lib/apiError';
import type { InjectionOrder, InjectionOrderStatus } from '@/lib/types';
import { INJECTION_ROUTES } from '@/lib/types';
import { DashboardShell } from '@/components/DashboardShell';
import type { RoleViewProps } from '@/components/RoleView';
import { hasPermission } from '@/lib/auth';
import {
  useListInjectionOrdersQuery,
  useCreateInjectionOrderMutation,
  useAdministerInjectionOrderMutation,
  useCancelInjectionOrderMutation,
  useListInjectablesQuery,
  useListPatientsQuery,
} from '@/store/api';
import { doctorRole, nurseRole, pharmacistRole } from '@/lib/roles';
import { fmtDate } from '@/lib/date';
import { Spinner } from '@/components/ui/spinner';

type StatusTab = 'all' | InjectionOrderStatus;

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'administered', label: 'Administered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_BADGE: Record<InjectionOrderStatus, string> = {
  ordered: 'bg-amber-100 text-amber-700',
  administered: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

const TITLE_BY_ROLE: Record<string, string> = {
  [doctorRole]: 'My Injection Orders',
  [nurseRole]: 'Shots to Administer',
  [pharmacistRole]: 'Injection Orders',
};

const SUBTITLE_BY_ROLE: Record<string, string> = {
  [doctorRole]: 'Injections you have ordered for patients',
  [nurseRole]: 'Ordered shots waiting to be given',
  [pharmacistRole]: 'Every injection ordered across the hospital',
};

interface NewOrderForm {
  patientId: string;
  injectableId: string;
  injectableName: string;
  dose: string;
  route: string;
  quantity: string;
  scheduledFor: string;
  instructions: string;
}

const EMPTY_FORM: NewOrderForm = {
  patientId: '',
  injectableId: '',
  injectableName: '',
  dose: '',
  route: 'IM',
  quantity: '1',
  scheduledFor: '',
  instructions: '',
};

export function InjectionOrders({ session }: RoleViewProps) {
  const role = session.user.role;
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [search, setSearch] = useState('');
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [form, setForm] = useState<NewOrderForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const [giving, setGiving] = useState<InjectionOrder | null>(null);
  const [site, setSite] = useState('');
  const [giveNotes, setGiveNotes] = useState('');
  const [giveQty, setGiveQty] = useState('');

  const canOrder = hasPermission(session, 'injection_orders.manage');
  const canAdminister = hasPermission(session, 'injection_orders.administer');

  const queryArgs = {
    ...(activeTab !== 'all' && { status: activeTab }),
    ...(search.trim() && { q: search.trim() }),
  };
  const { data: orders = [], isLoading } = useListInjectionOrdersQuery(
    Object.keys(queryArgs).length ? queryArgs : undefined,
  );
  const { data: injectables = [] } = useListInjectablesQuery(undefined, { skip: !canOrder });
  const { data: patients = [] } = useListPatientsQuery(undefined, { skip: !canOrder });

  const [createOrder, { isLoading: isCreating }] = useCreateInjectionOrderMutation();
  const [administerOrder, { isLoading: isGiving }] = useAdministerInjectionOrderMutation();
  const [cancelOrder] = useCancelInjectionOrderMutation();

  const sorted = useMemo(
    () => [...orders].sort((a, b) => (a.orderedAt < b.orderedAt ? 1 : -1)),
    [orders],
  );

  const pickInjectable = (id: string) => {
    const item = injectables.find((i) => i.id === id);
    setForm((f) => ({
      ...f,
      injectableId: id,
      injectableName: item ? item.name : f.injectableName,
      dose: item?.strength || f.dose,
      route: item?.route || f.route,
    }));
  };

  const handleCreate = async () => {
    setFormError('');
    if (!form.patientId) return setFormError('Select a patient');
    if (!form.injectableName.trim()) return setFormError('Name the injectable');
    if (!form.route) return setFormError('Select a route');
    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return setFormError('Quantity must be a whole number of at least 1');
    }
    try {
      await createOrder({
        patientId: form.patientId,
        injectableId: form.injectableId || undefined,
        injectableName: form.injectableName.trim(),
        dose: form.dose.trim(),
        route: form.route,
        quantity,
        scheduledFor: form.scheduledFor || undefined,
        instructions: form.instructions.trim() || undefined,
      }).unwrap();
      toast.success('Injection ordered');
      setNewOrderOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setFormError(apiError(err, 'Failed to order injection'));
    }
  };

  const openGive = (order: InjectionOrder) => {
    setGiving(order);
    setSite('');
    setGiveNotes('');
    setGiveQty(String(order.quantity));
  };

  const handleGive = async () => {
    if (!giving) return;
    if (!site.trim()) {
      toast.error('Record the injection site (e.g. Left deltoid, IV line A)');
      return;
    }
    const qty = Number(giveQty);
    if (!Number.isInteger(qty) || qty < 1) {
      toast.error('Quantity must be a whole number of at least 1');
      return;
    }
    try {
      await administerOrder({
        id: giving.id,
        site: site.trim(),
        notes: giveNotes.trim() || undefined,
        quantity: qty,
      }).unwrap();
      toast.success('Shot marked as given');
      setGiving(null);
    } catch (err) {
      toast.error(apiError(err, 'Failed to record administration'));
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelOrder(id).unwrap();
      toast.success('Order cancelled');
    } catch (err) {
      toast.error(apiError(err, 'Failed to cancel order'));
    }
  };

  const showActions =
    (canOrder && role === doctorRole) || canAdminister;
  const shortStock = (o: InjectionOrder) =>
    o.status === 'ordered' &&
    o.injectableId != null &&
    o.stockOnHand != null &&
    o.stockOnHand < o.quantity;

  return (
    <DashboardShell
      role={role}
      userName={session.user.name}
      title={TITLE_BY_ROLE[role] ?? 'Injection Orders'}
      subtitle={SUBTITLE_BY_ROLE[role] ?? 'Injections ordered for patients'}
    >
      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-white rounded-lg shadow px-1 py-1 flex-wrap">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  activeTab === tab.value
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient or injectable…"
              className="w-full pl-9 pr-3 py-1.5 bg-white rounded-lg shadow text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {canOrder && role === doctorRole && (
            <button
              onClick={() => { setForm(EMPTY_FORM); setFormError(''); setNewOrderOpen(true); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-brand-teal text-white rounded-lg text-sm font-medium hover:shadow-lg transition ml-auto"
            >
              <Plus className="w-4 h-4" />
              New Injection Order
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h3 className="font-semibold text-slate-900">Injection Orders ({sorted.length})</h3>
          </div>

          {isLoading ? (
            <Spinner variant="block" />
          ) : sorted.length === 0 ? (
            <div className="text-center py-16">
              <Syringe className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No injection orders found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Patient</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Injectable</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Dose</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Route</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-900">Qty</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Doctor</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Ordered</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Status</th>
                    {showActions && <th className="text-right py-3 px-4 font-semibold text-slate-900">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{order.patientName ?? order.patientId}</p>
                        {order.patientPhone && <p className="text-xs text-slate-500">{order.patientPhone}</p>}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {order.injectableName}
                        {shortStock(order) && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            {order.stockOnHand} in stock
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{order.dose || '—'}</td>
                      <td className="py-3 px-4 text-slate-600">{order.route}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-900">{order.quantity}</td>
                      <td className="py-3 px-4 text-slate-600">{order.doctorName ?? order.doctorId}</td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{fmtDate(order.orderedAt)}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[order.status]}`}>
                          {order.status}
                        </span>
                      </td>
                      {showActions && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canAdminister && order.status === 'ordered' && (
                              <button
                                onClick={() => openGive(order)}
                                className="px-2 py-1 text-xs font-medium bg-green-50 text-green-700 rounded hover:bg-green-100 transition"
                              >
                                Administer
                              </button>
                            )}
                            {canOrder && role === doctorRole && order.status === 'ordered' && (
                              <button
                                onClick={() => handleCancel(order.id)}
                                className="px-2 py-1 text-xs font-medium bg-red-50 text-red-700 rounded hover:bg-red-100 transition"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New Order Modal */}
      {newOrderOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">New Injection Order</h3>
              <button onClick={() => setNewOrderOpen(false)} className="text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Patient *</label>
                <select
                  value={form.patientId}
                  onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Select patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.user?.name ?? p.userId}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">From catalogue</label>
                <select
                  value={form.injectableId}
                  onChange={(e) => pickInjectable(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Not stocked — enter a name below</option>
                  {injectables.map((i) => (
                    <option key={i.id} value={i.id}>
                      {[i.name, i.strength, i.form].filter(Boolean).join(' · ')} ({i.stock} in stock)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Injectable name *</label>
                <input
                  value={form.injectableName}
                  onChange={(e) => setForm((f) => ({ ...f, injectableName: e.target.value, injectableId: '' }))}
                  placeholder="e.g. Tetanus toxoid"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dose</label>
                  <input
                    value={form.dose}
                    onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))}
                    placeholder="e.g. 0.5 mL"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Route *</label>
                  <select
                    value={form.route}
                    onChange={(e) => setForm((f) => ({ ...f, route: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {INJECTION_ROUTES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Qty *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">Vials used</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled for</label>
                <input
                  type="date"
                  value={form.scheduledFor}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledFor: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Instructions</label>
                <textarea
                  value={form.instructions}
                  onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                  placeholder="Special instructions…"
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setNewOrderOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="inline-flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-brand-teal text-white rounded hover:shadow-lg font-semibold transition disabled:opacity-50"
                >
                  {isCreating ? <Spinner size="sm" label="Ordering…" /> : 'Order Injection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Administer Modal */}
      {giving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">Record Administration</h3>
              <button onClick={() => setGiving(null)} className="text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Giving <span className="font-semibold">{giving.injectableName}</span>{' '}
              {giving.dose && <>{giving.dose} </>}
              <span className="font-medium text-slate-700">({giving.route})</span> to{' '}
              <span className="font-semibold">{giving.patientName ?? giving.patientId}</span>.
            </p>
            <div className="grid gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Injection site <span className="text-red-500">*</span>
                </label>
                <input
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  placeholder="e.g. Left deltoid, Right thigh, IV line A"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vials used</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={giveQty}
                  onChange={(e) => setGiveQty(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                {giving.injectableId != null && giving.stockOnHand != null && (
                  <p className="text-xs text-slate-400 mt-1">{giving.stockOnHand} in stock</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                <textarea
                  value={giveNotes}
                  onChange={(e) => setGiveNotes(e.target.value)}
                  placeholder="e.g. Tolerated well, no adverse reaction…"
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setGiving(null)}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleGive}
                disabled={isGiving}
                className="inline-flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-brand-teal text-white rounded hover:shadow-lg font-semibold transition disabled:opacity-50"
              >
                {isGiving ? <Spinner size="sm" label="Saving…" /> : 'Mark Given'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
