'use client';

import { useMember } from '@/lib/use-member';

interface MemberSwitcherProps {
  /** 'header' = bootstrap dropdown for the navbar; 'subbar' = horizontal pills for mobile sub-bar. */
  variant?: 'header' | 'subbar';
  className?: string;
}

export default function MemberSwitcher({ variant = 'header', className = '' }: MemberSwitcherProps) {
  const { memberId, setMember, members, ready } = useMember();
  if (!ready || members.length === 0) return null;

  if (variant === 'subbar') {
    return (
      <div className={`d-flex flex-wrap align-items-center gap-1 px-3 py-2 bg-light border-bottom ${className}`}>
        <span className="text-muted small me-1">
          <i className="fa fa-user-friends me-1"></i>Showing
        </span>
        <button
          type="button"
          className={`btn btn-sm ${!memberId ? 'btn-primary' : 'btn-outline-secondary'} rounded-pill`}
          style={{ fontSize: '0.75rem' }}
          onClick={() => setMember('')}
        >
          Everyone
        </button>
        {members.map(m => (
          <button
            key={m.id}
            type="button"
            className={`btn btn-sm ${memberId === m.name ? 'btn-primary' : 'btn-outline-secondary'} rounded-pill`}
            style={{ fontSize: '0.75rem' }}
            onClick={() => setMember(m.name)}
          >
            {m.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`navbar-item dropdown ${className}`}>
      <a
        href="#"
        className="navbar-link dropdown-toggle d-flex align-items-center"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        onClick={e => e.preventDefault()}
      >
        <div className="image image-icon bg-gray-800 text-gray-600">
          <i className="fa fa-user-friends"></i>
        </div>
        <span>
          <span className="d-none d-lg-inline">{memberId || 'Everyone'}</span>
          <b className="caret"></b>
        </span>
      </a>
      <div className="dropdown-menu dropdown-menu-end">
        <button
          type="button"
          className={`dropdown-item ${!memberId ? 'active' : ''}`}
          onClick={() => setMember('')}
        >
          <i className="fa fa-users me-2"></i>Everyone
        </button>
        {members.map(m => (
          <button
            key={m.id}
            type="button"
            className={`dropdown-item ${memberId === m.name ? 'active' : ''}`}
            onClick={() => setMember(m.name)}
          >
            <i className="fa fa-user me-2"></i>{m.name}
          </button>
        ))}
      </div>
    </div>
  );
}
