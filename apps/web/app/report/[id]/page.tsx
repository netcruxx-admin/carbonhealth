'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';

/**
 * The lab report moved under /print with the other printables. Kept as a
 * redirect so older links and bookmarks (`/report/<orderId>`) still land.
 */
export default function LegacyReportRedirect() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/print/lab-report/${id}`);
  }, [router, id]);

  return <Spinner variant="page" label="Loading report…" />;
}
