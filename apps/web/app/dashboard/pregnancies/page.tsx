'use client';

import { RoleView } from '@/components/RoleView';
import { DoctorPregnancies } from '@/components/pregnancies/DoctorPregnancies';
import { PatientPregnancy } from '@/components/pregnancies/PatientPregnancy';
import { doctorRole, nurseRole, patientRole } from '@/lib/roles';

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
      }}
    />
  );
}
