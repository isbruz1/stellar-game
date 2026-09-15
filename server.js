const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(express.static(path.join(__dirname, "public")));

// ---------- Constantes ----------
const MAP_W = 3200, MAP_H = 3200;
const PLAYER_RADIUS = 24;
const PLAYER_SPEED = 3.4;
const BULLET_SPEED = 9;
const BULLET_LIFE = 150;
const BULLET_DAMAGE = 25;
const SHOOT_COOLDOWN = 350;
const RESPAWN_TIME = 3000;
const MAX_HP = 100;
const MAX_PLAYERS = 8;

// ---------- Zones ----------
const ZONE_TYPES = {
  heal:   { color: "#4f4", label: "Soin",     radius: 110 },
  speed:  { color: "#4af", label: "Vitesse",  radius: 110 },
  damage: { color: "#f55", label: "Dégâts +", radius: 110 },
  shield: { color: "#fd4", label: "Bouclier", radius: 110 }
};

// ---------- Biomes ----------
const BIOMES = {
  grass:   { bg: "#1d3a1a", accent: "#2d5a28", tree: "#0f2410" },
  desert:  { bg: "#5a4a2a", accent: "#7a6038", tree: "#3a2a1a" },
  snow:    { bg: "#2a3a4a", accent: "#4a5a6a", tree: "#1a2a3a" },
  water:   { bg: "#0a2040", accent: "#1a3560", tree: "#000" }
};

// ---------- Rooms ----------
const rooms = {};

function genRoomId() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function genBiomeBlob() {
  const keys = Object.keys(BIOMES);
  return {
    type: keys[Math.floor(Math.random() * keys.length)],
    x: Math.random() * MAP_W,
    y: Math.random() * MAP_H,
    r: 300 + Math.random() * 400
  };
}

function genWall() {
  const w = 120 + Math.random() * 300;
  const h = 40 + Math.random() * 120;
  return {
    x: 200 + Math.random() * (MAP_W - 600),
    y: 200 + Math.random() * (MAP_H - 600),
    w, h,
    horizontal: Math.random() > 0.5
  };
}

function genRiver() {
  // Polyligne de 4-6 points
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
  const cx = 300 + Math.random() * (MAP_W - 600);
  const cy = 300 + Math.random() * (MAP_H - 600);
  const trees = [];
  const count = 15 + Math.floor(Math.random() * 15);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * 220;
    trees.push({
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d,
      r: 22 + Math.random() * 12
    });
  }
  return trees;
}

function genZone(moving = false) {
  const keys = Object.keys(ZONE_TYPES);
  const type = keys[Math.floor(Math.random() * keys.length)];
  const x = 300 + Math.random() * (MAP_W - 600);
  const y = 300 + Math.random() * (MAP_H - 600);
  const z = {
    id: Math.random().toString(36).slice(2, 8),
    type,
    x, y,
    radius: ZONE_TYPES[type].radius,
    moving: false,
    vx: 0, vy: 0,
    moveTimer: 0
  };
  if (moving) startZoneMove(z);
  return z;
}

function startZoneMove(z) {
  const angle = Math.random() * Math.PI * 2;
  const speed = 1.2 + Math.random() * 1.2;
  z.moving = true;
  z.vx = Math.cos(angle) * speed;
  z.vy = Math.sin(angle) * speed;
  z.moveTimer = 200 + Math.floor(Math.random() * 200); // 3-6s
  z.stopped = false;
}

function createRoom(name, hostId) {
  let id;
  do { id = genRoomId(); } while (rooms[id]);
  const r = {
    id,
    name: name || `Serveur ${id}`,
    hostId,
    players: {},
    bullets: [],
    bulletSeq: 0,
    gameStarted: false,
    zones: [],
    zoneTimer: 0,
    mapData: null,
    maxPlayers: MAX_PLAYERS,
    announcement: null,
    announcementTime: 0
  };
  rooms[id] = r;
  return r;
}

