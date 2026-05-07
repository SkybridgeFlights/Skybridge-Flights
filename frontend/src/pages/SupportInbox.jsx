// frontend/src/pages/SupportInbox.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import { getSocket } from '../realtime/socket';

export default function SupportInbox(){
  const [threads,setThreads] = useState([]);
  const [active,setActive] = useState(null);
  const [messages,setMessages] = useState([]);
  const [msg,setMsg] = useState('');

  const token = localStorage.getItem('staffToken') || localStorage.getItem('token');
  const headers = useMemo(()=> token? { Authorization:`Bearer ${token}` }: {}, [token]);

  const loadThreads = async()=>{
    const { data } = await axios.get(`${API_BASE_URL}/api/support`,{ headers });
    setThreads(data);
  };
  const loadThread = async(id)=>{
    const { data } = await axios.get(`${API_BASE_URL}/api/support/${id}`,{ headers });
    setActive(data.thread);
    setMessages(data.messages);
  };

  const send = async()=>{
    if(!msg.trim()) return;
    await axios.post(`${API_BASE_URL}/api/support/${active._id}/messages`, { text:msg }, { headers });
    setMsg('');
    loadThread(active._id);
  };

  useEffect(()=>{ loadThreads(); },[]);
  useEffect(()=>{
    const s = getSocket();
    s.on('support:new', ({ threadId })=>{
      if(active && active._id===threadId) loadThread(threadId);
      else loadThreads();
    });
    return ()=> s.off('support:new');
  },[active]);

  return (
    <div className="container mt-4">
      <h2>📨 Support Inbox</h2>
      <div style={{ display:'flex', gap:16 }}>
        <div style={{ flex:1 }}>
          <h5>Threads</h5>
          <ul className="list-group">
            {threads.map(t=>(
              <li key={t._id} className="list-group-item" onClick={()=>loadThread(t._id)}>
                {t.subject} – {t.status}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ flex:2 }}>
          {active? (
            <div>
              <h5>{active.subject}</h5>
              <div style={{ maxHeight:300, overflow:'auto', border:'1px solid #ddd', padding:8 }}>
                {messages.map(m=>(
                  <div key={m._id}>
                    <b>{m.byName}</b>: {m.text}
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <input value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Reply…" />
                <button onClick={send}>Send</button>
              </div>
            </div>
          ): <p>Select a thread</p>}
        </div>
      </div>
    </div>
  );
}