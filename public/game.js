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

let playerPseudo = "";

// 1. Script de la cinématique d'introduction au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
    const fullText = "Merci d'avoir rejoint mon jeu ! 🚀";
    let charIndex = 0;

    // Attendre 1 seconde sur fond noir, puis faire apparaître l'icône
    setTimeout(() => {
        introLogo.classList.add('show');
        
        // Commencer à taper le texte automatiquement après l'apparition du logo
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
            // Une fois le texte fini, attendre 1.5s puis masquer l'intro et afficher l'écran de login (pseudo)
            setTimeout(() => {
                introOverlay.style.opacity = '0';
                setTimeout(() => {
                    introOverlay.style.display = 'none';
                    
                    // Affichage de l'écran de login pseudo
                    loginScreen.style.display = 'block';
                    setTimeout(() => {
                        loginScreen.style.opacity = '1';
                        usernameInput.focus(); // Focus automatique sur l'input
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
    console.log("Pseudo enregistré :", playerPseudo);

    // Masquer l'écran de login
    loginScreen.style.opacity = '0';
    setTimeout(() => {
        loginScreen.style.display = 'none';

        // Afficher l'animation de salutation personnalisée
        animatedGreeting.textContent = `Bonjour, ${playerPseudo} ! 🚀`;
        welcomeMessageOverlay.style.display = 'flex';

        // Après 2.5 secondes, masquer le message de salutation et afficher le menu principal
        setTimeout(() => {
            welcomeMessageOverlay.style.opacity = '0';
            setTimeout(() => {
                welcomeMessageOverlay.style.display = 'none';

                // Afficher le menu principal du jeu
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

// Bouton Jouer
startBtn.addEventListener('click', () => {
    alert(`Bienvenue dans le salon, ${playerPseudo} ! Lancement de la partie...`);
});

// Bouton Paramètres
settingsBtn.addEventListener('click', () => {
    alert("Les paramètres du jeu seront bientôt disponibles !");
});