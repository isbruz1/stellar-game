const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static('public'));

// ====== CONFIG ======
const WORLD_SIZE = 2500;
const TANK_RADIUS = 22;
const TANK_SPEED = 3.5;
const TURRET_TURN_SPEED = 0.15;
const BULLET_SPEED = 12;
const BULLET_RADIUS = 4;
const BULLET_DAMAGE = 20;
const BULLET_LIFETIME = 120;
const SHOOT_COOLDOWN = 25;
const MAX_HP = 100;
const SHRINK_START_DELAY = 60 * 30; // 30s
const SHRINK_RATE = 0.15;
const MIN_ZONE_RADIUS = 200;
const ZONE_DAMAGE_PER_SEC = 8;

// ====== SALLES ======
// rooms[roomId] = { id, name, isPrivate, players: {}, bullets: [], obstacles: [], zone, gameStarted, tickCount, hostId }
const rooms = {};

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createRoom(isPrivate = false, name = null) {
  let id;
  do { id = generateRoomId(); } while (rooms[id]);

  const obstacles = generateObstacles();

  rooms[id] = {
    id,
    name: name || `Salle ${id}`,
    isPrivate,
    players: {},
    bullets: [],
    obstacles,
    zone: {
      x: WORLD_SIZE / 2,
      y: WORLD_SIZE / 2,
      radius: WORLD_SIZE * 0.7,
      shrinking: false
    },
    gameStarted: false,
    tickCount: 0,
    hostId: null,
    createdAt: Date.now()
  };
  return rooms[id];
}

function generateObstacles() {
  const list = [];
  const count = 18;
  for (let i = 0; i < count; i++) {
    const w = 60 + Math.random() * 120;
    const h = 60 + Math.random() * 120;
    list.push({
      x: Math.random() * (WORLD_SIZE - w),
      y: Math.random() * (WORLD_SIZE - h),
      w, h
    });
  }
  return list;
}

function randomSpawn(room) {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * (room.zone.radius * 0.8);
  return {
    x: room.zone.x + Math.cos(angle) * dist,
    y: room.zone.y + Math.sin(angle) * dist
  };
}

function collisionAABB(x, y, r, rect) {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy < r * r;
}

function damagePlayer(room, p, amount, attackerId = null) {
  if (!p.alive) return;
  p.hp -= amount;
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    const killer = attackerId ? room.players[attackerId] : null;
    if (killer) killer.kills++;
    io.to(room.id).emit('killfeed', {
      killer: killer ? killer.pseudo : '☠️ Zone',
      victim: p.pseudo
    });
  }
}

function resetRoom(room) {
  room.zone = {
    x: WORLD_SIZE / 2,
    y: WORLD_SIZE / 2,
    radius: WORLD_SIZE * 0.7,
    shrinking: false
  };
  room.bullets.length = 0;
  room.obstacles = generateObstacles();
  room.tickCount = 0;
  room.gameStarted = false;

  for (const id in room.players) {
    const p = room.players[id];
    const pos = randomSpawn(room);
    p.x = pos.x; p.y = pos.y;
    p.hp = MAX_HP; p.alive = true;
    p.kills = 0; p.angle = 0; p.turretAngle = 0; p.cooldown = 0;
  }
  io.to(room.id).emit('roundStart');
}

