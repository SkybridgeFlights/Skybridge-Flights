// frontend/src/pages/BookingsPage.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';
import './BookingsPage.css';
import CancelRefundModal from '../components/CancelRefundModal';

const BookingsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchBookingsAndRefunds = async () => {
      try {
        const token = localStorage.getItem('token');
        console.log('Fetching bookings for token:', token);

        if (!token) {
          console.error('No token found. User not logged in.');
          setLoading(false);
          return;
        }

        const [bRes, rRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/bookings/mine`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_BASE_URL}/api/refunds/mine`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        console.log('Bookings API Response:', bRes.data);
        setBookings(bRes.data);
        setRefunds(rRes.data);
      } catch (err) {
        console.error('Error fetching bookings/refunds:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookingsAndRefunds();
  }, []);

  const getRefundStatus = (bookingId) => {
    const refund = refunds.find((r) => r.booking?._id === bookingId);
    return refund ? refund.status : '—';
  };

  const handleCancelOrRefund = (booking) => {
    if (booking.status === 'cancelled') {
      alert('This booking is already cancelled.');
      return;
    }
    setSelectedBooking(booking);
    setShowCancelModal(true);
  };

  const handleProceedFromModal = ({ reason }) => {
    setShowCancelModal(false);
    navigate(`/refund/${selectedBooking._id}`, { state: { reason } });
  };

  if (loading) {
    return (
      <div className="bookings-container">
        <p className="loading-text">Loading your bookings...</p>
      </div>
    );
  }

  return (
    <div className="bookings-container">
      <h2 className="page-title">📑 My Bookings</h2>

      {bookings.length === 0 ? (
        <p className="no-bookings">No bookings found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="bookings-table">
            <thead>
              <tr>
                <th>Passenger</th>
                <th>Outbound Flight</th>
                <th>Return Flight</th>
                <th>Date(s)</th>
                <th>Seat(s)</th>
                <th>Total Price (€)</th>
                <th>Booking Status</th>
                <th>Refund Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b._id}>
                  <td>{b.passengers?.[0]?.name || 'N/A'}</td>
                  <td>{b.flight ? `${b.flight.from} → ${b.flight.to}` : 'N/A'}</td>
                  <td>{b.returnFlight ? `${b.returnFlight.from} → ${b.returnFlight.to}` : '—'}</td>
                  <td>
                    {b.flight?.date
                      ? new Date(b.flight.date).toLocaleDateString()
                      : 'N/A'}
                    {b.returnFlight?.date && (
                      <> / {new Date(b.returnFlight.date).toLocaleDateString()}</>
                    )}
                  </td>
                  <td>
                    {b.seatNumber || 'N/A'}
                    {b.seatNumberReturn && ` / ${b.seatNumberReturn}`}
                  </td>
                  <td>€{(b.totalPrice || 0) + (b.totalPriceReturn || 0)}</td>
                  <td className={`status ${b.status.toLowerCase()}`}>{b.status}</td>
                  <td className={`status ${getRefundStatus(b._id).toLowerCase()}`}>
                    {getRefundStatus(b._id)}
                  </td>
                  <td className="action-buttons">
                    <Link to={`/ticket/${b._id}`} className="btn-view">
                      View Ticket
                    </Link>
                    <button
                      className="btn-cancel"
                      onClick={() => handleCancelOrRefund(b)}
                    >
                      Cancel / Refund
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CancelRefundModal
        open={showCancelModal}
        booking={selectedBooking}
        onClose={() => setShowCancelModal(false)}
        onProceed={handleProceedFromModal}
      />
    </div>
  );
};

export default BookingsPage;