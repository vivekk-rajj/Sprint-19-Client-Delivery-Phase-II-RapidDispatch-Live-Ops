# Prompts.md

This file records the AI-assisted design prompts and decisions used for the concurrency implementation. It is intentionally transparent: these are representative prompts describing the implementation work, not claims about hidden tooling or an exact transcript.

## Socket.IO server design

**Prompt:** Design an Express and Socket.IO server for a collaborative support-ticket board. Use a server-side in-memory Map keyed by ticket ID, reject competing lock requests, permit only the lock owner to unlock, broadcast state changes, and clean up every lock owned by a disconnected socket.

**Decision:** The backend owns the lock state. A lock value contains `socketId` and `agentName`. The `disconnect` handler calls the same lock-manager cleanup path for every ticket owned by the socket and emits one release event per ticket.

## Lock race handling

**Prompt:** How should two nearly simultaneous Socket.IO `lock_ticket` events be handled in Node.js?

**Decision:** The lock check and insertion occur synchronously in one event-handler turn. Node's event loop does not interleave synchronous Map operations, so the first handler that observes a free ticket wins. A later request receives `lock_rejected` and cannot overwrite the owner.

## React Strict Mode

**Prompt:** Prevent duplicate Socket.IO listeners when a React application runs under Strict Mode, while keeping one connection and supporting reconnect banners.

**Decision:** The client uses a stable socket instance, registers listeners inside one `useEffect`, emits `join_dashboard` from `connect`, and removes every named listener in the effect cleanup. No polling timer is used.

## Client authority and stale UI

**Prompt:** How should a React ticket editor avoid optimistic state that can disagree with another agent?

**Decision:** Clicking Edit only sends `lock_ticket`; the UI enters edit mode after receiving the server's `ticket_locked` event for the current socket. A rejection clears the pending request. Unlock and disconnect events update the shared lock map for every client.

## CORS and WSS deployment

**Prompt:** Configure Socket.IO for a Vercel frontend and Render backend without committing deployment-specific URLs.

**Decision:** The backend reads a comma-separated `FRONTEND_URL` allowlist. The frontend reads `VITE_API_URL`. In production, HTTPS causes Socket.IO to use WSS, while the backend must explicitly allow the exact Vercel origin.

## Verification checklist

- Open two browser windows with different `agent` query parameters.
- Confirm a lock is visible in both windows without refresh.
- Confirm a second lock attempt is rejected.
- Confirm only the owner can unlock.
- Close the owner tab and confirm ghost-disconnect cleanup.
- Check the browser Network tab's WS filter and confirm there is no `setInterval` polling.
