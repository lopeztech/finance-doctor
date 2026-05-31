'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthUser } from '@/lib/use-auth-user';
import { useGuestMode } from '@/lib/use-guest-mode';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { exitGuest } from '@/lib/guest-store';

const NAV = [
  { href: '/',            label: 'Financial' },
  { href: '/tax',         label: 'Tax' },
  { href: '/cashflow',    label: 'Cashflow' },
  { href: '/investments', label: 'Investments' },
  { href: '/expenses',    label: 'Spending' },
  { href: '/budgets',     label: 'Budgets' },
  { href: '/settings',    label: 'Settings' },
];

export default function Masthead() {
  const pathname = usePathname();
  const { user } = useAuthUser();
  const { guest } = useGuestMode();
  const router = useRouter();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fd-theme') === 'dark';
      setDark(saved);
      document.body.classList.toggle('dark', saved);
    } catch {}
  }, []);

  if (pathname === '/login') return null;

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.body.classList.toggle('dark', next);
    try { localStorage.setItem('fd-theme', next ? 'dark' : 'light'); } catch {}
  };

  const handleSignOut = async () => {
    if (guest) { exitGuest(); router.replace('/login'); return; }
    if (auth) await signOut(auth);
    router.replace('/login');
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="masthead">
      <div className="inner">
        <Link href="/" className="wordmark">
          <span className="mk"><i className="fa fa-user-doctor"></i></span>
          <span className="wm">Finance Doctor</span>
        </Link>

        <nav className="topnav">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className={isActive(href) ? 'active' : ''}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="mh-tools">
          <button className="iconbtn" onClick={toggleTheme} title="Toggle theme">
            <i className={`fa ${dark ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <button className="iconbtn" title={guest ? 'Exit guest mode' : user?.displayName || 'Account'} onClick={handleSignOut}>
            <i className="fa fa-circle-user"></i>
          </button>
        </div>
      </div>
    </header>
  );
}
