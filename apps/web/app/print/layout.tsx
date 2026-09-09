/**
 * The shell for everything under /print — a bill, a lab report, and whatever
 * gets printed next.
 *
 * No DashboardShell, no sidebar, no theme chrome: these pages are handed to a
 * patient on paper. The root layout still wraps this in <Providers>, so RTK
 * Query works exactly as it does inside the dashboard.
 *
 * `.no-print` is the one shared convention — toolbars and buttons carry it and
 * disappear when the sheet actually prints.
 *
 * `@page { margin: 0 }` is deliberate and applies to every print route: it
 * leaves the browser no room to stamp its own header/footer (the date, page
 * title, URL and "1/1" a print-to-PDF otherwise adds), and it lets a full-page
 * letterhead bleed to the sheet edge — Chrome clips `position: fixed` elements
 * to the area *inside* the page margin, so any non-zero margin would crop the
 * letterhead's own header band and footer. Each PrintSheet mode then insets its
 * content with padding instead.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 print:bg-transparent">
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          .no-print { display: none !important; }
          [data-sonner-toaster] { display: none !important; }
          html, body { background: #fff !important; }
        }
      `}</style>
      {children}
    </div>
  );
}
