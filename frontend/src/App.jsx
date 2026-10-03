import { useEffect, useMemo, useState } from 'react';
import { socket } from './socket.js';
import './styles.css';

const initialLocks = {};

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [locks, setLocks] = useState(initialLocks);
  const [pendingTicket, setPendingTicket] = useState(null);
  const [editingTicket, setEditingTicket] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const [notice, setNotice] = useState('');
  const agentName = useMemo(() => new URLSearchParams(window.location.search).get('agent') || 'Agent A', []);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/tickets`)
      .then((response) => response.json())
      .then((data) => setTickets(data.tickets || []))
      .catch(() => setNotice('Unable to load tickets from the server.'));

    const onConnect = () => { setConnected(true); socket.emit('join_dashboard'); };
    const onDisconnect = () => { setConnected(false); setEditingTicket(null); setPendingTicket(null); };
    const onCurrentLocks = ({ locks: currentLocks }) => setLocks(Object.fromEntries(currentLocks.map((lock) => [lock.ticketId, lock])));
    const onLocked = (lock) => {
      setLocks((current) => ({ ...current, [lock.ticketId]: lock }));
      if (lock.socketId === socket.id && lock.agentName === agentName) {
        setEditingTicket(lock.ticketId);
        setPendingTicket(null);
      }
    };
    const onLockRejected = ({ ticketId, reason, lockedBy }) => {
      setPendingTicket(null);
      setNotice(reason === 'already_locked' ? `Ticket ${ticketId} is locked by ${lockedBy?.agentName || 'another agent'}.` : reason);
    };
    const onUnlocked = ({ ticketId }) => {
      setLocks((current) => { const next = { ...current }; delete next[ticketId]; return next; });
      if (editingTicket === ticketId) setEditingTicket(null);
    };
    const onCreated = (ticket) => setTickets((current) => [...current, ticket]);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('current_locks', onCurrentLocks);
    socket.on('ticket_locked', onLocked);
    socket.on('lock_rejected', onLockRejected);
    socket.on('ticket_unlocked', onUnlocked);
    socket.on('ticket_created', onCreated);
    if (!socket.connected) socket.connect(); else onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('current_locks', onCurrentLocks);
      socket.off('ticket_locked', onLocked);
      socket.off('lock_rejected', onLockRejected);
      socket.off('ticket_unlocked', onUnlocked);
      socket.off('ticket_created', onCreated);
    };
  }, [agentName, editingTicket]);

  const editTicket = (ticketId) => {
    if (locks[ticketId]) return;
    setPendingTicket(ticketId);
    setNotice('');
    socket.emit('lock_ticket', { ticketId, agentName });
  };

  const releaseTicket = (ticketId) => {
    socket.emit('unlock_ticket', { ticketId });
    setEditingTicket(null);
  };

  return <main>
    {!connected && <div className="connection-lost">Connection Lost: Reconnecting...</div>}
    <header><div><p className="eyebrow">RapidDispatch Freight & Logistics</p><h1>Live Ops Helpdesk</h1></div><label>Agent name<input value={agentName} readOnly /></label></header>
    {notice && <p className="notice">{notice}</p>}
    <section className="board"><div className="board-heading"><h2>Active tickets</h2><span>{connected ? 'Live' : 'Offline'}</span></div>
      {tickets.map((ticket) => {
        const lock = locks[ticket.id];
        const isMine = lock?.socketId === socket.id;
        const isPending = pendingTicket === ticket.id;
        return <article className={`ticket ${lock && !isMine ? 'locked' : ''}`} key={ticket.id}>
          <div><small>#{ticket.id} · {ticket.priority}</small><h3>{ticket.subject}</h3><p>{ticket.customer}</p>{lock && <strong>🔒 Locked by {lock.agentName}</strong>}</div>
          <div className="actions">{editingTicket === ticket.id ? <><button onClick={() => releaseTicket(ticket.id)}>Save</button><button className="secondary" onClick={() => releaseTicket(ticket.id)}>Close</button></> : <button disabled={Boolean(lock) || isPending || !connected} onClick={() => editTicket(ticket.id)}>{isPending ? 'Requesting…' : lock ? 'Locked' : 'Edit'}</button>}</div>
        </article>;
      })}
    </section>
  </main>;
}
