const socket = io();

const serverStatus = document.getElementById('server-status');
const statusText = document.getElementById('status-text');
const startBtn = document.getElementById('start-btn');
const settingsBtn = document.getElementById('settings-btn');

const introOverlay = document.getElementById('intro-overlay');
const introLogo = document.getElementById('intro-logo');
const typedWelcomeText = document.getElementById('typed-welcome-text');
const splashScreen = document.getElementById('splash-screen');

// Script de la cinématique d'introduction au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
    const fullText = "Merci d'avoir rejoint mon jeu ! 🚀";
    let charIndex = 0;

    // 1. Attendre 1 seconde sur fond noir, puis faire apparaître l'icône
    setTimeout(() => {
        introLogo.classList.add('show');
        
        // 2. Commencer à taper le texte automatiquement après l'apparition du logo
        setTimeout(() => {
            typeWriterEffect(fullText, charIndex);
        }, 800);

    }, 1000);

    function typeWriterEffect(text, index) {
        if (index < text.length) {
            typedWelcomeText.textContent += text.charAt(index);
            setTimeout(() => {
                typeWriterEffect(text, index + 1);
            }, 50); // Vitesse d'écriture de chaque lettre
        } else {
            // 3. Une fois le texte fini, attendre 1.5 secondes puis masquer l'intro et afficher le menu
            setTimeout(() => {
                introOverlay.style.opacity = '0';
                setTimeout(() => {
                    introOverlay.style.display = 'none';
                    splashScreen.style.opacity = '1';
                    splashScreen.style.pointerEvents = 'auto';
                }, 800); // Temps du fondu de sortie
            }, 1500);
        }
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
    alert("Transition vers le salon / sélection des pseudos... (Prochaine étape)");
});

// Bouton Paramètres
settingsBtn.addEventListener('click', () => {
    alert("Les paramètres du jeu seront bientôt disponibles !");
});