const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function harness() {
  let connect;
  const events = [];
  const sockets = new Map();
  const io = { on: (_, cb) => connect = cb, emit: (...e) => events.push(e), to: () => ({ emit: (...e) => events.push(e) }), sockets: { sockets } };
  const app = { use() {}, get() {} };
  const context = vm.createContext({ require: name => name === 'express' ? Object.assign(() => app, { static: () => {} }) : name === 'http' ? { createServer: () => ({ listen() {} }) } : name === 'socket.io' ? { Server: function () { return io; } } : require(name), __dirname: process.cwd(), console: { log() {} }, process: { env: {} }, setInterval() {} });
  vm.runInContext(fs.readFileSync('server.js', 'utf8') + '\n globalThis.api = { rooms, tick, buildState };', context);
  function socket(id) { const handlers = {}; const joined = new Set(); const sock = { id, on: (e, cb) => handlers[e] = cb, emit: (...e) => events.push(e), join: r => joined.add(r), leave: r => joined.delete(r) }; sockets.set(id, sock); connect(sock); return { send: (e, data) => handlers[e](data), joined }; }
  return { ...context.api, socket, events };
}
function create(h) { const a = h.socket('a'); a.send('create-room', { name: 'Test' }); const room = Object.values(h.rooms)[0]; a.send('join-room', { id: room.id, pseudo: 'Alpha' }); return { a, room }; }
test('movement is advanced by ticks, independent of input packet count; stale commands stop', () => {
  const h = harness(); const { a, room } = create(h); a.send('start-game'); room.mapData = { walls: [], forests: [], rivers: [] }; const p = room.players.a; const x = p.x;
  for (let i = 0; i < 1000; i++) a.send('input', { keys: { right: true }, angle: 0 });
  assert.equal(p.x, x); h.tick(); assert.equal(p.x, x + 1.7);
  p.inputAt = 0; h.tick(); assert.equal(p.x, x + 1.7);
  a.send('input', { angle: Infinity }); assert.equal(p.angle, 0);
});
test('map is sent initially and omitted from recurring states', () => { const h = harness(); const { a, room } = create(h); a.send('start-game'); assert.ok(h.buildState(room, true).mapData); assert.equal(h.buildState(room).mapData, undefined); });
test('leaving clears membership, reassigns host, and prevents multiple rooms', () => {
  const h = harness(); const { a, room } = create(h); const b = h.socket('b'); b.send('join-room', { id: room.id, pseudo: 'Bravo' }); a.send('create-room', { name: 'Duplicate' }); assert.equal(Object.keys(h.rooms).length, 1); a.send('leave-room'); assert.equal(a.joined.size, 0); assert.equal(room.hostId, 'b'); b.send('leave-room'); assert.equal(Object.keys(h.rooms).length, 0);
});
test('chat caps message length and only broadcasts for room members', () => { const h = harness(); const { a } = create(h); const outsider = h.socket('c'); outsider.send('chat-message', 'outside'); a.send('chat-message', 'x'.repeat(500)); const msgs = h.events.filter(e => e[0] === 'chat-message'); assert.equal(msgs.length, 1); assert.equal(msgs[0][1].text.length, 180); });
test('returning to lobby during combat does not resurrect the player', () => { const h = harness(); const { a, room } = create(h); const b = h.socket('b'); b.send('join-room', { id: room.id, pseudo: 'Bravo' }); b.send('toggle-ready'); a.send('start-game'); b.send('leave-game'); assert.equal(room.players.b.alive, false); });
