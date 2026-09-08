'use client';

import { useNotifications } from '@/hooks/useNotifications';

/**
 * Every dashboard screen renders its own <DashboardShell>, so a per-page
 * effect would register this device's FCM token on mount and unregister it
 * on unmount — meaning every click through the sidebar would tear the token
 * down and rebuild it a moment later, leaving a real gap where no token
 * exists for the user mid-navigation. Hoisting the hook here, in the layout
 * shared by every /dashboard/* route, means it mounts once per session
 * instead of once per page.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useNotifications();
  return <>{children}</>;
}
