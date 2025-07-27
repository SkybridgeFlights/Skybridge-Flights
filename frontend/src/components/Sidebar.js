// frontend/src/components/Sidebar.js
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';

function Sidebar({ menuOpen, toggleMenu }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // دالة لتحديث حالة المستخدم من LocalStorage
  const updateUserState = () => {
    try {
      const storedUser = localStorage.getItem('user');
      setUser(storedUser ? JSON.parse(storedUser) : null);
    } catch (error) {
      console.error('Error parsing user data:', error);
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  // تحديث عند أي تغيير للمسار (URL) أو عند إطلاق حدث userStateChange
  useEffect(() => {
    updateUserState();

    const handleUserChange = () => updateUserState();

    window.addEventListener('userStateChange', handleUserChange);

    return () => {
      window.removeEventListener('userStateChange', handleUserChange);
    };
  }, [location.pathname]);

  const isAdmin = user?.email === 'SkybridgeFlights@gmail.com';
  const isCustomer = user && !isAdmin;

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);

    // إطلاق الحدث لتحديث Sidebar فوراً
    window.dispatchEvent(new Event('userStateChange'));

    navigate('/login');
  };

  const showBackButton = !['/', '/login', '/register', '/staff-login'].includes(location.pathname);

  const handleGoBack = () => {
    navigate(-1);
    toggleMenu();
  };

  const handleLinkClick = () => {
    toggleMenu();
    // إطلاق الحدث للتأكد من تحديث القائمة
    window.dispatchEvent(new Event('userStateChange'));
  };

  return (
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      {showBackButton && (
        <button className="back-button" onClick={handleGoBack}>← Back</button>
      )}
      <nav className="sidebar-nav">
        <ul>
          {user && (
            <li className="sidebar-user">
              <div className="user-info">
                <strong>{user.name || "User"}</strong>
                <span>{user.email}</span>
              </div>
            </li>
          )}
          <li><Link to="/" onClick={handleLinkClick}>Home</Link></li>
          <li><Link to="/flights" onClick={handleLinkClick}>Search Flights</Link></li>
          {isCustomer && (
            <>
              <li><Link to="/user-profile" onClick={handleLinkClick}>My Profile</Link></li>
              <li><Link to="/bookings" onClick={handleLinkClick}>My Bookings</Link></li>
              <li><Link to="/visa" onClick={handleLinkClick}>Visa Application</Link></li>
            </>
          )}

          {/* رابط تسجيل الدور لجوازات السفر السورية */}
          <li><Link to="/passport-queue" onClick={handleLinkClick}>Syrian Passport Queue</Link></li>

          <li><Link to="/about" onClick={handleLinkClick}>About Us</Link></li>
          <li><Link to="/contact" onClick={handleLinkClick}>Contact Us</Link></li>
          {!user && (
            <>
              <li><Link to="/login" onClick={handleLinkClick}>Login</Link></li>
              <li><Link to="/register" onClick={handleLinkClick}>Register</Link></li>
              <li><Link to="/staff-login" onClick={handleLinkClick}>Staff Login</Link></li>
            </>
          )}
          {isAdmin && (
            <>
              <li><Link to="/admin" onClick={handleLinkClick}>Admin Panel</Link></li>
              <li><Link to="/admin/manage-staff" onClick={handleLinkClick}>Manage Staff</Link></li>
              <li><Link to="/admin/view-visas" onClick={handleLinkClick}>Visa Applications</Link></li>
              <li><Link to="/admin/view-bookings" onClick={handleLinkClick}>All Bookings</Link></li>
            </>
          )}
          {user && (
            <li>
              <button onClick={logout} className="logout-button">Logout</button>
            </li>
          )}
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;