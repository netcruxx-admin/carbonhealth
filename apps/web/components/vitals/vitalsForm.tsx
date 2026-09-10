'use client';

// Shared shape + fields for the counter's vitals form, used by RecordVitalsModal,
// EditVitalsModal and NurseVitals so the three stay identical.
//
// Nine fields: BP, Height, Pulse, Weight, Temperature, BMI, LMP, EDD, POG.
// Respiratory rate and clinical notes are still stored on the record (old data,
// API contract) but are no longer entered here — the payload builder simply
// omits them, which POST defaults and PUT leaves untouched.
//
// BMI, EDD and POG are auto-filled from their sources (height+weight, and LMP)
// but remain editable: each recomputes only when its own source changes, so a
// value the recorder then adjusts by hand survives until the next source edit.

import { useEffect, useRef } from 'react';
import { useFormikContext } from 'formik';
import * as Yup from 'yup';
import { FormField } from '@/components/form/FormField';
import type { Vitals } from '@/lib/types';

export interface VitalsFormValues {
  bloodPressure: string;
  height: string;
  heartRate: string;
  weight: string;
  temperature: string;
  bmi: string;
  lmp: string;
  edd: string;
  pog: string;
}

export const emptyVitals: VitalsFormValues = {
  bloodPressure: '',
  height: '',
  heartRate: '',
  weight: '',
  temperature: '',
  bmi: '',
  lmp: '',
  edd: '',
  pog: '',
};

const asStr = (n: number | null | undefined) => (n ? String(n) : '');

export const vitalsToForm = (v: Vitals): VitalsFormValues => ({
  bloodPressure: v.bloodPressure ?? '',
  height: asStr(v.height),
  heartRate: asStr(v.heartRate),
  weight: asStr(v.weight),
  temperature: asStr(v.temperature),
  bmi: asStr(v.bmi),
  lmp: v.lmp ?? '',
  edd: v.edd ?? '',
  pog: v.pog ?? '',
});

const asNum = (s: string) => Number(s) || 0;

/** The slice of the API body these fields own. Respiratory rate and notes are
 *  deliberately absent. */
export const vitalsToPayload = (v: VitalsFormValues) => ({
  bloodPressure: v.bloodPressure,
  height: asNum(v.height),
  heartRate: asNum(v.heartRate),
  weight: asNum(v.weight),
  temperature: asNum(v.temperature),
  bmi: asNum(v.bmi),
  lmp: v.lmp,
  edd: v.edd,
  pog: v.pog,
});

const numOpt = Yup.number()
  .transform((v, orig) => (orig === '' ? undefined : v))
  .typeError('Enter a number')
  .min(0, 'Cannot be negative')
  .notRequired();

export const vitalsSchema = Yup.object({
  bloodPressure: Yup.string().max(15, 'Too long'),
  height: numOpt,
  heartRate: numOpt,
  weight: numOpt,
  temperature: numOpt,
  bmi: numOpt,
  lmp: Yup.string(),
  edd: Yup.string(),
  pog: Yup.string().max(20, 'Too long'),
});

// --- derivations -----------------------------------------------------------

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Weeks + days since LMP as of today, e.g. "28w 3d". Empty for a nonsense or
 *  out-of-range date. */
function gestationFromLmp(iso: string): string {
  const lmp = new Date(iso);
  if (Number.isNaN(lmp.getTime())) return '';
  const days = Math.floor((Date.now() - lmp.getTime()) / 86_400_000);
  if (days < 0 || days > 320) return '';
  return `${Math.floor(days / 7)}w ${days % 7}d`;
}

function bmiFrom(heightCm: string, weightKg: string): string {
  const h = Number(heightCm) / 100;
  const w = Number(weightKg);
  if (!h || !w) return '';
  return (w / (h * h)).toFixed(1);
}

/** Watches the source fields and refreshes the derived ones on change only —
 *  the initial values (a saved record's own BMI/EDD/POG) are left as they are. */
function Autofill() {
  const { values, setFieldValue } = useFormikContext<VitalsFormValues>();
  const seen = useRef({
    hw: `${values.height}|${values.weight}`,
    lmp: values.lmp,
  });

  useEffect(() => {
    const key = `${values.height}|${values.weight}`;
    if (key === seen.current.hw) return;
    seen.current.hw = key;
    setFieldValue('bmi', bmiFrom(values.height, values.weight));
  }, [values.height, values.weight, setFieldValue]);

  useEffect(() => {
    if (values.lmp === seen.current.lmp) return;
    seen.current.lmp = values.lmp;
    setFieldValue('edd', values.lmp ? addDays(values.lmp, 280) : '');
    setFieldValue('pog', values.lmp ? gestationFromLmp(values.lmp) : '');
  }, [values.lmp, setFieldValue]);

  return null;
}

/** The nine fields, in the agreed order. Drop straight into a two-column grid
 *  `<Form>`. */
export function VitalsFormFields() {
  return (
    <>
      <Autofill />
      <FormField name="bloodPressure" label="BP" placeholder="120/80" />
      <FormField name="height" label="Height (cm)" type="number" placeholder="165" />
      <FormField name="heartRate" label="Pulse (bpm)" type="number" placeholder="78" />
      <FormField name="weight" label="Weight (kg)" type="number" placeholder="68" />
      <FormField name="temperature" label="Temperature (°F)" type="number" placeholder="98.6" />
      <FormField name="bmi" label="BMI (kg/m²)" type="number" placeholder="from height & weight" />
      <FormField name="lmp" label="LMP" type="date" />
      <FormField name="edd" label="EDD" type="date" />
      <FormField name="pog" label="POG" placeholder="e.g. 28w 3d" />
    </>
  );
}
