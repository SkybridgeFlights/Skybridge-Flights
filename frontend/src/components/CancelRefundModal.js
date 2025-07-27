// frontend/src/components/CancelRefundModal.js
import React, { useState, useEffect } from 'react';
import './CancelRefundModal.css';

const REASONS = [
  'Change of plans',
  'Found a cheaper flight',
  'Medical reasons',
  'Visa/Documentation issues',
  'Other',
];

export default function CancelRefundModal({
  open,
  booking,
  onClose,
  onProceed, // ({ reason }) => void
}) {
  const [selectedReason, setSelectedReason] = useState(REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedReason(REASONS[0]);
      setCustomReason('');
    }
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    const reason =
      selectedReason === 'Other' && customReason.trim()
        ? customReason.trim()
        : selectedReason;

    onProceed?.({ reason });
  };

  return (
    <div className="crf-modal-overlay" role="dialog" aria-modal="true">
      <div className="crf-modal">
        <button className="crf-close" onClick={onClose} aria-label="Close modal">
          ×
        </button>

        <h3 className="crf-title">Cancel / Refund booking</h3>

        <div className="crf-body">
          <div className="crf-summary">
          <p className="crf-line">
            <strong>Passenger:</strong>{' '}
            {booking?.passengers?.[0]?.name || '—'}
          </p>
          <p className="crf-line">
            <strong>Outbound:</strong>{' '}
            {booking?.flight
              ? `${booking.flight.from} → ${booking.flight.to}`
              : '—'}
          </p>
          {booking?.returnFlight && (
            <p className="crf-line">
              <strong>Return:</strong>{' '}
              {`${booking.returnFlight.from} → ${booking.returnFlight.to}`}
            </p>
          )}
          <p className="crf-line">
            <strong>Total paid:</strong>{' '}
            €{(booking?.totalPrice || 0) + (booking?.totalPriceReturn || 0)}
          </p>
          </div>

          <div className="crf-reasons">
            <label htmlFor="reason-select" className="crf-label">
              Why are you cancelling?
            </label>
            <select
              id="reason-select"
              className="crf-select"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {selectedReason === 'Other' && (
              <textarea
                className="crf-textarea"
                rows={3}
                placeholder="Please describe your reason…"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="crf-footer">
          <button className="crf-btn crf-btn-outline" onClick={onClose}>
            Back
          </button>
          <button className="crf-btn crf-btn-primary" onClick={handleConfirm}>
            Continue to refund page
          </button>
        </div>
      </div>
    </div>
  );
}