import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server } from 'socket.io';
import { LockManager } from './lockManager.js';
import { tickets } from './tickets.js';

const parseOrigins = (value) => (value || 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean);

export function createServer({ frontendUrl = process.env.FRONTEND_URL, port = process.env.PORT || 4000 } = {}) {
  const allowedOrigins = parseOrigins(frontendUrl);
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true }
  });
  const lockManager = new LockManager();

  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'rapid-dispatch-live-ops' }));
  app.get('/api/tickets', (_req, res) => res.json({ tickets }));
  app.post('/api/tickets', (req, res) => {
    const { subject, customer, priority = 'Medium' } = req.body || {};
    if (!subject || !customer) return res.status(400).json({ error: 'subject and customer are required' });
    const ticket = { id: String(Date.now()), subject, customer, priority, status: 'Active' };
    tickets.push(ticket);
    io.emit('ticket_created', ticket);
    return res.status(201).json(ticket);
  });

  io.on('connection', (socket) => {
    socket.on('join_dashboard', () => {
      socket.join('dashboard');
      socket.emit('current_locks', { locks: lockManager.list() });
    });

    socket.on('lock_ticket', (payload = {}) => {
      const ticketId = String(payload.ticketId || '');
      const agentName = String(payload.agentName || '').trim();
      if (!ticketId || !agentName) {
        socket.emit('lock_rejected', { ticketId, reason: 'ticketId and agentName are required' });
        return;
      }
      const result = lockManager.lock(ticketId, socket.id, agentName);
      if (!result.ok) {
        socket.emit('lock_rejected', { ticketId, reason: 'already_locked', lockedBy: result.existing });
        return;
      }
      io.emit('ticket_locked', result.lock);
    });

    socket.on('unlock_ticket', (payload = {}) => {
      const ticketId = String(payload.ticketId || '');
      const result = lockManager.unlock(ticketId, socket.id);
      if (!result.ok) {
        socket.emit('unlock_rejected', { ticketId, reason: result.reason });
        return;
      }
      io.emit('ticket_unlocked', result.lock);
    });

    socket.on('disconnect', () => {
      for (const lock of lockManager.releaseSocket(socket.id)) {
        io.emit('ticket_unlocked', lock);
      }
    });
  });

  return { app, httpServer, io, lockManager, port };
}

if (process.env.NODE_ENV !== 'test') {
  const server = createServer();
  server.httpServer.listen(server.port, () => console.log(`Live Ops backend listening on ${server.port}`));
}
