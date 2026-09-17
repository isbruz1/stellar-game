const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: true,
        methods: ["GET", "POST"]
    },
    transports: ["websocket", "polling"],
    pingInterval: 10000,
    pingTimeout: 20000
});

const PORT = Number(process.env.PORT) || 10000;
const HOST = "0.0.0.0";

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
    res.json({
        ok: true,
        game: "Stellar Game",
        players: io.engine.clientsCount,
        uptime: process.uptime()
    });
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --------------------------------------------------
// GAME CONFIG
// --------------------------------------------------

const WORLD = {
    width: 3600,
    height: 2400
};

const MAX_PLAYERS_PER_SERVER = 16;

const TICK_RATE = 30;
const TICK_MS = 1000 / TICK_RATE;

const PLAYER_SPEED = 260;
const PLAYER_RADIUS = 20;

const BULLET_SPEED = 850;
const BULLET_RADIUS = 5;
const BULLET_LIFETIME = 1.5;

const FIRE_COOLDOWN = 0.18;

// --------------------------------------------------
// DATA
// --------------------------------------------------

const rooms = new Map();

const COLORS = [
    "#38bdf8",
    "#a78bfa",
    "#34d399",
    "#fbbf24",
    "#fb7185",
    "#f97316",
    "#22d3ee",
    "#e879f9"
];

function createId(length = 6) {
    return crypto
        .randomBytes(length)
        .toString("base64")
        .replace(/[^A-Z0-9]/gi, "")
        .slice(0, length)
        .toUpperCase();
}

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(x, y) {
    const length = Math.hypot(x, y);

    if (length <= 0.0001) {
        return { x: 0, y: 0 };
    }

    return {
        x: x / length,
        y: y / length
    };
}

// --------------------------------------------------
// MAP
// --------------------------------------------------

function createMap() {
    const walls = [];
    const forests = [];
    const rivers = [];

    // Border walls
    walls.push(
        { x: 0, y: 0, w: WORLD.width, h: 40 },
        { x: 0, y: WORLD.height - 40, w: WORLD.width, h: 40 },
        { x: 0, y: 0, w: 40, h: WORLD.height },
        { x: WORLD.width - 40, y: 0, w: 40, h: WORLD.height }
    );

    // Buildings / obstacles
    const buildings = [
        [600, 420, 300, 190],
        [1280, 300, 360, 180],
        [2180, 420, 360, 200],
        [2850, 720, 330, 220],

        [380, 1350, 350, 190],
        [1120, 1500, 330, 220],
        [2050, 1320, 360, 190],
        [2800, 1500, 400, 230],

        [1500, 820, 220, 350]
    ];

    for (const [x, y, w, h] of buildings) {
        walls.push({ x, y, w, h });
    }

    // Forest zones
    forests.push(
        { x: 120, y: 280, w: 320, h: 300 },
        { x: 3150, y: 250, w: 300, h: 350 },
        { x: 760, y: 1820, w: 360, h: 330 },
        { x: 2350, y: 1880, w: 400, h: 300 }
    );

    // Rivers
    rivers.push({
        x: 1750,
        y: 0,
        w: 150,
        h: WORLD.height
    });

    return {
        width: WORLD.width,
        height: WORLD.height,
        walls,
        forests,
        rivers
    };
}

// --------------------------------------------------
// ROOM
// --------------------------------------------------

function createRoom(name, ownerId) {
    const room = {
        id: createId(6),
        name: name || "Stellar Server",
        ownerId,
        players: new Map(),
        bullets: [],
        createdAt: Date.now(),
        map: createMap()
    };

    rooms.set(room.id, room);

    return room;
}

function getRoomPlayers(room) {
    return [...room.players.values()].map(player => ({
        id: player.id,
        name: player.name,
        x: player.x,
        y: player.y,
        angle: player.angle,
        color: player.color,
        health: player.health,
        maxHealth: player.maxHealth,
        kills: player.kills,
        deaths: player.deaths,
        alive: player.alive,
        ready: player.ready
    }));
}

function publicRoom(room) {
    return {
        id: room.id,
        name: room.name,
        players: room.players.size,
        maxPlayers: MAX_PLAYERS_PER_SERVER,
        ownerId: room.ownerId
    };
}

function getRoomList() {
    return [...rooms.values()]
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(publicRoom);
}

// --------------------------------------------------
// SPAWN
// --------------------------------------------------

function isInsideWall(x, y, radius, room) {
    for (const wall of room.map.walls) {
        if (
            x + radius > wall.x &&
            x - radius < wall.x + wall.w &&
            y + radius > wall.y &&
            y - radius < wall.y + wall.h
        ) {
            return true;
        }
    }

    return false;
}

function isInsideRiver(x, y, room) {
    for (const river of room.map.rivers) {
        if (
            x > river.x &&
            x < river.x + river.w &&
            y > river.y &&
            y < river.y + river.h
        ) {
            return true;
        }
    }

    return false;
}

