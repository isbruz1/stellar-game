/* ==================================================================
   TANK.IO — Serveur V4
   Carte 8000×8000 • Fix direction • Fix disparitions • Optimisé classe
   ================================================================== */

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["polling", "websocket"],
  allowUpgrades: true,
  pingTimeout: 25000,
  pingInterval: 10000,
  connectTimeout: 20000,
  maxHttpBufferSize: 1e6
});

app.use(express.static(path.join(__dirname, "public")));

// Route de santé
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    rooms: Object.keys(rooms || {}).length,
    players: Object.values(rooms || {}).reduce((sum, r) => sum + Object.keys(r.players).length, 0),
    uptime: Math.floor(process.uptime())
  });
});

// ============================================================
//  CONSTANTES
// ============================================================
const MAP_W = 8000, MAP_H = 8000;
const PLAYER_RADIUS = 26;
const PLAYER_SPEED = 3.6;
const MAX_HP = 100;
const MAX_PLAYERS = 40;
const RESPAWN_DELAY = 4000;
const DASH_COOLDOWN = 3000;
const DASH_DURATION = 200;
const DASH_SPEED = 12;
const XP_PER_KILL = 100;

// ---------- Armes ----------
const WEAPONS = {
  pistol:  { name: "Pistolet",  damage: 22, speed: 10, cooldown: 320,  bulletLife: 150, spread: 0,    bullets: 1, color: "#ff4" },
  smg:     { name: "SMG",       damage: 10, speed: 12, cooldown: 90,   bulletLife: 130, spread: 0.1,  bullets: 1, color: "#fd4" },
  shotgun: { name: "Shotgun",   damage: 12, speed: 8,  cooldown: 750,  bulletLife: 100, spread: 0.35, bullets: 7, color: "#f94" },
  laser:   { name: "Laser",     damage: 8,  speed: 18, cooldown: 60,   bulletLife: 200, spread: 0.02, bullets: 1, color: "#4ff" },
  sniper:  { name: "Sniper",    damage: 75, speed: 20, cooldown: 1200, bulletLife: 350, spread: 0,    bullets: 1, color: "#f4f" }
};

// ============================================================
//  ROOMS
// ============================================================
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
    x: 400 + Math.random() * (MAP_W - 1000),
    y: 400 + Math.random() * (MAP_H - 1000),
    w: 180 + Math.random() * 400,
    h: 60 + Math.random() * 180
  };
}

function genForest() {
  const cx = 500 + Math.random() * (MAP_W - 1000);
  const cy = 500 + Math.random() * (MAP_H - 1000);
  const trees = [];
  const count = 15 + Math.floor(Math.random() * 20);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * 300;
    trees.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: 26 + Math.random() * 16 });
  }
  return trees;
}

function generateMap() {
  const walls = [];
  for (let i = 0; i < 70; i++) walls.push(genWall());
  const forests = [];
  for (let i = 0; i < 25; i++) forests.push(genForest());
  return { walls, forests };
}