// ====== SOCKET ======
io.on('connection', (socket) => {
  console.log('Connexion:', socket.id);

  // Liste des salles publiques
  socket.on('getRooms', () => {
    const publicRooms = Object.values(rooms)
      .filter(r => !r.isPrivate)
      .map(r => ({
        id: r.id,
        name: r.name,
        players: Object.keys(r.players).length,
        maxPlayers: 20
      }));
    socket.emit('roomsList', publicRooms);
  });

  // Créer une salle
  socket.on('createRoom', ({ isPrivate, pseudo }, cb) => {
    if (!pseudo || !pseudo.trim()) return cb({ error: 'Pseudo requis' });
    const room = createRoom(isPrivate, isPrivate ? null : `Partie de ${pseudo}`);
    cb({
      roomId: room.id,
      isPrivate: room.isPrivate,
      worldSize: WORLD_SIZE,
      maxHp: MAX_HP
    });
    joinRoom(socket, room, pseudo.trim().substring(0, 15));
  });

  // Rejoindre une salle
  socket.on('joinRoom', ({ roomId, pseudo }, cb) => {
    if (!pseudo || !pseudo.trim()) return cb({ error: 'Pseudo requis' });
    const room = rooms[roomId.toUpperCase()];
    if (!room) return cb({ error: 'Salle introuvable' });
    if (Object.keys(room.players).length >= 20) return cb({ error: 'Salle pleine' });

    cb({
      roomId: room.id,
      isPrivate: room.isPrivate,
      worldSize: WORLD_SIZE,
      maxHp: MAX_HP
    });
    joinRoom(socket, room, pseudo.trim().substring(0, 15));
  });

  socket.on('input', (data) => {
    const { roomId, input } = data;
    const room = rooms[roomId];
    if (room && room.players[socket.id]) room.players[socket.id].input = input;
  });

  socket.on('mouse', (data) => {
    const { roomId, mouse } = data;
    const room = rooms[roomId];
    if (room && room.players[socket.id]) room.players[socket.id].mouse = mouse;
  });

  socket.on('respawn', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const p = room.players[socket.id];
    if (!p || p.alive) return;
    const pos = randomSpawn(room);
    p.x = pos.x; p.y = pos.y;
    p.hp = MAX_HP; p.alive = true;
    p.angle = 0; p.turretAngle = 0; p.cooldown = 0;
  });

  socket.on('leaveRoom', (roomId) => {
    leaveRoom(socket, roomId);
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      if (rooms[roomId].players[socket.id]) leaveRoom(socket, roomId);
    }
  });
});

function joinRoom(socket, room, pseudo) {
  const pos = randomSpawn(room);
  room.players[socket.id] = {
    id: socket.id,
    pseudo,
    x: pos.x, y: pos.y,
    angle: 0, turretAngle: 0,
    hp: MAX_HP, alive: true,
    kills: 0, cooldown: 0,
    color: `hsl(${Math.random() * 360}, 70%, 55%)`,
    input: { up: false, down: false, left: false, right: false, shoot: false },
    mouse: { x: 0, y: 0 }
  };
  if (!room.hostId) room.hostId = socket.id;

  socket.join(room.id);
  socket.roomId = room.id;

  socket.emit('init', { id: socket.id, worldSize: WORLD_SIZE, maxHp: MAX_HP, roomId: room.id });
  io.to(room.id).emit('playerJoined', pseudo);
}

function leaveRoom(socket, roomId) {
  const room = rooms[roomId];
  if (!room) return;
  delete room.players[socket.id];
  socket.leave(roomId);

  // Si la salle est vide, on la détruit
  if (Object.keys(room.players).length === 0) {
    delete rooms[roomId];
    console.log('Salle supprimée:', roomId);
  }
}

