/* ==================================================================
   STELLAR GAME — Serveur V11
   Armes multiples • Power-ups • Kill feed • Chat • K/D • Timer
   ================================================================== */

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, pingTimeout: 30000, pingInterval: 10000 });

app.use(express.static(path.join(__dirname, "public")));

// ---------- Constantes ----------
const MAP_W = 4500, MAP_H = 4500;
const PLAYER_RADIUS = 24;
const PLAYER_SPEED = 3.4;
const MAX_HP = 100;
const MAX_SHIELD = 100;
const MAX_PLAYERS = 50;
const RESPAWN_DELAY = 5000;
const MATCH_TIME = 10 * 60 * 1000;

// ---------- Armes ----------
const WEAPONS = {
  pistol:  { name: "Pistolet",      damage: 25, speed: 9,  cooldown: 350,  bulletLife: 150, spread: 0,    bullets: 1, color: "#ff4" },
  smg:     { name: "Mitrailleuse",  damage: 12, speed: 11, cooldown: 110,  bulletLife: 130, spread: 0.08, bullets: 1, color: "#fd4" },
  shotgun: { name: "Shotgun",       damage: 14, speed: 8,  cooldown: 800,  bulletLife: 100, spread: 0.35, bullets: 6, color: "#f94" },
  sniper:  { name: "Sniper",        damage: 80, speed: 16, cooldown: 1400, bulletLife: 300, spread: 0,    bullets: 1, color: "#f4f" }
};

// ---------- Power-ups ----------
const POWERUP_TYPES = {
  speed:  { color: "#4af", icon: "⚡", duration: 6000 },
  shield: { color: "#fd4", icon: "🛡", duration: 8000 },
  heal:   { color: "#4f4", icon: "❤", duration: 0 },
  ammo:   { color: "#f4f", icon: "🎁", duration: 0 }
};

const activeAccounts = {};
function broadcastLockedAccounts() {
  io.emit("locked-accounts", Object.values(activeAccounts).map(a => a.pseudoOriginal));
}

const rooms = {};
let tickCounter = 0;

function genRoomId() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function genWall() {
  return {
    x: 300 + Math.random() * (MAP_W - 800),
    y: 300 + Math.random() * (MAP_H - 800),
    w: 120 + Math.random() * 300,
    h: 40 + Math.random() * 120
  };
}

function genRiver() {
  const points = [];
  let x = Math.random() * MAP_W;
  let y = 0;
  const segments = 5 + Math.floor(Math.random() * 3);
  for (let i = 0; i <= segments; i++) {
    points.push({ x, y });
    x += (Math.random() - 0.5) * 400;
    y += MAP_H / segments;
    x = Math.max(200, Math.min(MAP_W - 200, x));
  }
  return { points, width: 90 + Math.random() * 50 };
}

function genForest() {
  const cx = 400 + Math.random() * (MAP_W - 800);
  const cy = 400 + Math.random() * (MAP_H - 800);
  const trees = [];
  const count = 15 + Math.floor(Math.random() * 15);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * 220;
    trees.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: 22 + Math.random() * 12 });
  }
  return trees;
}

function generateMap() {
  const walls = [];
  for (let i = 0; i < 28; i++) walls.push(genWall());
  const rivers = [];
  for (let i = 0; i < 3; i++) rivers.push(genRiver());
  const forests = [];
  for (let i = 0; i < 9; i++) forests.push(genForest());
  return { walls, rivers, forests };
}

function genPowerup() {
  const keys = Object.keys(POWERUP_TYPES);
  const type = keys[Math.floor(Math.random() * keys.length)];
  return {
    id: Math.random().toString(36).slice(2, 9),
    type,
    x: 300 + Math.random() * (MAP_W - 600),
    y: 300 + Math.random() * (MAP_H - 600),
    r: 26,
    pulse: 0
  };
}

function createRoom(name, hostId) {
  let id;
  do { id = genRoomId(); } while (rooms[id]);
  const r = {
    id, name: name || `Serveur ${id}`, hostId,
    players: {}, bullets: [], bulletSeq: 0,
    powerups: [], killFeed: [], chat: [],
    gameStarted: false, matchStartTime: 0, mapData: null,
    maxPlayers: MAX_PLAYERS, victoryDeclared: false
  };
  rooms[id] = r;
  return r;
}

