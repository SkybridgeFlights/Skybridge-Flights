// src/pages/ContactUs.js
import React from 'react';
import './ContactUs.css';

const ContactUs = () => {
  return (
    <div className="contactus-page container py-5">
      <h1 className="text-center mb-4">Contact Us</h1>
      <p className="lead text-center mb-5">
        We'd love to hear from you. Reach out to us anytime!
      </p>

      <div className="contact-info text-center mb-5" data-aos="fade-up">
        <p><strong>Email:</strong> <a href="mailto:info@skybridgeflights.com">info@skybridgeflights.com</a></p>
        <p><strong>Phone:</strong> [coming soon]</p>
      </div>

      <div className="text-center" data-aos="fade-up" data-aos-delay="200">
        <p>Need help with a booking or partnership inquiry?</p>
        <p>Use our email above or reach us directly through the platform.</p>
      </div>
    </div>
  );
};

export default ContactUs;