// src/App.js
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

import HomePage from './pages/HomePage';
import FlightsPage from './pages/FlightsPage';
import BookingsPage from './pages/BookingsPage';
import VisaApplicationPage from './pages/VisaApplicationPage';
import TicketPage from './pages/TicketPage';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StaffLoginPage from './pages/StaffLoginPage';

import AdminPanel from './pages/AdminPanel';
import ManageStaff from './pages/ManageStaff';
import ViewVisaApplications from './pages/ViewVisaApplications';
import AllBookingsPage from './pages/AllBookingsPage';

import SearchResults from './SearchResults';
import PaymentPage from './pages/PaymentPage';
import LandingPage from './pages/LandingPage';
import AboutUs from './pages/AboutUs';
import ContactUs from './pages/ContactUs';

import Sidebar from './components/Sidebar';
import ChatBot from './components/ChatBot';
import ManageFlightsPage from './pages/ManageFlightsPage';
import UserProfilePage from './pages/UserProfilePage';
import VerifyPage from './pages/VerifyPage';
import VerifyInfoPage from './pages/VerifyInfoPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PassportQueuePage from './pages/PassportQueuePage';
import RefundPage from './pages/RefundPage';

// ✅ الصفحتان الجديدتان
import ConfirmBookingOutbound from './pages/ConfirmBookingOutbound';
import ConfirmBookingReturn from './pages/ConfirmBookingReturn';

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen(!menuOpen);

  return (
    <Router>
      <div className="app">
        <Sidebar menuOpen={menuOpen} toggleMenu={toggleMenu} />
        <header className="topbar">
          <button className="menu-btn" onClick={toggleMenu}>☰ Menu</button>
          <h1 className="company-title">Skybridge Flights</h1>
        </header>

        <main className="main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/flights" element={<FlightsPage />} />
            <Route path="/bookings" element={<BookingsPage />} />
            <Route path="/visa" element={<VisaApplicationPage />} />

            {/* ✅ المسارات الجديدة */}
            <Route path="/booking/outbound/:flightId" element={<ConfirmBookingOutbound />} />
            <Route path="/booking/return/:returnFlightId" element={<ConfirmBookingReturn />} />

            <Route path="/ticket/:bookingId" element={<TicketPage />} />
            <Route path="/search-results" element={<SearchResults />} />
            <Route path="/payment/:bookingId" element={<PaymentPage />} />

            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/staff-login" element={<StaffLoginPage />} />

            {/* Admin */}
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/admin/manage-staff" element={<ManageStaff />} />
            <Route path="/admin/view-visas" element={<ViewVisaApplications />} />
            <Route path="/admin/view-bookings" element={<AllBookingsPage />} />
            <Route path="/admin/manage-flights" element={<ManageFlightsPage />} />

            {/* Static & misc */}
            <Route path="/about" element={<AboutUs />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/user-profile" element={<UserProfilePage />} />
            <Route path="/verify/:token" element={<VerifyPage />} />
            <Route path="/verify-info" element={<VerifyInfoPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/passport-queue" element={<PassportQueuePage />} />
            <Route path="/refund/:bookingId" element={<RefundPage />} />
          </Routes>
        </main>

        <ChatBot />
      </div>
    </Router>
  );
}

export default App;