function isInsideWall(walls, x, y, r) {
  for (const w of walls) {
    if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return true;
  }
  return false;
}

function isInsideTree(forests, x, y, r) {
  for (const f of forests) {
    for (const t of f) {
      if (Math.hypot(t.x - x, t.y - y) < t.r + r * 0.6) return true;
    }
  }
  return false;
}

function findSafeSpawn(room, preferX, preferY) {
  const md = room.mapData;
  const margin = PLAYER_RADIUS + 40;
  const tryPos = (x, y) => {
    if (x < margin || x > MAP_W - margin) return false;
    if (y < margin || y > MAP_H - margin) return false;
    if (isInsideWall(md.walls, x, y, PLAYER_RADIUS + 15)) return false;
    if (isInsideTree(md.forests, x, y, PLAYER_RADIUS + 15)) return false;
    return true;
  };
  if (tryPos(preferX, preferY)) return { x: preferX, y: preferY };
  for (let ring = 1; ring <= 40; ring++) {
    const dist = ring * 60;
    const count = 8 + ring * 2;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x = preferX + Math.cos(a) * dist;
      const y = preferY + Math.sin(a) * dist;
      if (tryPos(x, y)) return { x, y };
    }
  }
  return { x: MAP_W / 2, y: MAP_H / 2 };
}

function publicPlayers(room) {
  const out = {};
  for (const id in room.players) {
    const p = room.players[id];
    out[id] = { id, pseudo: p.pseudo, realName: p.realName, skin: p.skin, ready: p.ready };
  }
  return out;
}

function buildState(room) {
  const p = {};
  for (const id in room.players) {
    const pl = room.players[id];
    p[id] = {
      id, x: pl.x, y: pl.y, angle: pl.angle, skin: pl.skin,
      hp: pl.hp, shield: pl.shield, alive: pl.alive,
      pseudo: pl.pseudo, realName: pl.realName,
      kills: pl.kills || 0, deaths: pl.deaths || 0, score: pl.score || 0,
      weapon: pl.weapon,
      speedBoost: pl.speedBoost || 0,
      shieldBoost: pl.shieldBoost || 0
    };
  }
  return {
    players: p,
    bullets: room.bullets.map(b => ({ id: b.id, x: b.x, y: b.y, color: b.color || "#ff4" })),
    mapData: room.mapData,
    powerups: room.powerups,
    killFeed: room.killFeed.slice(-5),
    matchTime: room.gameStarted ? Date.now() - room.matchStartTime : 0
  };
}

function broadcastLobby(room) {
  io.to(room.id).emit("lobby-update", {
    players: publicPlayers(room), hostId: room.hostId,
    gameStarted: room.gameStarted, roomId: room.id, roomName: room.name
  });
  io.emit("room-list-update", roomList());
}

function roomList() {
  return Object.values(rooms).map(r => ({
    id: r.id, name: r.name,
    host: r.players[r.hostId]?.pseudo || "?",
    count: Object.keys(r.players).length,
    max: r.maxPlayers, started: r.gameStarted
  }));
}

function addKillFeed(room, killerPseudo, victimPseudo, weapon) {
  room.killFeed.push({ killer: killerPseudo, victim: victimPseudo, weapon, time: Date.now() });
  if (room.killFeed.length > 20) room.killFeed.shift();
}

function resetForGame(room) {
  room.bullets = [];
  room.powerups = [];
  room.killFeed = [];
  room.chat = [];
  room.mapData = generateMap();
  room.victoryDeclared = false;
  room.matchStartTime = Date.now();

  for (let i = 0; i < 8; i++) room.powerups.push(genPowerup());

  const ids = Object.keys(room.players);
  const count = ids.length;
  const spawnRadius = Math.min(1600, 300 + count * 25);

  ids.forEach((id, i) => {
    const p = room.players[id];
    const a = (i / count) * Math.PI * 2;
    const preferX = MAP_W / 2 + Math.cos(a) * spawnRadius;
    const preferY = MAP_H / 2 + Math.sin(a) * spawnRadius;
    const safe = findSafeSpawn(room, preferX, preferY);
    p.x = safe.x;
    p.y = safe.y;
    p.angle = a + Math.PI;
    p.hp = MAX_HP;
    p.shield = MAX_SHIELD;
    p.alive = true;
    p.lastShot = 0;
    p.weapon = "pistol";
    p.kills = 0; p.deaths = 0; p.score = 0;
    p.speedBoost = 0; p.shieldBoost = 0;
    p.spectating = null; p.spectators = 0; p.respawnAt = 0;
  });
}

