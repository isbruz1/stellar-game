const socket = io();

// Éléments du DOM
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const roomContainer = document.getElementById('room-container');
const playersList = document.getElementById('players-list');
const readyBtn = document.getElementById('ready-btn');
const waitingMsg = document.getElementById('waiting-msg');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let isReady = false;
let gameStarted = false;
let allPlayers = {};

// 1. Rejoindre le salon
joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username === '') {
        alert("Veuillez entrer un pseudo valide !");
        return;
    }

    // Envoyer le pseudo au serveur
    socket.emit('join-lobby', username);

    // Masquer le champ pseudo et afficher la salle d'attente
    usernameInput.style.display = 'none';
    joinBtn.style.display = 'none';
    roomContainer.style.display = 'block';
});

// 2. Cliquer sur le bouton Prêt / Pas prêt
readyBtn.addEventListener('click', () => {
    socket.emit('toggle-ready');
});

// 3. Mettre à jour l'affichage du salon en temps réel
socket.on('update-lobby', (players) => {
    allPlayers = players;
    playersList.innerHTML = '';

    let totalPlayers = 0;
    let allReady = true;

    // Trouver notre propre état
    if (players[socket.id]) {
        isReady = players[socket.id].ready;
        if (isReady) {
            readyBtn.textContent = "Je suis Prêt !";
            readyBtn.className = "btn is-ready";
        } else {
            readyBtn.textContent = "Je ne suis pas prêt";
            readyBtn.className = "btn not-ready";
        }
    }

    // Remplir la liste des joueurs
    for (let id in players) {
        let p = players[id];
        totalPlayers++;

        let li = document.createElement('li');
        let statusBadge = p.ready 
            ? '<span style="color: #22c55e; font-weight: bold;">🟢 Prêt</span>' 
            : '<span style="color: #ef4444; font-weight: bold;">🔴 Pas prêt</span>';

        li.innerHTML = `<span>${p.username} ${id === socket.id ? '(toi)' : ''}</span> ${statusBadge}`;
        playersList.appendChild(li);

        if (!p.ready) {
            allReady = false;
        }
    }

    // Si tout le monde est prêt et qu'il y a au moins 1 joueur (ou 2 selon tes préférences)
    if (totalPlayers > 0 && allReady) {
        waitingMsg.textContent = "Tous les joueurs sont prêts ! Lancement imminent...";
        
        // Lancer le jeu après une courte pause de 1 seconde
        setTimeout(() => {
            if (!gameStarted) {
                startGame();
            }
        }, 1000);
    } else {
        waitingMsg.textContent = "En attente que tout le monde soit prêt...";
    }
});

// 4. Fonction pour basculer vers l'écran de jeu
function startGame() {
    gameStarted = true;
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';

    // Démarrer la boucle de rendu du jeu
    requestAnimationFrame(gameLoop);
}

// 5. Boucle principale du jeu (Render basique pour l'instant)
function gameLoop() {
    // Nettoyer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dessiner un fond de grille / espace
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Afficher les joueurs connectés
    for (let id in allPlayers) {
        let p = allPlayers[id];
        ctx.fillStyle = (id === socket.id) ? "#38bdf8" : "#f43f5e";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        // Afficher le pseudo au-dessus du joueur
        ctx.fillStyle = "#ffffff";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.username, p.x, p.y - 28);
    }

    requestAnimationFrame(gameLoop);
}