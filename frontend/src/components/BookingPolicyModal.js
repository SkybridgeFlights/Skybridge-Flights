import React from 'react';
import './BookingPolicyModal.css';

const textOrNull = (v) => (typeof v === 'string' && v.trim() ? v : null);

const BookingPolicyModal = ({ show, onClose, bookingSettings }) => {
  if (!show) return null;

  const bs = bookingSettings || {};

  // دعم كلا المفتاحين: cancellationPolicy و cancellationPolicyText
  const cancellation =
    textOrNull(bs.cancellationPolicy) ||
    textOrNull(bs.cancellationPolicyText);

  const refund        = textOrNull(bs.refundPolicy);
  const modification  = textOrNull(bs.modificationPolicy);
  const baggage       = textOrNull(bs.baggagePolicy);
  const terms         = textOrNull(bs.bookingTerms);
  const customTerms   = Array.isArray(bs.customTerms) ? bs.customTerms : [];

  const render = (txt) => (txt ? txt : 'Not available.');

  return (
    <div className="policy-modal-overlay">
      <div className="policy-modal-content">
        <h3>📄 Booking Terms & Policies</h3>
        <button className="close-btn" onClick={onClose}>✖ Close</button>

        <div className="policy-section">
          <h5>❌ Cancellation Policy</h5>
          <p>{render(cancellation)}</p>
        </div>

        <div className="policy-section">
          <h5>💳 Refund Policy</h5>
          <p>{render(refund)}</p>
        </div>

        <div className="policy-section">
          <h5>🛠 Modification Policy</h5>
          <p>{render(modification)}</p>
        </div>

        <div className="policy-section">
          <h5>🧳 Baggage Policy</h5>
          <p>{render(baggage)}</p>
        </div>

        {(terms || customTerms.length > 0) && (
          <div className="policy-section">
            <h5>📜 General Terms</h5>
            {terms && <p className="mt-1">{terms}</p>}

            {customTerms.length > 0 && (
              <ul className="mt-2" style={{ paddingLeft: 18 }}>
                {customTerms.map((t, i) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    {t.title ? <strong>{t.title}: </strong> : null}
                    <span>{t.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingPolicyModal;