import test from 'node:test';
import assert from 'node:assert/strict';
import { LockManager } from '../src/lockManager.js';

test('first agent acquires a free ticket', () => {
  const manager = new LockManager();
  const result = manager.lock('105', 'socket-a', 'Agent A');
  assert.equal(result.ok, true);
  assert.deepEqual(manager.list(), [{ ticketId: '105', socketId: 'socket-a', agentName: 'Agent A' }]);
});

test('second agent cannot overwrite an existing lock', () => {
  const manager = new LockManager();
  manager.lock('105', 'socket-a', 'Agent A');
  const result = manager.lock('105', 'socket-b', 'Agent B');
  assert.equal(result.ok, false);
  assert.equal(result.existing.socketId, 'socket-a');
});

test('only the owner can unlock', () => {
  const manager = new LockManager();
  manager.lock('105', 'socket-a', 'Agent A');
  assert.equal(manager.unlock('105', 'socket-b').reason, 'not_owner');
  assert.equal(manager.unlock('105', 'socket-a').ok, true);
  assert.equal(manager.list().length, 0);
});

test('disconnect cleanup releases every lock owned by a socket', () => {
  const manager = new LockManager();
  manager.lock('105', 'socket-a', 'Agent A');
  manager.lock('106', 'socket-a', 'Agent A');
  manager.lock('107', 'socket-b', 'Agent B');
  const released = manager.releaseSocket('socket-a');
  assert.deepEqual(released.map(({ ticketId }) => ticketId), ['105', '106']);
  assert.deepEqual(manager.list().map(({ ticketId }) => ticketId), ['107']);
});
