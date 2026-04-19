'use client';

import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { useGuestMode } from '@/lib/use-guest-mode';
import { exitGuest } from '@/lib/guest-store';

export default function SidebarSignOut() {
  const { guest } = useGuestMode();
  const router = useRouter();

  const handleSignOut = async () => {
    if (guest) {
      exitGuest();
      router.replace('/login');
      return;
    }
    if (auth) await signOut(auth);
    router.replace('/login');
  };

  return (
    <div className="menu">
      <div className="menu-item">
        <button
          type="button"
          className="menu-link w-100 text-start bg-transparent border-0"
          onClick={handleSignOut}
        >
          <div className="menu-icon">
            <i className="fa fa-sign-out-alt"></i>
          </div>
          <div className="menu-text">{guest ? 'Exit Guest mode' : 'Sign Out'}</div>
        </button>
      </div>
    </div>
  );
}
