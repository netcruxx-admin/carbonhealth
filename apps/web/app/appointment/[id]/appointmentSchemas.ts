// Validation schemas and constants for the appointment detail page's
// inline-editable sections (vitals / prescription).
import * as Yup from 'yup';

export const today = new Date().toISOString().split('T')[0];

// vitalsSchema moved to components/vitals/vitalsForm — the vitals form is shared.

export const rxSchema = Yup.object({
  medicineName: Yup.string().trim().required('Select a medicine'),
  dosage: Yup.string().trim().required('Dosage is required').max(50, 'Too long'),
  frequency: Yup.string().trim().required('Frequency is required').max(50, 'Too long'),
  duration: Yup.string().trim().required('Duration is required').max(50, 'Too long'),
  instructions: Yup.string().max(300, 'Too long'),
});
