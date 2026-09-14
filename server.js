const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir les fichiers statiques (HTML, CSS, JS) depuis le dossier racine ou 'public'
app.use(express.static(__dirname));

// Liste des joueurs connectés au salon
let players = {};

io.on('connection', (socket) => {
    console.log(`Un utilisateur s'est connecté : ${socket.id}`);

    // Le joueur rejoint le salon avec un pseudo
    socket.on('join-lobby', (username) => {
        players[socket.id] = {
            id: socket.id,
            username: username || `Joueur_${socket.id.substr(0, 4)}`,
            ready: false,
            x: Math.floor(Math.random() * 600) + 50,
            y: Math.floor(Math.random() * 400) + 50
        };
        // Diffuser la nouvelle liste à tout le monde
        io.emit('update-lobby', players);
    });

    // Le joueur clique sur le bouton Prêt / Pas prêt
    socket.on('toggle-ready', () => {
        if (players[socket.id]) {
            players[socket.id].ready = !players[socket.id].ready;
            io.emit('update-lobby', players);
        }
    });

    // Gestion des mouvements en jeu (optionnel de base, prêt pour ton jeu)
    socket.on('player-move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            io.emit('players-update', players);
        }
    });

    // Déconnexion d'un joueur
    socket.on('disconnect', () => {
        console.log(`Utilisateur déconnecté : ${socket.id}`);
        delete players[socket.id];
        io.emit('update-lobby', players);
        io.emit('players-update', players);
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});