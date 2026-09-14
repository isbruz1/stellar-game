const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir les fichiers statiques depuis le dossier 'public'
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gestion des connexions en temps réel
io.on('connection', (socket) => {
    console.log(`Connexion établie avec le client : ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`Déconnexion du client : ${socket.id}`);
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Serveur opérationnel sur le port ${PORT}`);
});