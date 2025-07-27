// frontend/src/pages/PaymentPage.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import './PaymentPage.css';

const PaymentPage = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('You must be logged in to continue.');
      navigate('/login');
      return;
    }

    const fetchBookingData = async () => {
      try {
        const bookingRes = await axios.get(
          `${API_BASE_URL}/api/bookings/${bookingId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setBooking(bookingRes.data);
      } catch (err) {
        console.error('Failed to load booking:', err?.response?.data || err.message);
        alert('Failed to load booking.');
      }
    };

    fetchBookingData();
  }, [bookingId, navigate]);

  const handlePayment = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('You must be logged in to continue.');
      navigate('/login');
      return;
    }

    try {
      setIsProcessing(true);

      // (هنا تضع أي عملية دفع حقيقية أو وهمية)
      // سنستخدم setTimeout لمحاكاة بوابة الدفع
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // تأكيد الحجز بعد "الدفع"
      await axios.patch(
        `${API_BASE_URL}/api/bookings/${bookingId}/confirm`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      navigate(`/ticket/${bookingId}`);
    } catch (err) {
      console.error('Payment/confirm error:', err?.response?.data || err.message);
      alert('Payment failed or confirm failed. Please try again.');
      setIsProcessing(false);
    }
  };

  if (!booking) {
    return (
      <div className="payment-container">
        <h2>Processing Payment...</h2>
        <p>Please wait while we confirm your booking and generate your ticket.</p>
      </div>
    );
  }

  const outbound = booking.flight;        // populated
  const inbound  = booking.returnFlight;  // populated or null

  const baseOutbound = booking.totalPrice || 0;
  const baseInbound  = booking.totalPriceReturn || 0;

  const total = baseOutbound + baseInbound;

  return (
    <div className="payment-container">
      {!isProcessing ? (
        <div className="payment-box">
          <h2>💳 Complete Payment</h2>
          <p><strong>Passenger:</strong> {booking.passengers?.[0]?.name || 'N/A'}</p>

          <h3>🛫 Outbound Flight</h3>
          {outbound ? (
            <>
              <p><strong>From:</strong> {outbound.from} ➔ {outbound.to}</p>
              <p><strong>Airline:</strong> {outbound.airline || 'N/A'}</p>
              <p><strong>Seat:</strong> {booking.seatNumber || 'Not selected'}</p>
              <p><strong>Subtotal:</strong> €{baseOutbound}</p>
            </>
          ) : <p>Outbound flight not found.</p>}

          {inbound && (
            <>
              <hr />
              <h3>🔁 Return Flight</h3>
              <p><strong>From:</strong> {inbound.from} ➔ {inbound.to}</p>
              <p><strong>Airline:</strong> {inbound.airline || 'N/A'}</p>
              <p><strong>Seat:</strong> {booking.seatNumberReturn || 'Not selected'}</p>
              <p><strong>Subtotal:</strong> €{baseInbound}</p>
            </>
          )}

          <hr />
          <p><strong>Total Price:</strong> €{total}</p>
          <p><strong>Payment Method:</strong> {booking.paymentMethod}</p>

          <button className="pay-btn" onClick={handlePayment}>Pay Now</button>
        </div>
      ) : (
        <div className="payment-box processing">
          <h2>🔄 Processing Payment...</h2>
          <p>Please wait while we confirm your booking and generate your ticket.</p>
        </div>
      )}
    </div>
  );
};

export default PaymentPage;