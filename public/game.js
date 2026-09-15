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
    turretAngle: 0,   // Angle de la tourelle (vers la souris)
    bodyAngle: 0,     // Angle du corps (direction ZQSD)
    width: 100,
    height: 100
};

// Tableau pour stocker tous les projectiles tirés
const bullets = [];

// Charger l'image du tank
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

// Tirer un projectile au clic gauche de la souris
window.addEventListener('mousedown', (e) => {
    if (!gameStarted) return;
    if (e.button === 0) { // Clic gauche
        // Calculer la vitesse du projectile selon l'angle de la tourelle
        const bulletSpeed = 10;
        bullets.push({
            x: tank.x,
            y: tank.y,
            vx: Math.cos(tank.turretAngle) * bulletSpeed,
            vy: Math.sin(tank.turretAngle) * bulletSpeed,
            radius: 5
        });
    }
});

// 1. Script de la cinématique d'introduction au chargement
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

// 2. Validation du pseudo
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
    if (e.key === 'Enter') handleLogin();
});

// Connexion Socket.io
socket.on('connect', () => {
    serverStatus.className = "status-online";
    statusText.textContent = "Serveur en ligne (Connecté)";
});

socket.on('disconnect', () => {
    serverStatus.className = "status-offline";
    statusText.textContent = "Serveur déconnecté - Reconnexion...";
});

// Bouton Jouer
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

settingsBtn.addEventListener('click', () => {
    alert("Les paramètres du jeu seront bientôt disponibles !");
});

// 3. Boucle principale du jeu (60 FPS)
function gameLoop() {
    if (!gameStarted) return;

    // --- MOUVEMENTS DU TANK & ORIENTATION DU CORPS ---
    let moving = false;
    let targetBodyAngle = tank.bodyAngle;

    if (keys['z'] || keys['arrowup']) { 
        tank.y -= tank.speed; 
        moving = true; 
        targetBodyAngle = -Math.PI / 2; // Vers le haut
    }
    if (keys['s'] || keys['arrowdown']) { 
        tank.y += tank.speed; 
        moving = true; 
        targetBodyAngle = Math.PI / 2;  // Vers le bas
    }
    if (keys['q'] || keys['arrowleft']) { 
        tank.x -= tank.speed; 
        moving = true; 
        targetBodyAngle = Math.PI;      // Vers la gauche
    }
    if (keys['d'] || keys['arrowright']) { 
        tank.x += tank.speed; 
        moving = true; 
        targetBodyAngle = 0;            // Vers la droite
    }

    // Gestion propre des diagonales
    if ((keys['z'] || keys['arrowup']) && (keys['d'] || keys['arrowright'])) targetBodyAngle = -Math.PI / 4;
    if ((keys['z'] || keys['arrowup']) && (keys['q'] || keys['arrowleft'])) targetBodyAngle = -3 * Math.PI / 4;
    if ((keys['s'] || keys['arrowdown']) && (keys['d'] || keys['arrowright'])) targetBodyAngle = Math.PI / 4;
    if ((keys['s'] || keys['arrowdown']) && (keys['q'] || keys['arrowleft'])) targetBodyAngle = 3 * Math.PI / 4;

    if (moving) {
        tank.bodyAngle = targetBodyAngle;
    }

    // --- ORIENTATION DE LA TOURELLE VERS LA SOURIS ---
    const dx = mouseX - tank.x;
    const dy = mouseY - tank.y;
    tank.turretAngle = Math.atan2(dy, dx);

    // --- MISE A JOUR DES PROJECTICLES ---
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].x += bullets[i].vx;
        bullets[i].y += bullets[i].vy;

        // Supprimer le projectile s'il sort de l'écran
        if (bullets[i].x < 0 || bullets[i].x > canvas.width || bullets[i].y < 0 || bullets[i].y > canvas.height) {
            bullets.splice(i, 1);
        }
    }

    // --- RENDU GRAPHIQUE ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dessiner les projectiles
    ctx.fillStyle = '#38bdf8';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#38bdf8';
    for (let b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0; // Réinitialiser l'effet lumineux pour la suite

    // Dessiner le Tank du joueur
    ctx.save();
    ctx.translate(tank.x, tank.y);
    
    // Rotation du corps du tank selon sa direction de mouvement
    ctx.rotate(tank.bodyAngle);

    if (tankImage.complete) {
        // Affichage de l'image principale du tank centrée
        ctx.drawImage(
            tankImage, 
            0, 0, tankImage.width / 2, tankImage.height, 
            -tank.width / 2, -tank.height / 2, tank.width, tank.height
        );
    }
    ctx.restore();

    // Boucler l'animation
    requestAnimationFrame(gameLoop);
}