'use client';

import React from 'react';
import { useSession, signOut } from 'next-auth/react';

export default function DropdownProfile() {
  const { data: session } = useSession();

  return (
    <div className="navbar-item navbar-user dropdown">
      <a href="#" className="navbar-link dropdown-toggle d-flex align-items-center" data-bs-toggle="dropdown">
        {session?.user?.image ? (
          <img
            src={session.user.image}
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
          <span className="d-none d-md-inline fw-bold">{session?.user?.name || 'User'}</span>
          <b className="caret"></b>
        </span>
      </a>
      <div className="dropdown-menu dropdown-menu-end me-1">
        <a
          href="#"
          className="dropdown-item"
          onClick={(e) => { e.preventDefault(); signOut({ callbackUrl: '/login' }); }}
        >
          Log Out
        </a>
      </div>
    </div>
  );
}
