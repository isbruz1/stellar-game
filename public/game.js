const socket = io();

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
let pulseEffect = 0;

joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username === '') {
        alert("Veuillez entrer un pseudo valide !");
        return;
    }

    socket.emit('join-lobby', username);

    usernameInput.style.display = 'none';
    joinBtn.style.display = 'none';
    roomContainer.style.display = 'block';
});

readyBtn.addEventListener('click', () => {
    socket.emit('toggle-ready');
});

socket.on('update-lobby', (players) => {
    allPlayers = players;
    playersList.innerHTML = '';

    let totalPlayers = 0;
    let allReady = true;

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

    if (totalPlayers > 0 && allReady) {
        waitingMsg.textContent = "Tous les joueurs sont prêts ! Lancement imminent...";
        
        setTimeout(() => {
            if (!gameStarted) {
                startGame();
            }
        }, 1000);
    } else {
        waitingMsg.textContent = "En attente que tout le monde soit prêt...";
    }
});

function startGame() {
    gameStarted = true;
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';

    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    pulseEffect += 0.05;
    let glowSize = 20 + Math.sin(pulseEffect) * 3;

    for (let id in allPlayers) {
        let p = allPlayers[id];
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = (id === socket.id) ? "#38bdf8" : "#f43f5e";

        ctx.fillStyle = (id === socket.id) ? "#38bdf8" : "#f43f5e";
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        ctx.shadowBlur = 0;

        ctx.fillStyle = "#ffffff";
        ctx.font = "14px 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.username, p.x, p.y - 32);
    }

    requestAnimationFrame(gameLoop);
}