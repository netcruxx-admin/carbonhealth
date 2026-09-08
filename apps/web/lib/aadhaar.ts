/**
 * Aadhaar formatting and the transcription check, client-side.
 *
 * Mirrors `apps/api/app/identity.py`, which is the authority — this copy exists
 * so a desk clerk who fat-fingers a digit is told at the field instead of after
 * a round trip that also loses the rest of the form. Neither copy *verifies* an
 * Aadhaar: nothing here asks UIDAI whether the number belongs to the person. It
 * checks that the number was typed correctly, which is what makes it usable for
 * matching a patient to the record they already have.
 */

// Verhoeff's dihedral group D5 multiplication table and position permutation.
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

function verhoeffOk(digits: string): boolean {
  let checksum = 0;
  const reversed = digits.split('').reverse();
  reversed.forEach((digit, position) => {
    checksum = D[checksum][P[position % 8][Number(digit)]];
  });
  return checksum === 0;
}

/** Just the digits — people paste the number as printed on the card. */
export function aadhaarDigits(value: string): string {
  return (value ?? '').replace(/[\s-]/g, '');
}

/** "1234 5678 9012" — how the number is printed, and how it is read aloud. */
export function formatAadhaar(value: string): string {
  const digits = aadhaarDigits(value).slice(0, 12);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

/** Empty when the value is fine; otherwise what is wrong with it, for the field. */
export function aadhaarError(value: string): string {
  const digits = aadhaarDigits(value);
  if (!digits) return '';
  if (!/^\d+$/.test(digits)) return 'Aadhaar number must be 12 digits';
  if (digits.length !== 12) return 'Aadhaar number must be exactly 12 digits';
  if (digits[0] === '0' || digits[0] === '1') return 'Aadhaar number cannot start with 0 or 1';
  if (!verhoeffOk(digits)) return 'That Aadhaar number is not valid — please re-check it';
  return '';
}

/** "XXXX XXXX 9012" — for lists and anywhere the full number is not needed. */
export function maskAadhaar(value: string): string {
  const digits = aadhaarDigits(value);
  if (digits.length !== 12) return '';
  return `XXXX XXXX ${digits.slice(-4)}`;
}
