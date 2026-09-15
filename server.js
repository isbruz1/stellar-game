const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

function generateRoomId() {
    return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function generateCode() {
    return "STL-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

function cleanName(name, fallback = "Serveur Stellar") {
    if (!name || typeof name !== "string") return fallback;

    return name
        .trim()
        .replace(/[<>]/g, "")
        .slice(0, 24) || fallback;
}

function cleanPseudo(name) {
    if (!name || typeof name !== "string") return "Pilote";

    return name
        .trim()
        .replace(/[<>]/g, "")
        .slice(0, 16) || "Pilote";
}

function publicRoomInfo(room) {
    return {
        id: room.id,
        name: room.name,
        maxPlayers: room.maxPlayers,
        players: room.players.size,
        private: room.private,
        hidden: room.hidden
    };
}

function visibleRooms() {
    return [...rooms.values()]
        .filter(room => !room.hidden && !room.private)
        .map(publicRoomInfo);
}

function broadcastRooms() {
    io.emit("room-list", visibleRooms());
}

function roomPlayerList(room) {
    return [...room.players.values()].map(player => ({
        id: player.id,
        pseudo: player.pseudo,
        x: player.x,
        y: player.y,
        angle: player.angle,
        bodyAngle: player.bodyAngle
    }));
}

io.on("connection", socket => {

    console.log("Joueur connecté :", socket.id);

    socket.emit("room-list", visibleRooms());

    socket.on("get-rooms", () => {
        socket.emit("room-list", visibleRooms());
    });

    socket.on("create-room", data => {

        const name = cleanName(data?.name);
        const pseudo = cleanPseudo(data?.pseudo);

        let maxPlayers = Number(data?.maxPlayers) || 8;

        maxPlayers = Math.max(2, Math.min(maxPlayers, 16));

        const isPrivate = Boolean(data?.private);
        const isHidden = Boolean(data?.hidden);

        const roomId = generateRoomId();
        const accessCode = generateCode();

        const room = {
            id: roomId,
            name,
            maxPlayers,
            private: isPrivate,
            hidden: isHidden,

            code: accessCode,

            owner: socket.id,

            players: new Map()
        };

        room.players.set(socket.id, {
            id: socket.id,
            pseudo,
            x: 500,
            y: 400,
            angle: 0,
            bodyAngle: 0
        });

        rooms.set(roomId, room);

        socket.join(roomId);

        socket.data.roomId = roomId;
        socket.data.pseudo = pseudo;

        socket.emit("room-created", {
            room: publicRoomInfo(room),
            code: accessCode,
            hidden: isHidden
        });

        socket.emit("room-state", {
            room: publicRoomInfo(room),
            players: roomPlayerList(room)
        });

        broadcastRooms();
    });

    socket.on("join-room", data => {

        const roomId = String(data?.roomId || "").trim().toUpperCase();
        const code = String(data?.code || "").trim().toUpperCase();
        const pseudo = cleanPseudo(data?.pseudo);

        const room = rooms.get(roomId);

        if (!room) {
            socket.emit("room-error", "Ce serveur n'existe plus.");
            return;
        }

        if (room.players.size >= room.maxPlayers) {
            socket.emit("room-error", "Ce serveur est complet.");
            return;
        }

        if (room.private || room.hidden) {

            if (!code || code !== room.code) {
                socket.emit("room-error", "Code privé incorrect.");
                return;
            }
        }

        room.players.set(socket.id, {
            id: socket.id,
            pseudo,
            x: 300 + Math.random() * 500,
            y: 250 + Math.random() * 300,
            angle: 0,
            bodyAngle: 0
        });

        socket.join(roomId);

        socket.data.roomId = roomId;
        socket.data.pseudo = pseudo;

        socket.emit("room-joined", {
            room: publicRoomInfo(room),
            owner: room.owner === socket.id
        });

        io.to(roomId).emit("room-state", {
            room: publicRoomInfo(room),
            players: roomPlayerList(room)
        });

        broadcastRooms();
    });

    socket.on("leave-room", () => {
        leaveRoom(socket);
    });

    socket.on("player-update", data => {

        const roomId = socket.data.roomId;

        if (!roomId) return;

        const room = rooms.get(roomId);

        if (!room) return;

        const player = room.players.get(socket.id);

        if (!player) return;

        if (typeof data.x === "number") player.x = data.x;
        if (typeof data.y === "number") player.y = data.y;
        if (typeof data.angle === "number") player.angle = data.angle;
        if (typeof data.bodyAngle === "number") {
            player.bodyAngle = data.bodyAngle;
        }

        socket.to(roomId).emit("player-update", {
            id: socket.id,
            x: player.x,
            y: player.y,
            angle: player.angle,
            bodyAngle: player.bodyAngle
        });
    });

    socket.on("player-shot", data => {

        const roomId = socket.data.roomId;

        if (!roomId) return;

        socket.to(roomId).emit("player-shot", {
            id: socket.id,
            x: Number(data?.x) || 0,
            y: Number(data?.y) || 0,
            angle: Number(data?.angle) || 0
        });
    });

    socket.on("disconnect", () => {

        console.log("Joueur déconnecté :", socket.id);

        leaveRoom(socket);
    });
});

function leaveRoom(socket) {

    const roomId = socket.data.roomId;

    if (!roomId) return;

    const room = rooms.get(roomId);

    if (!room) return;

    room.players.delete(socket.id);

    socket.leave(roomId);

    if (room.owner === socket.id) {

        if (room.players.size > 0) {

            const nextPlayer = room.players.keys().next().value;

            room.owner = nextPlayer;

            io.to(roomId).emit("owner-changed", {
                owner: nextPlayer
            });

        } else {

            rooms.delete(roomId);
        }

    } else if (room.players.size === 0) {

        rooms.delete(roomId);
    }

    socket.data.roomId = null;

    if (rooms.has(roomId)) {

        io.to(roomId).emit("room-state", {
            room: publicRoomInfo(room),
            players: roomPlayerList(room)
        });
    }

    broadcastRooms();
}

app.get("/api/rooms", (req, res) => {
    res.json(visibleRooms());
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => {
    console.log(`🚀 Stellar Game lancé sur le port ${PORT}`);
});