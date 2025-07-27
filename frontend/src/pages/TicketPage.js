// frontend/src/pages/TicketPage.js
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { API_BASE_URL } from '../apiConfig';
import './TicketPage.css';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return d.toISOString().split('T')[0];
};

const TicketPage = () => {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const printRef = useRef();

  useEffect(() => {
    const fetch = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE_URL}/api/bookings/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setBooking(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetch();
  }, [bookingId]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const original = document.body.innerHTML;
    document.body.innerHTML = html;
    window.print();
    document.body.innerHTML = original;
    window.location.reload();
  };

  if (!booking) return <p className="loading">Loading ticket...</p>;

  const pOut = booking.passengers?.[0] || {};
  const pRet = booking.passengersReturn?.[0] || {};
  const fOut = booking.flight;
  const fRet = booking.returnFlight;

  const extraOut = booking.extraWeight || 0;
  const extraRet = booking.extraWeightReturn || 0;

  return (
    <div className="ticket-container" ref={printRef}>
      <h2 className="ticket-title">🎟️ Official Flight Ticket</h2>
      <div className="ticket-header">
        <div className="ticket-logo">
          <img src="/logo.png" alt="Skybridge Flights Logo" className="ticket-logo-img" />
        </div>
        <div className="ticket-qr">
          <QRCodeCanvas value={`https://skybridgeflights.com/verify-booking/${booking._id}`} size={100} />
          <p className="verify-text">Scan to verify</p>
        </div>
      </div>

      <div className="ticket-body">
        {/* Passenger for outbound (نفس الراكب عادة) */}
        <div className="ticket-section">
          <h4>Passenger (Outbound)</h4>
          <p><strong>Name:</strong> {pOut.name || 'N/A'}</p>
          <p><strong>Email:</strong> {pOut.email || booking.contact?.email || 'N/A'}</p>
          <p><strong>Passport Number:</strong> {pOut.passportNumber || 'N/A'}</p>
          <p><strong>Date of Birth:</strong> {formatDate(pOut.dateOfBirth)}</p>
          <p><strong>Gender:</strong> {pOut.gender || 'N/A'}</p>
          <p><strong>Seat:</strong> {booking.seatNumber || 'Not assigned'}</p>
          <p><strong>Pet:</strong> {booking.petDetails ? 'Yes' : 'No'}</p>
        </div>

        {/* Outbound Info */}
        {fOut && (
          <div className="ticket-section">
            <h4>Outbound Flight</h4>
            <p><strong>Airline:</strong> {fOut.airline}</p>
            <p><strong>Flight Number:</strong> {fOut.flightNumber || 'N/A'}</p>
            <p><strong>From:</strong> {fOut.from}</p>
            <p><strong>To:</strong> {fOut.to}</p>
            <p><strong>Departure:</strong> {fOut.departureTime || 'N/A'}</p>
            <p><strong>Arrival:</strong> {fOut.arrivalTime || 'N/A'}</p>
            <p><strong>Travel Class:</strong> {fOut.class || 'Economy'}</p>
            <p><strong>Extra Baggage:</strong> {extraOut} kg</p>
            <p><strong>Subtotal:</strong> €{booking.totalPrice || 0}</p>
          </div>
        )}

        {/* Passenger for return (قد يكون نفسه أو مختلف) */}
        {fRet && (
          <div className="ticket-section">
            <h4>Passenger (Return)</h4>
            <p><strong>Name:</strong> {pRet.name || pOut.name || 'N/A'}</p>
            <p><strong>Email:</strong> {pRet.email || booking.contactReturn?.email || pOut.email || 'N/A'}</p>
            <p><strong>Passport Number:</strong> {pRet.passportNumber || pOut.passportNumber || 'N/A'}</p>
            <p><strong>Date of Birth:</strong> {formatDate(pRet.dateOfBirth) || formatDate(pOut.dateOfBirth)}</p>
            <p><strong>Gender:</strong> {pRet.gender || pOut.gender || 'N/A'}</p>
            <p><strong>Seat:</strong> {booking.seatNumberReturn || 'Not assigned'}</p>
            <p><strong>Pet:</strong> {booking.petDetailsReturn ? 'Yes' : 'No'}</p>
          </div>
        )}

        {/* Return Info */}
        {fRet && (
          <div className="ticket-section">
            <h4>Return Flight</h4>
            <p><strong>Airline:</strong> {fRet.airline}</p>
            <p><strong>Flight Number:</strong> {fRet.flightNumber || 'N/A'}</p>
            <p><strong>From:</strong> {fRet.from}</p>
            <p><strong>To:</strong> {fRet.to}</p>
            <p><strong>Departure:</strong> {fRet.departureTime || 'N/A'}</p>
            <p><strong>Arrival:</strong> {fRet.arrivalTime || 'N/A'}</p>
            <p><strong>Travel Class:</strong> {fRet.class || 'Economy'}</p>
            <p><strong>Extra Baggage:</strong> {extraRet} kg</p>
            <p><strong>Subtotal:</strong> €{booking.totalPriceReturn || 0}</p>
          </div>
        )}

        <div className="ticket-section">
          <h4>Payment Summary</h4>
          <p><strong>Outbound:</strong> €{booking.totalPrice || 0}</p>
          {fRet && <p><strong>Return:</strong> €{booking.totalPriceReturn || 0}</p>}
          <hr />
          <p><strong>Total Paid:</strong> €{(booking.totalPrice || 0) + (booking.totalPriceReturn || 0)}</p>
          <p><strong>Payment Method:</strong> {booking.paymentMethod || 'N/A'}</p>
        </div>
      </div>

      <div className="ticket-footer">
        <img src="/signature.png" alt="Signature" className="signature" />
        <p className="authority">Skybridge Flights Authority</p>
        <button className="print-btn no-print" onClick={handlePrint}>
          🖨️ Print Ticket (PDF)
        </button>
      </div>
    </div>
  );
};

export default TicketPage;