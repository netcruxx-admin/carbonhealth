'use client';

import { RoleView } from '@/components/RoleView';
import { InventoryHub } from '@/components/inventory/InventoryHub';
import { adminRole, pharmacistRole } from '@/lib/roles';

export default function InventoryPage() {
  return (
    <RoleView
      path="/dashboard/inventory"
      views={{
        [pharmacistRole]: InventoryHub,
        [adminRole]: InventoryHub,
      }}
    />
  );
}
