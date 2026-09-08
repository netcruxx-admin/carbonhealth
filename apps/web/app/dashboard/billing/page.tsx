'use client';

import { RoleView } from '@/components/RoleView';
import { BillingPage } from '@/components/billing/BillingPage';
import { pharmacistRole, adminRole, receptionistRole } from '@/lib/roles';

export default function BillingRoute() {
  return (
    <RoleView
      path="/dashboard/billing"
      views={{
        [pharmacistRole]: BillingPage,
        [adminRole]: BillingPage,
        [receptionistRole]: BillingPage,
      }}
      // The screen is the same for every counter; the tabs inside it, and the
      // permissions behind them, are what differ. A role created at runtime with
      // payments.read lands here too rather than on the "no view" notice.
      viewsByScope={{ all: BillingPage, own: BillingPage }}
    />
  );
}
