const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let players = {};

io.on('connection', (socket) => {
    console.log(`Un utilisateur s'est connecté : ${socket.id}`);

    socket.on('join-lobby', (username) => {
        players[socket.id] = {
            id: socket.id,
            username: username || `Joueur_${socket.id.substr(0, 4)}`,
            ready: false,
            x: Math.floor(Math.random() * 600) + 50,
            y: Math.floor(Math.random() * 400) + 50
        };
        io.emit('update-lobby', players);
    });

    socket.on('toggle-ready', () => {
        if (players[socket.id]) {
            players[socket.id].ready = !players[socket.id].ready;
            io.emit('update-lobby', players);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Utilisateur déconnecté : ${socket.id}`);
        delete players[socket.id];
        io.emit('update-lobby', players);
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});