'use client';

import { Formik, Form } from 'formik';
import { X } from 'lucide-react';
import { apiError } from '@/lib/apiError';
import { useUpdateVitalsMutation } from '@/store/api';
import { Modal } from './Modal';
import {
  VitalsFormFields,
  vitalsSchema,
  vitalsToForm,
  vitalsToPayload,
} from '@/components/vitals/vitalsForm';
import type { Vitals } from '@/lib/types';
import { Spinner } from '@/components/ui/spinner';

interface Props {
  vitals: Vitals;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export function EditVitalsModal({ vitals, onClose, onSaved }: Props) {
  const [updateVitals] = useUpdateVitalsMutation();

  return (
    <Modal maxWidth="max-w-lg" scroll>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-900">Edit Vitals</h2>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
          <X className="w-5 h-5" />
        </button>
      </div>
      <Formik
        initialValues={vitalsToForm(vitals)}
        validationSchema={vitalsSchema}
        onSubmit={async (values, { setSubmitting, setStatus }) => {
          setStatus('');
          try {
            await updateVitals({
              id: vitals.id,
              body: vitalsToPayload(values),
            }).unwrap();
            onSaved('Vitals updated');
          } catch (err) {
            setStatus(apiError(err, 'Could not update vitals'));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ status, isSubmitting }) => (
          <Form className="grid grid-cols-2 gap-4">
            <VitalsFormFields />
            {status && (
              <p className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{status}</p>
            )}
            <div className="col-span-2 flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-brand-teal text-white rounded-lg hover:shadow-lg font-semibold transition disabled:opacity-50"
              >
                {isSubmitting ? <Spinner size="sm" label="Saving…" /> : 'Save Changes'}
              </button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  );
}
