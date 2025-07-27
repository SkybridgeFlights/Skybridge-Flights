import React from 'react';
import './SeatMap.css';

const SeatMap = ({ selectedSeat, bookedSeats, onSelectSeat, flightClass }) => {
  const rows = flightClass === 'First Class' ? 4 : flightClass === 'Business' ? 6 : 10;
  const seatsPerRow = 6;
  const seatLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  const isBooked = (seat) => bookedSeats.includes(seat);
  const isSelected = (seat) => selectedSeat === seat;

  const handleClick = (seat) => {
    if (!isBooked(seat)) {
      onSelectSeat(seat === selectedSeat ? null : seat); // Toggle selection
    }
  };

  return (
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
                onClick={() => handleClick(seatNumber)}
              >
                {seatNumber}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default SeatMap;