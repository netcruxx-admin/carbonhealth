/**
 * Indian-format currency, in one place.
 *
 * `₹` symbol, lakh/crore digit grouping (₹1,23,456.00), two decimals for
 * amounts that carry paise. A bill line, a payment row and a revenue tile all
 * read the same because they all come through here.
 *
 * `paise: false` drops the decimals for headline figures where they are just
 * noise — a dashboard KPI, a status badge.
 */
export function formatINR(
  amount: number | null | undefined,
  { paise = true }: { paise?: boolean } = {},
): string {
  const value = Number.isFinite(amount as number) ? (amount as number) : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}
