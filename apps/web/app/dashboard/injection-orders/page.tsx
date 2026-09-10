'use client';

import { RoleView } from '@/components/RoleView';
import { InjectionOrders } from '@/components/injection-orders/InjectionOrders';
import { doctorRole, nurseRole, pharmacistRole } from '@/lib/roles';

export default function InjectionOrdersPage() {
  return (
    <RoleView
      path="/dashboard/injection-orders"
      views={{
        [doctorRole]: InjectionOrders,
        [nurseRole]: InjectionOrders,
        [pharmacistRole]: InjectionOrders,
      }}
    />
  );
}
