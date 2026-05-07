import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import './Sidebar.css';

function SvgIcon({ children, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const Icons = {
  Home:        () => <SvgIcon><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></SvgIcon>,
  Flights:     () => <SvgIcon><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></SvgIcon>,
  Blog:        () => <SvgIcon><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></SvgIcon>,
  About:       () => <SvgIcon><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></SvgIcon>,
  Contact:     () => <SvgIcon><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></SvgIcon>,
  Login:       () => <SvgIcon><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></SvgIcon>,
  Register:    () => <SvgIcon><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></SvgIcon>,
  StaffLogin:  () => <SvgIcon><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></SvgIcon>,
  Dashboard:   () => <SvgIcon><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></SvgIcon>,
  Providers:   () => <SvgIcon><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></SvgIcon>,
  Users:       () => <SvgIcon><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></SvgIcon>,
  ManageBlog:  () => <SvgIcon><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></SvgIcon>,
  Reviews:     () => <SvgIcon><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></SvgIcon>,
  ManageStaff: () => <SvgIcon><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></SvgIcon>,
  Support:     () => <SvgIcon><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></SvgIcon>,
  Profile:     () => <SvgIcon><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></SvgIcon>,
  Logout:      () => <SvgIcon><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></SvgIcon>,
  Close:       () => <SvgIcon size={16}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></SvgIcon>,
  Plane:       () => <SvgIcon size={20}><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></SvgIcon>,
};

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function Sidebar({ menuOpen, toggleMenu }) {
  const [user, setUser]     = useState(null);
  const [isStaff, setIsStaff] = useState(false);
  const [perms, setPerms]   = useState({});
  const navigate   = useNavigate();
  const location   = useLocation();

  const updateUserState = useCallback(() => {
    try {
      const raw        = localStorage.getItem('user');
      const u          = raw ? JSON.parse(raw) : null;
      const staffToken = localStorage.getItem('staffToken');
      const userIsAdmin = u?.role?.toLowerCase?.() === 'admin';
      setUser(u);
      setIsStaff(!!staffToken && !!u && !userIsAdmin);
      setPerms(u?.permissions || {});
    } catch {
      localStorage.removeItem('user');
      setUser(null);
      setIsStaff(false);
      setPerms({});
    }
  }, []);

  const isAdmin = user?.role?.toLowerCase?.() === 'admin';

  useEffect(() => {
    updateUserState();
    window.addEventListener('userStateChange', updateUserState);
    return () => window.removeEventListener('userStateChange', updateUserState);
  }, [location.pathname, updateUserState]);

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('staffToken');
    window.dispatchEvent(new Event('userStateChange'));
    toggleMenu?.();
    navigate('/login');
  };

  const onNav = () => {
    toggleMenu?.();
    window.dispatchEvent(new Event('userStateChange'));
  };

  const navCls = ({ isActive }) => isActive ? 'nav-item active' : 'nav-item';

  const roleBadge = isAdmin
    ? { label: 'Admin', cls: 'role-admin' }
    : isStaff
    ? { label: 'Staff', cls: 'role-staff' }
    : { label: 'Member', cls: 'role-user' };

  return (
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>

      {/* ── Header ── */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon"><Icons.Plane /></div>
          <div>
            <span className="sidebar-brand-name">Skybridge</span>
            <span className="sidebar-brand-sub">Flights</span>
          </div>
        </div>
        <button className="sidebar-close" onClick={toggleMenu} aria-label="Close menu">
          <Icons.Close />
        </button>
      </div>

      {/* ── User block ── */}
      {user && (
        <div className="sidebar-user-block">
          <div className="sidebar-avatar">
            {getInitials(isAdmin ? 'Admin' : user.name)}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">
              {isAdmin ? 'Main Admin' : (user.name || 'User')}
            </div>
            <div className="sidebar-user-email">{user.email}</div>
          </div>
          <span className={`sidebar-role-badge ${roleBadge.cls}`}>{roleBadge.label}</span>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="sidebar-nav">

        {/* Guest */}
        {!user && (<>
          <p className="sidebar-section-label">Navigation</p>
          <ul>
            <li><NavLink to="/" className={navCls} onClick={onNav} end><Icons.Home /><span>Home</span></NavLink></li>
            <li><NavLink to="/flights" className={navCls} onClick={onNav}><Icons.Flights /><span>Search Flights</span></NavLink></li>
            <li><NavLink to="/blog" className={navCls} onClick={onNav}><Icons.Blog /><span>Blog</span></NavLink></li>
            <li><NavLink to="/about" className={navCls} onClick={onNav}><Icons.About /><span>About Us</span></NavLink></li>
            <li><NavLink to="/contact" className={navCls} onClick={onNav}><Icons.Contact /><span>Contact Us</span></NavLink></li>
          </ul>
          <div className="sidebar-divider" />
          <p className="sidebar-section-label">Account</p>
          <ul>
            <li><NavLink to="/login" className={navCls} onClick={onNav}><Icons.Login /><span>Login</span></NavLink></li>
            <li><NavLink to="/register" className={navCls} onClick={onNav}><Icons.Register /><span>Register</span></NavLink></li>
            <li><NavLink to="/staff-login" className={navCls} onClick={onNav}><Icons.StaffLogin /><span>Staff Login</span></NavLink></li>
          </ul>
        </>)}

        {/* Admin */}
        {isAdmin && (<>
          <p className="sidebar-section-label">Administration</p>
          <ul>
            <li><NavLink to="/admin" className={navCls} onClick={onNav} end><Icons.Dashboard /><span>Dashboard</span></NavLink></li>
            <li><NavLink to="/admin/providers" className={navCls} onClick={onNav}><Icons.Providers /><span>Providers</span></NavLink></li>
            <li><NavLink to="/admin/users" className={navCls} onClick={onNav}><Icons.Users /><span>Users</span></NavLink></li>
            <li><NavLink to="/admin/blog" className={navCls} onClick={onNav}><Icons.ManageBlog /><span>Blog</span></NavLink></li>
            <li><NavLink to="/admin/reviews" className={navCls} onClick={onNav}><Icons.Reviews /><span>Reviews</span></NavLink></li>
            <li><NavLink to="/admin/manage-staff" className={navCls} onClick={onNav}><Icons.ManageStaff /><span>Staff</span></NavLink></li>
            <li><NavLink to="/admin/support" className={navCls} onClick={onNav}><Icons.Support /><span>Support</span></NavLink></li>
          </ul>
        </>)}

        {/* Staff */}
        {isStaff && !isAdmin && (<>
          <p className="sidebar-section-label">Staff Panel</p>
          <ul>
            {perms.viewStats       && <li><NavLink to="/admin" className={navCls} onClick={onNav} end><Icons.Dashboard /><span>Dashboard</span></NavLink></li>}
            {perms.manageProviders && <li><NavLink to="/admin/providers" className={navCls} onClick={onNav}><Icons.Providers /><span>Providers</span></NavLink></li>}
            {perms.viewUsers       && <li><NavLink to="/admin/users" className={navCls} onClick={onNav}><Icons.Users /><span>Users</span></NavLink></li>}
            {(perms.manageBlog || perms.publishBlog) && <li><NavLink to="/admin/blog" className={navCls} onClick={onNav}><Icons.ManageBlog /><span>Blog</span></NavLink></li>}
            {perms.manageReviews   && <li><NavLink to="/admin/reviews" className={navCls} onClick={onNav}><Icons.Reviews /><span>Reviews</span></NavLink></li>}
            {perms.manageSupport   && <li><NavLink to="/admin/support" className={navCls} onClick={onNav}><Icons.Support /><span>Support</span></NavLink></li>}
          </ul>
        </>)}

        {/* Regular user */}
        {user && !isAdmin && !isStaff && (<>
          <p className="sidebar-section-label">Navigation</p>
          <ul>
            <li><NavLink to="/" className={navCls} onClick={onNav} end><Icons.Home /><span>Home</span></NavLink></li>
            <li><NavLink to="/flights" className={navCls} onClick={onNav}><Icons.Flights /><span>Search Flights</span></NavLink></li>
            <li><NavLink to="/blog" className={navCls} onClick={onNav}><Icons.Blog /><span>Blog</span></NavLink></li>
            <li><NavLink to="/user-profile" className={navCls} onClick={onNav}><Icons.Profile /><span>My Profile</span></NavLink></li>
            <li><NavLink to="/about" className={navCls} onClick={onNav}><Icons.About /><span>About Us</span></NavLink></li>
            <li><NavLink to="/contact" className={navCls} onClick={onNav}><Icons.Contact /><span>Contact Us</span></NavLink></li>
          </ul>
        </>)}

      </nav>

      {/* ── Logout footer ── */}
      {user && (
        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={logout}>
            <Icons.Logout />
            <span>Logout</span>
          </button>
        </div>
      )}

    </aside>
  );
}

export default Sidebar;
