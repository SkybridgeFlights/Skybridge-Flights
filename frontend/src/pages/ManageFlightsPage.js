// src/pages/ManageFlightsPage.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './ManageFlightsPage.css';
import { API_BASE_URL } from '../apiConfig'; // ✅ استيراد رابط API الأساسي

const ManageFlightsPage = () => {
  const [flights, setFlights] = useState([]);
  const [form, setForm] = useState({
    airline: '',
    from: '',
    to: '',
    departure: '',
    arrival: '',
    price: '',
    seatCapacity: '',
    baseWeight: '',
    extraWeightPrice: ''
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchFlights();
  }, []);

  const fetchFlights = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/flights`);
      setFlights(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching flights:', err);
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddFlight = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/flights`, form);
      setForm({
        airline: '',
        from: '',
        to: '',
        departure: '',
        arrival: '',
        price: '',
        seatCapacity: '',
        baseWeight: '',
        extraWeightPrice: ''
      });
      setMessage('✈️ Flight added successfully!');
      fetchFlights();
    } catch (err) {
      console.error('Error adding flight:', err);
      setMessage('❌ Failed to add flight.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this flight?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/flights/${id}`);
      fetchFlights();
    } catch (err) {
      console.error('Error deleting flight:', err);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
  };

  return (
    <div className="manage-flights-container">
      <h2>🛫 Manage Flights</h2>

      <div className="add-flight-form">
        <input type="text" name="airline" placeholder="Airline" value={form.airline} onChange={handleChange} />
        <input type="text" name="from" placeholder="From" value={form.from} onChange={handleChange} />
        <input type="text" name="to" placeholder="To" value={form.to} onChange={handleChange} />
        <input type="datetime-local" name="departure" value={form.departure} onChange={handleChange} />
        <input type="datetime-local" name="arrival" value={form.arrival} onChange={handleChange} />
        <input type="number" name="price" placeholder="Price (€)" value={form.price} onChange={handleChange} />
        <input type="number" name="seatCapacity" placeholder="Seat Capacity" value={form.seatCapacity} onChange={handleChange} />
        <input type="number" name="baseWeight" placeholder="Base Weight (kg)" value={form.baseWeight} onChange={handleChange} />
        <input type="number" name="extraWeightPrice" placeholder="Extra Weight Price (€/kg)" value={form.extraWeightPrice} onChange={handleChange} />
        <button onClick={handleAddFlight}>➕ Add Flight</button>
        {message && <p className="message">{message}</p>}
      </div>

      <hr />
      <h4>📋 All Flights</h4>

      {loading ? (
        <p>Loading flights...</p>
      ) : flights.length === 0 ? (
        <p>No flights available.</p>
      ) : (
        <table className="flights-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Airline</th>
              <th>From</th>
              <th>To</th>
              <th>Departure</th>
              <th>Arrival</th>
              <th>Price (€)</th>
              <th>Seats</th>
              <th>Basic Weight</th>
              <th>Extra Weight Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {flights.map((flight, index) => (
              <tr key={flight._id}>
                <td>{index + 1}</td>
                <td>{flight.airline}</td>
                <td>{flight.from}</td>
                <td>{flight.to}</td>
                <td>{formatDateTime(flight.departure)}</td>
                <td>{formatDateTime(flight.arrival)}</td>
                <td>{flight.price} €</td>
                <td>{flight.seatCapacity}</td>
                <td>{flight.baseWeight} kg</td>
                <td>{flight.extraWeightPrice} €/kg</td>
                <td>
                  <button className="delete-btn" onClick={() => handleDelete(flight._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ManageFlightsPage;