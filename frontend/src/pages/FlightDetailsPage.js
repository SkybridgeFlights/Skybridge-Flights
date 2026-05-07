
// src/pages/FlightDetailsPage.js
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const FlightDetailsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const flight = location.state?.flight;

  if (!flight) {
    return <div className="container mt-4"><h4>No flight data found.</h4></div>;
  }

  const handleChooseSeat = () => {
    navigate('/seat-map', { state: { flight } });
  };

  return (
    <div className="container mt-4">
      <h2>Flight Details</h2>
      <div className="card mt-4 shadow-sm">
        <div className="card-body">
          <h5 className="card-title">{flight.airline}</h5>
          <p><strong>From:</strong> {flight.from}</p>
          <p><strong>To:</strong> {flight.to}</p>
          <p><strong>Date:</strong> {flight.date}</p>
          <p><strong>Class:</strong> {flight.class}</p>
          <p><strong>Price:</strong> €{flight.price}</p>
          <button className="btn btn-primary mt-3" onClick={handleChooseSeat}>
            Choose Seat
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlightDetailsPage;
