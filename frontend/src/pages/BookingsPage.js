// frontend/src/pages/BookingsPage.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';
import './BookingsPage.css';
import { fmt, percent } from '../utils/money';

const BookingsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        const res = await axios.get(`${API_BASE_URL}/api/bookings/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setBookings(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Error fetching bookings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  const handleCancelOrRefund = (booking) => {
    if (!booking?._id) return;

    if (booking.status === 'cancelled' && booking.refundStatus !== 'none') {
      alert('A refund request already exists for this booking.');
      return;
    }

    navigate(`/refund/${booking._id}`);
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
              {bookings.map((b) => {
                const total = (b.totalPrice || 0) + (b.totalPriceReturn || 0);

                return (
                  <tr key={b._id}>
                    <td>{b.passengers?.[0]?.name || 'N/A'}</td>
                    <td>{b.flight ? `${b.flight.from} → ${b.flight.to}` : 'N/A'}</td>
                    <td>{b.returnFlight ? `${b.returnFlight.from} → ${b.returnFlight.to}` : '—'}</td>
                    <td>
                      {b.flight?.date ? new Date(b.flight.date).toLocaleDateString() : 'N/A'}
                      {b.returnFlight?.date && <> / {new Date(b.returnFlight.date).toLocaleDateString()}</>}
                    </td>
                    <td>
                      {b.seatNumber || 'N/A'}
                      {b.seatNumberReturn && ` / ${b.seatNumberReturn}`}
                    </td>
                    <td>{fmt(total)}</td>

                    <td className={`status ${(b.status || '').toLowerCase()}`}>{b.status || 'N/A'}</td>

                    <td>
                      {b.refundStatus === 'none' || !b.refundStatus ? '—' : null}

                      {b.refundStatus === 'pending' && (
                        <span className="badge bg-warning text-dark">Pending</span>
                      )}

                      {b.refundStatus === 'approved' && (
                        <div>
                          <span className="badge bg-success">Approved</span>
                          <div className="rf-note">
                            Amount: {fmt(b.refundAmount || 0)}
                            {total > 0 ? ` (${percent(b.refundAmount || 0, total)}%)` : ''}
                          </div>
                          {b.refundPolicyReason && (
                            <div className="rf-note">
                              <em>{b.refundPolicyReason}</em>
                            </div>
                          )}
                          {b.refundAdminNote && (
                            <div className="rf-note">Note: {b.refundAdminNote}</div>
                          )}
                        </div>
                      )}

                      {b.refundStatus === 'rejected' && (
                        <div>
                          <span className="badge bg-danger">Rejected</span>
                          {b.refundAdminNote && (
                            <div className="rf-note">Reason: {b.refundAdminNote}</div>
                          )}
                        </div>
                      )}

                      {b.refundStatus === 'processed' && (
                        <div>
                          <span className="badge bg-secondary">Processed</span>
                          <div className="rf-note">
                            Paid: {fmt(b.refundProcessedAmount || b.refundAmount || 0)}
                            {total > 0
                              ? ` (${percent(b.refundProcessedAmount || b.refundAmount || 0, total)}%)`
                              : ''}
                          </div>
                          {b.refundProcessor && (
                            <div className="rf-note">
                              Via {b.refundProcessor}
                              {b.refundTransactionId ? ` (#${b.refundTransactionId})` : ''}
                            </div>
                          )}
                          {b.refundProcessedAt && (
                            <div className="rf-note">
                              On {new Date(b.refundProcessedAt).toLocaleString()}
                            </div>
                          )}
                          {b.refundAdminNote && (
                            <div className="rf-note">Note: {b.refundAdminNote}</div>
                          )}
                          {b.refundPolicyReason && (
                            <div className="rf-note">
                              <em>{b.refundPolicyReason}</em>
                            </div>
                          )}
                        </div>
                      )}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BookingsPage;