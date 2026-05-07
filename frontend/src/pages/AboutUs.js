import React from 'react';
import './AboutUs.css';

const AboutUs = () => {
  return (
    <div className="aboutus-page container py-5">
      <h1 className="text-center mb-4">About Skybridge Flights</h1>

      <p className="lead text-center mb-5">
        Skybridge Flights helps travelers search and compare flight options from trusted travel providers worldwide.
      </p>

      <section className="mb-5" data-aos="fade-up">
        <h3>Who We Are</h3>
        <p>
          Skybridge Flights is a travel discovery and flight comparison platform built to make searching for flights
          easier, clearer, and more convenient. Our goal is to help travelers explore routes, compare options,
          and reach the booking provider that best fits their needs.
        </p>
      </section>

      <section className="mb-5" data-aos="fade-up" data-aos-delay="100">
        <h3>What We Do</h3>
        <p>
          We focus on helping users discover flight options and compare travel opportunities through a simple search
          experience. When a traveler chooses an offer, they may be redirected to a partner or provider website to
          complete the booking process.
        </p>
      </section>

      <section className="mb-5" data-aos="fade-up" data-aos-delay="200">
        <h3>Our Mission</h3>
        <p>
          Our mission is to make flight search more transparent and user-friendly by helping travelers compare options,
          discover routes, and access useful travel information in one place.
        </p>
      </section>

      <section className="mb-5" data-aos="fade-up" data-aos-delay="300">
        <h3>Why Choose Skybridge Flights?</h3>
        <ul>
          <li>✔ Clean and simple flight search experience</li>
          <li>✔ Access to global travel routes and destinations</li>
          <li>✔ Helpful travel content and destination inspiration</li>
          <li>✔ Easy connection to trusted booking providers</li>
        </ul>
      </section>

      <section data-aos="fade-up" data-aos-delay="400">
        <h3>Our Vision</h3>
        <p>
          We are building Skybridge Flights as a growing travel platform that connects search, comparison, and travel
          inspiration in one experience. As the platform evolves, we aim to expand our flight search capabilities,
          provider coverage, and travel content offering.
        </p>
      </section>
    </div>
  );
};

export default AboutUs;