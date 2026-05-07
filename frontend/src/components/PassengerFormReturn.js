import React from 'react';

const PassengerFormReturn = ({
  passenger,
  setPassenger,
  extraWeight,
  setExtraWeight,
  baseWeight,
  extraPricePer5Kg,
  validationErrors
}) => {
  const handlePassengerChange = (e) => {
    const { name, value } = e.target;
    setPassenger((prev) => ({ ...prev, [name]: value }));
  };

  return (
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
  );
};

export default PassengerFormReturn;