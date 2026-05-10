import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './SearchResults.css';
import { API_BASE_URL } from './apiConfig';
import { trackEvent } from './utils/analytics';

function SearchResults() {
  const [searchMeta, setSearchMeta] = useState(null);
  const [flights, setFlights] = useState([]);
  const [filter, setFilter] = useState('all');
  const [airlineFilter, setAirlineFilter] = useState('all');
  const [maxPrice, setMaxPrice] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');

  useEffect(() => {
    const stored = localStorage.getItem('searchResults');
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);

      if (parsed?.searchMeta && Array.isArray(parsed?.flights)) {
        setSearchMeta(parsed.searchMeta);
        setFlights(parsed.flights);
      } else {
        console.warn('Unexpected searchResults format:', parsed);
      }
    } catch (error) {
      console.error('Failed to parse searchResults', error);
    }
  }, []);

  const getBestPrice = useCallback((flight) => {
    if (!Array.isArray(flight?.offers) || flight.offers.length === 0) {
      return 0;
    }

    return Math.min(...flight.offers.map((offer) => Number(offer.price || 0)));
  }, []);

  const getDepartureHour = useCallback((flight) => {
    if (!flight?.departureTime) return 0;
    return parseInt(String(flight.departureTime).split(':')[0], 10);
  }, []);

  const formatPrice = useCallback((value, currency = 'EUR') => {
    const symbol =
      currency === 'USD'
        ? '$'
        : currency === 'GBP'
        ? '£'
        : currency === 'TRY'
        ? '₺'
        : '€';

    return `${symbol}${Number(value || 0).toFixed(0)}`;
  }, []);

  const formatDuration = useCallback((minutes) => {
    const total = Number(minutes || 0);
    const hrs = Math.floor(total / 60);
    const mins = total % 60;
    return `${hrs}h ${mins}m`;
  }, []);

  const applyFilters = useCallback(
    (items) => {
      let result = [...items];

      if (filter === 'direct') {
        result = result.filter((flight) => flight.direct);
      } else if (filter === 'cheapest') {
        result.sort((a, b) => getBestPrice(a) - getBestPrice(b));
      } else if (filter === 'fastest') {
        result.sort(
          (a, b) =>
            Number(a.durationMinutes || 0) - Number(b.durationMinutes || 0)
        );
      }

      if (airlineFilter !== 'all') {
        result = result.filter((flight) => flight.airline === airlineFilter);
      }

      if (maxPrice) {
        result = result.filter(
          (flight) => getBestPrice(flight) <= Number(maxPrice)
        );
      }

      if (timeFilter !== 'all') {
        result = result.filter((flight) => {
          const hour = getDepartureHour(flight);

          if (timeFilter === 'morning') return hour >= 6 && hour < 12;
          if (timeFilter === 'afternoon') return hour >= 12 && hour < 17;
          if (timeFilter === 'evening') return hour >= 17 && hour < 21;
          if (timeFilter === 'night') return hour < 6 || hour >= 21;

          return true;
        });
      }

      return result;
    },
    [
      airlineFilter,
      filter,
      getBestPrice,
      getDepartureHour,
      maxPrice,
      timeFilter,
    ]
  );

  const filteredFlights = useMemo(() => applyFilters(flights), [applyFilters, flights]);

  const uniqueAirlines = useMemo(() => {
    return [...new Set(flights.map((flight) => flight.airline).filter(Boolean))];
  }, [flights]);

  const handleGoToSite = useCallback(
    (offer, flight) => {
      const params = new URLSearchParams();

      if (flight?.from) params.set('from', flight.from);
      if (flight?.to) params.set('to', flight.to);
      if (flight?.date) params.set('date', flight.date);

      if (searchMeta?.fromCode) params.set('fromCode', searchMeta.fromCode);
      if (searchMeta?.toCode) params.set('toCode', searchMeta.toCode);

      if (searchMeta?.returnDate) {
        params.set('returnDate', searchMeta.returnDate);
      }
      if (searchMeta?.adults) {
        params.set('adults', String(searchMeta.adults));
      }
      if (searchMeta?.children) {
        params.set('children', String(searchMeta.children));
      }
      if (searchMeta?.infants) {
        params.set('infants', String(searchMeta.infants));
      }
      if (searchMeta?.travelClass) {
        params.set('travelClass', searchMeta.travelClass);
      }
      if (searchMeta?.currency) {
        params.set('currency', searchMeta.currency);
      }

      const url =
        offer?.deepLink && String(offer.deepLink).trim()
          ? offer.deepLink
          : `${API_BASE_URL}/api/redirect/${offer.providerKey}?${params.toString()}`;

      trackEvent('booking_search_click', {
        metadata: {
          provider: offer?.providerKey || offer?.provider || '',
          from: flight?.from || searchMeta?.fromCode || '',
          to: flight?.to || searchMeta?.toCode || '',
          date: flight?.date || searchMeta?.date || '',
        },
      });
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [searchMeta]
  );

  return (
    <div className="search-results-container">
      <h2 className="results-title">Compare Flight Deals</h2>

      {searchMeta && (
        <div className="results-meta">
          <strong>{searchMeta.from}</strong> → <strong>{searchMeta.to}</strong>
          {' | '}
          {searchMeta.date}
          {searchMeta.returnDate ? ` | Return: ${searchMeta.returnDate}` : ''}
          {` | ${searchMeta.adults || 1} Adult${Number(searchMeta.adults || 1) > 1 ? 's' : ''}`}
          {Number(searchMeta.children || 0) > 0 ? ` | ${searchMeta.children} Children` : ''}
          {Number(searchMeta.infants || 0) > 0 ? ` | ${searchMeta.infants} Infants` : ''}
          {searchMeta.travelClass ? ` | ${searchMeta.travelClass}` : ''}
        </div>
      )}

      <div className="filter-bar">
        <button
          type="button"
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          className={filter === 'direct' ? 'active' : ''}
          onClick={() => setFilter('direct')}
        >
          Direct Only
        </button>
        <button
          type="button"
          className={filter === 'cheapest' ? 'active' : ''}
          onClick={() => setFilter('cheapest')}
        >
          Cheapest
        </button>
        <button
          type="button"
          className={filter === 'fastest' ? 'active' : ''}
          onClick={() => setFilter('fastest')}
        >
          Fastest
        </button>
      </div>

      <div className="extra-filters">
        <select
          value={airlineFilter}
          onChange={(event) => setAirlineFilter(event.target.value)}
        >
          <option value="all">All Airlines</option>
          {uniqueAirlines.map((airline, index) => (
            <option key={index} value={airline}>
              {airline}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Max Price"
          value={maxPrice}
          onChange={(event) => setMaxPrice(event.target.value)}
        />

        <select
          value={timeFilter}
          onChange={(event) => setTimeFilter(event.target.value)}
        >
          <option value="all">All Times</option>
          <option value="morning">Morning (06:00 - 12:00)</option>
          <option value="afternoon">Afternoon (12:00 - 17:00)</option>
          <option value="evening">Evening (17:00 - 21:00)</option>
          <option value="night">Night (21:00 - 06:00)</option>
        </select>
      </div>

      {filteredFlights.length === 0 ? (
        <p className="no-results">No flights available.</p>
      ) : (
        <div className="flights-grid">
          {filteredFlights.map((flight) => {
            const sortedOffers = [...(flight.offers || [])].sort(
              (a, b) => Number(a.price || 0) - Number(b.price || 0)
            );

            return (
              <div className="flight-card" key={flight.flightKey}>
                <div className="flight-info">
                  <div className="flight-route">
                    <strong>{flight.from}</strong> → <strong>{flight.to}</strong>
                  </div>

                  <p>
                    <strong>Airline:</strong> {flight.airline || '—'}
                  </p>

                  <p>
                    <strong>Date:</strong> {flight.date || '—'}
                  </p>

                  <p>
                    <strong>Departure:</strong> {flight.departureTime || '—'}
                  </p>

                  <p>
                    <strong>Arrival:</strong> {flight.arrivalTime || '—'}
                  </p>

                  <p>
                    <strong>Duration:</strong> {formatDuration(flight.durationMinutes)}
                  </p>

                  <p>
                    <strong>Stops:</strong> {Number(flight.stops || 0)}
                    {flight.direct ? ' (Direct)' : ''}
                  </p>

                  <p className="best-price-line">
                    <strong>Best price from:</strong>{' '}
                    {formatPrice(
                      getBestPrice(flight),
                      searchMeta?.currency || 'EUR'
                    )}
                  </p>
                </div>

                <div className="providers-list">
                  {sortedOffers.map((offer) => (
                    <div
                      className="provider-row"
                      key={`${flight.flightKey}-${offer.providerKey}`}
                    >
                      <div className="provider-main">
                        <div className="provider-name-line">
                          <strong>{offer.providerName}</strong>

                          {offer.isCheapest ? (
                            <span className="provider-badge">Cheapest</span>
                          ) : null}

                          {offer.isBest && !offer.isCheapest ? (
                            <span className="provider-badge">Best</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="provider-price">
                        {formatPrice(
                          offer.price,
                          offer.currency || searchMeta?.currency || 'EUR'
                        )}
                      </div>

                      <button
                        type="button"
                        className="book-btn"
                        onClick={() => handleGoToSite(offer, flight)}
                      >
                        Go to site
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SearchResults;
