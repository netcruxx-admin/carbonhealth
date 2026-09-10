'use client';

import { useState } from 'react';

import { Formik, Form } from 'formik';
import { X } from 'lucide-react';
import { apiError } from '@/lib/apiError';
import { useCreateVitalsMutation } from '@/store/api';
import { Modal } from './Modal';
import {
  VitalsFormFields,
  emptyVitals,
  vitalsSchema,
  vitalsToPayload,
} from '@/components/vitals/vitalsForm';

interface RecordVitalsModalProps {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export function RecordVitalsModal({ appointmentId, patientId, doctorId, onClose, onSaved }: RecordVitalsModalProps) {
  const [createVitals] = useCreateVitalsMutation();
  const [error, setError] = useState('');

  return (
    <Modal maxWidth="max-w-lg" scroll>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-900">Record Vitals</h2>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
          <X className="w-5 h-5" />
        </button>
      </div>
      <Formik
        initialValues={emptyVitals}
        validationSchema={vitalsSchema}
        onSubmit={async (values, { setSubmitting }) => {
          setError('');
          try {
            await createVitals({
              appointmentId,
              patientId,
              doctorId,
              ...vitalsToPayload(values),
            }).unwrap();
            onSaved('Vitals recorded');
          } catch (err) {
            setError(apiError(err, 'Could not record vitals'));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form className="grid grid-cols-2 gap-4">
          <VitalsFormFields />
          {error && (
            <p className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="col-span-2 flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-brand-teal text-white rounded-lg hover:shadow-lg font-semibold transition"
            >
              Save Vitals
            </button>
          </div>
        </Form>
      </Formik>
    </Modal>
  );
}