io.on("connection", socket => {
  let currentRoom = null;

  socket.emit("room-list-update", roomList());
  socket.emit("locked-accounts", Object.values(activeAccounts).map(a => a.pseudoOriginal));

  socket.on("list-rooms", () => socket.emit("room-list-update", roomList()));

  socket.on("claim-account", pseudo => {
    const key = String(pseudo || "").toLowerCase();
    if (!key) return socket.emit("claim-result", { ok: false, reason: "pseudo invalide" });
    const existing = activeAccounts[key];
    if (existing && existing.socketId !== socket.id) {
      socket.emit("claim-result", { ok: false, reason: "Ce compte est déjà utilisé ailleurs." });
      return;
    }
    activeAccounts[key] = { socketId: socket.id, pseudoOriginal: pseudo };
    socket.emit("claim-result", { ok: true });
    broadcastLockedAccounts();
  });

  socket.on("release-account", pseudo => {
    const key = String(pseudo || "").toLowerCase();
    if (activeAccounts[key] && activeAccounts[key].socketId === socket.id) {
      delete activeAccounts[key];
      broadcastLockedAccounts();
    }
  });

  socket.on("create-room", data => {
    const room = createRoom(data.name, socket.id);
    currentRoom = room.id;
    socket.join(room.id);
    socket.emit("room-created", { id: room.id, name: room.name });
    io.emit("room-list-update", roomList());
  });

  socket.on("join-room", data => {
    const room = rooms[data.id];
    if (!room) return socket.emit("join-error", "Serveur introuvable.");
    if (Object.keys(room.players).length >= room.maxPlayers)
      return socket.emit("join-error", "Serveur plein.");
    if (room.gameStarted)
      return socket.emit("join-error", "Partie déjà en cours.");

    currentRoom = room.id;
    socket.join(room.id);

    room.players[socket.id] = {
      id: socket.id,
      pseudo: String(data.pseudo || "Joueur").slice(0, 16),
      realName: String(data.realName || "").slice(0, 32),
      skin: Number(data.skin) || 0,
      ready: false,
      x: MAP_W / 2, y: MAP_H / 2, angle: 0,
      hp: MAX_HP, shield: MAX_SHIELD, alive: true, lastShot: 0,
      weapon: "pistol",
      kills: 0, deaths: 0, score: 0,
      speedBoost: 0, shieldBoost: 0,
      spectators: 0, spectating: null, respawnAt: 0
    };
    socket.emit("room-joined", { id: room.id, name: room.name });
    broadcastLobby(room);
  });

  socket.on("leave-room", () => {
    if (currentRoom) handleLeave(currentRoom, socket.id);
    socket.emit("left-room");
    currentRoom = null;
  });

  socket.on("update-pseudo", pseudo => {
    const room = rooms[currentRoom];
    if (room && room.players[socket.id]) room.players[socket.id].pseudo = String(pseudo).slice(0, 16);
    if (room) broadcastLobby(room);
  });

  socket.on("update-realname", name => {
    const room = rooms[currentRoom];
    if (room && room.players[socket.id]) room.players[socket.id].realName = String(name).slice(0, 32);
    if (room) broadcastLobby(room);
  });

  socket.on("update-skin", skin => {
    const room = rooms[currentRoom];
    if (room && room.players[socket.id]) room.players[socket.id].skin = Number(skin) || 0;
    if (room) broadcastLobby(room);
  });

  socket.on("toggle-ready", () => {
    const room = rooms[currentRoom];
    if (!room) return;
    const p = room.players[socket.id];
    if (p && socket.id !== room.hostId) { p.ready = !p.ready; broadcastLobby(room); }
  });

  socket.on("start-game", () => {
    const room = rooms[currentRoom];
    if (!room || socket.id !== room.hostId) return;
    const guests = Object.values(room.players).filter(p => p.id !== room.hostId);
    if (guests.length > 0 && !guests.every(p => p.ready)) return;
    resetForGame(room);
    room.gameStarted = true;
    io.to(room.id).emit("game-started");
    io.to(room.id).emit("state", buildState(room));
  });

  socket.on("leave-game", () => {
    const room = rooms[currentRoom];
    if (!room) return;
    const p = room.players[socket.id];
    if (p) {
      p.ready = false;
      p.hp = MAX_HP; p.shield = MAX_SHIELD;
      p.alive = true; p.spectating = null;
      for (const id in room.players) {
        if (room.players[id].spectating === socket.id) room.players[id].spectating = null;
      }
    }
    if (socket.id === room.hostId) {
      room.gameStarted = false;
      room.bullets = [];
      io.to(room.id).emit("game-ended");
    }
    broadcastLobby(room);
  });

  socket.on("chat-message", text => {
    const room = rooms[currentRoom];
    if (!room) return;
    const p = room.players[socket.id];
    if (!p) return;
    const clean = String(text || "").trim().slice(0, 120);
    if (!clean) return;
    room.chat.push({ pseudo: p.pseudo, text: clean, time: Date.now() });
    if (room.chat.length > 50) room.chat.shift();
    io.to(room.id).emit("chat-message", { pseudo: p.pseudo, text: clean, time: Date.now() });
  });

  socket.on("switch-weapon", weapon => {
    const room = rooms[currentRoom];
    if (!room) return;
    const p = room.players[socket.id];
    if (!p || !p.alive) return;
    if (WEAPONS[weapon]) p.weapon = weapon;
  });

  socket.on("spectate", targetId => {
    const room = rooms[currentRoom];
    if (!room) return;
    const p = room.players[socket.id];
    const target = room.players[targetId];
    if (!p || !target) return;
    if (p.spectating) {
      const old = room.players[p.spectating];
      if (old) old.spectators = Math.max(0, (old.spectators || 0) - 1);
    }
    p.spectating = targetId;
    target.spectators = (target.spectators || 0) + 1;
  });

  socket.on("stop-spectate", () => {
    const room = rooms[currentRoom];
    if (!room) return;
    const p = room.players[socket.id];
    if (!p || !p.spectating) return;
    const old = room.players[p.spectating];
    if (old) old.spectators = Math.max(0, (old.spectators || 0) - 1);
    p.spectating = null;
  });

  socket.on("input", data => {
    const room = rooms[currentRoom];
    if (!room) return;
    const p = room.players[socket.id];
    if (!p || !room.gameStarted || !p.alive) return;

    const k = data.keys || {};
    let dx = 0, dy = 0;
    if (k.up) dy -= 1;
    if (k.down) dy += 1;
    if (k.left) dx -= 1;
    if (k.right) dx += 1;
    const len = Math.hypot(dx, dy);

    const speedMult = 1 + (p.speedBoost > 0 ? 0.5 : 0);
    const speed = PLAYER_SPEED * speedMult;

    let nx = p.x, ny = p.y;
    if (len > 0) {
      nx += (dx / len) * speed;
      ny += (dy / len) * speed;
    }
    nx = Math.max(PLAYER_RADIUS, Math.min(MAP_W - PLAYER_RADIUS, nx));
    ny = Math.max(PLAYER_RADIUS, Math.min(MAP_H - PLAYER_RADIUS, ny));

    const md = room.mapData;
    if (md) {
      const stuck =
        isInsideWall(md.walls, p.x, p.y, PLAYER_RADIUS) ||
        isInsideTree(md.forests, p.x, p.y, PLAYER_RADIUS);
      if (stuck) { p.x = nx; p.y = ny; }
      else {
        if (!isInsideWall(md.walls, nx, p.y, PLAYER_RADIUS)) p.x = nx;
        if (!isInsideWall(md.walls, p.x, ny, PLAYER_RADIUS) &&
            !isInsideTree(md.forests, p.x, ny, PLAYER_RADIUS)) p.y = ny;
      }
    } else { p.x = nx; p.y = ny; }

    if (typeof data.angle === "number") p.angle = data.angle;
  });

  socket.on("shoot", data => {
    const room = rooms[currentRoom];
    if (!room) return;
    const p = room.players[socket.id];
    if (!p || !room.gameStarted || !p.alive) return;

    const weapon = WEAPONS[p.weapon] || WEAPONS.pistol;
    const now = Date.now();
    if (now - p.lastShot < weapon.cooldown) return;
    p.lastShot = now;

    if (typeof data.angle === "number") p.angle = data.angle;

    const md = room.mapData;
    let offset = 34;
    if (md) {
      const stuck = isInsideWall(md.walls, p.x, p.y, PLAYER_RADIUS) ||
                    isInsideTree(md.forests, p.x, p.y, PLAYER_RADIUS);
      if (stuck) offset = 70;
    }

    for (let i = 0; i < weapon.bullets; i++) {
      const spread = (Math.random() - 0.5) * weapon.spread;
      const angle = p.angle + spread;
      room.bullets.push({
        id: ++room.bulletSeq,
        x: p.x + Math.cos(p.angle) * offset,
        y: p.y + Math.sin(p.angle) * offset,
        vx: Math.cos(angle) * weapon.speed,
        vy: Math.sin(angle) * weapon.speed,
        owner: socket.id,
        life: weapon.bulletLife,
        damage: weapon.damage,
        weapon: p.weapon,
        color: weapon.color,
        ignoreWalls: 3
      });
    }
  });

  socket.on("disconnect", () => {
    for (const key in activeAccounts) {
      if (activeAccounts[key].socketId === socket.id) delete activeAccounts[key];
    }
    broadcastLockedAccounts();
    if (currentRoom) handleLeave(currentRoom, socket.id);
  });

  function handleLeave(rid, sid) {
    const room = rooms[rid];
    if (!room) return;
    const p = room.players[sid];
    if (p && p.spectating) {
      const old = room.players[p.spectating];
      if (old) old.spectators = Math.max(0, (old.spectators || 0) - 1);
    }
    delete room.players[sid];
    if (Object.keys(room.players).length === 0) {
      delete rooms[rid];
    } else {
      if (sid === room.hostId) {
        room.hostId = Object.keys(room.players)[0];
        if (room.gameStarted) {
          room.gameStarted = false;
          room.bullets = [];
          io.to(room.id).emit("game-ended");
        }
      }
      broadcastLobby(room);
    }
    io.emit("room-list-update", roomList());
  }
});

