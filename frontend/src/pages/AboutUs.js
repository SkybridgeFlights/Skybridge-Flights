// src/pages/AboutUs.js
import React from 'react';
import './AboutUs.css';

const AboutUs = () => {
  return (
    <div className="aboutus-page container py-5">
      <h1 className="text-center mb-4">About Skybridge Flights</h1>
      <p className="lead text-center mb-5">
        Your trusted partner for seamless and affordable flight booking experiences.
      </p>

      <section className="mb-5" data-aos="fade-up">
        <h3>Who We Are</h3>
        <p>
          Skybridge Flights is a modern travel technology platform dedicated to simplifying flight booking for
          travelers around the globe. Founded with passion and precision, our platform connects users to thousands of
          flight options from hundreds of airlines, all in one place.
        </p>
      </section>

      <section className="mb-5" data-aos="fade-up" data-aos-delay="100">
        <h3>Our Mission</h3>
        <p>
          To make air travel accessible, transparent, and reliable. We believe in empowering travelers with real-time
          data, flexible booking options, and superior customer support.
        </p>
      </section>

      <section className="mb-5" data-aos="fade-up" data-aos-delay="200">
        <h3>Why Choose Us?</h3>
        <ul>
          <li>✔ Aggregated flight data from trusted global sources</li>
          <li>✔ 24/7 multilingual customer support</li>
          <li>✔ Secure payment options (credit card, PayPal, crypto)</li>
          <li>✔ Seamless visa support and add-ons for luggage, seats, and pets</li>
        </ul>
      </section>

      <section data-aos="fade-up" data-aos-delay="300">
        <h3>Our Team</h3>
        <p>
          Our team consists of travel technology enthusiasts, customer care specialists, and developers with deep
          knowledge of the airline and booking industry. We work hard to ensure Skybridge Flights delivers excellence,
          transparency, and satisfaction.
        </p>
      </section>
    </div>
  );
};

export default AboutUs;