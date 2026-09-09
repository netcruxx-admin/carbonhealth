/**
 * Open a bill as a print sheet.
 *
 * The sheet lives at /print/invoice/[paymentId] — a real route that fetches
 * GET /payments/{id}/invoice itself (permission-guarded, tenant-scoped) and
 * renders it through <PrintSheet>, letterhead and all. Callers only need the
 * payment id; there is nothing to pre-fetch or assemble here.
 *
 * Opened in a new tab so the counter keeps its place. `window.open` on a real
 * URL from a click is not treated as a popup the way `window.open('')` +
 * document.write was. `opener` is left intact on purpose — the sheet is a
 * trusted same-origin route, and its Close button uses it to close the tab.
 */
export function openInvoicePrint(paymentId: string): void {
  window.open(`/print/invoice/${paymentId}`, '_blank');
}
