// src/pages/AllBookingsPage.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const AllBookingsPage = () => {
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/bookings/all');
        setBookings(res.data);
      } catch (err) {
        console.error('Failed to fetch bookings:', err);
      }
    };
    fetchBookings();
  }, []);

  return (
    <div className="container mt-4">
      <h2>📋 All Flight Bookings</h2>
      {bookings.length === 0 ? (
        <p>No bookings found.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Flight</th>
              <th>Seat</th>
              <th>Price</th>
              <th>Extras</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking._id}>
                <td>{booking.user?.name || 'Guest'}</td>
                <td>{booking.flight?.flightNumber}</td>
                <td>{booking.seatNumber}</td>
                <td>{booking.totalPrice} {booking.currency || 'USD'}</td>
                <td>{booking.extraWeight ? `${booking.extraWeight}kg` : '-'}</td>
                <td>{new Date(booking.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AllBookingsPage;