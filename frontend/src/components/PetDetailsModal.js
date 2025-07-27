import React, { useState, useEffect } from 'react';
import './PetDetailsModal.css';

const PetDetailsModal = ({ show, onClose, onSave, initialData = {}, airline }) => {
  const [type, setType] = useState('');
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [price, setPrice] = useState(0);

  useEffect(() => {
    if (airline === 'Lufthansa') setPrice(40);
    else if (airline === 'Emirates') setPrice(50);
    else if (airline === 'Skybridge Airlines') setPrice(30);
    else setPrice(35);
  }, [airline]);

  useEffect(() => {
    if (initialData) {
      setType(initialData.type || '');
      setName(initialData.name || '');
      setWeight(initialData.weight || '');
      setIdNumber(initialData.idNumber || '');
    }
  }, [initialData]);

  const handleSave = () => {
    if (!type || !name || !weight) {
      alert('Please fill in all required pet details.');
      return;
    }

    onSave({
      type,
      name,
      weight,
      idNumber,
      price,
    });
    onClose();
  };

  if (!show) return null;

  return (
    <div className="pet-modal-overlay">
      <div className="pet-modal-content">
        <h4>🐾 Pet Travel Details</h4>

        <div className="form-group">
          <label>Animal Type <span>*</span></label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Select</option>
            <option value="Cat">Cat</option>
            <option value="Dog">Dog</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="form-group">
          <label>Animal Name <span>*</span></label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="form-group">
          <label>Weight (kg) <span>*</span></label>
          <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>

        <div className="form-group">
          <label>Microchip ID / Health ID</label>
          <input type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
        </div>

        <div className="info-box">
          <strong>Pet Travel Fee:</strong> €{price}
        </div>

        <div className="pet-modal-actions">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={handleSave}>Done</button>
        </div>
      </div>
    </div>
  );
};

export default PetDetailsModal;