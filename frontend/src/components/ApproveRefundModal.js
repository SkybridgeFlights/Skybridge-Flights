// frontend/src/components/ApproveRefundModal.js
import React, { useEffect, useMemo, useState } from 'react';
import { fmt, percent } from '../utils/money';

export default function ApproveRefundModal({ open, request, onClose, onApprove }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const totalPaid = useMemo(() => {
    const b = request?.booking;
    return (b?.totalPrice || 0) + (b?.totalPriceReturn || 0);
  }, [request]);

  useEffect(() => {
    if (open && request) {
      setAmount(request.overrideAmount ?? request.amount ?? 0);
      setNote('');
    }
  }, [open, request]);

  if (!open || !request) return null;

  const calc = Number(request.amount || 0);
  const warnTooHigh = Number(amount) > totalPaid;

  return (
    <div className="crf-modal-overlay">
      <div className="crf-modal">
        <button className="crf-close" onClick={onClose} aria-label="Close">×</button>
        <h3>Approve Refund</h3>

        <div style={{marginTop:10, fontSize:14, color:'#475569'}}>
          <div>
            <strong>Auto-calculated:</strong> {fmt(calc)}{totalPaid>0 ? ` (${percent(calc, totalPaid)}%)` : ''}
          </div>
          {request?.booking?.refundPolicyReason && (
            <div style={{marginTop:6}}>
              <em>{request.booking.refundPolicyReason}</em>
            </div>
          )}
          {totalPaid>0 && (
            <div style={{marginTop:6, color:'#64748b'}}>Total paid: {fmt(totalPaid)}</div>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <label className="crf-label">Override amount (optional)</label>
          <input
            type="number"
            min="0"
            className="crf-select"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          {warnTooHigh && (
            <div style={{color:'#b91c1c', fontSize:12, marginTop:6}}>
              Entered amount exceeds total paid. Please double-check.
            </div>
          )}
        </div>

        <div style={{ marginTop: 10 }}>
          <label className="crf-label">Admin note</label>
          <input
            type="text"
            className="crf-select"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Why are you approving this amount?"
          />
        </div>

        <div className="crf-footer">
          <button className="crf-btn crf-btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="crf-btn crf-btn-primary"
            onClick={() => onApprove({ overrideAmount: Number(amount||0), adminNote: note })}
            disabled={warnTooHigh}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}