function findSpawn(room) {
    for (let i = 0; i < 100; i++) {
        const point = {
            x: random(100, WORLD.width - 100),
            y: random(100, WORLD.height - 100)
        };

        if (isInsideWall(point.x, point.y, 60, room)) {
            continue;
        }

        if (isInsideRiver(point.x, point.y, room)) {
            continue;
        }

        let valid = true;

        for (const player of room.players.values()) {
            if (distance(point, player) < 180) {
                valid = false;
                break;
            }
        }

        if (valid) {
            return point;
        }
    }

    return {
        x: WORLD.width / 2,
        y: WORLD.height / 2
    };
}

// --------------------------------------------------
// PLAYER
// --------------------------------------------------

function createPlayer(socket, name, room) {
    const spawn = findSpawn(room);

    return {
        id: socket.id,
        name: String(name || "Player").trim().slice(0, 16) || "Player",

        x: spawn.x,
        y: spawn.y,

        angle: 0,

        vx: 0,
        vy: 0,

        color: COLORS[Math.floor(Math.random() * COLORS.length)],

        health: 100,
        maxHealth: 100,

        kills: 0,
        deaths: 0,

        alive: true,
        ready: false,

        input: {
            x: 0,
            y: 0,
            shooting: false,
            angle: 0
        },

        lastShot: 0,
        respawnAt: 0
    };
}

// --------------------------------------------------
// COLLISION
// --------------------------------------------------

function movePlayer(player, room, dx, dy) {
    let newX = player.x + dx;
    let newY = player.y + dy;

    newX = clamp(
        newX,
        PLAYER_RADIUS + 45,
        WORLD.width - PLAYER_RADIUS - 45
    );

    newY = clamp(
        newY,
        PLAYER_RADIUS + 45,
        WORLD.height - PLAYER_RADIUS - 45
    );

    if (!isInsideWall(newX, newY, PLAYER_RADIUS, room)) {
        player.x = newX;
    }

    if (!isInsideWall(player.x, newY, PLAYER_RADIUS, room)) {
        player.y = newY;
    }
}

// --------------------------------------------------
// SHOOT
// --------------------------------------------------

function createBullet(player, room) {
    const now = Date.now();

    if (now - player.lastShot < FIRE_COOLDOWN * 1000) {
        return;
    }

    if (!player.alive) {
        return;
    }

    player.lastShot = now;

    const direction = normalize(
        Math.cos(player.input.angle),
        Math.sin(player.input.angle)
    );

    room.bullets.push({
        id: createId(8),
        ownerId: player.id,

        x: player.x + direction.x * 28,
        y: player.y + direction.y * 28,

        vx: direction.x * BULLET_SPEED,
        vy: direction.y * BULLET_SPEED,

        life: BULLET_LIFETIME
    });
}

// --------------------------------------------------
// BULLETS
// --------------------------------------------------

function updateBullets(room, dt) {
    for (let i = room.bullets.length - 1; i >= 0; i--) {
        const bullet = room.bullets[i];

        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.life -= dt;

        if (
            bullet.life <= 0 ||
            bullet.x < 0 ||
            bullet.y < 0 ||
            bullet.x > WORLD.width ||
            bullet.y > WORLD.height ||
            isInsideWall(bullet.x, bullet.y, BULLET_RADIUS, room)
        ) {
            room.bullets.splice(i, 1);
            continue;
        }

        let hit = false;

        for (const player of room.players.values()) {
            if (!player.alive) continue;
            if (player.id === bullet.ownerId) continue;

            const d = Math.hypot(
                player.x - bullet.x,
                player.y - bullet.y
            );

            if (d < PLAYER_RADIUS + BULLET_RADIUS) {
                player.health -= 34;
                hit = true;

                if (player.health <= 0) {
                    player.health = 0;
                    player.alive = false;
                    player.deaths++;
                    player.respawnAt = Date.now() + 2500;

                    const killer = room.players.get(bullet.ownerId);

                    if (killer) {
                        killer.kills++;
                    }

                    io.to(room.id).emit("playerDied", {
                        victim: player.name,
                        killer: killer ? killer.name : "Unknown"
                    });
                }

                break;
            }
        }

        if (hit) {
            room.bullets.splice(i, 1);
        }
    }
}

// --------------------------------------------------
// GAME LOOP
// --------------------------------------------------

function updateRoom(room, dt) {
    for (const player of room.players.values()) {
        if (!player.alive) {
            if (Date.now() >= player.respawnAt) {
                const spawn = findSpawn(room);

                player.x = spawn.x;
                player.y = spawn.y;
                player.health = player.maxHealth;
                player.alive = true;
            }

            continue;
        }

        const input = player.input;

        const normalized = normalize(input.x, input.y);

        let speed = PLAYER_SPEED;

        // River slows players
        if (isInsideRiver(player.x, player.y, room)) {
            speed *= 0.55;
        }

        movePlayer(
            player,
            room,
            normalized.x * speed * dt,
            normalized.y * speed * dt
        );

        player.angle = input.angle;

        if (input.shooting) {
            createBullet(player, room);
        }
    }

    updateBullets(room, dt);
}

