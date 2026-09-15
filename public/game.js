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
    angle: 0,     // Angle vers la souris
    width: 110,
    height: 110
};

// Tableau des projectiles
const bullets = [];

// Charger l'image complète du tank (sprite sheet)
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

// Tirer un projectile au clic gauche
window.addEventListener('mousedown', (e) => {
    if (!gameStarted) return;
    if (e.button === 0) { // Clic gauche
        const bulletSpeed = 12;
        bullets.push({
            x: tank.x + Math.cos(tank.angle) * 35,
            y: tank.y + Math.sin(tank.angle) * 35,
            vx: Math.cos(tank.angle) * bulletSpeed,
            vy: Math.sin(tank.angle) * bulletSpeed,
            angle: tank.angle
        });
    }
});

// 1. Cinématique d'introduction
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

// 2. Connexion / Pseudo
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

socket.on('connect', () => {
    serverStatus.className = "status-online";
    statusText.textContent = "Serveur en ligne (Connecté)";
});

socket.on('disconnect', () => {
    serverStatus.className = "status-offline";
    statusText.textContent = "Serveur déconnecté - Reconnexion...";
});

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

    // --- MOUVEMENTS ZQSD ---
    if (keys['z'] || keys['arrowup']) tank.y -= tank.speed;
    if (keys['s'] || keys['arrowdown']) tank.y += tank.speed;
    if (keys['q'] || keys['arrowleft']) tank.x -= tank.speed;
    if (keys['d'] || keys['arrowright']) tank.x += tank.speed;

    // --- VISÉE SOURIS (L'angle suit parfaitement le curseur) ---
    const dx = mouseX - tank.x;
    const dy = mouseY - tank.y;
    tank.angle = Math.atan2(dy, dx);

    // --- MISE A JOUR DES PROJECTILES ---
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].x += bullets[i].vx;
        bullets[i].y += bullets[i].vy;

        if (bullets[i].x < 0 || bullets[i].x > canvas.width || bullets[i].y < 0 || bullets[i].y > canvas.height) {
            bullets.splice(i, 1);
        }
    }

    // --- RENDU GRAPHIQUE ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dessiner les projectiles énergétiques
    for (let b of bullets) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        
        ctx.fillStyle = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#38bdf8';
        ctx.fillRect(-12, -4, 24, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-4, -2, 8, 4);
        
        ctx.restore();
    }

    // --- DESSINER LE TANK PRINCIPAL SANS BOGUE NI TRUC EN TROP ---
    ctx.save();
    ctx.translate(tank.x, tank.y);
    
    // Fait pivoter le tank pour pointer exactement vers la souris
    ctx.rotate(tank.angle + Math.PI / 2); // Ajustement de l'axe de l'image

    if (tankImage.complete) {
        // Recadrage strict sur le grand tank de gauche uniquement (on évite les petits sprites de la roue)
        // Ajuste 'tankImage.width * 0.48' si nécessaire pour couper pile avant la roue
        const srcX = 0;
        const srcY = 0;
        const srcWidth = tankImage.width * 0.47; 
        const srcHeight = tankImage.height;

        ctx.drawImage(
            tankImage, 
            srcX, srcY, srcWidth, srcHeight, 
            -tank.width / 2, -tank.height / 2, tank.width, tank.height
        );
    }
    ctx.restore();

    requestAnimationFrame(gameLoop);
}