function createRoom(name, hostId) {
  let id;
  do { id = genRoomId(); } while (rooms[id]);
  const r = {
    id, name: name || `Tank.io #${id}`, hostId,
    players: {}, bullets: [], bulletSeq: 0,
    killFeed: [], chat: [],
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
  for (let ring = 1; ring <= 60; ring++) {
    const dist = ring * 70;
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
    out[id] = { id, pseudo: p.pseudo, skin: p.skin, ready: p.ready };
  }
  return out;
}

function buildState(room) {
  const p = {};
  for (const id in room.players) {
    const pl = room.players[id];
    p[id] = {
      id, x: pl.x, y: pl.y, angle: pl.angle, skin: pl.skin,
      hp: pl.hp, alive: pl.alive,
      pseudo: pl.pseudo,
      kills: pl.kills || 0, deaths: pl.deaths || 0,
      level: pl.level || 1, xp: pl.xp || 0,
      weapon: pl.weapon,
      dashing: pl.dashing || false
    };
  }
  return {
    players: p,
    bullets: room.bullets.map(b => ({ id: b.id, x: b.x, y: b.y, color: b.color })),
    mapData: room.mapData,
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
  room.killFeed = [];
  room.chat = [];
  room.mapData = generateMap();
  room.victoryDeclared = false;
  room.matchStartTime = Date.now();

  const ids = Object.keys(room.players);
  const count = ids.length;
  // Spawn radius adapté à la grande carte
  const spawnRadius = Math.min(2800, 600 + count * 40);

  ids.forEach((id, i) => {
    const p = room.players[id];
    const a = (i / count) * Math.PI * 2;
    const safe = findSafeSpawn(room,
      MAP_W / 2 + Math.cos(a) * spawnRadius,
      MAP_H / 2 + Math.sin(a) * spawnRadius);
    p.x = safe.x; p.y = safe.y;
    p.angle = a + Math.PI;
    p.hp = MAX_HP;
    p.alive = true;
    p.lastShot = 0;
    p.weapon = "pistol";
    p.kills = 0; p.deaths = 0;
    p.level = 1; p.xp = 0;
    p.dashing = false; p.lastDash = 0;
    p.spectating = null;
    p.spectators = 0;
    p.respawnAt = 0;
  });
}

// ============================================================
//  SOCKET EVENTS
// ============================================================
io.on("connection", socket => {
  console.log(`🔌 Connexion : ${socket.id} (${io.engine.clientsCount} en ligne)`);
  let currentRoom = null;

  socket.emit("room-list-update", roomList());

  socket.on("list-rooms", () => socket.emit("room-list-update", roomList()));

  socket.on("create-room", data => {
    const room = createRoom(data.name, socket.id);
    currentRoom = room.id;
    socket.join(room.id);
    socket.emit("room-created", { id: room.id, name: room.name });
    io.emit("room-list-update", roomList());
  });

  socket.on("join-room", data => {
    const room = rooms[data.id];
    if (!room) return socket.emit("join-error", "Partie introuvable.");
    if (Object.keys(room.players).length >= room.maxPlayers)
      return socket.emit("join-error", "Partie pleine.");
    if (room.gameStarted)
      return socket.emit("join-error", "Partie déjà en cours.");

    currentRoom = room.id;
    socket.join(room.id);

    room.players[socket.id] = {
      id: socket.id,
      pseudo: String(data.pseudo || "Joueur").slice(0, 16),
      skin: Number(data.skin) || 0,
      ready: false,
      x: MAP_W / 2, y: MAP_H / 2, angle: 0,
      hp: MAX_HP, alive: true, lastShot: 0,
      weapon: "pistol",
      kills: 0, deaths: 0,
      level: 1, xp: 0,
      dashing: false, lastDash: 0,
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
      p.hp = MAX_HP;
      p.alive = true;
      p.spectating = null;
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

  socket.on("dash", () => {
    const room = rooms[currentRoom];
    if (!room) return;
    const p = room.players[socket.id];
    if (!p || !room.gameStarted || !p.alive) return;
    const now = Date.now();
    if (now - p.lastDash < DASH_COOLDOWN) return;
    p.lastDash = now;
    p.dashing = true;
    setTimeout(() => {
      const r = rooms[currentRoom];
      if (r && r.players[socket.id]) r.players[socket.id].dashing = false;
    }, DASH_DURATION);
    io.to(room.id).emit("dash-effect", { playerId: socket.id, x: p.x, y: p.y });
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
    const speed = p.dashing ? DASH_SPEED : PLAYER_SPEED;

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

    // ⚠️ Fix direction : on prend l'angle envoyé par le client
    const shootAngle = typeof data.angle === "number" ? data.angle : p.angle;
    p.angle = shootAngle;

    const md = room.mapData;
    let offset = 34;
    if (md) {
      const stuck = isInsideWall(md.walls, p.x, p.y, PLAYER_RADIUS) ||
                    isInsideTree(md.forests, p.x, p.y, PLAYER_RADIUS);
      if (stuck) offset = 70;
    }

    for (let i = 0; i < weapon.bullets; i++) {
      const spread = (Math.random() - 0.5) * weapon.spread;
      const angle = shootAngle + spread;
      room.bullets.push({
        id: ++room.bulletSeq,
        x: p.x + Math.cos(shootAngle) * offset,
        y: p.y + Math.sin(shootAngle) * offset,
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

  socket.on("disconnect", (reason) => {
    console.log(`🔌 Déconnexion : ${socket.id} (${reason})`);
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

// ============================================================
//  BOUCLE DE JEU
// ============================================================
function tick() {
  tickCounter++;
  for (const rid in rooms) {
    const room = rooms[rid];
    if (!room.gameStarted) continue;

    // Balles
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
          const dmg = b.damage || 25;
          p.hp -= dmg;
          hit = true;

          io.to(room.id).emit("hit", {
            targetId: id, attackerId: b.owner, x: p.x, y: p.y, hpDamage: dmg
          });

          if (p.hp <= 0) {
            p.hp = 0; p.alive = false;
            p.deaths = (p.deaths || 0) + 1;
            p.respawnAt = Date.now() + RESPAWN_DELAY;

            const killer = room.players[b.owner];
            if (killer) {
              killer.kills = (killer.kills || 0) + 1;
              killer.xp = (killer.xp || 0) + XP_PER_KILL;
              const newLevel = Math.floor(killer.xp / 200) + 1;
              if (newLevel > (killer.level || 1)) {
                killer.level = newLevel;
                io.to(room.id).emit("level-up", { playerId: b.owner, level: newLevel });
                if (newLevel >= 2) killer.weapon = "smg";
                if (newLevel >= 3) killer.weapon = "shotgun";
                if (newLevel >= 4) killer.weapon = "laser";
                if (newLevel >= 5) killer.weapon = "sniper";
              }
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

    // Respawn
    const now = Date.now();
    for (const id in room.players) {
      const p = room.players[id];
      if (!p.alive && p.respawnAt > 0 && now >= p.respawnAt) {
        const a = Math.random() * Math.PI * 2;
        const r = 1500 + Math.random() * 1200;
        const safe = findSafeSpawn(room, MAP_W / 2 + Math.cos(a) * r, MAP_H / 2 + Math.sin(a) * r);
        p.x = safe.x; p.y = safe.y;
        p.hp = MAX_HP;
        p.alive = true;
        p.weapon = "pistol";
        p.respawnAt = 0;
        io.to(room.id).emit("player-respawned", { playerId: id });
      }
    }

    // Envoi state à 20 Hz (3 frames sur 4)
    if (tickCounter % 3 === 0) {
      io.to(room.id).emit("state", buildState(room));
    }

    // Victoire
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
        p.hp = MAX_HP;
        p.alive = true;
        p.spectating = null; p.spectators = 0; p.respawnAt = 0;
      }
      io.to(room.id).emit("game-ended");
      broadcastLobby(room);
    }
  }
}
setInterval(tick, 1000 / 60);

// ============================================================
//  DÉMARRAGE
// ============================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Tank.io — Serveur démarré sur le port ${PORT}`);
  console.log(`🗺️ Carte : ${MAP_W}×${MAP_H}`);
  console.log(`🌐 Health : http://localhost:${PORT}/health`);
});