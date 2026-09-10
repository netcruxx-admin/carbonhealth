'use client';

import { useState } from 'react';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { X } from 'lucide-react';
import { apiError } from '@/lib/apiError';
import { useCreateInjectionOrderMutation, useListInjectablesQuery } from '@/store/api';
import { INJECTION_ROUTES } from '@/lib/types';
import { FormField } from '@/components/form/FormField';
import { Modal } from './Modal';

interface Props {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

const schema = Yup.object({
  injectableId: Yup.string(),
  injectableName: Yup.string().trim().required('Name the injectable'),
  dose: Yup.string().trim().max(40, 'Too long'),
  route: Yup.string().required('Select a route'),
  quantity: Yup.number()
    .transform((v, o) => (o === '' ? undefined : v))
    .typeError('Enter a number')
    .integer('Whole number')
    .min(1, 'At least 1')
    .required('Quantity is required'),
  scheduledFor: Yup.string(),
  instructions: Yup.string().trim().max(300, 'Too long'),
});

const routeOptions = INJECTION_ROUTES.map((r) => ({ value: r, label: r }));

export function AddInjectionOrderModal({ appointmentId, patientId, doctorId, onClose, onSaved }: Props) {
  const [createInjectionOrder] = useCreateInjectionOrderMutation();
  const { data: injectables = [] } = useListInjectablesQuery();
  const [error, setError] = useState('');

  return (
    <Modal maxWidth="max-w-lg" scroll>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-900">Order Injection</h2>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
          <X className="w-5 h-5" />
        </button>
      </div>
      <Formik
        initialValues={{
          injectableId: '',
          injectableName: '',
          dose: '',
          route: 'IM',
          quantity: '1',
          scheduledFor: '',
          instructions: '',
        }}
        validationSchema={schema}
        onSubmit={async (values, { setSubmitting }) => {
          setError('');
          try {
            await createInjectionOrder({
              appointmentId,
              patientId,
              doctorId,
              injectableId: values.injectableId || undefined,
              injectableName: values.injectableName.trim(),
              dose: values.dose.trim(),
              route: values.route,
              quantity: Number(values.quantity),
              scheduledFor: values.scheduledFor || undefined,
              instructions: values.instructions.trim() || undefined,
            }).unwrap();
            onSaved('Injection ordered — the nurse will see it in their queue');
          } catch (err) {
            setError(apiError(err, 'Could not order injection'));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ values, setFieldValue }) => (
          <Form className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">From catalogue</label>
              <select
                value={values.injectableId}
                onChange={(e) => {
                  const item = injectables.find((i) => i.id === e.target.value);
                  setFieldValue('injectableId', e.target.value);
                  if (item) {
                    setFieldValue('injectableName', item.name);
                    if (item.strength) setFieldValue('dose', item.strength);
                    if (item.route) setFieldValue('route', item.route);
                  }
                }}
                className="w-full pl-3 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
              >
                <option value="">Not stocked — enter a name below</option>
                {injectables.map((i) => (
                  <option key={i.id} value={i.id}>
                    {[i.name, i.strength, i.form].filter(Boolean).join(' · ')} ({i.stock} in stock)
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <FormField name="injectableName" label="Injectable" placeholder="e.g. Tetanus toxoid" required />
            </div>
            <FormField name="dose" label="Dose" placeholder="e.g. 0.5 mL" />
            <FormField name="route" label="Route" as="select" placeholder="Select route" options={routeOptions} required />
            <FormField name="quantity" label="Vials used" type="number" min="1" required />
            <FormField name="scheduledFor" label="Scheduled for" type="date" />
            <div className="sm:col-span-2">
              <FormField name="instructions" label="Instructions" as="textarea" rows={2} placeholder="e.g. Give after the consult, observe 15 min" />
            </div>
            {error && (
              <p className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="sm:col-span-2 flex gap-3 pt-2">
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
                Order Injection
              </button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  );
}
