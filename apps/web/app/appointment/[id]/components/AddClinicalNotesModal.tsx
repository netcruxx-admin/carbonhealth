'use client';

import { useState } from 'react';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { X } from 'lucide-react';
import { apiError } from '@/lib/apiError';
import { useCreateMedicalRecordMutation } from '@/store/api';
import { FormField } from '@/components/form/FormField';
import { Modal } from './Modal';
import { Spinner } from '@/components/ui/spinner';

interface Props {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

const schema = Yup.object({
  diagnosis: Yup.string().trim(),
  treatmentAdvice: Yup.string().trim(),
  followUpAdvice: Yup.string().trim(),
}).test('at-least-one', 'Fill in at least one of these', (values) =>
  !!(values.diagnosis?.trim() || values.treatmentAdvice?.trim() || values.followUpAdvice?.trim()),
);

export function AddClinicalNotesModal({ appointmentId, patientId, doctorId, onClose, onSaved }: Props) {
  const [createMedicalRecord] = useCreateMedicalRecordMutation();
  const [error, setError] = useState('');

  return (
    <Modal maxWidth="max-w-lg" scroll>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-900">Add Clinical Notes</h2>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
          <X className="w-5 h-5" />
        </button>
      </div>
      <Formik
        initialValues={{ diagnosis: '', treatmentAdvice: '', followUpAdvice: '' }}
        validationSchema={schema}
        onSubmit={async (values, { setSubmitting }) => {
          setError('');
          try {
            await createMedicalRecord({
              appointmentId,
              patientId,
              doctorId,
              diagnosis: values.diagnosis.trim() || undefined,
              treatmentAdvice: values.treatmentAdvice.trim() || undefined,
              followUpAdvice: values.followUpAdvice.trim() || undefined,
            }).unwrap();
            onSaved('Clinical notes saved');
          } catch (err) {
            setError(apiError(err, 'Could not save clinical notes'));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ isSubmitting }) => (
          <Form className="space-y-4">
            <FormField
              name="diagnosis"
              label="Diagnosis"
              as="textarea"
              rows={3}
              placeholder="e.g. Acute pharyngitis, viral etiology"
              dictation
            />
            <FormField
              name="treatmentAdvice"
              label="Treatment Advice"
              as="textarea"
              rows={3}
              placeholder="e.g. Warm saline gargles, paracetamol for fever, rest and fluids"
              dictation
            />
            <FormField
              name="followUpAdvice"
              label="Follow-up Advice"
              as="textarea"
              rows={3}
              placeholder="e.g. Review in 5 days, or sooner if fever crosses 102°F or breathing difficulty"
              dictation
            />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-brand-teal text-white rounded-lg hover:shadow-lg font-semibold transition disabled:opacity-50"
              >
                {isSubmitting ? <Spinner size="sm" label="Saving…" /> : 'Save Notes'}
              </button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  );
}