function tick() {
  tickCounter++;
  for (const rid in rooms) {
    const room = rooms[rid];
    if (!room.gameStarted) continue;

    // BALLES
    for (let i = room.bullets.length - 1; i >= 0; i--) {
      const b = room.bullets[i];
      b.x += b.vx; b.y += b.vy; b.life--;
      if (b.ignoreWalls && b.ignoreWalls > 0) b.ignoreWalls--;

      let dead = false;
      if (b.life <= 0 || b.x < 0 || b.x > MAP_W || b.y < 0 || b.y > MAP_H) dead = true;
      if (!dead && !b.ignoreWalls && room.mapData &&
          isInsideWall(room.mapData.walls, b.x, b.y, 4)) dead = true;
      if (dead) { room.bullets.splice(i, 1); continue; }

      let hit = false;
      for (const id in room.players) {
        if (id === b.owner) continue;
        const p = room.players[id];
        if (!p.alive) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) < PLAYER_RADIUS) {
          let dmg = b.damage || 25;
          let shieldDamage = 0, hpDamage = 0, shieldBroken = false;

          if (p.shield > 0) {
            const absorbed = Math.min(p.shield, dmg);
            p.shield -= absorbed;
            shieldDamage = absorbed;
            dmg -= absorbed;
            if (p.shield <= 0 && absorbed > 0) shieldBroken = true;
          }
          if (dmg > 0) { p.hp -= dmg; hpDamage = dmg; }
          hit = true;

          io.to(room.id).emit("hit", {
            targetId: id, attackerId: b.owner, x: p.x, y: p.y,
            shieldDamage, hpDamage, shieldBroken
          });

          if (shieldBroken) {
            io.to(room.id).emit("shield-broken", { targetId: id, x: p.x, y: p.y });
            const victimSocket = io.sockets.sockets.get(id);
            if (victimSocket) victimSocket.emit("screen-shake");
          }

          if (p.hp <= 0) {
            p.hp = 0; p.alive = false;
            p.deaths = (p.deaths || 0) + 1;
            p.respawnAt = Date.now() + RESPAWN_DELAY;

            const killer = room.players[b.owner];
            if (killer) {
              killer.kills = (killer.kills || 0) + 1;
              killer.score = (killer.score || 0) + 100;
            }

            const killerPseudo = killer ? killer.pseudo : "?";
            addKillFeed(room, killerPseudo, p.pseudo, b.weapon || "pistol");

            io.to(room.id).emit("kill-feed-update", room.killFeed.slice(-5));
            io.to(room.id).emit("player-died", {
              victimId: id, killerId: b.owner,
              killerPseudo, victimPseudo: p.pseudo, respawnAt: p.respawnAt
            });
          }
          break;
        }
      }
      if (hit) room.bullets.splice(i, 1);
    }

    // RESPAWN
    const now = Date.now();
    for (const id in room.players) {
      const p = room.players[id];
      if (!p.alive && p.respawnAt > 0 && now >= p.respawnAt) {
        const a = Math.random() * Math.PI * 2;
        const r = 800 + Math.random() * 600;
        const safe = findSafeSpawn(room, MAP_W / 2 + Math.cos(a) * r, MAP_H / 2 + Math.sin(a) * r);
        p.x = safe.x; p.y = safe.y;
        p.hp = MAX_HP; p.shield = MAX_SHIELD;
        p.alive = true;
        p.speedBoost = 0; p.shieldBoost = 0;
        p.weapon = "pistol";
        p.respawnAt = 0;
        io.to(room.id).emit("player-respawned", { playerId: id });
      }
    }

    // POWER-UPS
    for (let i = room.powerups.length - 1; i >= 0; i--) {
      const pu = room.powerups[i];
      pu.pulse = (pu.pulse || 0) + 0.05;
      for (const id in room.players) {
        const p = room.players[id];
        if (!p.alive) continue;
        if (Math.hypot(p.x - pu.x, p.y - pu.y) < PLAYER_RADIUS + pu.r) {
          if (pu.type === "heal") p.hp = Math.min(MAX_HP, p.hp + 50);
          else if (pu.type === "speed") {
            p.speedBoost = 1;
            setTimeout(() => { if (room.players[id]) room.players[id].speedBoost = 0; }, POWERUP_TYPES.speed.duration);
          } else if (pu.type === "shield") {
            p.shield = MAX_SHIELD;
            p.shieldBoost = 1;
            setTimeout(() => { if (room.players[id]) room.players[id].shieldBoost = 0; }, POWERUP_TYPES.shield.duration);
          } else if (pu.type === "ammo") {
            p.weapon = ["smg", "shotgun", "sniper"][Math.floor(Math.random() * 3)];
          }
          io.to(room.id).emit("powerup-taken", { playerId: id, type: pu.type, x: pu.x, y: pu.y });
          room.powerups.splice(i, 1);
          setTimeout(() => {
            if (room.gameStarted) room.powerups.push(genPowerup());
          }, 8000);
          break;
        }
      }
    }

    // ENVOI STATE
    if (tickCounter % 3 === 0) {
      io.to(room.id).emit("state", buildState(room));
    }

    // VICTOIRE
    const aliveIds = Object.keys(room.players).filter(id => room.players[id].alive);
    const totalPlayers = Object.keys(room.players).length;

    if (totalPlayers >= 2 && aliveIds.length === 1 && !room.victoryDeclared) {
      const winnerId = aliveIds[0];
      room.victoryDeclared = true;
      room.gameStarted = false;
      room.bullets = [];
      io.to(room.id).emit("victory", { winnerId });
      for (const id in room.players) {
        const p = room.players[id];
        p.ready = false;
        p.hp = MAX_HP; p.shield = MAX_SHIELD;
        p.alive = true;
        p.spectating = null; p.spectators = 0; p.respawnAt = 0;
      }
      io.to(room.id).emit("game-ended");
      broadcastLobby(room);
    }
  }
}
setInterval(tick, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Stellar Game — Port ${PORT}`));
