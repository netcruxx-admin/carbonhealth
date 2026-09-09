'use client';

import { RoleView } from '@/components/RoleView';
import { DoctorNewborns } from '@/components/babies/DoctorNewborns';
import { PatientBaby } from '@/components/babies/PatientBaby';
import { doctorRole, nurseRole, patientRole } from '@/lib/roles';

export default function BabiesPage() {
  return (
    <RoleView
      path="/dashboard/babies"
      views={{
        [doctorRole]: DoctorNewborns,
        // Read-only for nurse: the component itself hides registration and
        // recording behind `babies.manage`, which nurse doesn't hold.
        [nurseRole]: DoctorNewborns,
        [patientRole]: PatientBaby,
      }}
    />
  );
}
