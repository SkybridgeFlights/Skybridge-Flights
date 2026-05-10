import React, { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from 'react-router-dom';
import './App.css';
import CookieBanner from './components/CookieBanner';
import AdSlot from './components/monetization/AdSlot';
import { initAnalytics, trackPageView } from './utils/analytics';

import HomePage from './pages/HomePage';
import FlightsPage from './pages/FlightsPage.js';
import BookingsPage from './pages/BookingsPage';
import BlogPage from './pages/BlogPage';
import BlogPostPage from './pages/BlogPostPage';
import SeoLandingPage from './pages/SeoLandingPage';
import LiveFlightTrackerPage from './pages/LiveFlightTrackerPage';
import AirportIntelligencePage from './pages/AirportIntelligencePage';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StaffLoginPage from './pages/StaffLoginPage';

import AdminPanel from './pages/AdminPanel';
import ManageStaff from './pages/ManageStaff';
import ManageProvidersPage from './pages/ManageProvidersPage';
import ManageBlogPage from './admin/ManageBlogPage';
import ManageReviewsPage from './admin/ManageReviewsPage';
import AppSearchPage from './pages/AppSearchPage';

import SearchResults from './SearchResults';
import LandingPage from './pages/LandingPage';
import AboutUs from './pages/AboutUs';
import ContactUs from './pages/ContactUs';

import Sidebar from './components/Sidebar';
import ChatBot from './components/ChatBot';
import ManageUsers from './admin/ManageUsers';
import UserOverview from './admin/UserOverview';
import UserProfilePage from './pages/UserProfilePage';
import VerifyPage from './pages/VerifyPage';
import VerifyInfoPage from './pages/VerifyInfoPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ForgotPasswordAppPage from './pages/ForgotPasswordAppPage';
import Privacy from "./Privacy";
import DeleteAccountPage from './pages/DeleteAccountPage';
import './styles/Modals.css';
import FabHub from './components/FAB/FabHub';

import SupportChatModal from './components/support/SupportChatModal';
import SupportInboxPage from './admin/SupportInboxPage';

function LiveTrackerRedirect() {
  const location = useLocation();
  return <Navigate to={`/flight-tracker${location.search || ''}`} replace />;
}

function StaffRoute({ children }) {
  try {
    const staffToken = localStorage.getItem('staffToken');
    if (staffToken) return children;

    const raw = localStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    const isAdmin =
      String(user?.role || '').toLowerCase() === 'admin' || !!user?.isAdmin;
    const perms = user?.permissions || {};

    if (
      isAdmin ||
      perms.viewStats ||
      perms.manageProviders ||
      perms.viewUsers ||
      perms.manageBlog ||
      perms.publishBlog ||
      perms.manageReviews ||
      perms.manageSupport ||
      perms.manageStaff
    ) {
      return children;
    }
  } catch (_) {}

  return <Navigate to="/staff-login" replace />;
}

function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => trackPageView(location), 250);
    return () => window.clearTimeout(timer);
  }, [location]);

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__openSupport = () => setSupportOpen(true);
      window.__closeSupport = () => setSupportOpen(false);
    }

    return () => {
      if (typeof window !== 'undefined') {
        try {
          delete window.__openSupport;
        } catch (_) {}
        try {
          delete window.__closeSupport;
        } catch (_) {}
      }
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const theme = params.get('theme');

    document.body.classList.remove('dark-mode');

    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    }
  }, [location.search]);

  const isAppSearchPage = location.pathname === '/app-search';
  const isForgotPasswordAppPage = location.pathname === '/forgot-password-app';
  const isFlightTrackerPage =
    location.pathname === '/flight-tracker' ||
    location.pathname.startsWith('/live-flights/');
  const hideSiteChrome = isAppSearchPage || isForgotPasswordAppPage || isFlightTrackerPage;

  const hideFabRoutes = [
    '/',
    '/flights',
    '/login',
    '/register',
    '/forgot-password',
    '/verify-info',
    '/app-search',
    '/forgot-password-app',
  ];

  const hideFab =
    hideFabRoutes.includes(location.pathname) ||
    location.pathname.startsWith('/reset-password/') ||
    location.pathname.startsWith('/verify/');

  return (
    <div className="app">
      {!hideSiteChrome && (
        <>
          <Sidebar menuOpen={menuOpen} toggleMenu={toggleMenu} />
          {menuOpen && <div className="sidebar-backdrop" onClick={toggleMenu} />}

          <header className="topbar">
            <button className="menu-btn" onClick={toggleMenu} aria-label="Open menu">
              <span className="menu-icon">☰</span>
              <span className="menu-text">Menu</span>
            </button>

            <div className="brand-block">
              <h1 className="company-title">Skybridge Flights</h1>
            </div>
            <div className="topbar-actions">
              <Link to={`/flight-tracker${location.search || ''}`} className="topbar-tracker-link">Flight Tracker</Link>
            </div>
          </header>
        </>
      )}

      <main className={hideSiteChrome ? '' : 'main'}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/flights" element={<FlightsPage />} />
          <Route path="/live-tracker" element={<LiveTrackerRedirect />} />
          <Route path="/flight-tracker" element={<LiveFlightTrackerPage />} />
          <Route path="/live-flights/:flightNumber" element={<LiveFlightTrackerPage />} />
          <Route path="/airports/:airportCode" element={<AirportIntelligencePage />} />
          <Route path="/flights/:slug" element={<SeoLandingPage />} />
          <Route path="/travel-guides/:slug" element={<SeoLandingPage />} />
          <Route path="/seo/:slug" element={<SeoLandingPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/search-results" element={<SearchResults />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:lang/:slug" element={<BlogPostPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/staff-login" element={<StaffLoginPage />} />
          <Route path="/app-search" element={<AppSearchPage />} />
          <Route path="/forgot-password-app" element={<ForgotPasswordAppPage />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/delete-account" element={<DeleteAccountPage />} />

          <Route
            path="/admin"
            element={
              <StaffRoute>
                <AdminPanel />
              </StaffRoute>
            }
          />

          <Route
            path="/admin/manage-staff"
            element={
              <StaffRoute>
                <ManageStaff />
              </StaffRoute>
            }
          />

          <Route
            path="/admin/support"
            element={
              <StaffRoute>
                <SupportInboxPage />
              </StaffRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <StaffRoute>
                <ManageUsers />
              </StaffRoute>
            }
          />

          <Route
            path="/admin/user/:userId"
            element={
              <StaffRoute>
                <UserOverview />
              </StaffRoute>
            }
          />

          <Route
            path="/admin/providers"
            element={
              <StaffRoute>
                <ManageProvidersPage />
              </StaffRoute>
            }
          />

          <Route
            path="/admin/blog"
            element={
              <StaffRoute>
                <ManageBlogPage />
              </StaffRoute>
            }
          />

          <Route
            path="/admin/reviews"
            element={
              <StaffRoute>
                <ManageReviewsPage />
              </StaffRoute>
            }
          />

          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/user-profile" element={<UserProfilePage />} />
          <Route path="/verify/:token" element={<VerifyPage />} />
          <Route path="/verify-info" element={<VerifyInfoPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        </Routes>
      </main>
      {!hideSiteChrome && <AdSlot placement="footer_banner" metadata={{ path: location.pathname }} />}

      {!hideSiteChrome && !hideFab && <FabHub />}
      {!hideSiteChrome && (
        <>
          <SupportChatModal open={supportOpen} onClose={() => setSupportOpen(false)} />
          <ChatBot />
        </>
      )}
      <CookieBanner />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