// ====== BOUCLE DE JEU GLOBALE ======
setInterval(() => {
  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (Object.keys(room.players).length === 0) continue;

    room.tickCount++;

    // Zone qui rétrécit
    if (room.tickCount > SHRINK_START_DELAY) {
      room.zone.shrinking = true;
      if (room.zone.radius > MIN_ZONE_RADIUS) {
        room.zone.radius = Math.max(MIN_ZONE_RADIUS, room.zone.radius - SHRINK_RATE);
      }
    }

    // Déplacer tanks
    for (const id in room.players) {
      const p = room.players[id];
      if (!p.alive) continue;

      let dx = 0, dy = 0;
      if (p.input.up) dy -= 1;
      if (p.input.down) dy += 1;
      if (p.input.left) dx -= 1;
      if (p.input.right) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx = (dx / len) * TANK_SPEED;
        dy = (dy / len) * TANK_SPEED;
      }

      if (dx !== 0 || dy !== 0) {
        const targetAngle = Math.atan2(dy, dx);
        let diff = targetAngle - p.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.angle += Math.sign(diff) * Math.min(Math.abs(diff), TURRET_TURN_SPEED * 1.5);
      }

      let nx = p.x + dx;
      let ny = p.y + dy;

      for (const o of room.obstacles) {
        if (collisionAABB(nx, p.y, TANK_RADIUS, o)) nx = p.x;
        if (collisionAABB(p.x, ny, TANK_RADIUS, o)) ny = p.y;
      }

      nx = Math.max(TANK_RADIUS, Math.min(WORLD_SIZE - TANK_RADIUS, nx));
      ny = Math.max(TANK_RADIUS, Math.min(WORLD_SIZE - TANK_RADIUS, ny));
      p.x = nx; p.y = ny;

      const targetTurret = Math.atan2(p.mouse.y - p.y, p.mouse.x - p.x);
      let diffT = targetTurret - p.turretAngle;
      while (diffT > Math.PI) diffT -= Math.PI * 2;
      while (diffT < -Math.PI) diffT += Math.PI * 2;
      p.turretAngle += Math.sign(diffT) * Math.min(Math.abs(diffT), TURRET_TURN_SPEED * 2);

      if (p.cooldown > 0) p.cooldown--;

      if (p.input.shoot && p.cooldown <= 0) {
        p.cooldown = SHOOT_COOLDOWN;
        const muzzleDist = TANK_RADIUS + 8;
        room.bullets.push({
          x: p.x + Math.cos(p.turretAngle) * muzzleDist,
          y: p.y + Math.sin(p.turretAngle) * muzzleDist,
          vx: Math.cos(p.turretAngle) * BULLET_SPEED,
          vy: Math.sin(p.turretAngle) * BULLET_SPEED,
          owner: id, life: BULLET_LIFETIME, color: p.color
        });
        io.to(room.id).emit('shootSound');
      }

      // Dégâts de zone
      const dxZ = p.x - room.zone.x;
      const dyZ = p.y - room.zone.y;
      if (Math.hypot(dxZ, dyZ) > room.zone.radius) {
        if (room.tickCount % 60 === 0) damagePlayer(room, p, ZONE_DAMAGE_PER_SEC);
      }
    }

    // Balles
    for (let i = room.bullets.length - 1; i >= 0; i--) {
      const b = room.bullets[i];
      b.x += b.vx; b.y += b.vy; b.life--;

      let destroyed = false;
      if (b.x < 0 || b.y < 0 || b.x > WORLD_SIZE || b.y > WORLD_SIZE || b.life <= 0) destroyed = true;

      if (!destroyed) {
        for (const o of room.obstacles) {
          if (collisionAABB(b.x, b.y, BULLET_RADIUS, o)) { destroyed = true; break; }
        }
      }

      if (!destroyed) {
        for (const id in room.players) {
          if (id === b.owner) continue;
          const p = room.players[id];
          if (!p.alive) continue;
          const dx = p.x - b.x;
          const dy = p.y - b.y;
          if (dx * dx + dy * dy < (TANK_RADIUS + BULLET_RADIUS) ** 2) {
            damagePlayer(room, p, BULLET_DAMAGE, b.owner);
            destroyed = true;
            break;
          }
        }
      }
      if (destroyed) room.bullets.splice(i, 1);
    }

    // Fin de manche
    const alivePlayers = Object.values(room.players).filter(p => p.alive);
    const totalPlayers = Object.keys(room.players).length;
    if (totalPlayers >= 2 && alivePlayers.length === 1 && !room.gameStarted) {
      room.gameStarted = true;
      io.to(room.id).emit('roundEnd', { winner: alivePlayers[0].pseudo });
      setTimeout(() => resetRoom(room), 5000);
    }

    // Envoi de l'état
    io.to(room.id).emit('state', {
      players: room.players,
      bullets: room.bullets,
      obstacles: room.obstacles,
      zone: room.zone,
      aliveCount: alivePlayers.length,
      totalCount: totalPlayers
    });
  }
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✨ STELLAR GAME lancé sur http://localhost:${PORT}`);
});