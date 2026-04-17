'use client';

import { useRouter } from 'next/navigation';
import { useGuestMode } from '@/lib/use-guest-mode';
import { exitGuest } from '@/lib/guest-store';

export default function GuestBanner() {
  const router = useRouter();
  const { guest, ready } = useGuestMode();
  if (!ready || !guest) return null;

  const handleExit = () => {
    exitGuest();
    router.replace('/login');
  };

  return (
    <div
      className="alert alert-warning d-flex flex-wrap align-items-center gap-2 mb-0 rounded-0 py-2"
      role="alert"
    >
      <i className="fa fa-user-astronaut"></i>
      <span>
        <strong>Guest mode</strong> — you&apos;re viewing demo data. Changes aren&apos;t saved.
        AI responses are sample content, not live Gemini output.
      </span>
      <button
        type="button"
        className="btn btn-sm btn-outline-dark ms-sm-auto"
        onClick={handleExit}
      >
        <i className="fa fa-right-from-bracket me-1"></i>Exit &amp; sign in
      </button>
    </div>
  );
}
