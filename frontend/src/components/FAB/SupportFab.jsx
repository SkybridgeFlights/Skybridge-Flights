// src/components/FAB/SupportFab.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../apiConfig';
import { getSocket } from '../../realtime/socket';
import './fab.css';

function useAuthHeaders(){
  const token = localStorage.getItem('token') || localStorage.getItem('staffToken');
  return useMemo(()=> token ? { Authorization: `Bearer ${token}` } : {}, [token]);
}

// helper: استخراج اسم الملف من Content-Disposition
function getFilenameFromCD(cd){
  if (!cd) return null;
  try {
    const m = cd.match(/filename\*?=(?:UTF-8''|")?([^";]+)"?/i);
    if (m && m[1]) return decodeURIComponent(m[1]);
  } catch(_) {}
  return null;
}

export default function SupportFab(){
  const headers = useAuthHeaders();

  const [open,setOpen] = useState(false);
  const [ticket,setTicket] = useState(null);
  const [loading,setLoading] = useState(false);
  const [msg,setMsg] = useState('');
  const [files,setFiles] = useState([]);
  const listRef = useRef(null);

  const scrollToBottom = () => {
    const el = listRef.current; if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const ensureTicket = async ()=>{
    setLoading(true);
    try{
      if (!ticket) {
        const { data: t } = await axios.post(`${API_BASE_URL}/api/support/tickets`, { subject:'Support' }, { headers });
        const { data } = await axios.get(`${API_BASE_URL}/api/support/tickets/${t._id}`, { headers });
        setTicket(data);
      } else {
        const { data } = await axios.get(`${API_BASE_URL}/api/support/tickets/${ticket._id}`, { headers });
        setTicket(data);
      }
      setTimeout(scrollToBottom, 50);
    }catch(e){
      alert(e?.response?.data?.error || 'Failed to open support');
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{
    if (!open) return;
    ensureTicket();

    const s = getSocket();
    let joined = false;
    if (ticket?._id) { s.emit('join:support', { id: ticket._id }); joined = true; }

    const onNew = (payload)=>{
      if (payload?.id === ticket?._id) {
        axios.get(`${API_BASE_URL}/api/support/tickets/${ticket._id}`, { headers })
          .then(r => setTicket(r.data))
          .then(()=> setTimeout(scrollToBottom, 50))
          .catch(()=>{});
      }
    };
    s.on('support:message:new', onNew);

    return ()=>{
      s.off('support:message:new', onNew);
      if (joined) s.emit('leave:support', { id: ticket._id });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticket?._id]);

  const send = async ()=>{
    const text = (msg || '').trim();
    if (!ticket?._id) return;
    if (!text && files.length === 0) return;

    try{
      // لو فيه مرفقات نستخدم FormData
      if (files.length > 0) {
        const fd = new FormData();
        fd.append('text', text || '(attachment)');
        files.forEach(f => fd.append('files', f));
        await axios.post(`${API_BASE_URL}/api/support/tickets/${ticket._id}/messages`, fd, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await axios.post(`${API_BASE_URL}/api/support/tickets/${ticket._id}/messages`, { text }, { headers });
      }
      setMsg(''); setFiles([]);
      const { data } = await axios.get(`${API_BASE_URL}/api/support/tickets/${ticket._id}`, { headers });
      setTicket(data);
      setTimeout(scrollToBottom, 50);
    }catch(e){
      alert(e?.response?.data?.error || 'Failed to send message');
    }
  };

  // تنزيل أي ملف من رسالة
  const dl = async ({ msgId, fileId })=>{
    if (!ticket?._id) return;
    try{
      const url = `${API_BASE_URL}/api/support/tickets/${ticket._id}/download?msgId=${msgId}&fileId=${fileId}&inline=0`;
      const res = await axios.get(url, { headers, responseType: 'blob' });
      const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });
      const filename = getFilenameFromCD(res.headers['content-disposition']) || 'download';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    }catch(e){
      alert(e?.response?.data?.error || 'Failed to download file');
    }
  };

  return (
    <>
      <button className="fab-main" title="Support" onClick={()=>setOpen(v=>!v)}>💬</button>

      {open && (
        <div className="fab-panel" onClick={(e)=>e.stopPropagation()}>
          <div className="fab-header">
            <div className="title">Support</div>
            <button className="x" onClick={()=>setOpen(false)}>✕</button>
          </div>

          <div className="fab-body">
            {loading && <div className="muted" style={{padding:8}}>Loading…</div>}

            {!loading && !ticket && (
              <div className="muted" style={{padding:8}}>
                Welcome to Support. Start a new ticket.
              </div>
            )}

            {!!ticket && (
              <>
                <div className="muted" style={{padding:'6px 8px'}}>
                  Subject: <b>{ticket.subject}</b>
                </div>

                <div ref={listRef} className="fab-thread">
                  {(ticket.messages || []).length === 0 && (
                    <div className="muted">No messages yet.</div>
                  )}
                  {ticket.messages?.map(m=>(
                    <div key={m._id} className={`fab-msg ${m.byKind==='staff'?'staff':'me'}`}>
                      <div className="meta">
                        <b>{m.byName || m.byKind}</b>
                        <span>{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="bubble">{m.text}</div>

                      {!!(m.files||[]).length && (
                        <div style={{marginTop:6, display:'flex', gap:8, flexWrap:'wrap'}}>
                          {m.files.map(f=>(
                            <button
                              key={f._id}
                              className="ms-btn ms-btn-light"
                              onClick={()=>dl({ msgId:m._id, fileId:f._id })}
                              title={f.originalName}
                            >
                              ⬇ {f.originalName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="fab-compose">
                  <input
                    value={msg}
                    onChange={e=>setMsg(e.target.value)}
                    placeholder="Write to support…"
                    onKeyDown={e=>{ if (e.key==='Enter') send(); }}
                  />
                  <input
                    type="file"
                    multiple
                    onChange={e=>setFiles(Array.from(e.target.files||[]))}
                    title="Attach files"
                    style={{maxWidth:140}}
                  />
                  <button onClick={send}>Send</button>
                </div>
                {!!files.length && (
                  <div className="muted" style={{marginTop:6, padding:'0 2px'}}>
                    Attach: {files.map(f=>f.name).join(', ')}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}