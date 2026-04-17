'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthUser } from '@/lib/use-auth-user';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready } = useAuthUser();

  useEffect(() => {
    if (!ready) return;
    if (!user && pathname !== '/login') router.replace('/login');
    if (user && pathname === '/login') router.replace('/');
  }, [ready, user, pathname, router]);

  if (!ready) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <i className="fa fa-spinner fa-spin fa-2x text-muted"></i>
      </div>
    );
  }

  if (!user && pathname !== '/login') return null;

  return <>{children}</>;
}
