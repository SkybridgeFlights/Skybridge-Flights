// frontend/src/components/support/SupportChatModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../apiConfig';
import { getSocket } from '../../realtime/socket';
import '../../styles/Modals.css';

export default function SupportChatModal({ open, onClose }) {
  // ===== Auth =====
  const token =
    localStorage.getItem('token') || localStorage.getItem('staffToken') || '';
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  // ===== State =====
  const [list, setList] = useState([]);          // قائمة كل تذاكر العميل
  const [active, setActive] = useState(null);    // التذكرة المفتوحة حاليا (كائن كامل)
  const [loadingList, setLoadingList] = useState(false);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [sending, setSending] = useState(false);

  // إنشاء تذكرة جديدة
  const [subject, setSubject] = useState('Support Request');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const threadRef = useRef(null);

  const scrollToBottom = () => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const withToken = (url) =>
    token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url;

  const fileUrl = (ticketId, f) =>
    withToken(`${API_BASE_URL}/api/support/${ticketId}/download?fileId=${f._id}&inline=1`);

  // ===== API: load list & ticket =====
  const fetchList = async () => {
    setLoadingList(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/support/my`, { headers });
      setList(Array.isArray(data) ? data : []);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('support_list error:', e);
      setList([]);
      return [];
    } finally {
      setLoadingList(false);
    }
  };

  const fetchTicket = async (id) => {
    if (!id) { setActive(null); return; }
    setLoadingTicket(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/support/${id}`, { headers });
      setActive(data || null);
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      console.error('support_ticket error:', e);
      setActive(null);
    } finally {
      setLoadingTicket(false);
    }
  };

  // ===== API: create / send / close =====
  const createTicket = async (initialText, initialFiles) => {
    const hasFiles = initialFiles && initialFiles.length > 0;
    setSending(true);
    try {
      if (hasFiles) {
        const fd = new FormData();
        fd.append('subject', subject || 'Support Request');
        if (initialText) fd.append('text', initialText);
        initialFiles.forEach((f) => fd.append('files', f));
        const { data } = await axios.post(`${API_BASE_URL}/api/support`, fd, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' },
        });
        return data;
      } else {
        const { data } = await axios.post(
          `${API_BASE_URL}/api/support`,
          { subject: subject || 'Support Request', text: initialText || '' },
          { headers }
        );
        return data;
      }
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async () => {
    const t = (text || '').trim();
    const hasFiles = files && files.length > 0;
    if (!t && !hasFiles) return;

    // إن كانت التذكرة مغلقة لا نسمح بالإرسال
    if (active?.status === 'closed') {
      alert('This ticket is closed. Please create a new ticket.');
      return;
    }

    try {
      // لا توجد تذكرة محددة -> أنشئ واحدة
      if (!active?._id) {
        const created = await createTicket(t, files);
        setText(''); setFiles([]);
        await fetchList();
        await fetchTicket(created._id);
        return;
      }

      setSending(true);
      if (hasFiles) {
        const fd = new FormData();
        if (t) fd.append('text', t);
        files.forEach((f) => fd.append('files', f));
        const { data } = await axios.post(
          `${API_BASE_URL}/api/support/${active._id}/messages`,
          fd,
          { headers: { ...headers, 'Content-Type': 'multipart/form-data' } }
        );
        setActive(data);
      } else {
        const { data } = await axios.post(
          `${API_BASE_URL}/api/support/${active._id}/messages`,
          { text: t },
          { headers }
        );
        setActive(data);
      }
      setText(''); setFiles([]);
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const closeTicket = async () => {
    if (!active?._id) return;
    try {
      await axios.patch(`${API_BASE_URL}/api/support/${active._id}`, { status: 'closed' }, { headers });
      await fetchTicket(active._id);
      await fetchList();
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to close ticket');
    }
  };

  // ===== Lifecycle =====
  useEffect(() => {
    if (!open) return;
    (async () => {
      const arr = await fetchList();
      // افتح أحدث تذكرة مفتوحة، وإلا افتح الأحدث عمومًا، وإلا ابدأ في وضع "إنشاء"
      if (arr.length > 0) {
        const openOne = arr.find(t => t.status !== 'closed');
        await fetchTicket((openOne || arr[0])._id);
      } else {
        setActive(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Socket: حدّث المحادثة والقائمة فورًا
  useEffect(() => {
    if (!open) return;
    const s = getSocket();
    const refresh = () => {
      fetchList();
      if (active?._id) fetchTicket(active._id);
    };
    s.on('support:message:new', refresh);
    s.on('support:updated', refresh);
    return () => {
      s.off('support:message:new', refresh);
      s.off('support:updated', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active?._id]);

  // ===== UI =====
  if (!open) return null;

  return (
    <div className="sb-overlay" onClick={onClose}>
      <div
        className="sb-modal"
        style={{ maxWidth: 900 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sb-modal-header" style={{ justifyContent: 'space-between' }}>
          <h5 className="sb-modal-title">Support</h5>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="sb-btn"
              onClick={() => {
                setActive(null);
                setSubject('Support Request');
                setText('');
                setFiles([]);
              }}
            >
              New ticket
            </button>
            <button className="sb-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Body: Sidebar list + Conversation */}
        <div className="sb-modal-body" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12 }}>
          {/* Sidebar List */}
          <div className="ms-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="ms-label" style={{ padding: '10px 12px' }}>
              My tickets
              {loadingList && <span className="muted" style={{ marginLeft: 6 }}>(loading…)</span>}
            </div>
            <div style={{ maxHeight: 420, overflow: 'auto' }}>
              {list.length === 0 && (
                <div className="muted" style={{ padding: 12 }}>No tickets yet.</div>
              )}
              {list.map(t => (
                <button
                  key={t._id}
                  className={`ms-row ${active?._id === t._id ? 'active' : ''}`}
                  style={{ width: '100%', textAlign: 'left', padding: 12, borderTop: '1px solid #1f2937' }}
                  onClick={() => fetchTicket(t._id)}
                  title={t.subject}
                >
                  <div className="bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.subject}
                  </div>
                  <div className="muted" style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                    <span className={`pill status-${t.status}`}>{t.status}</span>
                    <span>{new Date(t.updatedAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Conversation / Create form */}
          <div style={{ minWidth: 0 }}>
            {!active && (
              <div className="ms-card">
                <div className="ms-label">Start a new ticket</div>
                <input
                  className="ms-input"
                  placeholder="Ticket subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
                <div className="muted" style={{ marginTop: 6 }}>
                  Type your message below and click <b>Send</b> to create the ticket.
                </div>
              </div>
            )}

            {active && (
              <div className="ms-card">
                <div className="ms-label">Subject</div>
                <div className="bold">{active.subject}</div>
                <div className="muted" style={{ marginTop: 4, display:'flex', gap:8, alignItems:'center' }}>
                  Status: <span className={`pill status-${active.status || 'open'}`}>{active.status || 'open'}</span>
                  {active.status !== 'closed' && (
                    <button className="sb-btn" onClick={closeTicket} title="Mark as resolved">Mark as resolved</button>
                  )}
                </div>
              </div>
            )}

            <div className="ms-card">
              <div className="ms-label">{active ? 'Conversation' : 'Message'}</div>
              {loadingTicket ? (
                <p className="muted">Loading…</p>
              ) : active ? (
                <div className="sb-thread" ref={threadRef} style={{ maxHeight: 320, overflow: 'auto' }}>
                  {(active.messages || []).map((m) => (
                    <div key={m._id} className="sb-msg">
                      <span className="who">{m.byName || m.by}</span>
                      <span className="meta">({new Date(m.createdAt).toLocaleString()})</span>
                      {m.text && <div className="body">{m.text}</div>}
                      {!!(m.files || []).length && (
                        <div className="attachments" style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {m.files.map((f) => (
                            <a
                              key={f._id}
                              className="sb-btn"
                              href={fileUrl(active._id, f)}
                              target="_blank"
                              rel="noreferrer"
                              title={f.originalName}
                            >
                              ⬇ {f.originalName}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {(active.messages || []).length === 0 && <div className="muted">No messages yet.</div>}
                </div>
              ) : (
                <div className="muted">Choose a subject and send to create your ticket.</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer: composer */}
        <div className="sb-modal-footer" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <textarea
            className="ms-input"
            placeholder={active?.status === 'closed' ? 'This ticket is closed' : 'Write to support…'}
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ flex: 1, resize: 'vertical', minHeight: 44 }}
            disabled={sending || active?.status === 'closed'}
          />
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            disabled={sending || active?.status === 'closed'}
          />
          <button className="sb-btn primary" onClick={sendMessage} disabled={sending || active?.status === 'closed'}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}