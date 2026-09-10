'use client';

import { RoleView } from '@/components/RoleView';
import { InjectableCatalog } from '@/components/injectables/InjectableCatalog';
import { adminRole, pharmacistRole } from '@/lib/roles';

export default function InjectablesPage() {
  return (
    <RoleView
      path="/dashboard/injectables"
      views={{
        [pharmacistRole]: InjectableCatalog,
        [adminRole]: InjectableCatalog,
      }}
    />
  );
}
