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
            bullets[i] = null;
        }
    }
    // Nettoyage du tableau des bullets nulles
    for (let i = bullets.length - 1; i >= 0; i--) {
        if (!bullets[i]) bullets.splice(i, 1);
    }

    // --- RENDU GRAPHIQUE ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dessiner les projectiles
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

    // --- DESSINER LE TANK UTILISANT LES SPRITES DU CERCLE DE ROTATION ---
    if (tankImage.complete) {
        ctx.save();
        ctx.translate(tank.x, tank.y);

        // Convertir l'angle en degrés (0 à 360)
        let degrees = (tank.angle * 180 / Math.PI + 360) % 360;
        
        // Découper l'angle en 8 directions correspondant aux 8 mini-tanks du cercle de droite
        // 0 = Haut, 1 = Haut-Droite, 2 = Droite, 3 = Bas-Droite, 4 = Bas, 5 = Bas-Gauche, 6 = Gauche, 7 = Haut-Gauche
        let indexDir = Math.round(degrees / 45) % 8;

        // Coordonnées approximatives des mini-tanks dans le cercle de ton image (à adapter selon les proportions exactes de ton image source)
        // Les dimensions globales de l'image source
        const imgW = tankImage.width;
        const imgH = tankImage.height;

        // Position du cercle de droite (exemple basé sur ton image : les mini-tanks sont dans la moitié droite)
        // On découpe la grille des mini-tanks du cercle de droite selon l'indexDir
        // Note: Tu peux soit utiliser le grand tank de gauche et faire une rotation classique, 
        // soit mapper précisément les coordonnées de chaque mini-tank du cercle de droite.
        
        // Alternative plus simple et ultra fluide : 
        // On utilise le gros tank de gauche (qui est bien dessiné de face) et on fait pivoter *uniquement* 
        // l'image source du gros tank par rapport à son axe de tourelle, ou on utilise le cercle.
        
        // Ici, affichons le gros tank de gauche de manière fixe ou en rotation propre sans le "truc en trop" :
        const srcX = 0;
        const srcY = 0;
        const srcWidth = imgW * 0.46; // Coupe avant la roue de droite
        const srcHeight = imgH;

        // Rotation propre centrée sur le tank
        ctx.rotate(tank.angle + Math.PI / 2);
        ctx.drawImage(
            tankImage, 
            srcX, srcY, srcWidth, srcHeight, 
            -tank.width / 2, -tank.height / 2, tank.width, tank.height
        );

        ctx.restore();
    }

    requestAnimationFrame(gameLoop);
}