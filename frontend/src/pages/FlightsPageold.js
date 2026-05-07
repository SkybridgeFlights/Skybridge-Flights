import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import airports from '../data/airports';
import './FlightsPage.css';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';

const FlightsPage = () => {
  const [tripType, setTripType] = useState('oneway');
  const [search, setSearch] = useState({
    from: '',
    to: '',
    departure: '',
    returnDate: '',
    oneWay: true,
    adults: 1,
    children: 0,
    infants: 0,
    travelClass: 'Economy',
    currency: 'EUR',
  });

  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const fromRef = useRef(null);
  const toRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const savedSearch = localStorage.getItem('lastSearch');
    if (savedSearch) {
      try {
        const parsed = JSON.parse(savedSearch);
        setSearch(parsed);
        setTripType(parsed?.oneWay ? 'oneway' : 'round');
      } catch (e) {
        console.error('Failed to parse lastSearch', e);
      }
    }

    const handleClickOutside = (e) => {
      if (fromRef.current && !fromRef.current.contains(e.target)) {
        setFromSuggestions([]);
      }
      if (toRef.current && !toRef.current.contains(e.target)) {
        setToSuggestions([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTripTypeChange = (type) => {
    const isOneWay = type === 'oneway';

    setTripType(type);
    setSearch((prev) => ({
      ...prev,
      oneWay: isOneWay,
      returnDate: isOneWay ? '' : prev.returnDate,
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearch((prev) => ({ ...prev, [name]: value }));
  };

  const handleAirportInputChange = (field, value) => {
    setSearch((prev) => ({ ...prev, [field]: value }));

    const suggestions = airports
      .filter(
        (airport) =>
          airport.name.toLowerCase().includes(value.toLowerCase()) ||
          airport.code.toLowerCase().includes(value.toLowerCase())
      )
      .slice(0, 5);

    if (field === 'from') {
      setFromSuggestions(suggestions);
    } else {
      setToSuggestions(suggestions);
    }
  };

  const handleSuggestionClick = (field, value) => {
    setSearch((prev) => ({ ...prev, [field]: value }));

    if (field === 'from') {
      setFromSuggestions([]);
    } else {
      setToSuggestions([]);
    }
  };

  const isExactAirportMatch = (value) => {
    return airports.some(
      (airport) => `${airport.name} (${airport.code})` === value.trim()
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fromTrimmed = search.from.trim();
      const toTrimmed = search.to.trim();
      const depDate = search.departure.trim();
      const retDate = search.returnDate.trim();

      if (!fromTrimmed || !toTrimmed || !depDate) {
        alert('Please fill all required fields (From, To, Departure Date).');
        setLoading(false);
        return;
      }

      if (!isExactAirportMatch(fromTrimmed) || !isExactAirportMatch(toTrimmed)) {
        alert('Please choose airports from the suggestions list.');
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({
        from: fromTrimmed,
        to: toTrimmed,
        date: depDate,
        adults: String(search.adults || 1),
        children: String(search.children || 0),
        infants: String(search.infants || 0),
        travelClass: search.travelClass || 'Economy',
        currency: search.currency || 'EUR',
      });

      if (!search.oneWay && retDate) {
        params.append('returnDate', retDate);
      }

      const searchURL = `${API_BASE_URL}/api/flights/search?${params.toString()}`;
      console.log('Fetching flights from:', searchURL);

      const response = await axios.get(searchURL);
      const normalizedResult = response.data;

      if (!normalizedResult?.flights || normalizedResult.flights.length === 0) {
        alert('No flights found for the selected trip.');
        setLoading(false);
        return;
      }

      localStorage.setItem('lastSearch', JSON.stringify(search));
      localStorage.setItem('searchResults', JSON.stringify(normalizedResult));

      navigate('/search-results');
    } catch (error) {
      console.error('Flights search error:', error);

      if (error.response?.status === 404) {
        alert(error.response?.data?.error || 'No flights found.');
      } else {
        alert('Error fetching flights. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flights-background">
      <div className="glass-form-container">
        <h3 className="text-center mb-4">
          <i className="fas fa-plane-departure me-2" />
          Find Your Perfect Flight
        </h3>

        <div className="trip-type-tabs">
          {['oneway', 'round', 'multi'].map((type) => (
            <button
              key={type}
              type="button"
              className={`tab-button ${tripType === type ? 'active' : ''}`}
              onClick={() => handleTripTypeChange(type)}
            >
              {type === 'oneway'
                ? 'One Way'
                : type === 'round'
                ? 'Round Trip'
                : 'Multi-city'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="search-grid-form mt-2">
          <div className="form-group" ref={fromRef}>
            <label>From</label>
            <input
              type="text"
              className="form-control"
              value={search.from}
              onChange={(e) => handleAirportInputChange('from', e.target.value)}
              placeholder="Enter departure airport"
            />
            {fromSuggestions.length > 0 && (
              <ul className="suggestions-list">
                {fromSuggestions.map((airport, i) => (
                  <li
                    key={i}
                    onClick={() =>
                      handleSuggestionClick('from', `${airport.name} (${airport.code})`)
                    }
                  >
                    {airport.name} ({airport.code})
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="form-group" ref={toRef}>
            <label>To</label>
            <input
              type="text"
              className="form-control"
              value={search.to}
              onChange={(e) => handleAirportInputChange('to', e.target.value)}
              placeholder="Enter arrival airport"
            />
            {toSuggestions.length > 0 && (
              <ul className="suggestions-list">
                {toSuggestions.map((airport, i) => (
                  <li
                    key={i}
                    onClick={() =>
                      handleSuggestionClick('to', `${airport.name} (${airport.code})`)
                    }
                  >
                    {airport.name} ({airport.code})
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="form-group">
            <label>Departure Date</label>
            <input
              type="date"
              name="departure"
              className="form-control"
              value={search.departure}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label>Return Date</label>
            <input
              type="date"
              name="returnDate"
              className="form-control"
              value={search.returnDate}
              onChange={handleInputChange}
              disabled={search.oneWay}
            />
          </div>

          <div className="form-group">
            <label>Adults</label>
            <input
              type="number"
              name="adults"
              className="form-control"
              value={search.adults}
              onChange={handleInputChange}
              min={1}
            />
          </div>

          <div className="form-group">
            <label>Children</label>
            <input
              type="number"
              name="children"
              className="form-control"
              value={search.children}
              onChange={handleInputChange}
              min={0}
            />
          </div>

          <div className="form-group">
            <label>Infants</label>
            <input
              type="number"
              name="infants"
              className="form-control"
              value={search.infants}
              onChange={handleInputChange}
              min={0}
            />
          </div>

          <div className="form-group">
            <label>Class</label>
            <select
              name="travelClass"
              className="form-select"
              value={search.travelClass}
              onChange={handleInputChange}
            >
              <option value="Economy">Economy</option>
              <option value="Business">Business</option>
              <option value="First Class">First Class</option>
            </select>
          </div>

          <div className="form-group">
            <label>Currency</label>
            <select
              name="currency"
              className="form-select"
              value={search.currency}
              onChange={handleInputChange}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="TRY">TRY</option>
            </select>
          </div>

          <div className="form-group full-width">
            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? 'Searching...' : 'Search Flights'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FlightsPage;