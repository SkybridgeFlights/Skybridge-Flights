import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  return (
    <div
      className="hero-section"
      style={{
        backgroundImage: "url('/plane1.jpg')", // ✅ نستخدم الصورة من public
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        height: '100vh'
      }}
    >
      <div className="overlay">
        <h1 className="hero-title">Skybridge Flights</h1>
        <p className="hero-subtitle">Connecting the world, one flight at a time ✈️</p>
        <Link to="/flights" className="hero-btn">Search Flights</Link>
      </div>
    </div>
  );
};

export default LandingPage;