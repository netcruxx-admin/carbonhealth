'use client';

import { RoleView } from '@/components/RoleView';
import { AdminBook } from '@/components/book/AdminBook';
import { PatientBook } from '@/components/book/PatientBook';
import { SuperadminBook } from '@/components/book/SuperadminBook';
import { adminRole, doctorRole, patientRole, receptionistRole, superadminRole } from '@/lib/roles';

export default function BookPage() {
  return (
    <RoleView
      path="/dashboard/book"
      views={{
        [superadminRole]: SuperadminBook,
        [adminRole]: AdminBook,
        [doctorRole]: AdminBook,
        [receptionistRole]: AdminBook,
        [patientRole]: PatientBook,
      }}
      // A role a superadmin invented and gave `appointments.create` to books
      // the way the front desk does — including the payment mode. Without this
      // it reaches the page and finds "no view built for your role".
      fallback={AdminBook}
    />
  );
}
