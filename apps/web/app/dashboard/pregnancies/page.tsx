'use client';

import { RoleView } from '@/components/RoleView';
import { AdminPregnancies } from '@/components/pregnancies/AdminPregnancies';
import { DoctorPregnancies } from '@/components/pregnancies/DoctorPregnancies';
import { PatientPregnancy } from '@/components/pregnancies/PatientPregnancy';
import { adminRole, doctorRole, nurseRole, patientRole } from '@/lib/roles';

export default function PregnanciesPage() {
  return (
    <RoleView
      path="/dashboard/pregnancies"
      views={{
        [doctorRole]: DoctorPregnancies,
        // Read-only for nurse: the component itself hides record/visit
        // creation behind `pregnancies.manage`, which nurse doesn't hold.
        [nurseRole]: DoctorPregnancies,
        [patientRole]: PatientPregnancy,
        // A census, not a work queue: an admin wants counts and flags, not
        // per-patient antenatal data entry — see AdminPregnancies.
        [adminRole]: AdminPregnancies,
      }}
    />
  );
}
