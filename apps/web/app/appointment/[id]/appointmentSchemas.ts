// Validation schemas and select-option constants for the appointment detail
// page's modals (reschedule / edit / vitals / prescription).
import * as Yup from 'yup';

export const today = new Date().toISOString().split('T')[0];

export const rescheduleSchema = Yup.object({
  date: Yup.string().required('Date is required'),
  time: Yup.string().required('Please select a time slot'),
});

export const editSchema = Yup.object({
  status: Yup.string().oneOf(['scheduled', 'completed', 'cancelled']).required('Select a status'),
  reason: Yup.string().max(200, 'Too long'),
});

// vitalsSchema moved to components/vitals/vitalsForm — the vitals form is shared.

export const rxSchema = Yup.object({
  medicineName: Yup.string().trim().required('Select a medicine'),
  dosage: Yup.string().trim().required('Dosage is required').max(50, 'Too long'),
  frequency: Yup.string().trim().required('Frequency is required').max(50, 'Too long'),
  duration: Yup.string().trim().required('Duration is required').max(50, 'Too long'),
  instructions: Yup.string().max(300, 'Too long'),
});

export const statusOptions = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const timeSlots = [
  { value: '09:00 AM', label: '09:00 AM' },
  { value: '09:30 AM', label: '09:30 AM' },
  { value: '10:00 AM', label: '10:00 AM' },
  { value: '10:30 AM', label: '10:30 AM' },
  { value: '02:00 PM', label: '02:00 PM' },
  { value: '02:30 PM', label: '02:30 PM' },
  { value: '03:00 PM', label: '03:00 PM' },
  { value: '03:30 PM', label: '03:30 PM' },
];
