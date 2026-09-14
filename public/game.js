// Connexion au serveur via Socket.io
const socket = io();

const serverStatus = document.getElementById('server-status');
const statusText = document.getElementById('status-text');
const startBtn = document.getElementById('start-btn');
const settingsBtn = document.getElementById('settings-btn');

// Gestion des indicateurs de connexion en temps réel
socket.on('connect', () => {
    console.log("Connecté au serveur avec l'ID :", socket.id);
    serverStatus.className = "status-online";
    statusText.textContent = "Serveur en ligne (Connecté)";
});

socket.on('disconnect', () => {
    console.log("Déconnecté du serveur");
    serverStatus.className = "status-offline";
    statusText.textContent = "Serveur déconnecté - Reconnexion...";
});

// Événement du bouton Jouer (Prêt pour brancher le salon / la suite)
startBtn.addEventListener('click', () => {
    alert("Transition vers le salon / sélection des pseudos... (Prochaine étape)");
});

// Événement du bouton Paramètres (Réservé pour plus tard)
settingsBtn.addEventListener('click', () => {
    alert("Les paramètres du jeu seront bientôt disponibles !");
});