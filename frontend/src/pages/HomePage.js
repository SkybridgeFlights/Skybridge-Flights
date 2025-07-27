// src/pages/HomePage.js
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './HomePage.css';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { API_BASE_URL } from '../apiConfig';

const backgroundImages = ['/plane1.jpg', '/plane2.jpg', '/plane3.jpg'];

const HomePage = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showWarning, setShowWarning] = useState(true); // دائما true ليظهر التحذير في كل مرة
  const featuresRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    AOS.init({ duration: 1000 });
  }, []);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const closeWarning = () => {
    setShowWarning(false);
  };

  return (
    <div className="homepage">
      {/* نافذة التحذير */}
      {showWarning && (
        <div className="warning-modal">
          <div className="warning-content">
            <h2>⚠️ Site Under Development</h2>
            <p>
              This website is currently under development and testing. Some features may not be fully functional yet.
            </p>
            <button className="warning-btn" onClick={closeWarning}>OK, I Understand</button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div
        className="hero"
        style={{
          backgroundImage: `url(${backgroundImages[currentImageIndex]})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          height: '100vh',
          transition: 'background-image 1s ease-in-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 0
        }}
      >
        <div className="overlay text-center">
          <h1 className="hero-title">Skybridge Flights</h1>
          <p className="hero-subtitle">Connecting the world, one flight at a time ✈️</p>
          <Link to="/flights" className="hero-btn">Search Flights</Link>
          <br />
          <button className="scroll-down-btn mt-4" onClick={scrollToFeatures}>
            ⬇ Learn More
          </button>
        </div>
      </div>

      {/* Features Section */}
      <div ref={featuresRef} className="features-section container mt-5" data-aos="fade-up">
        <h2 className="text-center mb-4">Why Choose Skybridge?</h2>
        <div className="row text-center">
          <div className="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100">
            <img src="/icons/world.svg" alt="Global Destinations" className="feature-icon" />
            <h4>Global Destinations</h4>
            <p>Over 150 countries and 500+ airports at your fingertips.</p>
          </div>
          <div className="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200">
            <img src="/icons/visa.svg" alt="Visa Support" className="feature-icon" />
            <h4>Visa Support</h4>
            <p>Apply and track visas seamlessly through our platform.</p>
          </div>
          <div className="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300">
            <img src="/icons/support.svg" alt="Customer Service" className="feature-icon" />
            <h4>24/7 Customer Service</h4>
            <p>We're here to help, anytime, anywhere.</p>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <ReviewsSection />
    </div>
  );
};

const ReviewsSection = () => {
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ name: '', comment: '', rating: 0 });
  const [sort, setSort] = useState('highest');

  const fetchReviews = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/reviews`);
      let sorted = [...res.data];

      if (sort === 'highest') sorted.sort((a, b) => b.rating - a.rating);
      else if (sort === 'lowest') sorted.sort((a, b) => a.rating - b.rating);
      else if (sort === 'newest') sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      else if (sort === 'oldest') sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      else if (sort.includes('stars')) sorted = sorted.filter(r => r.rating === parseInt(sort[0]));

      setReviews(sorted);
    } catch (err) {
      console.error('Failed to fetch reviews', err);
    }
  };

  useEffect(() => {
    fetchReviews();
    AOS.refresh();
  }, [sort]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newReview.rating || !newReview.name || !newReview.comment) return;
    await axios.post(`${API_BASE_URL}/api/reviews`, newReview);
    setNewReview({ name: '', comment: '', rating: 0 });
    fetchReviews();
  };

  const handleDelete = async (id) => {
    const isAdmin = localStorage.getItem('user') === 'SkybridgeFlights@gmail.com';
    if (!isAdmin) return;
    await axios.delete(`${API_BASE_URL}/api/reviews/${id}`);
    fetchReviews();
  };

  return (
    <div className="reviews-section text-center mt-5" data-aos="fade-up">
      <h2>Traveler Reviews</h2>

      <div className="sort-container mb-3">
        <label htmlFor="sort">Sort by:</label>
        <select
          id="sort"
          className="form-select w-auto d-inline-block ms-2"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="highest">Highest Rating</option>
          <option value="lowest">Lowest Rating</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="5stars">5 Stars</option>
          <option value="4stars">4 Stars</option>
          <option value="3stars">3 Stars</option>
          <option value="2stars">2 Stars</option>
          <option value="1stars">1 Star</option>
        </select>
      </div>

      <form onSubmit={handleSubmit} className="review-form mb-5" data-aos="fade-up">
        <div className="stars mb-3">
          {[1, 2, 3, 4, 5].map(n => (
            <span
              key={n}
              onClick={() => setNewReview(prev => ({ ...prev, rating: n }))}
              style={{
                cursor: 'pointer',
                color: newReview.rating >= n ? 'gold' : 'gray',
                fontSize: '26px'
              }}
            >
              ★
            </span>
          ))}
        </div>
        <input
          type="text"
          className="form-control mb-2"
          placeholder="Your name"
          value={newReview.name}
          onChange={(e) => setNewReview(prev => ({ ...prev, name: e.target.value }))}
          required
        />
        <textarea
          className="form-control mb-3"
          placeholder="Write your review..."
          value={newReview.comment}
          onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
          required
        ></textarea>
        <button className="btn btn-warning" type="submit">Submit Review</button>
      </form>

      <div className="reviews-list">
        {reviews.map(r => (
          <div key={r._id} className="review-item mb-3" data-aos="fade-up">
            <div className="rating">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
            <div className="name fw-bold">{r.name}</div>
            <p>{r.comment}</p>
            {localStorage.getItem('user') === 'SkybridgeFlights@gmail.com' && (
              <button onClick={() => handleDelete(r._id)} className="btn btn-sm btn-danger">Delete</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomePage;