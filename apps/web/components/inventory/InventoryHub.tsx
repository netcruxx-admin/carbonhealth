'use client';

/**
 * InventoryHub
 *
 * The single Inventory screen. It replaces the three separate sidebar entries
 * (Inventory, Injectables, Medicines) with one route that carries two tabs:
 *
 *   Medicines    → catalogue + stock & movements  (see MedicineInventoryPanel)
 *   Injectables  → catalogue + stock & movements  (InjectableCatalogPanel)
 *
 * Every capability the old pages had is preserved — the panels are the same
 * components, only lifted out of their own DashboardShell so they can share
 * this one. Each tab is gated on the permission its route used to require, so a
 * role that holds one but not the other still gets a usable screen.
 *
 * Reachable by whoever holds `inventory.read` (admin and pharmacist ship with
 * it). Nurses keep their own medication / injection administration screens and
 * are untouched.
 */

import { useState } from 'react';
import { Package, Pill, Syringe } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import type { RoleViewProps } from '@/components/RoleView';
import { hasPermission } from '@/lib/auth';
import { MedicineInventoryPanel } from '@/components/inventory/MedicineInventoryPanel';
import { InjectableCatalogPanel } from '@/components/injectables/InjectableCatalog';

type Section = 'medicines' | 'injectables';

export function InventoryHub({ session }: RoleViewProps) {
  // The Medicines tab covers two former routes; either permission opens it.
  const canMedicines =
    hasPermission(session, 'medicines.read') || hasPermission(session, 'inventory.read');
  const canInjectables = hasPermission(session, 'injectables.read');

  const tabs = [
    { id: 'medicines' as Section, label: 'Medicines', icon: Pill, show: canMedicines },
    { id: 'injectables' as Section, label: 'Injectables', icon: Syringe, show: canInjectables },
  ];
  const visible = tabs.filter((t) => t.show);
  const [section, setSection] = useState<Section>(visible[0]?.id ?? 'medicines');
  const active = visible.some((t) => t.id === section) ? section : visible[0]?.id;

  return (
    <DashboardShell
      role={session.user.role}
      userName={session.user.name}
      title="Inventory"
      subtitle="Catalogue and stock for medicines and injectables"
    >
      <div className="space-y-6">
        {visible.length > 0 ? (
          <div className="border-b border-slate-200">
            <nav className="flex gap-1" aria-label="Inventory sections">
              {visible.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSection(t.id)}
                    aria-current={active === t.id ? 'page' : undefined}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                      active === t.id
                        ? 'border-cyan-600 text-cyan-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow py-16 text-center">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">You don&apos;t have access to any inventory sections.</p>
          </div>
        )}

        {active === 'medicines' && <MedicineInventoryPanel session={session} />}
        {active === 'injectables' && <InjectableCatalogPanel session={session} />}
      </div>
    </DashboardShell>
  );
}
