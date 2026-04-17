'use client';

import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Panel, PanelHeader, PanelBody } from '@/components/panel/panel';
import DataManagement from '@/components/data-management';
import { auth } from '@/lib/firebase';
import { useAuthUser } from '@/lib/use-auth-user';

export default function SettingsPage() {
  const { user } = useAuthUser();
  const router = useRouter();

  const handleSignOut = async () => {
    if (auth) await signOut(auth);
    router.replace('/login');
  };

  return (
    <>
      <h1 className="page-header">Settings</h1>

      <div className="row">
        <div className="col-xl-6">
          <Panel>
            <PanelHeader noButton>Profile</PanelHeader>
            <PanelBody>
              <div className="d-flex align-items-center mb-3">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
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
                  <h5 className="mb-1">{user?.displayName || 'User'}</h5>
                  <p className="text-muted mb-0">{user?.email}</p>
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
                onClick={handleSignOut}
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

      <h2 className="h4 mt-4 mb-3"><i className="fa fa-database me-2"></i>Data Management</h2>
      <DataManagement />
    </>
  );
}
