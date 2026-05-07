// frontend/src/pages/AllBookingsPage.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';
import './AllBookingsPage.css';
import { fmt, percent } from '../utils/money';
import ApproveRefundModal from '../components/ApproveRefundModal';

function readUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

function ProcessedModal({ open, request, onClose, onMark }) {
  const [processor, setProcessor] = useState('PayPal');
  const [txn, setTxn] = useState('');
  const [amt, setAmt] = useState('');

  useEffect(() => {
    if (open) {
      setProcessor('PayPal');
      setTxn('');
      setAmt(request?.amount ?? 0);
    }
  }, [open, request]);

  if (!open || !request) return null;

  return (
    <div className="crf-modal-overlay">
      <div className="crf-modal">
        <button className="crf-close" onClick={onClose} aria-label="Close">×</button>
        <h3>Mark as Processed</h3>

        <div style={{ marginTop: 10 }}>
          <label className="crf-label">Processor</label>
          <select className="crf-select" value={processor} onChange={(e) => setProcessor(e.target.value)}>
            <option>PayPal</option>
            <option>Stripe</option>
            <option>Bank</option>
            <option>Other</option>
          </select>
        </div>

        <div style={{ marginTop: 10 }}>
          <label className="crf-label">Transaction ID</label>
          <input className="crf-select" value={txn} onChange={(e) => setTxn(e.target.value)} />
        </div>

        <div style={{ marginTop: 10 }}>
          <label className="crf-label">Processed amount (optional)</label>
          <input
            type="number"
            min="0"
            className="crf-select"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
          />
        </div>

        <div className="crf-footer">
          <button className="crf-btn crf-btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="crf-btn crf-btn-primary"
            onClick={() => onMark({ processor, transactionId: txn, processedAmount: Number(amt || 0) })}
          >
            Mark Processed
          </button>
        </div>
      </div>
    </div>
  );
}

const AllBookingsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [approveOpen, setApproveOpen] = useState(false);
  const [processedOpen, setProcessedOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const userFilter = searchParams.get('user') || '';

  const user = readUser();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';
  const perms = user?.permissions || {};
  const canConfirm = isAdmin || !!perms.manageBookings;
  const canRefund = isAdmin || !!perms.manageRefunds;

  const token = localStorage.getItem('token') || localStorage.getItem('staffToken');
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const bParams = new URLSearchParams();
      if (userFilter) bParams.set('user', userFilter);

      const rParams = new URLSearchParams();
      if (userFilter) rParams.set('user', userFilter);

      const [bRes, rRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/bookings?${bParams.toString()}`, { headers }),
        axios.get(`${API_BASE_URL}/api/refunds?${rParams.toString()}`, { headers }),
      ]);

      setBookings(Array.isArray(bRes.data) ? bRes.data : []);
      setRefunds(Array.isArray(rRes.data) ? rRes.data : []);
    } catch (err) {
      console.error('Failed to fetch data:', err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [headers, userFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const refundMap = useMemo(() => {
    const map = new Map();
    refunds.forEach((r) => r?.booking?._id && map.set(r.booking._id, r));
    return map;
  }, [refunds]);

  const handleConfirm = async (bookingId) => {
    if (!canConfirm) return;
    try {
      setStatusUpdating(true);
      await axios.patch(`${API_BASE_URL}/api/bookings/${bookingId}/confirm`, {}, { headers });
      setBookings((prev) => prev.map((b) => (b._id === bookingId ? { ...b, status: 'confirmed' } : b)));
    } catch (err) {
      console.error('Error updating status:', err?.response?.data || err.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  const createRefund = async (bookingId) => {
    if (!canRefund) return;
    if (!window.confirm('Create refund request for this cancelled booking?')) return;
    try {
      setActionLoadingId(bookingId);
      await axios.post(
        `${API_BASE_URL}/api/refunds`,
        { bookingId, reason: 'Admin initiated' },
        { headers }
      );
      await fetchAll();
    } catch (err) {
      console.error('Error creating refund:', err);
      alert(err?.response?.data?.error || 'Failed to create refund request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openApprove = (req) => {
    if (!canRefund) return;
    setActiveRequest(req);
    setApproveOpen(true);
  };

  const openProcessed = (req) => {
    if (!canRefund) return;
    setActiveRequest(req);
    setProcessedOpen(true);
  };

  const approveRefund = async ({ overrideAmount, adminNote }) => {
    if (!canRefund || !activeRequest) return;
    try {
      setActionLoadingId(activeRequest._id);
      await axios.patch(
        `${API_BASE_URL}/api/refunds/${activeRequest._id}/status`,
        { status: 'Approved', overrideAmount, adminNote },
        { headers }
      );
      setApproveOpen(false);
      setActiveRequest(null);
      await fetchAll();
    } catch (err) {
      console.error('Error approving refund:', err);
      alert(err?.response?.data?.error || 'Failed to approve refund');
    } finally {
      setActionLoadingId(null);
    }
  };

  const rejectRefund = async (refundId) => {
    if (!canRefund) return;
    const note = prompt('Reason for rejection (optional):') || '';
    try {
      setActionLoadingId(refundId);
      await axios.patch(
        `${API_BASE_URL}/api/refunds/${refundId}/status`,
        { status: 'Rejected', adminNote: note },
        { headers }
      );
      await fetchAll();
    } catch (err) {
      console.error('Error rejecting refund:', err);
      alert(err?.response?.data?.error || 'Failed to reject refund');
    } finally {
      setActionLoadingId(null);
    }
  };

  const markProcessed = async ({ processor, transactionId, processedAmount }) => {
    if (!canRefund || !activeRequest) return;
    try {
      setActionLoadingId(activeRequest._id);
      await axios.patch(
        `${API_BASE_URL}/api/refunds/${activeRequest._id}/status`,
        { status: 'Processed', processor, refundTransactionId: transactionId, processedAmount },
        { headers }
      );
      setProcessedOpen(false);
      setActiveRequest(null);
      await fetchAll();
    } catch (err) {
      console.error('Error marking processed:', err);
      alert(err?.response?.data?.error || 'Failed to mark processed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const pageTitle = isAdmin ? '📋 All Bookings (Admin)' : '📋 All Bookings';

  if (loading) {
    return (
      <div className="admin-bookings-page container mt-4">
        <h2 className="mb-4">{pageTitle}</h2>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="admin-bookings-page container mt-4">
      <h2 className="mb-4">{pageTitle}</h2>

      {bookings.length === 0 ? (
        <p>No bookings found.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover table-bordered align-middle">
            <thead className="table-primary">
              <tr>
                <th>User</th>
                <th>Flight</th>
                <th>Return</th>
                <th>Status</th>
                <th>Refund</th>
                <th>Amount</th>
                <th>Seat</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const req = refundMap.get(b._id);
                const total = (b.totalPrice || 0) + (b.totalPriceReturn || 0);

                return (
                  <tr key={b._id}>
                    <td>{b.user?.name || 'Guest'}</td>
                    <td>{b.flight?.flightNumber || '-'}</td>
                    <td>{b.returnFlight?.flightNumber || '-'}</td>
                    <td>
                      <span
                        className={`badge ${
                          b.status === 'confirmed'
                            ? 'bg-success'
                            : b.status === 'pending'
                              ? 'bg-warning text-dark'
                              : 'bg-danger'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          (req?.status === 'Approved' || b.refundStatus === 'approved')
                            ? 'bg-success'
                            : (req?.status === 'Rejected' || b.refundStatus === 'rejected')
                              ? 'bg-danger'
                              : (req?.status === 'Pending' || b.refundStatus === 'pending')
                                ? 'bg-warning text-dark'
                                : (req?.status === 'Processed' || b.refundStatus === 'processed')
                                  ? 'bg-secondary'
                                  : 'bg-secondary'
                        }`}
                      >
                        {req?.status || b.refundStatus || 'none'}
                      </span>
                    </td>

                    <td>
                      {fmt(b.refundAmount || 0)} / {fmt(total)}
                      {total > 0 && <> ({percent(b.refundAmount || 0, total)}%)</>}
                    </td>

                    <td>
                      {b.seatNumber || '-'}
                      {b.seatNumberReturn ? ` / ${b.seatNumberReturn}` : ''}
                    </td>

                    <td>{new Date(b.createdAt).toLocaleDateString()}</td>

                    <td>
                      <button
                        className="btn btn-sm btn-info me-2"
                        onClick={() => navigate(`/admin/ticket/${b._id}`)}
                      >
                        🎫 View
                      </button>

                      {b.status === 'pending' && canConfirm && (
                        <button
                          className="btn btn-sm btn-success me-2"
                          onClick={() => handleConfirm(b._id)}
                          disabled={statusUpdating}
                        >
                          ✅ Confirm
                        </button>
                      )}

                      {b.status === 'cancelled' && !req && b.refundStatus !== 'pending' && canRefund && (
                        <button
                          className="btn btn-sm btn-warning me-2"
                          onClick={() => createRefund(b._id)}
                          disabled={actionLoadingId === b._id}
                        >
                          💸 Create Refund
                        </button>
                      )}

                      {req && req.status === 'Pending' && canRefund && (
                        <>
                          <button
                            className="btn btn-sm btn-success me-2"
                            onClick={() => openApprove(req)}
                            disabled={actionLoadingId === req._id}
                          >
                            ✅ Approve
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => rejectRefund(req._id)}
                            disabled={actionLoadingId === req._id}
                          >
                            ❌ Reject
                          </button>
                        </>
                      )}

                      {req && req.status === 'Approved' && canRefund && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => openProcessed(req)}
                          disabled={actionLoadingId === req._id}
                        >
                          💼 Mark Processed
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ApproveRefundModal
        open={approveOpen}
        request={activeRequest}
        onClose={() => {
          setApproveOpen(false);
          setActiveRequest(null);
        }}
        onApprove={approveRefund}
      />

      <ProcessedModal
        open={processedOpen}
        request={activeRequest}
        onClose={() => {
          setProcessedOpen(false);
          setActiveRequest(null);
        }}
        onMark={markProcessed}
      />
    </div>
  );
};

export default AllBookingsPage;