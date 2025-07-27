// frontend/src/pages/ConfirmBookingReturn.js
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import './ConfirmBooking.css';

import SeatModal from '../components/SeatModal';
import PetDetailsModal from '../components/PetDetailsModal';

const isValidObjectId = (id) =>
  typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

const ConfirmBookingReturn = () => {
  const { returnFlightId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const outboundBookingId = searchParams.get('outboundBookingId');

  const [flight, setFlight] = useState(null);
  const [bookedSeats, setBookedSeats] = useState([]);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [showSeatModal, setShowSeatModal] = useState(false);

  const [showPetModal, setShowPetModal] = useState(false);
  const [petDetails, setPetDetails] = useState(null);

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

  const [baseWeight, setBaseWeight] = useState(20);
  const [extraWeight, setExtraWeight] = useState(0);
  const [extraPricePer5Kg, setExtraPricePer5Kg] = useState(10);
  const [seatFee, setSeatFee] = useState(5);

  const [validationErrors, setValidationErrors] = useState({});
  const [loadingFlight, setLoadingFlight] = useState(true);
  const [loadingSeats, setLoadingSeats] = useState(false);

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

  useEffect(() => {
    const token = localStorage.getItem('token');

    const validateParams = () => {
      if (!isValidObjectId(returnFlightId) || !isValidObjectId(outboundBookingId)) {
        alert('Invalid booking or flight. Please search again.');
        navigate('/flights');
        return false;
      }
      return true;
    };

    const fetchFlight = async () => {
      try {
        setLoadingFlight(true);
        const res = await axios.get(`${API_BASE_URL}/api/flights/${returnFlightId}`);
        const data = res.data;
        if (!data) {
          alert('The return flight you selected is no longer available. Please search again.');
          navigate('/flights');
          return;
        }
        setFlight(data);

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
        console.error('Failed to fetch return flight:', err?.response?.status, err?.response?.data);
        alert('The return flight you selected is no longer available. Please search again.');
        navigate('/flights');
      } finally {
        setLoadingFlight(false);
      }
    };

    const fetchBookedSeats = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        setLoadingSeats(true);
        // لاحقًا يمكن تفعيل جلب المقاعد المحجوزة
      } catch (err) {
        console.error('Failed to fetch booked seats:', err);
      } finally {
        setLoadingSeats(false);
      }
    };

    if (validateParams()) {
      fetchFlight();
      fetchBookedSeats();
    }
  }, [returnFlightId, outboundBookingId, navigate]);

  const handlePassengerChange = (e) => {
    const { name, value } = e.target;
    setPassenger((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const required = [
      'firstName', 'lastName', 'gender', 'birthDate', 'email',
      'passportNumber', 'country', 'city', 'street', 'zip'
    ];
    const errs = {};
    required.forEach((f) => { if (!passenger[f]) errs[f] = true; });
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

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
        returnFlightId,
        passengersReturn: [
          {
            name: `${passenger.firstName} ${passenger.middleName || ''} ${passenger.lastName}`.trim(),
            passportNumber: passenger.passportNumber,
            dateOfBirth: passenger.birthDate,
            gender: passenger.gender,
            email: passenger.email,
          },
        ],
        seatNumberReturn: selectedSeat || null,
        extraWeightReturn: extraWeight,
        totalPriceReturn: totalPrice,
        petDetailsReturn: petDetails,
        contactReturn: {
          email: passenger.email,
          address: {
            country: passenger.country,
            city: passenger.city,
            street: passenger.street,
            zip: passenger.zip,
          }
        },
      };

      console.log('Return Booking Payload:', payload);

      // تحديث الحجز الخاص بالذهاب وإضافة بيانات الإياب بحالة pending
      await axios.put(
        `${API_BASE_URL}/api/bookings/${outboundBookingId}/attach-return`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      navigate(`/payment/${outboundBookingId}`);
    } catch (error) {
      console.error('Return booking failed:', error);
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Return flight attach failed. Please try again.';
      alert(msg);
    }
  };

  if (loadingFlight) {
    return <p className="text-center mt-5">Loading return flight details...</p>;
  }
  if (!flight) {
    return <p className="text-center mt-5">The return flight you selected is no longer available.</p>;
  }

  return (
    <div className="confirm-booking-container">
      <div className="booking-card">
        <h2 className="section-title">🔁 Confirm Your Return Flight</h2>
        <p className="flight-info-summary">
          <strong>{flight.airline}</strong> | {flight.from} ➜ {flight.to}{' '}
          | <strong>Class:</strong> {flight.class || 'Economy'}
        </p>

        <div className="form-grid">
          <div className="form-group">
            <label>First Name *</label>
            <input name="firstName" type="text" value={passenger.firstName} onChange={handlePassengerChange} className={validationErrors.firstName ? 'error-field' : ''} />
          </div>
          <div className="form-group">
            <label>Middle Name</label>
            <input name="middleName" type="text" value={passenger.middleName} onChange={handlePassengerChange} />
          </div>
          <div className="form-group">
            <label>Last Name *</label>
            <input name="lastName" type="text" value={passenger.lastName} onChange={handlePassengerChange} className={validationErrors.lastName ? 'error-field' : ''} />
          </div>
          <div className="form-group">
            <label>Gender *</label>
            <select name="gender" value={passenger.gender} onChange={handlePassengerChange} className={validationErrors.gender ? 'error-field' : ''}>
              <option value="">Select</option>
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>
          <div className="form-group">
            <label>Date of Birth *</label>
            <input name="birthDate" type="date" value={passenger.birthDate} onChange={handlePassengerChange} className={validationErrors.birthDate ? 'error-field' : ''} />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input name="email" type="email" value={passenger.email} onChange={handlePassengerChange} className={validationErrors.email ? 'error-field' : ''} />
          </div>
          <div className="form-group">
            <label>Passport Number *</label>
            <input name="passportNumber" type="text" value={passenger.passportNumber} onChange={handlePassengerChange} className={validationErrors.passportNumber ? 'error-field' : ''} />
          </div>
          <div className="form-group">
            <label>Country *</label>
            <input name="country" type="text" value={passenger.country} onChange={handlePassengerChange} className={validationErrors.country ? 'error-field' : ''} />
          </div>
          <div className="form-group">
            <label>City *</label>
            <input name="city" type="text" value={passenger.city} onChange={handlePassengerChange} className={validationErrors.city ? 'error-field' : ''} />
          </div>
          <div className="form-group">
            <label>Street *</label>
            <input name="street" type="text" value={passenger.street} onChange={handlePassengerChange} className={validationErrors.street ? 'error-field' : ''} />
          </div>
          <div className="form-group">
            <label>Zip Code *</label>
            <input name="zip" type="text" value={passenger.zip} onChange={handlePassengerChange} className={validationErrors.zip ? 'error-field' : ''} />
          </div>

          <div className="form-group">
            <label>Extra Baggage</label>
            <select value={extraWeight} onChange={(e) => setExtraWeight(Number(e.target.value))}>
              <option value={0}>No extra</option>
              <option value={5}>+5 kg (€{extraPricePer5Kg})</option>
              <option value={10}>+10 kg (€{extraPricePer5Kg * 2})</option>
            </select>
            <small>Included: {baseWeight} kg</small>
          </div>
        </div>

        <div className="options-section">
          <button className="option-button" onClick={() => setShowSeatModal(true)}>
            🎫 Choose Seat {selectedSeat && `(${selectedSeat})`}
          </button>
          <button className="option-button" onClick={() => setShowPetModal(true)}>
            🐾 Add Pet Details
          </button>
        </div>

        <div className="price-summary">
          <h4>💰 Price Breakdown (Return)</h4>
          <p>Flight: €{flight.price}</p>
          <p>Extra Baggage: €{extraFee}</p>
          <p>Seat: €{selectedSeat ? seatFee : 0}</p>
          <p>Pet: €{petFee}</p>
          <hr />
          <h3>Total: €{totalPrice}</h3>
        </div>

        <div className="confirm-button-container">
          <button className="confirm-button" onClick={handleSubmit}>
            ✅ Continue to Payment
          </button>
        </div>
      </div>

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

export default ConfirmBookingReturn;