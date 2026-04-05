'use client';

import { signIn } from "next-auth/react";
import { useAppSettings } from '@/config/app-settings';
import { useEffect } from 'react';

export default function LoginPage() {
  const { updateSettings } = useAppSettings();

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
          <div className="d-flex justify-content-center">
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="btn btn-outline-white btn-lg d-flex align-items-center gap-2"
            >
              <i className="fab fa-google"></i>
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