// --------------------------------------------------
// SOCKET.IO
// --------------------------------------------------

io.on("connection", socket => {
    console.log("Connected:", socket.id);

    socket.emit("connected", {
        id: socket.id,
        rooms: getRoomList()
    });

    socket.on("getRooms", () => {
        socket.emit("roomList", getRoomList());
    });

    socket.on("createRoom", data => {
        const name =
            data && typeof data.name === "string"
                ? data.name
                : "Stellar Server";

        const playerName =
            data && typeof data.playerName === "string"
                ? data.playerName
                : "Player";

        const room = createRoom(name, socket.id);

        joinRoom(socket, room, playerName);
    });

    socket.on("joinRoom", data => {
        if (!data || !data.roomId) {
            socket.emit("errorMessage", "Serveur introuvable.");
            return;
        }

        const room = rooms.get(String(data.roomId).toUpperCase());

        if (!room) {
            socket.emit("errorMessage", "Ce serveur n'existe plus.");
            return;
        }

        if (room.players.size >= MAX_PLAYERS_PER_SERVER) {
            socket.emit("errorMessage", "Ce serveur est complet.");
            return;
        }

        const playerName =
            typeof data.playerName === "string"
                ? data.playerName
                : "Player";

        joinRoom(socket, room, playerName);
    });

    socket.on("leaveRoom", () => {
        leaveCurrentRoom(socket);
    });

    socket.on("ready", value => {
        const room = getPlayerRoom(socket.id);

        if (!room) return;

        const player = room.players.get(socket.id);

        if (!player) return;

        player.ready = Boolean(value);

        io.to(room.id).emit("roomState", {
            room: publicRoom(room),
            players: getRoomPlayers(room)
        });
    });

    socket.on("startGame", () => {
        const room = getPlayerRoom(socket.id);

        if (!room) return;

        if (room.ownerId !== socket.id) {
            socket.emit("errorMessage", "Seul l'hôte peut lancer la partie.");
            return;
        }

        io.to(room.id).emit("gameStarted", {
            map: room.map
        });
    });

    socket.on("input", input => {
        const room = getPlayerRoom(socket.id);

        if (!room) return;

        const player = room.players.get(socket.id);

        if (!player) return;

        const x = Number(input?.x) || 0;
        const y = Number(input?.y) || 0;
        const angle = Number(input?.angle) || 0;

        player.input.x = clamp(x, -1, 1);
        player.input.y = clamp(y, -1, 1);
        player.input.angle = angle;
        player.input.shooting = Boolean(input?.shooting);
    });

    socket.on("disconnect", () => {
        console.log("Disconnected:", socket.id);

        leaveCurrentRoom(socket);
    });
});

// --------------------------------------------------
// JOIN / LEAVE
// --------------------------------------------------

function getPlayerRoom(socketId) {
    for (const room of rooms.values()) {
        if (room.players.has(socketId)) {
            return room;
        }
    }

    return null;
}

function joinRoom(socket, room, playerName) {
    const oldRoom = getPlayerRoom(socket.id);

    if (oldRoom) {
        leaveCurrentRoom(socket);
    }

    const player = createPlayer(socket, playerName, room);

    room.players.set(socket.id, player);

    socket.join(room.id);

    socket.emit("joinedRoom", {
        room: publicRoom(room),
        player: {
            id: player.id,
            name: player.name,
            color: player.color
        },
        map: room.map
    });

    broadcastRoom(room);
}

function leaveCurrentRoom(socket) {
    const room = getPlayerRoom(socket.id);

    if (!room) return;

    room.players.delete(socket.id);

    socket.leave(room.id);

    if (room.ownerId === socket.id) {
        const nextPlayer = room.players.values().next().value;

        if (nextPlayer) {
            room.ownerId = nextPlayer.id;
        }
    }

    if (room.players.size === 0) {
        rooms.delete(room.id);
        return;
    }

    broadcastRoom(room);
}

function broadcastRoom(room) {
    io.to(room.id).emit("roomState", {
        room: publicRoom(room),
        players: getRoomPlayers(room)
    });
}

// --------------------------------------------------
// SERVER TICK
// --------------------------------------------------

setInterval(() => {
    const dt = TICK_MS / 1000;

    for (const room of rooms.values()) {
        updateRoom(room, dt);

        io.to(room.id).emit("gameState", {
            players: getRoomPlayers(room),
            bullets: room.bullets.map(bullet => ({
                id: bullet.id,
                x: bullet.x,
                y: bullet.y
            }))
        });
    }
}, TICK_MS);

// --------------------------------------------------
// START
// --------------------------------------------------

server.listen(PORT, HOST, () => {
    console.log("--------------------------------");
    console.log(" STELLAR GAME SERVER");
    console.log("--------------------------------");
    console.log(`Listening on ${HOST}:${PORT}`);
    console.log(`Players: ${io.engine.clientsCount}`);
});