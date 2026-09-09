import { useMemo } from 'react';
import { useGetHospitalOperationalQuery } from '@/store/api';
import { breakSlotsFromRange } from '@/lib/schedule';

/**
 * Generate slot labels (e.g. "09:00 AM") from 09:00 to 17:00 at the given
 * interval. Default start/end covers a standard OPD day; hospitals that run
 * longer should extend the range here.
 */
export function generateSlots(stepMinutes: number): string[] {
  const slots: string[] = [];
  // 09:00 → 17:00 (exclusive), i.e. last slot starts at 16:45 or earlier
  const startMin = 9 * 60;   // 09:00
  const endMin   = 17 * 60;  // 17:00 exclusive
  for (let t = startMin; t < endMin; t += stepMinutes) {
    const h24 = Math.floor(t / 60);
    const m   = t % 60;
    const ampm = h24 < 12 ? 'AM' : 'PM';
    const h12  = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    slots.push(`${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`);
  }
  return slots;
}

/**
 * Returns the slot list for this hospital and the Set of slots that fall
 * within the lunch break — both derived from GET /hospitals/current/operational.
 *
 * Fetches the public endpoint (no auth required).
 * Falls back to 15-min slots and 12:00–14:00 break while loading.
 */
export function useBreakSlots(slots?: string[]): Set<string> {
  const { data } = useGetHospitalOperationalQuery();
  const start = data?.lunchBreakStart ?? '12:00';
  const end   = data?.lunchBreakEnd   ?? '14:00';
  const generated = useMemo(
    () => slots ?? generateSlots(data?.appointmentSlotMinutes ?? 15),
    [slots, data?.appointmentSlotMinutes],
  );
  return useMemo(() => breakSlotsFromRange(start, end, generated), [start, end, generated]);
}

/**
 * Returns { slots, breakSlots } — the slot list AND the blocked-for-lunch set.
 * Use this in booking components so both are derived from the same fetch.
 *
 * Pass `restrictToWindow: true` to also fold the hospital's patient
 * self-booking window (if the admin has set one) into `breakSlots`, so slots
 * outside it render the same "blocked" way lunch-break slots already do.
 * Only the patient booking screen should pass this — receptionist/admin
 * booking stays unrestricted.
 */
export function useHospitalSlots(
  options?: { restrictToWindow?: boolean },
): { slots: string[]; breakSlots: Set<string> } {
  const { data } = useGetHospitalOperationalQuery();
  const stepMinutes = data?.appointmentSlotMinutes ?? 15;
  const start = data?.lunchBreakStart ?? '12:00';
  const end   = data?.lunchBreakEnd   ?? '14:00';
  const windowStart = data?.patientBookingWindowStart;
  const windowEnd   = data?.patientBookingWindowEnd;

  const slots = useMemo(() => generateSlots(stepMinutes), [stepMinutes]);
  const breakSlots = useMemo(() => {
    const blocked = breakSlotsFromRange(start, end, slots);
    if (options?.restrictToWindow && windowStart && windowEnd) {
      const inWindow = breakSlotsFromRange(windowStart, windowEnd, slots);
      for (const slot of slots) {
        if (!inWindow.has(slot)) blocked.add(slot);
      }
    }
    return blocked;
  }, [start, end, slots, options?.restrictToWindow, windowStart, windowEnd]);

  return { slots, breakSlots };
}
