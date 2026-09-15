const socket = io();

const serverStatus = document.getElementById('server-status');
const statusText = document.getElementById('status-text');
const startBtn = document.getElementById('start-btn');
const settingsBtn = document.getElementById('settings-btn');

// Éléments des écrans
const introOverlay = document.getElementById('intro-overlay');
const introLogo = document.getElementById('intro-logo');
const typedWelcomeText = document.getElementById('typed-welcome-text');

const loginScreen = document.getElementById('login-screen');
const usernameInput = document.getElementById('username-input');
const validateBtn = document.getElementById('validate-btn');

const welcomeMessageOverlay = document.getElementById('welcome-message-overlay');
const animatedGreeting = document.getElementById('animated-greeting');

const splashScreen = document.getElementById('splash-screen');
const gameContainer = document.getElementById('game-container');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let playerPseudo = "";
let gameStarted = false;

// Objet Tank du joueur
const tank = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    speed: 4,
    angle: 0,
    bodyAngle: 0,
    width: 120,
    height: 120
};

// Charger l'image du tank 2D
const tankImage = new Image();
tankImage.src = 'assets/Gemini_Generated_Image_7sx5q27sx5q27sx5-removebg-preview.png';

const keys = {};
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

let mouseX = 0;
let mouseY = 0;
window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

// 1. Script de la cinématique d'introduction au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
    const fullText = "Merci d'avoir rejoint mon jeu ! 🚀";
    let charIndex = 0;

    setTimeout(() => {
        introLogo.classList.add('show');
        setTimeout(() => {
            typeWriterEffect(fullText, charIndex);
        }, 800);
    }, 1000);

    function typeWriterEffect(text, index) {
        if (index < text.length) {
            typedWelcomeText.textContent += text.charAt(index);
            setTimeout(() => {
                typeWriterEffect(text, index + 1);
            }, 50);
        } else {
            setTimeout(() => {
                introOverlay.style.opacity = '0';
                setTimeout(() => {
                    introOverlay.style.display = 'none';
                    loginScreen.style.display = 'block';
                    setTimeout(() => {
                        loginScreen.style.opacity = '1';
                        usernameInput.focus();
                    }, 50);
                }, 800);
            }, 1500);
        }
    }
});

// 2. Gestion de la validation du pseudo
function handleLogin() {
    const pseudo = usernameInput.value.trim();
    if (pseudo === "") {
        alert("Veuillez entrer un pseudo valide !");
        usernameInput.focus();
        return;
    }

    playerPseudo = pseudo;

    loginScreen.style.opacity = '0';
    setTimeout(() => {
        loginScreen.style.display = 'none';

        animatedGreeting.textContent = `Bonjour, ${playerPseudo} ! 🚀`;
        welcomeMessageOverlay.style.display = 'flex';

        setTimeout(() => {
            welcomeMessageOverlay.style.opacity = '0';
            setTimeout(() => {
                welcomeMessageOverlay.style.display = 'none';

                splashScreen.style.display = 'block';
                setTimeout(() => {
                    splashScreen.style.opacity = '1';
                }, 50);
            }, 800);
        }, 2500);
    }, 800);
}

validateBtn.addEventListener('click', handleLogin);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleLogin();
    }
});

// Gestion des connexions Socket.io
socket.on('connect', () => {
    serverStatus.className = "status-online";
    statusText.textContent = "Serveur en ligne (Connecté)";
});

socket.on('disconnect', () => {
    serverStatus.className = "status-offline";
    statusText.textContent = "Serveur déconnecté - Reconnexion...";
});

// Bouton Jouer : Masque le menu et lance la boucle du jeu
startBtn.addEventListener('click', () => {
    splashScreen.style.opacity = '0';
    setTimeout(() => {
        splashScreen.style.display = 'none';
        gameContainer.style.display = 'block';
        resizeCanvas();
        gameStarted = true;
        gameLoop();
    }, 800);
});

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

// Bouton Paramètres
settingsBtn.addEventListener('click', () => {
    alert("Les paramètres du jeu seront bientôt disponibles !");
});

// 3. Boucle principale du jeu (60 FPS)
function gameLoop() {
    if (!gameStarted) return;

    let moving = false;
    let moveAngle = tank.bodyAngle;

    if (keys['z'] || keys['arrowup']) { tank.y -= tank.speed; moving = true; moveAngle = -Math.PI / 2; }
    if (keys['s'] || keys['arrowdown']) { tank.y += tank.speed; moving = true; moveAngle = Math.PI / 2; }
    if (keys['q'] || keys['arrowleft']) { tank.x -= tank.speed; moving = true; moveAngle = Math.PI; }
    if (keys['d'] || keys['arrowright']) { tank.x += tank.speed; moving = true; moveAngle = 0; }

    if ((keys['z'] || keys['arrowup']) && (keys['d'] || keys['arrowright'])) moveAngle = -Math.PI / 4;
    if ((keys['z'] || keys['arrowup']) && (keys['q'] || keys['arrowleft'])) moveAngle = -3 * Math.PI / 4;
    if ((keys['s'] || keys['arrowdown']) && (keys['d'] || keys['arrowright'])) moveAngle = Math.PI / 4;
    if ((keys['s'] || keys['arrowdown']) && (keys['q'] || keys['arrowleft'])) moveAngle = 3 * Math.PI / 4;

    if (moving) {
        tank.bodyAngle = moveAngle;
    }

    const dx = mouseX - tank.x;
    const dy = mouseY - tank.y;
    tank.angle = Math.atan2(dy, dx);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.angle);

    if (tankImage.complete) {
        ctx.drawImage(
            tankImage, 
            0, 0, tankImage.width / 2, tankImage.height, 
            -tank.width / 2, -tank.height / 2, tank.width, tank.height
        );
    }

    ctx.restore();

    requestAnimationFrame(gameLoop);
}