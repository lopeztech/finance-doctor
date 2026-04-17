'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useAppSettings } from '@/config/app-settings';
import { auth } from '@/lib/firebase';
import { enableGuest } from '@/lib/guest-store';

export default function LoginPage() {
  const { updateSettings } = useAppSettings();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    updateSettings({
      appHeaderNone: true,
      appSidebarNone: true,
      appContentNone: true,
    });

    return () => {
      updateSettings({
        appHeaderNone: false,
        appSidebarNone: false,
        appContentNone: false,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async () => {
    if (!auth) {
      setError('Firebase is not configured.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login login-v2 fw-bold">
      <div className="login-cover">
        <div
          className="login-cover-img"
          style={{ backgroundImage: 'url(/assets/img/login-bg/login-bg-17.jpg)' }}
        ></div>
        <div className="login-cover-bg"></div>
      </div>

      <div className="login-container">
        <div className="login-header">
          <div className="brand">
            <div className="d-flex align-items-center">
              <span className="logo"></span>
              <b>Finance</b>&nbsp;Doctor
            </div>
            <small>Your personal finance health check</small>
          </div>
          <div className="icon">
            <i className="fa fa-heartbeat"></i>
          </div>
        </div>

        <div className="login-content">
          <div className="text-white text-opacity-50 text-center mb-4">
            Sign in with your Google account to get started
          </div>
          <div className="d-flex flex-column align-items-center gap-3">
            <button
              onClick={handleLogin}
              disabled={busy}
              className="btn btn-outline-white btn-lg d-flex align-items-center gap-2"
            >
              {busy ? <i className="fa fa-spinner fa-spin"></i> : <i className="fab fa-google"></i>}
              Sign in with Google
            </button>
            <div className="text-white text-opacity-50 small">— or —</div>
            <button
              type="button"
              onClick={() => { enableGuest(); router.replace('/'); }}
              className="btn btn-link text-white text-decoration-none"
            >
              <i className="fa fa-user-astronaut me-2"></i>Try as Guest (demo data)
            </button>
          </div>
          {error && <div className="text-danger text-center mt-3 small">{error}</div>}
        </div>
      </div>
    </div>
  );
}
