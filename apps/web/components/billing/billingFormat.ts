/** Formatting and invoice printing shared by both billing reports.
 *
 *  One copy, because a pharmacy bill and a consultation bill are the same
 *  document to the person holding it — the money, the method and the invoice
 *  number should not be formatted two different ways depending on the tab. */

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
}

export function methodLabel(method: string): string {
  switch (method.toLowerCase()) {
    case 'cash': return 'Cash';
    case 'upi': case 'qr': return 'UPI';
    case 'card': return 'Card';
    case 'razorpay': return 'Online';
    default: return method || '—';
  }
}

export function methodBadgeClass(method: string): string {
  switch (method.toLowerCase()) {
    case 'cash': return 'bg-green-100 text-green-700';
    case 'upi': case 'qr': return 'bg-violet-100 text-violet-700';
    case 'card': return 'bg-blue-100 text-blue-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildInvoiceHtml(invoice: any): string {
  const lines = (invoice.lines ?? [])
    .map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (l: any) => `
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #eee">${l.description}</td>
          <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:center">${l.quantity}</td>
          <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">₹${l.unitPrice.toFixed(2)}</td>
          <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">₹${l.amount.toFixed(2)}</td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${invoice.number}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; color: #222; margin: 0; padding: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 0 0 16px; color: #555; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #888; padding: 4px 0; border-bottom: 2px solid #222; }
    th:nth-child(n+2) { text-align: right; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .label { color: #888; font-size: 11px; }
    .total-row td { font-weight: bold; padding-top: 10px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${invoice.seller?.name || 'Hospital'}</h1>
  <h2>${invoice.seller?.address || ''}</h2>
  <div class="meta">
    <div>
      <div class="label">Invoice No</div>
      <div>${invoice.number}</div>
      <div class="label" style="margin-top:8px">Patient</div>
      <div>${invoice.patientName || '—'}</div>
      ${invoice.patientPhone ? `<div style="color:#555">${invoice.patientPhone}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div class="label">Date</div>
      <div>${new Date(invoice.issuedAt).toLocaleDateString('en-IN')}</div>
      <div class="label" style="margin-top:8px">Method</div>
      <div style="text-transform:capitalize">${invoice.paymentMethod || '—'}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:50%">Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>${lines}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="3" style="text-align:right;padding-top:10px">Total (${invoice.currency || 'INR'})</td>
        <td style="text-align:right;padding-top:10px">₹${(invoice.total ?? 0).toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
  ${invoice.seller?.gstin ? `<p style="margin-top:20px;font-size:11px;color:#888">GSTIN: ${invoice.seller.gstin}</p>` : ''}
</body>
</html>`;
}
