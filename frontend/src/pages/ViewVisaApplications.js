// src/pages/ViewVisaApplications.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig'; // ✅ إضافة هذا السطر

const ViewVisaApplications = () => {
  const [visaApplications, setVisaApplications] = useState([]);

  useEffect(() => {
    const fetchVisas = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/visa-applications`); // ✅ تعديل الرابط
        setVisaApplications(res.data);
      } catch (err) {
        console.error('Failed to fetch visa applications:', err);
      }
    };
    fetchVisas();
  }, []);

  return (
    <div className="container mt-4">
      <h2>🛂 All Visa Applications</h2>
      {visaApplications.length === 0 ? (
        <p>No visa applications found.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Nationality</th>
              <th>Date of Birth</th>
              <th>Passport No.</th>
              <th>Destination</th>
              <th>Travel Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visaApplications.map((visa) => (
              <tr key={visa._id}>
                <td>{visa.fullName}</td>
                <td>{visa.nationality}</td>
                <td>{visa.dateOfBirth}</td>
                <td>{visa.passportNumber}</td>
                <td>{visa.destinationCountry}</td>
                <td>{visa.travelDate}</td>
                <td>{visa.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ViewVisaApplications;