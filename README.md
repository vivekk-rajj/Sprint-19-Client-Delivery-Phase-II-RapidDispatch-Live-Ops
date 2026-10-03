# RapidDispatch Live Ops

A real-time collaborative support-ticket board demonstrating Socket.IO concurrency control, server-authoritative ticket locks, and ghost-disconnect cleanup.

## Architecture

- `backend/`: Express + Socket.IO server. Ticket locks live in an in-memory `Map` keyed by ticket ID.
- `frontend/`: React/Vite client using one Socket.IO connection per mounted application.
- The server is the source of truth. Clients only enter edit mode after receiving the server's `ticket_locked` broadcast.

## Local development

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The API and WebSocket server listen on `http://localhost:4000`.

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open the Vite URL in two browser windows. Use a different `agent` query parameter in each window, for example `?agent=Agent%20A` and `?agent=Agent%20B`.

## Environment variables

Backend (`backend/.env`):

- `PORT`: HTTP port, default `4000`.
- `FRONTEND_URL`: comma-separated allowed browser origins, default `http://localhost:5173`.

Frontend (`frontend/.env`):

- `VITE_API_URL`: backend origin, default `http://localhost:4000`.

## Socket event contract

- Client → server: `join_dashboard`
- Client → server: `lock_ticket`, payload `{ ticketId, agentName }`
- Server → clients: `ticket_locked`, payload `{ ticketId, socketId, agentName }`
- Server → requesting client: `lock_rejected`, payload `{ ticketId, reason, lockedBy }`
- Client → server: `unlock_ticket`, payload `{ ticketId }`
- Server → clients: `ticket_unlocked`, payload `{ ticketId, socketId, agentName, reason }`
- Server → joining client: `current_locks`, payload `{ locks: [...] }`

## Tests

```bash
cd backend
npm install
npm test
```

The tests cover first-owner locking, second-owner rejection, owner-only unlock, and cleanup of multiple locks after a ghost disconnect.

## Two-window demo

1. Start both applications.
2. Open two windows side by side with `?agent=Agent%20A` and `?agent=Agent%20B`.
3. Click **Edit** for the same ticket in Agent A's window.
4. Verify Agent B immediately sees a gray row, a lock icon, `Locked by Agent A`, and a disabled Edit button.
5. Try to edit the same ticket from Agent B and verify the request is rejected.
6. Click **Close** or **Save** in Agent A and verify Agent B immediately sees the ticket unlocked.
7. Lock another ticket in Agent A, close Agent A's browser tab without clicking Close, and verify Agent B receives the automatic unlock after the socket disconnects.
8. Turn off the network temporarily and verify the red `Connection Lost: Reconnecting...` banner.

## Vercel + Render deployment

### Render backend

Create a Node web service rooted at `backend`:

- Build command: `npm install`
- Start command: `npm start`
- `FRONTEND_URL=https://<your-vercel-domain>`
- `PORT` may be supplied by Render automatically.

Use the Render HTTPS URL as the WebSocket origin; Socket.IO will negotiate WSS in production.

### Vercel frontend

Deploy the `frontend` directory:

- Build command: `npm run build`
- Output directory: `dist`
- `VITE_API_URL=https://<your-render-service>.onrender.com`

After the Vercel domain is known, set that exact origin in Render's `FRONTEND_URL`, redeploy the backend, and verify the browser Network tab shows a WebSocket connection. Replace the placeholders in your submission only with real deployed URLs.
