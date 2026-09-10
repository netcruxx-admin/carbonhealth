'use client';

/**
 * MedicineInventoryPanel
 *
 * The "Medicines" tab of the combined Inventory page. It keeps the two medicine
 * screens that used to live on their own routes, split across sub-tabs so the
 * shape mirrors the Injectables tab:
 *
 *   Catalogue          → the old /dashboard/medicines (search, filter, export,
 *                        add / edit / delete)                — `medicines.*`
 *   Stock & Movements  → the old /dashboard/inventory (stock levels, low-stock
 *                        alert, restock / adjust, movement history) — `inventory.*`
 *
 * Each sub-tab is gated on its own permission, so a role that holds only one of
 * the two still gets a working screen.
 */

import { useState } from 'react';
import type { RoleViewProps } from '@/components/RoleView';
import { hasPermission } from '@/lib/auth';
import { AdminMedicinesPanel } from '@/components/medicines/AdminMedicines';
import { InventoryStockPanel } from '@/components/inventory/InventoryManagement';

type SubTab = 'catalogue' | 'stock';

export function MedicineInventoryPanel({ session }: RoleViewProps) {
  const subs: { id: SubTab; label: string; show: boolean }[] = [
    { id: 'catalogue', label: 'Catalogue', show: hasPermission(session, 'medicines.read') },
    { id: 'stock', label: 'Stock & Movements', show: hasPermission(session, 'inventory.read') },
  ];
  const visible = subs.filter((s) => s.show);
  const [sub, setSub] = useState<SubTab>(visible[0]?.id ?? 'catalogue');
  const active = visible.some((s) => s.id === sub) ? sub : visible[0]?.id;

  return (
    <div className="space-y-6">
      {visible.length > 1 && (
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {visible.map((s) => (
            <button
              key={s.id}
              onClick={() => setSub(s.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                active === s.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {active === 'catalogue' && <AdminMedicinesPanel session={session} />}
      {active === 'stock' && <InventoryStockPanel session={session} />}
    </div>
  );
}
