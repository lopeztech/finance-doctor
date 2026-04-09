'use client';

import { useSession, signOut } from 'next-auth/react';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <>
      <h1 className="page-header">Settings</h1>

      <div className="row">
        <div className="col-xl-6">
          <Panel>
            <PanelHeader noButton>Profile</PanelHeader>
            <PanelBody>
              <div className="d-flex align-items-center mb-3">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="rounded-circle me-3"
                    width="64"
                    height="64"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="bg-gray-800 text-gray-600 rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: 64, height: 64 }}>
                    <i className="fa fa-user fa-2x"></i>
                  </div>
                )}
                <div>
                  <h5 className="mb-1">{session?.user?.name || 'User'}</h5>
                  <p className="text-muted mb-0">{session?.user?.email}</p>
                </div>
              </div>
              <p className="text-muted small">Signed in via Google. Your data is stored securely and scoped to your account.</p>
            </PanelBody>
          </Panel>
        </div>

        <div className="col-xl-6">
          <Panel>
            <PanelHeader noButton>Account</PanelHeader>
            <PanelBody>
              <button
                className="btn btn-outline-danger"
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                <i className="fa fa-sign-out-alt me-2"></i>Sign Out
              </button>
            </PanelBody>
          </Panel>
        </div>
      </div>

      <div className="row">
        <div className="col-xl-6">
          <Panel>
            <PanelHeader noButton>Build Info</PanelHeader>
            <PanelBody>
              <div className="d-flex align-items-center">
                <i className="fa fa-clock text-muted me-2"></i>
                <div>
                  <small className="text-muted d-block">Last Successful Build</small>
                  <span>
                    {process.env.NEXT_PUBLIC_BUILD_TIME
                      ? new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleString()
                      : 'Development mode'}
                  </span>
                </div>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
