// frontend/src/pages/ConfirmBookingPage.js
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

import { API_BASE_URL } from '../apiConfig';
import './ConfirmBooking.css';

import SeatModal from '../components/SeatModal';
import PetDetailsModal from '../components/PetDetailsModal';

// التحقق من صحة ObjectId
const isValidObjectId = (id) =>
  typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

const ConfirmBookingPage = () => {
  const { flightId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // في حالة وجود رحلة عودة
  const returnFlightId = location.state?.returnFlightId || null;

  // بيانات الرحلة
  const [flight, setFlight] = useState(null);
  const [returnFlight, setReturnFlight] = useState(null);

  // المقاعد
  const [bookedSeatsOutbound, setBookedSeatsOutbound] = useState([]);
  const [bookedSeatsReturn, setBookedSeatsReturn] = useState([]);
  const [selectedSeatOutbound, setSelectedSeatOutbound] = useState(null);
  const [selectedSeatReturn, setSelectedSeatReturn] = useState(null);
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [seatSelectionType, setSeatSelectionType] = useState('outbound'); // outbound أو return

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
  const [seatFee, setSeatFee] = useState(0);

  // طريقة الدفع
  const [paymentMethod, setPaymentMethod] = useState('');

  // أخطاء التحقق
  const [validationErrors, setValidationErrors] = useState({});

  // حالة التحميل
  const [loadingFlights, setLoadingFlights] = useState(true);
  const [loadingSeats, setLoadingSeats] = useState(false);

  // -------------------------------------------------
  // حساب السعر النهائي
  // -------------------------------------------------
  const { extraFee, petFee, totalPrice } = useMemo(() => {
    const basePrice =
      (flight?.price || 0) + (returnFlight?.price || 0);
    const extra = (extraWeight / 5) * extraPricePer5Kg;
    const seatTotal =
      (selectedSeatOutbound ? seatFee : 0) +
      (selectedSeatReturn ? seatFee : 0);
    const pet = petDetails ? 25 : 0;
    return {
      extraFee: extra,
      petFee: pet,
      totalPrice: basePrice + extra + seatTotal + pet,
    };
  }, [
    flight,
    returnFlight,
    extraWeight,
    extraPricePer5Kg,
    selectedSeatOutbound,
    selectedSeatReturn,
    seatFee,
    petDetails,
  ]);

  // -------------------------------------------------
  // جلب بيانات الرحلات والمقاعد
  // -------------------------------------------------
  useEffect(() => {
    const token = localStorage.getItem('token');

    const fetchFlights = async () => {
      try {
        setLoadingFlights(true);

        // رحلة الذهاب
        if (!isValidObjectId(flightId)) {
          alert('The outbound flight is invalid. Please search again.');
          navigate('/flights');
          return;
        }
        const res = await axios.get(`${API_BASE_URL}/api/flights/${flightId}`);
        const data = res.data;
        setFlight(data);

        // رحلة العودة
        if (returnFlightId) {
          if (!isValidObjectId(returnFlightId)) {
            alert('The return flight is invalid.');
          } else {
            const resReturn = await axios.get(
              `${API_BASE_URL}/api/flights/${returnFlightId}`
            );
            setReturnFlight(resReturn.data);
          }
        }

        // إعداد أسعار الوزن والمقاعد
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
        console.error('Failed to fetch flights:', err);
        alert('Could not load flight information.');
      } finally {
        setLoadingFlights(false);
      }
    };

    const fetchSeats = async () => {
      if (!token) return;
      try {
        setLoadingSeats(true);

        // مقاعد الذهاب
        const resOutbound = await axios.get(
          `${API_BASE_URL}/api/bookings/flight/${flightId}/seats`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setBookedSeatsOutbound(resOutbound.data.bookedSeats || []);

        // مقاعد العودة
        if (returnFlightId) {
          const resReturn = await axios.get(
            `${API_BASE_URL}/api/bookings/flight/${returnFlightId}/seats`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setBookedSeatsReturn(resReturn.data.bookedSeats || []);
        }
      } catch (err) {
        console.error('Failed to fetch seats:', err);
      } finally {
        setLoadingSeats(false);
      }
    };

    fetchFlights();
    fetchSeats();
  }, [flightId, returnFlightId, navigate]);

  // -------------------------------------------------
  // Handlers
  // -------------------------------------------------
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
    if (!paymentMethod) errs.paymentMethod = true;
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
        flightId,
        returnFlightId: returnFlightId || null,
        seatNumberOutbound: selectedSeatOutbound || null,
        seatNumberReturn: selectedSeatReturn || null,
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
        address: {
          country: passenger.country,
          city: passenger.city,
          street: passenger.street,
          zip: passenger.zip,
        },
      };

      console.log('Booking Payload:', payload);

      const res = await axios.post(`${API_BASE_URL}/api/bookings`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      navigate(`/payment/${res.data.bookingId}`, { state: { bookingData: payload } });
    } catch (error) {
      console.error('Booking failed:', error);
      alert(error?.response?.data?.error || 'Booking failed. Please try again.');
    }
  };

  // -------------------------------------------------
  // Render
  // -------------------------------------------------
  if (loadingFlights) return <p className="text-center mt-5">Loading flight details...</p>;
  if (!flight) return <p className="text-center mt-5">Could not load the flight.</p>;

  return (
    <div className="confirm-booking-container">
      <div className="booking-card">
        <h2 className="section-title">🧾 Confirm Your Booking</h2>
        <p className="flight-info-summary">
          <strong>{flight.airline}</strong> | {flight.from} ➜ {flight.to}
          {returnFlight && ` | Return: ${returnFlight.from} ➜ ${returnFlight.to}`} | <strong>Class:</strong> {flight.class || 'Economy'}
        </p>

        {/* نموذج الراكب */}
        <div className="form-grid">
          {/* First Name */}
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

          {/* Middle Name */}
          <div className="form-group">
            <label>Middle Name</label>
            <input
              name="middleName"
              type="text"
              value={passenger.middleName}
              onChange={handlePassengerChange}
            />
          </div>

          {/* Last Name */}
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

          {/* Gender */}
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

          {/* Date of Birth */}
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

          {/* Email */}
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

          {/* Passport */}
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

          {/* Country */}
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

          {/* City */}
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

          {/* Street */}
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

          {/* Zip */}
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

        {/* خيارات المقعد */}
        <div className="options-section">
          <button
            className="option-button"
            onClick={() => { setSeatSelectionType('outbound'); setShowSeatModal(true); }}
          >
            🎫 Choose Seat (Outbound) {selectedSeatOutbound && `(${selectedSeatOutbound})`}
          </button>
          {returnFlight && (
            <button
              className="option-button"
              onClick={() => { setSeatSelectionType('return'); setShowSeatModal(true); }}
            >
              🎫 Choose Seat (Return) {selectedSeatReturn && `(${selectedSeatReturn})`}
            </button>
          )}
          <button className="option-button" onClick={() => setShowPetModal(true)}>
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
          <p>Outbound Flight: €{flight.price}</p>
          {returnFlight && <p>Return Flight: €{returnFlight.price}</p>}
          <p>Extra Baggage: €{extraFee}</p>
          <p>Seat (Outbound): €{selectedSeatOutbound ? seatFee : 0}</p>
          {returnFlight && <p>Seat (Return): €{selectedSeatReturn ? seatFee : 0}</p>}
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

      {/* Modals */}
      <SeatModal
        show={showSeatModal}
        onClose={() => setShowSeatModal(false)}
        bookedSeats={seatSelectionType === 'outbound' ? bookedSeatsOutbound : bookedSeatsReturn}
        selectedSeat={seatSelectionType === 'outbound' ? selectedSeatOutbound : selectedSeatReturn}
        onSelectSeat={seatSelectionType === 'outbound' ? setSelectedSeatOutbound : setSelectedSeatReturn}
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

export default ConfirmBookingPage;