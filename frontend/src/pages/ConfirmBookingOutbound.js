// frontend/src/pages/ConfirmBookingOutbound.js
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import './ConfirmBooking.css';

import SeatModal from '../components/SeatModal';
import PetDetailsModal from '../components/PetDetailsModal';

// التحقق من صحة ObjectId
const isValidObjectId = (id) =>
  typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

const ConfirmBookingOutbound = () => {
  const { flightId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const returnFlightId = searchParams.get('returnFlightId');

  // بيانات الرحلة
  const [flight, setFlight] = useState(null);

  // المقاعد
  const [bookedSeats, setBookedSeats] = useState([]);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [showSeatModal, setShowSeatModal] = useState(false);

  // الحيوانات الأليفة
  const [showPetModal, setShowPetModal] = useState(false);
  const [petDetails, setPetDetails] = useState(null);

  // بيانات الراكب
  const [passenger, setPassenger] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    gender: '',
    birthDate: '',
    email: '',
    passportNumber: '',
    country: '',
    city: '',
    street: '',
    zip: '',
  });

  // أوزان ورسوم إضافية
  const [baseWeight, setBaseWeight] = useState(20);
  const [extraWeight, setExtraWeight] = useState(0);
  const [extraPricePer5Kg, setExtraPricePer5Kg] = useState(10);
  const [seatFee, setSeatFee] = useState(5);

  // طريقة الدفع
  const [paymentMethod, setPaymentMethod] = useState('');

  // أخطاء التحقق
  const [validationErrors, setValidationErrors] = useState({});

  // حالة التحميل
  const [loadingFlight, setLoadingFlight] = useState(true);
  const [loadingSeats, setLoadingSeats] = useState(false);

  // حساب السعر النهائي
  const { extraFee, petFee, totalPrice } = useMemo(() => {
    const extra = (extraWeight / 5) * extraPricePer5Kg;
    const seat = selectedSeat ? seatFee : 0;
    const pet = petDetails ? 25 : 0;
    const base = flight?.price || 0;
    return {
      extraFee: extra,
      petFee: pet,
      totalPrice: base + extra + seat + pet,
    };
  }, [flight, extraWeight, extraPricePer5Kg, selectedSeat, seatFee, petDetails]);

  // جلب بيانات الرحلة والمقاعد
  useEffect(() => {
    const token = localStorage.getItem('token');

    const fetchFlight = async () => {
      try {
        if (!isValidObjectId(flightId)) {
          alert('The flight you selected is no longer available. Please search again.');
          navigate('/flights');
          return;
        }

        setLoadingFlight(true);
        const res = await axios.get(`${API_BASE_URL}/api/flights/${flightId}`);
        const data = res.data;
        setFlight(data);

        // ضبط القيم بناء على شركة الطيران
        let allowedWeight = 20, extraPer5kg = 10, seatPrice = 5;
        if (data.airline === 'Lufthansa') {
          allowedWeight = 25; extraPer5kg = 15; seatPrice = 8;
        } else if (data.airline === 'Emirates') {
          allowedWeight = 30; extraPer5kg = 20; seatPrice = 10;
        }

        if (data.class === 'Business') allowedWeight += 10;
        if (data.class === 'First Class') allowedWeight += 20;

        setBaseWeight(allowedWeight);
        setExtraPricePer5Kg(extraPer5kg);
        setSeatFee(seatPrice);
      } catch (err) {
        console.error('Failed to fetch flight:', err?.response?.status, err?.response?.data);
        if (err?.response?.status === 404) {
          alert('This flight no longer exists. Please search again.');
          navigate('/flights');
        }
      } finally {
        setLoadingFlight(false);
      }
    };

    const fetchBookedSeats = async () => {
      if (!token) return;
      try {
        setLoadingSeats(true);
        const res = await axios.get(
          `${API_BASE_URL}/api/bookings/flight/${flightId}/seats`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setBookedSeats(res.data.bookedSeats || []);
      } catch (err) {
        console.error('Failed to fetch booked seats:', err);
      } finally {
        setLoadingSeats(false);
      }
    };

    fetchFlight();
    fetchBookedSeats();
  }, [flightId, navigate]);

  // تحديث بيانات الراكب
  const handlePassengerChange = (e) => {
    const { name, value } = e.target;
    setPassenger((prev) => ({ ...prev, [name]: value }));
  };

  // تحقق من الحقول
  const validate = () => {
    const required = [
      'firstName', 'lastName', 'gender', 'birthDate', 'email',
      'passportNumber', 'country', 'city', 'street', 'zip'
    ];
    const errs = {};
    required.forEach((f) => { if (!passenger[f]) errs[f] = true; });
    if (!paymentMethod) errs.paymentMethod = true;
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // إرسال الحجز
  const handleSubmit = async () => {
    if (!validate()) {
      alert('Please fill all required fields.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      alert('You must be logged in to continue.');
      navigate('/login');
      return;
    }

    try {
      const payload = {
        flightId,
        seatNumber: selectedSeat || null,
        extraWeight,
        totalPrice,
        paymentMethod,
        petDetails,
        passengers: [
          {
            name: `${passenger.firstName} ${passenger.middleName || ''} ${passenger.lastName}`.trim(),
            passportNumber: passenger.passportNumber,
            dateOfBirth: passenger.birthDate,
            gender: passenger.gender,
            email: passenger.email,
          },
        ],
        contact: {
          email: passenger.email,
          address: {
            country: passenger.country,
            city: passenger.city,
            street: passenger.street,
            zip: passenger.zip,
          }
        },
        returnFlightId: returnFlightId || null,
      };

      console.log('Outbound Booking Payload:', payload);

      const res = await axios.post(`${API_BASE_URL}/api/bookings`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const outboundBookingId = res.data.bookingId;

      if (returnFlightId) {
        navigate(`/booking/return/${returnFlightId}?outboundBookingId=${outboundBookingId}`);
      } else {
        navigate(`/payment/${outboundBookingId}`);
      }
    } catch (error) {
      console.error('Booking failed:', error);
      alert(error?.response?.data?.error || 'Booking failed. Please try again.');
    }
  };

  if (loadingFlight) return <p className="text-center mt-5">Loading outbound flight details...</p>;
  if (!flight) return <p className="text-center mt-5">Could not load the flight.</p>;

  return (
    <div className="confirm-booking-container">
      <div className="booking-card">
        <h2 className="section-title">🧾 Confirm Your Outbound Booking</h2>
        <p className="flight-info-summary">
          <strong>{flight.airline}</strong> | {flight.from} ➜ {flight.to}{' '}
          | <strong>Class:</strong> {flight.class || 'Economy'}
        </p>

        {/* نموذج الراكب */}
        <div className="form-grid">
          <div className="form-group">
            <label>First Name *</label>
            <input
              name="firstName"
              type="text"
              value={passenger.firstName}
              onChange={handlePassengerChange}
              className={validationErrors.firstName ? 'error-field' : ''}
            />
          </div>

          <div className="form-group">
            <label>Middle Name</label>
            <input
              name="middleName"
              type="text"
              value={passenger.middleName}
              onChange={handlePassengerChange}
            />
          </div>

          <div className="form-group">
            <label>Last Name *</label>
            <input
              name="lastName"
              type="text"
              value={passenger.lastName}
              onChange={handlePassengerChange}
              className={validationErrors.lastName ? 'error-field' : ''}
            />
          </div>

          <div className="form-group">
            <label>Gender *</label>
            <select
              name="gender"
              value={passenger.gender}
              onChange={handlePassengerChange}
              className={validationErrors.gender ? 'error-field' : ''}
            >
              <option value="">Select</option>
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>

          <div className="form-group">
            <label>Date of Birth *</label>
            <input
              name="birthDate"
              type="date"
              value={passenger.birthDate}
              onChange={handlePassengerChange}
              className={validationErrors.birthDate ? 'error-field' : ''}
            />
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input
              name="email"
              type="email"
              value={passenger.email}
              onChange={handlePassengerChange}
              className={validationErrors.email ? 'error-field' : ''}
            />
          </div>

          <div className="form-group">
            <label>Passport Number *</label>
            <input
              name="passportNumber"
              type="text"
              value={passenger.passportNumber}
              onChange={handlePassengerChange}
              className={validationErrors.passportNumber ? 'error-field' : ''}
            />
          </div>

          <div className="form-group">
            <label>Country *</label>
            <input
              name="country"
              type="text"
              value={passenger.country}
              onChange={handlePassengerChange}
              className={validationErrors.country ? 'error-field' : ''}
            />
          </div>

          <div className="form-group">
            <label>City *</label>
            <input
              name="city"
              type="text"
              value={passenger.city}
              onChange={handlePassengerChange}
              className={validationErrors.city ? 'error-field' : ''}
            />
          </div>

          <div className="form-group">
            <label>Street *</label>
            <input
              name="street"
              type="text"
              value={passenger.street}
              onChange={handlePassengerChange}
              className={validationErrors.street ? 'error-field' : ''}
            />
          </div>

          <div className="form-group">
          <label>Zip Code *</label>
            <input
              name="zip"
              type="text"
              value={passenger.zip}
              onChange={handlePassengerChange}
              className={validationErrors.zip ? 'error-field' : ''}
            />
          </div>

          {/* Extra Baggage */}
          <div className="form-group">
            <label>Extra Baggage</label>
            <select
              value={extraWeight}
              onChange={(e) => setExtraWeight(Number(e.target.value))}
            >
              <option value={0}>No extra</option>
              <option value={5}>+5 kg (€{extraPricePer5Kg})</option>
              <option value={10}>+10 kg (€{extraPricePer5Kg * 2})</option>
            </select>
            <small>Included: {baseWeight} kg</small>
          </div>
        </div>

        {/* خيارات المقعد والحيوان */}
        <div className="options-section">
          <button
            className="option-button"
            onClick={() => setShowSeatModal(true)}
          >
            🎫 Choose Seat {selectedSeat && `(${selectedSeat})`}
          </button>
          <button
            className="option-button"
            onClick={() => setShowPetModal(true)}
          >
            🐾 Add Pet Details
          </button>
        </div>

        {/* الدفع */}
        <div className="payment-section">
          <label>💳 Payment Method *</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className={validationErrors.paymentMethod ? 'error-field' : ''}
          >
            <option value="">Select</option>
            <option value="visa">Visa</option>
            <option value="paypal">PayPal</option>
          </select>
        </div>

        {/* السعر */}
        <div className="price-summary">
          <h4>💰 Price Breakdown</h4>
          <p>Flight: €{flight.price}</p>
          <p>Extra Baggage: €{extraFee}</p>
          <p>Seat: €{selectedSeat ? seatFee : 0}</p>
          <p>Pet: €{petFee}</p>
          <hr />
          <h3>Total: €{totalPrice}</h3>
        </div>

        <div className="confirm-button-container">
          <button className="confirm-button" onClick={handleSubmit}>
            {returnFlightId ? '✅ Continue to Return Flight' : '✅ Continue to Payment'}
          </button>
        </div>
      </div>

      {/* Modals */}
      <SeatModal
        show={showSeatModal}
        onClose={() => setShowSeatModal(false)}
        bookedSeats={bookedSeats}
        selectedSeat={selectedSeat}
        onSelectSeat={setSelectedSeat}
        flightClass={flight.class || 'Economy'}
      />

      <PetDetailsModal
        show={showPetModal}
        onClose={() => setShowPetModal(false)}
        petDetails={petDetails}
        setPetDetails={setPetDetails}
      />
    </div>
  );
};

export default ConfirmBookingOutbound;