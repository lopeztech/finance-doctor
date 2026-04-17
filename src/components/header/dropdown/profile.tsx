'use client';

import React from 'react';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { useAuthUser } from '@/lib/use-auth-user';

export default function DropdownProfile() {
  const { user } = useAuthUser();
  const router = useRouter();

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (auth) await signOut(auth);
    router.replace('/login');
  };

  return (
    <div className="navbar-item navbar-user dropdown">
      <a href="#" className="navbar-link dropdown-toggle d-flex align-items-center" data-bs-toggle="dropdown">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="rounded-circle"
            width="36"
            height="36"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="image image-icon bg-gray-800 text-gray-600">
            <i className="fa fa-user"></i>
          </div>
        )}
        <span>
          <span className="d-none d-md-inline fw-bold">{user?.displayName || 'User'}</span>
          <b className="caret"></b>
        </span>
      </a>
      <div className="dropdown-menu dropdown-menu-end me-1">
        <a
          href="#"
          className="dropdown-item"
          onClick={handleSignOut}
        >
          Log Out
        </a>
      </div>
    </div>
  );
}
