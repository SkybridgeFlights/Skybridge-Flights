import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import './RefundPage.css';

const RefundPage = () => {
  const { bookingId } = useParams();
  const location = useLocation();
  const [booking, setBooking] = useState(null);
  const [reason, setReason] = useState(location.state?.reason || 'Change of plans');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refundStatus, setRefundStatus] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          alert('Please log in to access this page.');
          navigate('/login');
          return;
        }

        const res = await axios.get(`${API_BASE_URL}/api/bookings/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setBooking(res.data);
      } catch (error) {
        console.error('Failed to fetch booking:', error);
        alert('Failed to load booking details.');
        navigate('/bookings');
      }
    };

    fetchBooking();
  }, [bookingId, navigate]);

  const handleRefund = async () => {
    const finalReason = reason === 'Other' && customReason.trim() ? customReason.trim() : reason;

    if (!finalReason) {
      alert('Please select or provide a reason for the refund.');
      return;
    }

    if (!window.confirm('Are you sure you want to request a refund for this booking?')) return;

    try {
      setSubmitting(true);
      setError(null);
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_BASE_URL}/api/refunds`,
        { bookingId, reason: finalReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRefundStatus(res.data.refundRequest.status);
      alert(`✅ Refund request submitted. Amount: €${res.data.refundRequest.amount}`);
      navigate('/bookings');
    } catch (error) {
      console.error('Refund request failed:', error);
      const msg = error.response?.data?.error || '❌ Failed to create refund request.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!booking) {
    return (
      <div className="refund-container">
        <p>Loading booking details...</p>
      </div>
    );
  }

  const totalPaid = (booking.totalPrice || 0) + (booking.totalPriceReturn || 0);

  return (
    <div className="refund-container">
      <h2>💳 Request Refund</h2>
      <div className="refund-card">
        <p><strong>Passenger:</strong> {booking.passengers?.[0]?.name || 'N/A'}</p>
        <p>
          <strong>Flight:</strong> {booking.flight?.from} → {booking.flight?.to}
        </p>
        {booking.returnFlight && (
          <p>
            <strong>Return Flight:</strong> {booking.returnFlight.from} → {booking.returnFlight.to}
          </p>
        )}
        <p><strong>Total Paid:</strong> €{totalPaid}</p>
        <p><strong>Status:</strong> {booking.status}</p>

        <div className="reason-section">
          <label>Reason for Refund</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="Change of plans">Change of plans</option>
            <option value="Medical reasons">Medical reasons</option>
            <option value="Flight cancellation by airline">Flight cancellation by airline</option>
            <option value="Other">Other</option>
          </select>
          {reason === 'Other' && (
            <textarea
              placeholder="Please specify the reason..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
            ></textarea>
          )}
        </div>

        {error && (
          <div className="refund-error">
            {error}
          </div>
        )}

        <div className="refund-actions">
          <button className="btn-back" onClick={() => navigate('/bookings')}>
            Back
          </button>
          <button className="btn-refund" onClick={handleRefund} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Confirm Refund'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefundPage;