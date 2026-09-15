const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

const MAP_W = 2400, MAP_H = 2400;
const PLAYER_RADIUS = 24;
const PLAYER_SPEED = 3.4;
const BULLET_SPEED = 9;
const BULLET_LIFE = 150;
const BULLET_DAMAGE = 25;
const SHOOT_COOLDOWN = 350;
const RESPAWN_TIME = 3000;
const MAX_HP = 100;

const players = {};
let hostId = null;
let gameStarted = false;
let bullets = [];
let bulletSeq = 0;

function publicPlayers() {
  const out = {};
  for (const id in players) {
    const p = players[id];
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

function buildState() {
  const p = {};
  for (const id in players) {
    const pl = players[id];
    p[id] = {
      id, x: pl.x, y: pl.y, angle: pl.angle,
      skin: pl.skin, hp: pl.hp, alive: pl.alive,
      pseudo: pl.pseudo, realName: pl.realName
    };
  }
  return {
    players: p,
    bullets: bullets.map(b => ({ id: b.id, x: b.x, y: b.y }))
  };
}

function broadcastLobby() {
  io.emit("lobby-update", {
    players: publicPlayers(),
    hostId,
    gameStarted
  });
}

function resetForGame() {
  bullets = [];
  const ids = Object.keys(players);
  ids.forEach((id, i) => {
    const p = players[id];
    const a = (i / ids.length) * Math.PI * 2;
    p.x = MAP_W / 2 + Math.cos(a) * 350;
    p.y = MAP_H / 2 + Math.sin(a) * 350;
    p.angle = a + Math.PI;
    p.hp = MAX_HP;
    p.alive = true;
    p.lastShot = 0;
  });
}

io.on("connection", socket => {
  socket.on("join-lobby", data => {
    if (!hostId) hostId = socket.id;
    players[socket.id] = {
      id: socket.id,
      pseudo: String(data.pseudo || "Joueur").slice(0, 16) || "Joueur",
      realName: String(data.realName || "").slice(0, 32),
      skin: Number(data.skin) || 0,
      ready: false,
      x: MAP_W / 2, y: MAP_H / 2, angle: 0,
      hp: MAX_HP, alive: true, lastShot: 0
    };
    broadcastLobby();
  });

  socket.on("update-pseudo", pseudo => {
    const p = players[socket.id];
    if (!p) return;
    p.pseudo = String(pseudo).slice(0, 16) || "Joueur";
    broadcastLobby();
  });

  socket.on("update-realname", name => {
    const p = players[socket.id];
    if (!p) return;
    p.realName = String(name).slice(0, 32);
    broadcastLobby();
  });

  socket.on("update-skin", skin => {
    const p = players[socket.id];
    if (!p) return;
    p.skin = Number(skin) || 0;
    broadcastLobby();
  });

  socket.on("toggle-ready", () => {
    const p = players[socket.id];
    if (p && socket.id !== hostId) {
      p.ready = !p.ready;
      broadcastLobby();
    }
  });

  socket.on("start-game", () => {
    if (socket.id !== hostId) return;
    const guests = Object.values(players).filter(p => p.id !== hostId);
    if (guests.length > 0 && !guests.every(p => p.ready)) return;
    resetForGame();
    gameStarted = true;
    io.emit("game-started");
    io.emit("state", buildState());
  });

  socket.on("leave-game", () => {
    const p = players[socket.id];
    if (p) { p.ready = false; p.hp = MAX_HP; p.alive = true; }
    if (socket.id === hostId) {
      gameStarted = false;
      bullets = [];
      io.emit("game-ended");
    }
    broadcastLobby();
  });

  socket.on("input", data => {
    const p = players[socket.id];
    if (!p || !gameStarted || !p.alive) return;
    const k = data.keys || {};
    let dx = 0, dy = 0;
    if (k.up) dy -= 1;
    if (k.down) dy += 1;
    if (k.left) dx -= 1;
    if (k.right) dx += 1;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      p.x += (dx / len) * PLAYER_SPEED;
      p.y += (dy / len) * PLAYER_SPEED;
    }
    p.x = Math.max(PLAYER_RADIUS, Math.min(MAP_W - PLAYER_RADIUS, p.x));
    p.y = Math.max(PLAYER_RADIUS, Math.min(MAP_H - PLAYER_RADIUS, p.y));
    if (typeof data.angle === "number") p.angle = data.angle;
  });

  socket.on("shoot", data => {
    const p = players[socket.id];
    if (!p || !gameStarted || !p.alive) return;
    const now = Date.now();
    if (now - p.lastShot < SHOOT_COOLDOWN) return;
    p.lastShot = now;
    if (typeof data.angle === "number") p.angle = data.angle;
    bullets.push({
      id: ++bulletSeq,
      x: p.x + Math.cos(p.angle) * 34,
      y: p.y + Math.sin(p.angle) * 34,
      vx: Math.cos(p.angle) * BULLET_SPEED,
      vy: Math.sin(p.angle) * BULLET_SPEED,
      owner: socket.id,
      life: BULLET_LIFE
    });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    if (socket.id === hostId) hostId = Object.keys(players)[0] || null;
    if (Object.keys(players).length === 0) {
      gameStarted = false;
      bullets = [];
    }
    broadcastLobby();
  });
});

function tick() {
  if (!gameStarted) return;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.life <= 0 || b.x < 0 || b.x > MAP_W || b.y < 0 || b.y > MAP_H) {
      bullets.splice(i, 1); continue;
    }
    let hit = false;
    for (const id in players) {
      if (id === b.owner) continue;
      const p = players[id];
      if (!p.alive) continue;
      if (Math.hypot(p.x - b.x, p.y - b.y) < PLAYER_RADIUS) {
        p.hp -= BULLET_DAMAGE;
        hit = true;
        if (p.hp <= 0) {
          p.hp = 0; p.alive = false;
          const pid = id;
          setTimeout(() => {
            const pp = players[pid];
            if (pp && gameStarted) {
              pp.hp = MAX_HP; pp.alive = true;
              pp.x = Math.random() * MAP_W;
              pp.y = Math.random() * MAP_H;
            }
          }, RESPAWN_TIME);
        }
        break;
      }
    }
    if (hit) bullets.splice(i, 1);
  }
  io.emit("state", buildState());
}
setInterval(tick, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Serveur sur port ${PORT}`));