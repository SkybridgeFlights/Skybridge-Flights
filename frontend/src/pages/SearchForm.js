// frontend/src/components/SearchForm.js
import React, { useState } from 'react';

const SearchForm = ({ onSearch }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState(''); // ✅ عدّل الاسم هنا
  const [returnDate, setReturnDate] = useState('');
  const [classType, setClassType] = useState('Economy');
  const [currency, setCurrency] = useState('EUR');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch({
      from,
      to,
      date,          // ✅ هذا الاسم يجب أن يكون مطابقًا لما في backend
      returnDate,
      classType,
      currency,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="container mt-4 border p-4 rounded bg-light shadow-sm">
      <h4 className="mb-4 text-primary">✈️ Search Flights</h4>
      <div className="row">
        <div className="col-md-4 mb-3">
          <label>From</label>
          <input
            type="text"
            className="form-control"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </div>

        <div className="col-md-4 mb-3">
          <label>To</label>
          <input
            type="text"
            className="form-control"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </div>

        <div className="col-md-4 mb-3">
          <label>Class</label>
          <select
            className="form-control"
            value={classType}
            onChange={(e) => setClassType(e.target.value)}
          >
            <option value="Economy">Economy</option>
            <option value="Business">Business</option>
            <option value="First Class">First Class</option>
          </select>
        </div>
      </div>

      <div className="row">
        <div className="col-md-4 mb-3">
          <label>Departure Date</label>
          <input
            type="date"
            className="form-control"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="col-md-4 mb-3">
          <label>Return Date (optional)</label>
          <input
            type="date"
            className="form-control"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
          />
        </div>

        <div className="col-md-4 mb-3">
          <label>Currency</label>
          <select
            className="form-control"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="GBP">GBP (£)</option>
          </select>
        </div>
      </div>

      <button type="submit" className="btn btn-primary mt-3">
        Search Flights
      </button>
    </form>
  );
};

export default SearchForm;