import React from 'react';
import './SeatModal.css';

const SeatModal = ({ show, onClose, selectedSeat, bookedSeats, onSelectSeat, flightClass }) => {
  if (!show) return null;

  const rows = flightClass === 'First Class' ? 4 : flightClass === 'Business' ? 6 : 10;
  const seatsPerRow = 6;
  const seatLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  const isBooked = (seat) => bookedSeats.includes(seat);
  const isSelected = (seat) => selectedSeat === seat;

  const handleSeatClick = (seat) => {
    if (!isBooked(seat)) {
      onSelectSeat(seat === selectedSeat ? null : seat);
      onClose(); // Close the modal after selection
    }
  };

  return (
    <div className="seat-modal-overlay">
      <div className="seat-modal">
        <div className="seat-modal-header">
          <h3>Choose Your Seat</h3>
          <p>Note: Selecting a seat may incur additional charges depending on the airline.</p>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="seat-map">
          {[...Array(rows)].map((_, rowIndex) => (
            <div className="seat-row" key={rowIndex}>
              {seatLetters.map((letter) => {
                const seatNumber = `${rowIndex + 1}${letter}`;
                return (
                  <div
                    key={seatNumber}
                    className={`seat 
                      ${isBooked(seatNumber) ? 'booked' : ''} 
                      ${isSelected(seatNumber) ? 'selected' : ''}`}
                    onClick={() => handleSeatClick(seatNumber)}
                  >
                    {seatNumber}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SeatModal;