function generateMap() {
  const walls = [];
  for (let i = 0; i < 18; i++) walls.push(genWall());
  const rivers = [];
  for (let i = 0; i < 2; i++) rivers.push(genRiver());
  const forests = [];
  for (let i = 0; i < 6; i++) forests.push(genForest());
  const biomes = [];
  for (let i = 0; i < 6; i++) biomes.push(genBiomeBlob());
  return { walls, rivers, forests, biomes };
}

function publicPlayers(room) {
  const out = {};
  for (const id in room.players) {
    const p = room.players[id];
    out[id] = {
      id, pseudo: p.pseudo, realName: p.realName, skin: p.skin, ready: p.ready
    };
  }
  return out;
}

function buildState(room) {
  const p = {};
  for (const id in room.players) {
    const pl = room.players[id];
    p[id] = {
      id, x: pl.x, y: pl.y, angle: pl.angle, skin: pl.skin,
      hp: pl.hp, alive: pl.alive, pseudo: pl.pseudo, realName: pl.realName,
      speedBoost: pl.speedBoost || 0, shield: pl.shield || 0,
      damageBoost: pl.damageBoost || 0,
      spectators: pl.spectators || 0
    };
  }
  return {
    players: p,
    bullets: room.bullets.map(b => ({ id: b.id, x: b.x, y: b.y })),
    zones: room.zones,
    mapData: room.mapData,
    announcement: room.announcement
  };
}

function broadcastLobby(room) {
  io.to(room.id).emit("lobby-update", {
    players: publicPlayers(room),
    hostId: room.hostId,
    gameStarted: room.gameStarted,
    roomId: room.id,
    roomName: room.name
  });
  io.emit("room-list-update", roomList());
}

function roomList() {
  return Object.values(rooms).map(r => ({
    id: r.id,
    name: r.name,
    host: r.players[r.hostId]?.pseudo || "?",
    count: Object.keys(r.players).length,
    max: r.maxPlayers,
    started: r.gameStarted
  }));
}

