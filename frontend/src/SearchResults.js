// frontend/src/pages/SearchResults.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SearchResults.css';

function SearchResults() {
  const [departureFlights, setDepartureFlights] = useState([]);
  const [returnFlights, setReturnFlights] = useState([]);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [filter, setFilter] = useState('all');
  const [airlineFilter, setAirlineFilter] = useState('all');
  const [maxPrice, setMaxPrice] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('searchResults');
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);

      if (Array.isArray(parsed)) {
        setDepartureFlights(enhanceFlights(parsed));
        setIsRoundTrip(false);
      } else if (parsed?.departureFlights && parsed?.returnFlights) {
        setDepartureFlights(enhanceFlights(parsed.departureFlights));
        setReturnFlights(enhanceFlights(parsed.returnFlights));
        setIsRoundTrip(true);
      } else {
        console.warn('Unexpected searchResults format:', parsed);
      }
    } catch (e) {
      console.error('Failed to parse searchResults', e);
    }
  }, []);

  const computeDuration = (dep, arr) => {
    const depTime = new Date(`1970-01-01T${dep || '00:00'}:00`);
    const arrTime = new Date(`1970-01-01T${arr || '00:00'}:00`);
    let diff = (arrTime - depTime) / 60000;
    if (diff < 0) diff += 1440;
    return diff;
  };

  const enhanceFlights = (flights) =>
    flights.map((f) => {
      const duration =
        f.duration ??
        (f.departureTime && f.arrivalTime
          ? computeDuration(f.departureTime, f.arrivalTime)
          : 120);

      const departureHour = f.departureTime
        ? parseInt(String(f.departureTime).split(':')[0], 10)
        : Math.floor(Math.random() * 24);

      return {
        ...f,
        direct: f.stops === 0 || f.direct === true,
        duration,
        departureHour,
      };
    });

  const applyFilters = (flights) => {
    let result = [...flights];

    if (filter === 'direct') {
      result = result.filter((f) => f.direct);
    } else if (filter === 'cheapest') {
      result.sort((a, b) => a.price - b.price);
    } else if (filter === 'fastest') {
      result.sort((a, b) => a.duration - b.duration);
    }

    if (airlineFilter !== 'all') {
      result = result.filter((f) => f.airline === airlineFilter);
    }

    if (maxPrice) {
      result = result.filter((f) => f.price <= Number(maxPrice));
    }

    if (timeFilter !== 'all') {
      result = result.filter((f) => {
        const h = f.departureHour;
        if (timeFilter === 'morning') return h >= 6 && h < 12;
        if (timeFilter === 'afternoon') return h >= 12 && h < 17;
        if (timeFilter === 'evening') return h >= 17 && h < 21;
        if (timeFilter === 'night') return h < 6 || h >= 21;
        return true;
      });
    }

    return result;
  };

  const handleBook = (outboundId, returnId) => {
    if (returnId) {
      // نخزّن أيضاً معلومات مسار العودة احتياطاً
      localStorage.setItem(
        'roundTripIntent',
        JSON.stringify({ outboundId, returnId })
      );
      navigate(`/booking/outbound/${outboundId}?returnFlightId=${returnId}`);
    } else {
      navigate(`/booking/outbound/${outboundId}`);
    }
  };

  const uniqueAirlines = [
    ...new Set([...departureFlights, ...returnFlights].map((f) => f.airline)),
  ];

  return (
    <div className="search-results-container">
      <h2 className="results-title">Available Flights</h2>

      <div className="filter-bar">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
        <button className={filter === 'direct' ? 'active' : ''} onClick={() => setFilter('direct')}>Direct Only</button>
        <button className={filter === 'cheapest' ? 'active' : ''} onClick={() => setFilter('cheapest')}>Cheapest</button>
        <button className={filter === 'fastest' ? 'active' : ''} onClick={() => setFilter('fastest')}>Fastest</button>
      </div>

      <div className="extra-filters">
        <select value={airlineFilter} onChange={(e) => setAirlineFilter(e.target.value)}>
          <option value="all">All Airlines</option>
          {uniqueAirlines.map((airline, idx) => (
            <option key={idx} value={airline}>{airline}</option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Max Price (€)"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />

        <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
          <option value="all">All Times</option>
          <option value="morning">Morning (06:00 - 12:00)</option>
          <option value="afternoon">Afternoon (12:00 - 17:00)</option>
          <option value="evening">Evening (17:00 - 21:00)</option>
          <option value="night">Night (21:00 - 06:00)</option>
        </select>
      </div>

      {applyFilters(departureFlights).length === 0 ? (
        <p className="no-results">No outbound flights available.</p>
      ) : (
        <div className="flights-grid">
          {applyFilters(departureFlights).map((out, idx) => {
            if (isRoundTrip && applyFilters(returnFlights).length > 0) {
              return applyFilters(returnFlights).map((ret, jdx) => {
                const totalPrice = out.price + ret.price;
                return (
                  <div className="flight-card" key={`${idx}-${jdx}`}>
                    <div className="flight-info">
                      <p><strong>Departure:</strong> {out.from} → {out.to}</p>
                      <p><strong>Departure Date:</strong> {out.date}</p>
                      <p><strong>Price:</strong> €{out.price}</p>
                      <hr />
                      <p><strong>Return:</strong> {ret.from} → {ret.to}</p>
                      <p><strong>Return Date:</strong> {ret.date}</p>
                      <p><strong>Price:</strong> €{ret.price}</p>
                      <hr />
                      <p><strong>Total Price:</strong> €{totalPrice}</p>
                    </div>
                    <button className="book-btn" onClick={() => handleBook(out._id, ret._id)}>
                      Book
                    </button>
                  </div>
                );
              });
            } else {
              return (
                <div className="flight-card" key={idx}>
                  <div className="flight-info">
                    <p><strong>From:</strong> {out.from}</p>
                    <p><strong>To:</strong> {out.to}</p>
                    <p><strong>Date:</strong> {out.date}</p>
                    <p><strong>Price:</strong> €{out.price}</p>
                  </div>
                  <button className="book-btn" onClick={() => handleBook(out._id)}>
                    Book
                  </button>
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}

export default SearchResults;