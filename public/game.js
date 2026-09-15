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
    width: 100,
    height: 100
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
    if (e.button === 0) {
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

    // --- VISÉE SOURIS ---
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

    // --- UTILISATION DES SPRITES PRÉ-DESSINÉS DU CERCLE (8 DIRECTIONS) ---
    if (tankImage.complete) {
        ctx.save();
        ctx.translate(tank.x, tank.y);

        // Calculer l'angle en degrés (0 à 360) par rapport à la souris
        let deg = (tank.angle * 180 / Math.PI + 360) % 360;

        // Découper le cercle en 8 tranches de 45° pour sélectionner l'index du mini-tank (0 à 7)
        let frameIndex = Math.floor((deg + 22.5) / 45) % 8;

        // Définition des coordonnées des 8 mini-tanks du cercle dans ton image source
        // (Ces valeurs ciblent directement la zone de droite où se trouvent les mini-tanks en cercle)
        // Note : Si ton image fait par exemple 1000x1000, ces proportions s'adaptent, ou tu pourras affiner selon les pixels exacts.
        const totalW = tankImage.width;
        const totalH = tankImage.height;

        // Coordonnées approximatives du cercle des 8 tanks situés sur la moitié droite de l'image
        // On définit le centre du cercle des mini-tanks et leur taille
        const wheelCenterX = totalW * 0.75;
        const wheelCenterY = totalH * 0.5;
        const radiusOffset = totalW * 0.18; // Éloignement par rapport au centre du cercle

        // Angles de chaque position dans le cercle source (en radians)
        const sourceAngles = [
            -Math.PI / 2,           // 0: Haut (12h)
            -Math.PI / 4,           // 1: Haut-Droite (1h30)
            0,                      // 2: Droite (3h)
            Math.PI / 4,            // 3: Bas-Droite (4h30)
            Math.PI / 2,            // 4: Bas (6h)
            3 * Math.PI / 4,        // 5: Bas-Gauche (7h30)
            Math.PI,                // 6: Gauche (9h)
            -3 * Math.PI / 4        // 7: Haut-Gauche (10h30)
        ];

        const targetAngle = sourceAngles[frameIndex];
        
        // Taille d'un mini-tank dans la grille de droite (environ 18% de la largeur totale)
        const miniTankSize = totalW * 0.18; 
        const srcX = wheelCenterX + Math.cos(targetAngle) * radiusOffset - miniTankSize / 2;
        const srcY = wheelCenterY + Math.sin(targetAngle) * radiusOffset - miniTankSize / 2;

        // Dessiner le mini-tank correspondant à la direction de la souris sur le joueur
        ctx.drawImage(
            tankImage, 
            srcX, srcY, miniTankSize, miniTankSize, 
            -tank.width / 2, -tank.height / 2, tank.width, tank.height
        );

        ctx.restore();
    }

    requestAnimationFrame(gameLoop);
}