function isInsideWall(walls, x, y, r) {
  for (const w of walls) {
    // Approximation rectangle élargi
    if (x + r > w.x && x - r < w.x + w.w &&
        y + r > w.y && y - r < w.y + w.h) {
      return true;
    }
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

function resetForGame(room) {
  room.bullets = [];
  room.mapData = generateMap();
  room.zones = [];
  for (let i = 0; i < 5; i++) room.zones.push(genZone(i < 2));
  room.zoneTimer = 0;

  const ids = Object.keys(room.players);
  ids.forEach((id, i) => {
    const p = room.players[id];
    const a = (i / ids.length) * Math.PI * 2;
    p.x = MAP_W / 2 + Math.cos(a) * 400;
    p.y = MAP_H / 2 + Math.sin(a) * 400;
    p.angle = a + Math.PI;
    p.hp = MAX_HP;
    p.alive = true;
    p.lastShot = 0;
    p.speedBoost = 0;
    p.shield = 0;
    p.damageBoost = 0;
    p.spectators = 0;
    p.spectating = null;
  });
}

// ---------- Socket ----------
io.on("connection", socket => {
  let currentRoom = null;

  socket.emit("room-list-update", roomList());

  socket.on("list-rooms", () => socket.emit("room-list-update", roomList()));

  socket.on("delete-account", pseudo => {
    // Retire le joueur de tous les rooms (déconnexion forcée)
    for (const rid in rooms) {
      const room = rooms[rid];
      if (room.players[socket.id] && room.players[socket.id].pseudo === pseudo) {
        handleLeave(rid, socket.id);
        socket.emit("account-deleted");
        return;
      }
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
      hp: MAX_HP, alive: true, lastShot: 0,
      speedBoost: 0, shield: 0, damageBoost: 0,
      spectators: 0, spectating: null
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
    if (room && room.players[socket.id])
      room.players[socket.id].pseudo = String(pseudo).slice(0, 16);
    if (room) broadcastLobby(room);
  });

  socket.on("update-realname", name => {
    const room = rooms[currentRoom];
    if (room && room.players[socket.id])
      room.players[socket.id].realName = String(name).slice(0, 32);
    if (room) broadcastLobby(room);
  });

  socket.on("update-skin", skin => {
    const room = rooms[currentRoom];
    if (room && room.players[socket.id])
      room.players[socket.id].skin = Number(skin) || 0;
    if (room) broadcastLobby(room);
  });

  socket.on("toggle-ready", () => {
    const room = rooms[currentRoom];
    if (!room) return;
    const p = room.players[socket.id];
    if (p && socket.id !== room.hostId) {
      p.ready = !p.ready;
      broadcastLobby(room);
    }
  });

  socket.on("start-game", () => {
    const room = rooms[currentRoom];
    if (!room || socket.id !== room.hostId) return;
    const guests = Object.values(room.players).filter(p => p.id !== room.hostId);
    if (guests.length > 0 && !guests.every(p => p.ready)) return;
    resetForGame(room);
    room.gameStarted = true;
    room.announcement = "LA PARTIE COMMENCE !";
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
      // Retirer ce joueur du spectate des autres
      for (const id in room.players) {
        if (room.players[id].spectating === socket.id) {
          room.players[id].spectating = null;
        }
      }
    }
    if (socket.id === room.hostId) {
      room.gameStarted = false;
      room.bullets = [];
      io.to(room.id).emit("game-ended");
    }
    broadcastLobby(room);
  });

  socket.on("spectate", targetId => {
    const room = rooms[currentRoom];
    if (!room) return;
    const p = room.players[socket.id];
    const target = room.players[targetId];
    if (!p || !target) return;

    // Retirer de l'ancien
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
    const speed = PLAYER_SPEED * (1 + (p.speedBoost > 0 ? 0.6 : 0));

    let nx = p.x, ny = p.y;
    if (len > 0) {
      nx += (dx / len) * speed;
      ny += (dy / len) * speed;
    }
    nx = Math.max(PLAYER_RADIUS, Math.min(MAP_W - PLAYER_RADIUS, nx));
    ny = Math.max(PLAYER_RADIUS, Math.min(MAP_H - PLAYER_RADIUS, ny));

    // Collision murs + arbres
    const md = room.mapData;
    if (md) {
      if (!isInsideWall(md.walls, nx, p.y, PLAYER_RADIUS)) p.x = nx;
      if (!isInsideWall(md.walls, p.x, ny, PLAYER_RADIUS) &&
          !isInsideTree(md.forests, p.x, ny, PLAYER_RADIUS)) p.y = ny;
    } else {
      p.x = nx; p.y = ny;
    }

    if (typeof data.angle === "number") p.angle = data.angle;
  });

  socket.on("shoot", data => {
    const room = rooms[currentRoom];
    if (!room) return;
    const p = room.players[socket.id];
    if (!p || !room.gameStarted || !p.alive) return;
    const now = Date.now();
    if (now - p.lastShot < SHOOT_COOLDOWN) return;
    p.lastShot = now;
    if (typeof data.angle === "number") p.angle = data.angle;

    const dmg = p.damageBoost > 0 ? BULLET_DAMAGE * 1.5 : BULLET_DAMAGE;

    room.bullets.push({
      id: ++room.bulletSeq,
      x: p.x + Math.cos(p.angle) * 34,
      y: p.y + Math.sin(p.angle) * 34,
      vx: Math.cos(p.angle) * BULLET_SPEED,
      vy: Math.sin(p.angle) * BULLET_SPEED,
      owner: socket.id,
      life: BULLET_LIFE,
      damage: dmg
    });
  });

  socket.on("disconnect", () => {
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

// ---------- Tick ----------
function tick() {
  const now = Date.now();
  for (const rid in rooms) {
    const room = rooms[rid];
    if (!room.gameStarted) continue;

    // Zones : mouvement + respawn
    room.zoneTimer++;
    if (room.zoneTimer > 60 * 10) {
      room.zoneTimer = 0;
      if (room.zones.length > 3) room.zones.shift();
      room.zones.push(genZone(true));
    }

    for (const z of room.zones) {
      if (z.moving && z.moveTimer > 0) {
        z.x += z.vx;
        z.y += z.vy;
        z.moveTimer--;
        // Rebond sur les bords
        if (z.x < z.radius || z.x > MAP_W - z.radius) { z.vx *= -1; z.x = Math.max(z.radius, Math.min(MAP_W - z.radius, z.x)); }
        if (z.y < z.radius || z.y > MAP_H - z.radius) { z.vy *= -1; z.y = Math.max(z.radius, Math.min(MAP_H - z.radius, z.y)); }
      } else if (z.moving && z.moveTimer <= 0) {
        z.moving = false;
        z.stopped = true;
        room.announcement = "🛑 LA ZONE S'ARRÊTE";
        room.announcementTime = 60 * 2;
      }
    }

    // Annonce de mouvement
    if (!room.announcement || room.announcementTime <= 0) {
      const moving = room.zones.find(z => z.moving);
      if (moving && Math.random() < 0.005) {
        room.announcement = "🌪️ LA ZONE SE DÉPLACE";
        room.announcementTime = 60 * 2;
      }
    }
    if (room.announcementTime > 0) room.announcementTime--;

    // Boosts
    for (const id in room.players) {
      const p = room.players[id];
      if (p.speedBoost > 0) p.speedBoost--;
      if (p.shield > 0) p.shield--;
      if (p.damageBoost > 0) p.damageBoost--;
    }

    // Effets zones
    for (const id in room.players) {
      const p = room.players[id];
      if (!p.alive) continue;
      for (const z of room.zones) {
        if (Math.hypot(p.x - z.x, p.y - z.y) < z.radius) {
          if (z.type === "heal") p.hp = Math.min(MAX_HP, p.hp + 0.3);
          else if (z.type === "speed") p.speedBoost = 60;
          else if (z.type === "shield") p.shield = 120;
          else if (z.type === "damage") p.damageBoost = 90;
        }
      }
    }

    // Balles
    for (let i = room.bullets.length - 1; i >= 0; i--) {
      const b = room.bullets[i];
      b.x += b.vx; b.y += b.vy; b.life--;

      let dead = false;
      if (b.life <= 0 || b.x < 0 || b.x > MAP_W || b.y < 0 || b.y > MAP_H) dead = true;

      // Collision mur
      if (!dead && room.mapData && isInsideWall(room.mapData.walls, b.x, b.y, 4)) dead = true;

      if (dead) { room.bullets.splice(i, 1); continue; }

      let hit = false;
      for (const id in room.players) {
        if (id === b.owner) continue;
        const p = room.players[id];
        if (!p.alive) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) < PLAYER_RADIUS) {
          let dmg = b.damage || BULLET_DAMAGE;
          if (p.shield > 0) dmg *= 0.3;
          p.hp -= dmg;
          hit = true;
          if (p.hp <= 0) {
            p.hp = 0;
            p.alive = false;
            const pid = id;
            // Reset après respawn
            setTimeout(() => {
              const pp = room.players[pid];
              if (pp && room.gameStarted) {
                pp.hp = MAX_HP;
                pp.alive = true;
                pp.x = Math.random() * MAP_W;
                pp.y = Math.random() * MAP_H;
                pp.shield = 0;
                pp.speedBoost = 0;
                pp.damageBoost = 0;
              }
            }, RESPAWN_TIME * 4);
          }
          break;
        }
      }
      if (hit) room.bullets.splice(i, 1);
    }

    io.to(room.id).emit("state", buildState(room));
  }
}
setInterval(tick, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Serveur sur ${PORT}`));