import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import airports from '../data/airports';
import './FlightsPage.css';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig'; 

const FlightsPage = () => {
  const [tripType, setTripType] = useState('round');
  const [search, setSearch] = useState({
    from: '',
    to: '',
    departure: '',
    returnDate: '',
    oneWay: false,
    adults: 1,
    children: 0,
    infants: 0,
    travelClass: 'Economy',
    currency: 'USD',
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
      setSearch(JSON.parse(savedSearch));
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
    setTripType(type);
    setSearch((prev) => ({
      ...prev,
      oneWay: type === 'oneway',
      returnDate: type === 'oneway' ? '' : prev.returnDate,
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
    field === 'from' ? setFromSuggestions(suggestions) : setToSuggestions(suggestions);
  };

  const handleSuggestionClick = (field, value) => {
    setSearch((prev) => ({ ...prev, [field]: value }));
    field === 'from' ? setFromSuggestions([]) : setToSuggestions([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fromTrimmed = search.from.trim();
      const toTrimmed = search.to.trim();
      const depDate = search.departure.trim();

      if (!fromTrimmed || !toTrimmed || !depDate) {
        alert('Please fill all required fields (From, To, Departure Date).');
        setLoading(false);
        return;
      }

      const searchURL = `${API_BASE_URL}/api/flights/search`;
      console.log('🔍 Fetching flights from:', searchURL, {
        from: fromTrimmed,
        to: toTrimmed,
        date: depDate,
        returnDate: tripType === 'round' ? search.returnDate : undefined,
      });

      const response = await axios.get(searchURL, {
        params: {
          from: fromTrimmed,
          to: toTrimmed,
          date: depDate,
          returnDate: tripType === 'round' ? search.returnDate : undefined,
        },
      });

      const departureFlights = response.data.outboundFlights || [];
      const returnFlights = response.data.returnFlights || [];

      if (tripType === 'round' && returnFlights.length === 0) {
        alert('No return flights available on the selected date.');
      }

      localStorage.setItem('lastSearch', JSON.stringify(search));
      localStorage.setItem('searchResults', JSON.stringify({ departureFlights, returnFlights }));
      navigate('/search-results');
    } catch (error) {
      alert('Error fetching flights. Please try again later.');
      console.error('❌ API Error:', error);
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
          {['round', 'oneway', 'multi'].map((type) => (
            <button
              key={type}
              className={`tab-button ${tripType === type ? 'active' : ''}`}
              onClick={() => handleTripTypeChange(type)}
            >
              {type === 'round' ? 'Round Trip' : type === 'oneway' ? 'One Way' : 'Multi-city'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="search-grid-form mt-2">
          {/* From Airport */}
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
                    onClick={() => handleSuggestionClick('from', `${airport.name} (${airport.code})`)}
                  >
                    {airport.name} ({airport.code})
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* To Airport */}
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
                    onClick={() => handleSuggestionClick('to', `${airport.name} (${airport.code})`)}
                  >
                    {airport.name} ({airport.code})
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Departure Date */}
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

          {/* Return Date */}
          <div className="form-group">
            <label>Return Date</label>
            <input
              type="date"
              name="returnDate"
              className="form-control"
              value={search.returnDate}
              onChange={handleInputChange}
              disabled={tripType === 'oneway'}
            />
          </div>

          {/* Adults */}
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

          {/* Children */}
          <div className="form-group">
            <label>Children</label>
            <input
              type="number"
              name="children"
              className="form-control"
              value={search.children}
              onChange={handleInputChange}
            />
          </div>

          {/* Infants */}
          <div className="form-group">
            <label>Infants</label>
            <input
              type="number"
              name="infants"
              className="form-control"
              value={search.infants}
              onChange={handleInputChange}
            />
          </div>

          {/* Class */}
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

          {/* Currency */}
          <div className="form-group">
            <label>Currency</label>
            <select
              name="currency"
              className="form-select"
              value={search.currency}
              onChange={handleInputChange}
            >
              <option value="USD">USD</option>
              <option value="EUR">Euro</option>
              <option value="GBP">GBP</option>
              <option value="TRY">TRY</option>
            </select>
          </div>

          {/* Search Button */}
          <div className="form-group full-width">
            <button type="submit" className="btn btn-primary w-100">
              {loading ? 'Searching...' : 'Search Flights'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FlightsPage;