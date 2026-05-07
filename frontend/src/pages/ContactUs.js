import React from 'react';
import './ContactUs.css';

const ContactUs = () => {
  return (
    <div className="contactus-page container py-5">
      <h1 className="text-center mb-4">Contact Us</h1>

      <p className="lead text-center mb-5">
        Have a question, partnership inquiry, or general feedback? We would be glad to hear from you.
      </p>

      <div className="contact-info text-center mb-5" data-aos="fade-up">
        <p>
          <strong>Email:</strong>{' '}
          <a href="mailto:info@skybridgeflights.com">info@skybridgeflights.com</a>
        </p>
        <p>
          <strong>Website:</strong>{' '}
          <a href="https://skybridgeflights.com" target="_blank" rel="noreferrer">
            skybridgeflights.com
          </a>
        </p>
      </div>

      <div className="text-center" data-aos="fade-up" data-aos-delay="200">
        <p>
          For business inquiries, collaborations, or general support, please contact us by email.
        </p>
        <p>
          If your question is related to a booking completed on a partner website, please also check the booking
          confirmation and support options provided by that partner.
        </p>
      </div>
    </div>
  );
};

export default ContactUs;