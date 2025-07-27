import React, { useState } from 'react';
import './PassportQueuePage.css';

const PassportQueuePage = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    nationalId: '',
    passportNumber: '',
    passportType: '',
    requestType: '',
    residenceCountry: '',
    embassy: '',
    files: null,
  });

  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    const requiredFields = [
      'fullName', 'nationalId', 'passportType', 'requestType', 'residenceCountry', 'embassy'
    ];

    requiredFields.forEach((field) => {
      if (!formData[field]) newErrors[field] = true;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      setSubmitted(true);
      console.log('Form submitted:', formData);
      alert('Your request has been submitted successfully!');
    }
  };

  return (
    <div className="passport-queue-container">
      <div className="passport-queue-card">
        <h2 className="page-title">Syrian Passport Queue</h2>
        <p className="page-description">
          Fill out this form to book an appointment for a Syrian passport (new or renewal).
        </p>
        <form onSubmit={handleSubmit} className="passport-form">
          <div className="form-group">
            <label>Full Name <span>*</span></label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className={errors.fullName ? 'error' : ''}
            />
          </div>

          <div className="form-group">
            <label>National ID <span>*</span></label>
            <input
              type="text"
              name="nationalId"
              value={formData.nationalId}
              onChange={handleChange}
              className={errors.nationalId ? 'error' : ''}
            />
          </div>

          <div className="form-group">
            <label>Passport Number (Optional)</label>
            <input
              type="text"
              name="passportNumber"
              value={formData.passportNumber}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Passport Type <span>*</span></label>
            <select
              name="passportType"
              value={formData.passportType}
              onChange={handleChange}
              className={errors.passportType ? 'error' : ''}
            >
              <option value="">Select</option>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="form-group">
            <label>Request Type <span>*</span></label>
            <select
              name="requestType"
              value={formData.requestType}
              onChange={handleChange}
              className={errors.requestType ? 'error' : ''}
            >
              <option value="">Select</option>
              <option value="new">New Passport</option>
              <option value="renewal">Renewal</option>
            </select>
          </div>

          <div className="form-group">
            <label>Country of Residence <span>*</span></label>
            <input
              type="text"
              name="residenceCountry"
              value={formData.residenceCountry}
              onChange={handleChange}
              className={errors.residenceCountry ? 'error' : ''}
            />
          </div>

          <div className="form-group">
            <label>Embassy <span>*</span></label>
            <input
              type="text"
              name="embassy"
              value={formData.embassy}
              onChange={handleChange}
              className={errors.embassy ? 'error' : ''}
            />
          </div>

          <div className="form-group">
            <label>Upload Files (Images or PDFs)</label>
            <input
              type="file"
              name="files"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleChange}
            />
          </div>

          <button type="submit" className="submit-btn">Submit Request</button>
          {submitted && <p className="success-message">✔ Your request was successfully sent!</p>}
        </form>
      </div>
    </div>
  );
};

export default PassportQueuePage;