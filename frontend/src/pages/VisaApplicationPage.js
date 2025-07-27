// frontend/src/pages/VisaApplicationPage.js
import React, { useState } from 'react';
import axios from 'axios';
import './VisaApplicationPage.css';

function VisaApplicationPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    passportNumber: '',
    country: '',
    visaType: '',
    travelDates: '',
  });

  const [documents, setDocuments] = useState([]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setDocuments([...e.target.files]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = new FormData();
    for (const key in formData) {
      data.append(key, formData[key]);
    }

    documents.forEach((file) => {
      data.append('documents', file);
    });

    try {
      await axios.post('/api/visa', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      alert('Visa application submitted successfully!');
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        passportNumber: '',
        country: '',
        visaType: '',
        travelDates: '',
      });
      setDocuments([]);
    } catch (error) {
      console.error(error);
      alert('Submission failed.');
    }
  };

  return (
    <div className="visa-container">
      <div className="visa-form-box">
        <h2>Visa Application</h2>
        <form onSubmit={handleSubmit} className="visa-form" encType="multipart/form-data">
          <input type="text" name="fullName" placeholder="Full Name" value={formData.fullName} onChange={handleChange} required />
          <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
          <input type="tel" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required />
          <input type="text" name="passportNumber" placeholder="Passport Number" value={formData.passportNumber} onChange={handleChange} required />
          <input type="text" name="country" placeholder="Country Applying To" value={formData.country} onChange={handleChange} required />
          <input type="text" name="visaType" placeholder="Visa Type" value={formData.visaType} onChange={handleChange} required />
          <input type="text" name="travelDates" placeholder="Travel Dates" value={formData.travelDates} onChange={handleChange} required />

          <label>Upload Required Documents (PDF or Images):</label>
          <input type="file" name="documents" onChange={handleFileChange} multiple accept=".pdf,image/*" />

          <button type="submit">Submit Application</button>
        </form>
      </div>
    </div>
  );
}

export default VisaApplicationPage;