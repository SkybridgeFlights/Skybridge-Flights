// src/components/DashboardChart.js
import React, { useEffect, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import axios from 'axios';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const DashboardChart = () => {
  const [data, setData] = useState({
    flights: 0,
    bookings: 0,
    visas: 0,
    users: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchCounts = async () => {
    try {
      const [flights, bookings, visas, users] = await Promise.all([
        axios.get('/api/flights'),
        axios.get('/api/bookings'),
        axios.get('/api/visa'),
        axios.get('/api/users'),
      ]);
      setData({
        flights: flights.data.length,
        bookings: bookings.data.length,
        visas: visas.data.length,
        users: users.data.length,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  const chartData = {
    labels: ['Flights', 'Bookings', 'Visa Applications', 'Users'],
    datasets: [
      {
        label: 'Total Count',
        data: [data.flights, data.bookings, data.visas, data.users],
        backgroundColor: ['#007bff', '#28a745', '#ffc107', '#dc3545'],
        borderColor: ['#fff'],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="chart-container mt-4 mb-4">
      <h4 className="mb-3">📊 System Summary</h4>
      {loading ? (
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" />
          <p className="mt-2">Loading chart data...</p>
        </div>
      ) : (
        <Pie data={chartData} />
      )}
    </div>
  );
};

export default DashboardChart;