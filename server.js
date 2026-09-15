const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

// ----- Constantes -----
const MAP_W = 3200, MAP_H = 3200;
const PLAYER_RADIUS = 24;
const PLAYER_SPEED = 3.4;
const BULLET_SPEED = 9;
const BULLET_LIFE = 150;
const BULLET_DAMAGE = 25;
const SHOOT_COOLDOWN = 350;
const RESPAWN_TIME = 3000;
const MAX_HP = 100;
const MAX_PLAYERS_PER_ROOM = 8;

// ----- Zones -----
const ZONE_TYPES = {
  heal:    { color: "#4f4",   label: "Soin",     radius: 90 },
  speed:   { color: "#4af",   label: "Vitesse",  radius: 90 },
  damage:  { color: "#f55",   label: "Dégâts +", radius: 90 },
  shield:  { color: "#fd4",   label: "Bouclier", radius: 90 }
};

// ----- État global -----
const rooms = {};  // roomId -> room

function genRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function genZone() {
  const keys = Object.keys(ZONE_TYPES);
  const type = keys[Math.floor(Math.random() * keys.length)];
  return {
    id: Math.random().toString(36).slice(2, 8),
    type,
    x: 300 + Math.random() * (MAP_W - 600),
    y: 300 + Math.random() * (MAP_H - 600),
    radius: ZONE_TYPES[type].radius
  };
}

function createRoom(name, hostId, hostSocket) {
  let id;
  do { id = genRoomId(); } while (rooms[id]);
  rooms[id] = {
    id,
    name: name || `Serveur de ${id}`,
    hostId,
    players: {},
    bullets: [],
    bulletSeq: 0,
    gameStarted: false,
    zones: [],
    zoneTimer: 0,
    maxPlayers: MAX_PLAYERS_PER_ROOM,
    createdAt: Date.now()
  };
  return rooms[id];
}

function deleteRoom(id) {
  const r = rooms[id];
  if (!r) return;
  r.players = {};
  delete rooms[id];
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

function publicPlayers(room) {
  const out = {};
  for (const id in room.players) {
    const p = room.players[id];
    out[id] = {
      id,
      pseudo: p.pseudo,
      realName: p.realName,
      skin: p.skin,
      ready: p.ready
    };
  }
  return out;
}

function buildState(room) {
  const p = {};
  for (const id in room.players) {
    const pl = room.players[id];
    p[id] = {
      id, x: pl.x, y: pl.y, angle: pl.angle,
      skin: pl.skin, hp: pl.hp, alive: pl.alive,
      pseudo: pl.pseudo, realName: pl.realName,
      speedBoost: pl.speedBoost || 0,
      shield: pl.shield || 0
    };
  }
  return {
    players: p,
    bullets: room.bullets.map(b => ({ id: b.id, x: b.x, y: b.y })),
    zones: room.zones
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

function resetForGame(room) {
  room.bullets = [];
  room.zones = [];
  for (let i = 0; i < 5; i++) room.zones.push(genZone());
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
  });
}

// ----- Socket -----
io.on("connection", socket => {
  let currentRoom = null;

  socket.emit("room-list-update", roomList());

  socket.on("list-rooms", () => {
    socket.emit("room-list-update", roomList());
  });

  socket.on("create-room", data => {
    const room = createRoom(data.name, socket.id, socket);
    currentRoom = room.id;
    socket.join(room.id);
    socket.emit("room-created", { id: room.id, name: room.name });
    io.emit("room-list-update", roomList());
  });

  socket.on("join-room", data => {
    const room = rooms[data.id];
    if (!room) { socket.emit("join-error", "Serveur introuvable."); return; }
    if (Object.keys(room.players).length >= room.maxPlayers) {
      socket.emit("join-error", "Serveur plein."); return;
    }
    if (room.gameStarted) {
      socket.emit("join-error", "Partie déjà en cours."); return;
    }
    if (!room.hostId) room.hostId = socket.id;

    currentRoom = room.id;
    socket.join(room.id);

    room.players[socket.id] = {
      id: socket.id,
      pseudo: String(data.pseudo || "Joueur").slice(0, 16) || "Joueur",
      realName: String(data.realName || "").slice(0, 32),
      skin: Number(data.skin) || 0,
      ready: false,
      x: MAP_W / 2, y: MAP_H / 2, angle: 0,
      hp: MAX_HP, alive: true, lastShot: 0,
      speedBoost: 0, shield: 0
    };
    socket.emit("room-joined", { id: room.id, name: room.name });
    broadcastLobby(room);
  });

  socket.on("leave-room", () => {
    handleLeave();
  });

  function handleLeave() {
    if (!currentRoom) return;
    const room = rooms[currentRoom];
    socket.leave(currentRoom);
    currentRoom = null;
    if (!room) return;

    delete room.players[socket.id];

    if (Object.keys(room.players).length === 0) {
      deleteRoom(room.id);
    } else {
      if (socket.id === room.hostId) {
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
    socket.emit("left-room");
  }

  socket.on("update-pseudo", pseudo => {
    const room = rooms[currentRoom];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].pseudo = String(pseudo).slice(0, 16) || "Joueur";
    broadcastLobby(room);
  });

  socket.on("update-realname", name => {
    const room = rooms[currentRoom];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].realName = String(name).slice(0, 32);
    broadcastLobby(room);
  });

  socket.on("update-skin", skin => {
    const room = rooms[currentRoom];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].skin = Number(skin) || 0;
    broadcastLobby(room);
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
    io.to(room.id).emit("game-started");
    io.to(room.id).emit("state", buildState(room));
  });

  socket.on("leave-game", () => {
    const room = rooms[currentRoom];
    if (!room) return;
    const p = room.players[socket.id];
    if (p) { p.ready = false; p.hp = MAX_HP; p.alive = true; }
    if (socket.id === room.hostId) {
      room.gameStarted = false;
      room.bullets = [];
      io.to(room.id).emit("game-ended");
    }
    broadcastLobby(room);
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
    if (len > 0) {
      p.x += (dx / len) * speed;
      p.y += (dy / len) * speed;
    }
    p.x = Math.max(PLAYER_RADIUS, Math.min(MAP_W - PLAYER_RADIUS, p.x));
    p.y = Math.max(PLAYER_RADIUS, Math.min(MAP_H - PLAYER_RADIUS, p.y));
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

  socket.on("disconnect", () => { handleLeave(); });
});

// ----- Tick global -----
function tick() {
  const now = Date.now();
  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (!room.gameStarted) continue;

    // Zones : respawn périodique
    room.zoneTimer++;
    if (room.zoneTimer > 60 * 8) { // toutes les 8s on retire 1 et on ajoute 1
      room.zoneTimer = 0;
      if (room.zones.length > 3) room.zones.shift();
      room.zones.push(genZone());
    }

    // Décrémenter les boosts
    for (const id in room.players) {
      const p = room.players[id];
      if (p.speedBoost > 0) p.speedBoost--;
      if (p.shield > 0) p.shield--;
      if (p.damageBoost > 0) p.damageBoost--;
    }

    // Zones : effet quand le joueur est dedans
    for (const id in room.players) {
      const p = room.players[id];
      if (!p.alive) continue;
      for (const z of room.zones) {
        if (Math.hypot(p.x - z.x, p.y - z.y) < z.radius) {
          if (z.type === "heal") {
            p.hp = Math.min(MAX_HP, p.hp + 0.3);
          } else if (z.type === "speed") {
            p.speedBoost = 60;
          } else if (z.type === "shield") {
            p.shield = 120;
          } else if (z.type === "damage") {
            p.damageBoost = 90;
          }
        }
      }
    }

    // Balles
    for (let i = room.bullets.length - 1; i >= 0; i--) {
      const b = room.bullets[i];
      b.x += b.vx; b.y += b.vy; b.life--;

      if (b.life <= 0 || b.x < 0 || b.x > MAP_W || b.y < 0 || b.y > MAP_H) {
        room.bullets.splice(i, 1); continue;
      }

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
            p.hp = 0; p.alive = false;
            const pid = id;
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
            }, RESPAWN_TIME);
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
server.listen(PORT, () => console.log(`✅ Serveur sur port ${PORT}`));