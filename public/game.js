const socket = io();


// ======================================================
// DOM
// ======================================================

const introOverlay = document.getElementById("intro-overlay");
const typedWelcomeText = document.getElementById("typed-welcome-text");

const loginScreen = document.getElementById("login-screen");
const usernameInput = document.getElementById("username-input");
const validateBtn = document.getElementById("validate-btn");

const welcomeOverlay =
    document.getElementById("welcome-message-overlay");

const animatedGreeting =
    document.getElementById("animated-greeting");

const splashScreen =
    document.getElementById("splash-screen");

const lobbyScreen =
    document.getElementById("lobby-screen");

const waitingScreen =
    document.getElementById("waiting-screen");

const gameContainer =
    document.getElementById("game-container");

const startBtn =
    document.getElementById("start-btn");

const settingsBtn =
    document.getElementById("settings-btn");

const serverStatus =
    document.getElementById("server-status");

const statusText =
    document.getElementById("status-text");

const createRoomBtn =
    document.getElementById("create-room-btn");

const privateRoomBtn =
    document.getElementById("private-room-btn");

const refreshRoomsBtn =
    document.getElementById("refresh-rooms-btn");

const roomList =
    document.getElementById("room-list");

const serverCount =
    document.getElementById("server-count");

const backMenuBtn =
    document.getElementById("back-menu-btn");

const createRoomModal =
    document.getElementById("create-room-modal");

const privateRoomModal =
    document.getElementById("private-room-modal");

const roomCodeModal =
    document.getElementById("room-code-modal");

const settingsModal =
    document.getElementById("settings-modal");

const roomNameInput =
    document.getElementById("room-name-input");

const maxPlayersInput =
    document.getElementById("max-players-input");

const privateInput =
    document.getElementById("private-input");

const hiddenInput =
    document.getElementById("hidden-input");

const confirmCreateBtn =
    document.getElementById("confirm-create-btn");

const roomIdInput =
    document.getElementById("room-id-input");

const roomCodeInput =
    document.getElementById("room-code-input");

const confirmPrivateBtn =
    document.getElementById("confirm-private-btn");

const generatedCode =
    document.getElementById("generated-code");

const copyCodeBtn =
    document.getElementById("copy-code-btn");

const enterCreatedRoomBtn =
    document.getElementById("enter-created-room-btn");

const waitingRoomName =
    document.getElementById("waiting-room-name");

const waitingInfo =
    document.getElementById("waiting-info");

const waitingPlayers =
    document.getElementById("waiting-players");

const leaveRoomBtn =
    document.getElementById("leave-room-btn");

const launchGameBtn =
    document.getElementById("launch-game-btn");

const volumeSetting =
    document.getElementById("volume-setting");

const sensitivitySetting =
    document.getElementById("sensitivity-setting");

const fpsSetting =
    document.getElementById("fps-setting");

const particlesSetting =
    document.getElementById("particles-setting");

const closeSettingsBtn =
    document.getElementById("close-settings-btn");

const fullscreenBtn =
    document.getElementById("fullscreen-btn");

const exitGameBtn =
    document.getElementById("exit-game-btn");

const hudPseudo =
    document.getElementById("hud-pseudo");

const hudRoom =
    document.getElementById("hud-room");

const hudPlayers =
    document.getElementById("hud-players");

const fpsCounter =
    document.getElementById("fps-counter");

const canvas =
    document.getElementById("gameCanvas");

const ctx =
    canvas.getContext("2d");


// ======================================================
// STATE
// ======================================================

let playerPseudo = "";

let currentRoom = null;

let roomOwner = false;

let gameStarted = false;

let lastNetworkUpdate = 0;

let fps = 60;

let frameCounter = 0;

let fpsTimer = performance.now();

let generatedRoomCode = "";

const keys = {};

const remotePlayers = new Map();

const bullets = [];

const particles = [];

const explosions = [];


// ======================================================
// SETTINGS
// ======================================================

const settings = {
    volume: 0.7,
    sensitivity: 1,
    showFPS: true,
    particles: true
};

function loadSettings() {

    const saved =
        localStorage.getItem("stellar-settings");

    if (!saved) return;

    try {

        Object.assign(
            settings,
            JSON.parse(saved)
        );

    } catch {}
}

function saveSettings() {

    localStorage.setItem(
        "stellar-settings",
        JSON.stringify(settings)
    );
}

loadSettings();

volumeSetting.value =
    settings.volume * 100;

sensitivitySetting.value =
    settings.sensitivity * 100;

fpsSetting.checked =
    settings.showFPS;

particlesSetting.checked =
    settings.particles;


// ======================================================
// TANK
// ======================================================

const tankImage = new Image();

tankImage.src =
    "assets/Gemini_Generated_Image_7sx5q27sx5q27sx5-removebg-preview.png";

const tank = {

    x: 500,
    y: 400,

    vx: 0,
    vy: 0,

    acceleration: 0.65,

    friction: 0.88,

    maxSpeed: 6,

    angle: 0,

    bodyAngle: 0,

    width: 120,

    height: 120,

    recoil: 0,

    enginePulse: 0,

    bob: 0
};


// ======================================================
// CAMERA
// ======================================================

const camera = {

    x: 0,
    y: 0,

    shake: 0
};


// ======================================================
// MOUSE
// ======================================================

let mouseX = innerWidth / 2;

let mouseY = innerHeight / 2;

window.addEventListener("mousemove", e => {

    mouseX = e.clientX;

    mouseY = e.clientY;
});


// ======================================================
// KEYBOARD
// ======================================================

window.addEventListener("keydown", e => {

    keys[e.key.toLowerCase()] = true;

    if (
        ["z", "q", "s", "d", "arrowup",
        "arrowdown", "arrowleft",
        "arrowright", " "].includes(
            e.key.toLowerCase()
        )
    ) {
        e.preventDefault();
    }
});

window.addEventListener("keyup", e => {

    keys[e.key.toLowerCase()] = false;
});


// ======================================================
// SHOOT
// ======================================================

window.addEventListener("mousedown", e => {

    if (!gameStarted) return;

    if (e.button !== 0) return;

    shoot();
});

function shoot() {

    const speed = 14;

    const barrelLength = 55;

    const startX =
        tank.x +
        Math.cos(tank.angle) *
        barrelLength;

    const startY =
        tank.y +
        Math.sin(tank.angle) *
        barrelLength;

    bullets.push({

        x: startX,

        y: startY,

        vx:
            Math.cos(tank.angle) *
            speed,

        vy:
            Math.sin(tank.angle) *
            speed,

        angle: tank.angle,

        life: 0,

        maxLife: 100

    });

    tank.recoil = 14;

    camera.shake = 5;

    createMuzzleFlash(
        startX,
        startY,
        tank.angle
    );

    socket.emit("player-shot", {

        x: startX,

        y: startY,

        angle: tank.angle

    });
}


// ======================================================
// PARTICLES
// ======================================================

function createParticle(
    x,
    y,
    options = {}
) {

    if (!settings.particles) return;

    particles.push({

        x,

        y,

        vx:
            options.vx ??
            (Math.random() - .5) * 2,

        vy:
            options.vy ??
            (Math.random() - .5) * 2,

        life:
            options.life ??
            30,

        size:
            options.size ??
            2,

        maxLife:
            options.life ??
            30

    });
}

function createMuzzleFlash(x, y, angle) {

    for (let i = 0; i < 12; i++) {

        const a =
            angle +
            (Math.random() - .5) *
            0.8;

        createParticle(
            x,
            y,
            {
                vx: Math.cos(a) *
                    (3 + Math.random() * 5),

                vy: Math.sin(a) *
                    (3 + Math.random() * 5),

                life: 15 +
                    Math.random() * 15,

                size:
                    2 +
                    Math.random() * 4
            }
        );
    }
}

function createExplosion(x, y) {

    for (let i = 0; i < 28; i++) {

        const a =
            Math.random() *
            Math.PI *
            2;

        const speed =
            1 +
            Math.random() *
            5;

        createParticle(
            x,
            y,
            {
                vx:
                    Math.cos(a) *
                    speed,

                vy:
                    Math.sin(a) *
                    speed,

                life:
                    25 +
                    Math.random() *
                    35,

                size:
                    2 +
                    Math.random() *
                    5
            }
        );
    }

    explosions.push({

        x,

        y,

        life: 0,

        maxLife: 30

    });
}


// ======================================================
// BACKGROUND
// ======================================================

const stars = [];

for (let i = 0; i < 220; i++) {

    stars.push({

        x: Math.random() * 3000,

        y: Math.random() * 3000,

        size:
            Math.random() * 2 + .3,

        speed:
            Math.random() * .4 + .1,

        alpha:
            Math.random() * .8 + .2

    });
}

function drawSpace() {

    ctx.fillStyle = "#02050b";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const gradient =
        ctx.createRadialGradient(
            canvas.width / 2,
            canvas.height / 2,
            50,
            canvas.width / 2,
            canvas.height / 2,
            canvas.width
        );

    gradient.addColorStop(
        0,
        "#0b2037"
    );

    gradient.addColorStop(
        1,
        "#02050b"
    );

    ctx.fillStyle = gradient;

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    for (const star of stars) {

        const x =
            ((star.x - camera.x * star.speed)
                % 3000 + 3000) % 3000;

        const y =
            ((star.y - camera.y * star.speed)
                % 3000 + 3000) % 3000;

        const sx =
            x -
            1500 +
            canvas.width / 2;

        const sy =
            y -
            1500 +
            canvas.height / 2;

        ctx.globalAlpha =
            star.alpha;

        ctx.fillStyle = "#bde9ff";

        ctx.beginPath();

        ctx.arc(
            sx,
            sy,
            star.size,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.globalAlpha = 1;

    drawGrid();
}

function drawGrid() {

    const size = 100;

    ctx.save();

    ctx.globalAlpha = .08;

    ctx.strokeStyle = "#38bdf8";

    ctx.lineWidth = 1;

    const offsetX =
        (-camera.x) %
        size;

    const offsetY =
        (-camera.y) %
        size;

    for (
        let x = offsetX;
        x < canvas.width;
        x += size
    ) {

        ctx.beginPath();

        ctx.moveTo(x, 0);

        ctx.lineTo(x, canvas.height);

        ctx.stroke();
    }

    for (
        let y = offsetY;
        y < canvas.height;
        y += size
    ) {

        ctx.beginPath();

        ctx.moveTo(0, y);

        ctx.lineTo(canvas.width, y);

        ctx.stroke();
    }

    ctx.restore();
}


// ======================================================
// RESIZE
// ======================================================

function resizeCanvas() {

    canvas.width =
        window.innerWidth *
        devicePixelRatio;

    canvas.height =
        window.innerHeight *
        devicePixelRatio;

    canvas.style.width =
        window.innerWidth + "px";

    canvas.style.height =
        window.innerHeight + "px";

    ctx.setTransform(
        devicePixelRatio,
        0,
        0,
        devicePixelRatio,
        0,
        0
    );
}

window.addEventListener(
    "resize",
    resizeCanvas
);

resizeCanvas();


// ======================================================
// INTRO
// ======================================================

window.addEventListener(
    "DOMContentLoaded",
    () => {

        const text =
            "Bienvenue dans la galaxie, pilote.";

        let index = 0;

        function type() {

            if (index >= text.length) {

                setTimeout(() => {

                    introOverlay.style.opacity =
                        "0";

                    setTimeout(() => {

                        introOverlay.classList.add(
                            "hidden"
                        );

                        loginScreen.classList.remove(
                            "hidden"
                        );

                        usernameInput.focus();

                    }, 900);

                }, 1000);

                return;
            }

            typedWelcomeText.textContent +=
                text[index];

            index++;

            setTimeout(
                type,
                45
            );
        }

        setTimeout(
            type,
            1100
        );
    }
);


// ======================================================
// LOGIN
// ======================================================

function handleLogin() {

    const pseudo =
        usernameInput.value.trim();

    if (!pseudo) {

        usernameInput.focus();

        return;
    }

    playerPseudo =
        pseudo
            .replace(/[<>]/g, "")
            .slice(0, 16);

    loginScreen.classList.add(
        "hidden"
    );

    animatedGreeting.textContent =
        `Bonjour, ${playerPseudo} !`;

    welcomeOverlay.classList.remove(
        "hidden"
    );

    setTimeout(() => {

        welcomeOverlay.style.opacity =
            "0";

        setTimeout(() => {

            welcomeOverlay.classList.add(
                "hidden"
            );

            splashScreen.classList.remove(
                "hidden"
            );

        }, 700);

    }, 1800);
}

validateBtn.addEventListener(
    "click",
    handleLogin
);

usernameInput.addEventListener(
    "keydown",
    e => {

        if (e.key === "Enter") {
            handleLogin();
        }

    }
);


// ======================================================
// CONNECTION
// ======================================================

socket.on("connect", () => {

    serverStatus.classList.add(
        "status-online"
    );

    statusText.textContent =
        "Serveur connecté";

});

socket.on("disconnect", () => {

    serverStatus.classList.remove(
        "status-online"
    );

    statusText.textContent =
        "Serveur déconnecté...";

});


// ======================================================
// MENU → LOBBY
// ======================================================

startBtn.addEventListener(
    "click",
    () => {

        splashScreen.classList.add(
            "hidden"
        );

        lobbyScreen.classList.remove(
            "hidden"
        );

        socket.emit(
            "get-rooms"
        );
    }
);

backMenuBtn.addEventListener(
    "click",
    () => {

        lobbyScreen.classList.add(
            "hidden"
        );

        splashScreen.classList.remove(
            "hidden"
        );

    }
);


// ======================================================
// ROOMS
// ======================================================

socket.on(
    "room-list",
    rooms => {

        renderRooms(rooms);

    }
);

function renderRooms(rooms) {

    serverCount.textContent =
        `${rooms.length} serveur${rooms.length > 1 ? "s" : ""}`;

    if (!rooms.length) {

        roomList.innerHTML = `
            <div class="empty-rooms">
                <div>
                    <div style="font-size:40px">🌌</div>
                    <br>
                    Aucun serveur public disponible.<br>
                    Crée le premier !
                </div>
            </div>
        `;

        return;
    }

    roomList.innerHTML = "";

    rooms.forEach(room => {

        const full =
            room.players >= room.maxPlayers;

        const card =
            document.createElement("div");

        card.className =
            "room-card";

        card.innerHTML = `

            <div>

                <div class="room-name">
                    🟢 ${escapeHTML(room.name)}
                </div>

                <div class="room-id">
                    ID : ${escapeHTML(room.id)}
                </div>

            </div>

            <div class="room-players">
                ${room.players} / ${room.maxPlayers}
            </div>

            <button
                class="join-room-btn"
                ${full ? "disabled" : ""}
            >
                ${full ? "COMPLET" : "REJOINDRE"}
            </button>
        `;

        const button =
            card.querySelector(
                ".join-room-btn"
            );

        if (!full) {

            button.addEventListener(
                "click",
                () => {

                    joinRoom(
                        room.id,
                        ""
                    );

                }
            );

        }

        roomList.appendChild(
            card
        );
    });
}

refreshRoomsBtn.addEventListener(
    "click",
    () => {

        socket.emit(
            "get-rooms"
        );

    }
);


// ======================================================
// CREATE ROOM
// ======================================================

createRoomBtn.addEventListener(
    "click",
    () => {

        createRoomModal.classList.remove(
            "hidden"
        );

    }
);

confirmCreateBtn.addEventListener(
    "click",
    () => {

        socket.emit(
            "create-room",
            {

                name:
                    roomNameInput.value ||
                    "Galaxy Battle",

                maxPlayers:
                    Number(
                        maxPlayersInput.value
                    ),

                private:
                    privateInput.checked,

                hidden:
                    hiddenInput.checked,

                pseudo:
                    playerPseudo

            }
        );

    }
);

socket.on(
    "room-created",
    data => {

        currentRoom =
            data.room;

        generatedRoomCode =
            data.code;

        generatedCode.textContent =
            data.code;

        createRoomModal.classList.add(
            "hidden"
        );

        roomCodeModal.classList.remove(
            "hidden"
        );

    }
);

enterCreatedRoomBtn.addEventListener(
    "click",
    () => {

        roomCodeModal.classList.add(
            "hidden"
        );

        showWaitingRoom();

    }
);

copyCodeBtn.addEventListener(
    "click",
    async () => {

        try {

            await navigator.clipboard.writeText(
                generatedRoomCode
            );

            copyCodeBtn.textContent =
                "✓ COPIÉ";

            setTimeout(() => {

                copyCodeBtn.textContent =
                    "COPIER LE CODE";

            }, 1500);

        } catch {

            alert(
                "Code : " +
                generatedRoomCode
            );
        }

    }
);


// ======================================================
// PRIVATE ROOM
// ======================================================

privateRoomBtn.addEventListener(
    "click",
    () => {

        privateRoomModal.classList.remove(
            "hidden"
        );

    }
);

confirmPrivateBtn.addEventListener(
    "click",
    () => {

        const id =
            roomIdInput.value
                .trim();

        const code =
            roomCodeInput.value
                .trim();

        joinRoom(
            id,
            code
        );

    }
);

function joinRoom(id, code) {

    socket.emit(
        "join-room",
        {

            roomId: id,

            code,

            pseudo:
                playerPseudo

        }
    );
}

socket.on(
    "room-joined",
    data => {

        currentRoom =
            data.room;

        roomOwner =
            data.owner;

        privateRoomModal.classList.add(
            "hidden"
        );

        lobbyScreen.classList.add(
            "hidden"
        );

        showWaitingRoom();

    }
);

socket.on(
    "room-error",
    message => {

        alert(message);

    }
);


// ======================================================
// WAITING ROOM
// ======================================================

function showWaitingRoom() {

    waitingScreen.classList.remove(
        "hidden"
    );

    updateWaitingRoom();
}

socket.on(
    "room-state",
    data => {

        currentRoom =
            data.room;

        updateWaitingRoom(
            data.players
        );

    }
);

function updateWaitingRoom(players = []) {

    if (!currentRoom) return;

    waitingRoomName.textContent =
        currentRoom.name;

    waitingInfo.textContent =
        `${players.length} / ${currentRoom.maxPlayers} pilotes`;

    waitingPlayers.innerHTML = "";

    players.forEach(player => {

        const div =
            document.createElement("div");

        div.className =
            "player-card";

        if (player.id === socket.id) {

            div.classList.add(
                "owner"
            );

        }

        div.innerHTML = `
            🚀 ${escapeHTML(player.pseudo)}
            ${player.id === socket.id
                ? "<small> • TOI</small>"
                : ""}
        `;

        waitingPlayers.appendChild(
            div
        );

    });

    if (roomOwner) {

        launchGameBtn.classList.remove(
            "hidden"
        );

    }
}

launchGameBtn.addEventListener(
    "click",
    () => {

        startGame();

    }
);

leaveRoomBtn.addEventListener(
    "click",
    () => {

        socket.emit(
            "leave-room"
        );

        waitingScreen.classList.add(
            "hidden"
        );

        lobbyScreen.classList.remove(
            "hidden"
        );

        currentRoom = null;

        roomOwner = false;

        socket.emit(
            "get-rooms"
        );

    }
);


// ======================================================
// MODALS
// ======================================================

document
    .querySelectorAll("[data-close]")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const id =
                    button.dataset.close;

                document
                    .getElementById(id)
                    .classList.add(
                        "hidden"
                    );

            }
        );

    });


// ======================================================
// SETTINGS
// ======================================================

settingsBtn.addEventListener(
    "click",
    () => {

        settingsModal.classList.remove(
            "hidden"
        );

    }
);

closeSettingsBtn.addEventListener(
    "click",
    () => {

        settings.volume =
            Number(
                volumeSetting.value
            ) / 100;

        settings.sensitivity =
            Number(
                sensitivitySetting.value
            ) / 100;

        settings.showFPS =
            fpsSetting.checked;

        settings.particles =
            particlesSetting.checked;

        saveSettings();

        settingsModal.classList.add(
            "hidden"
        );

    }
);


// ======================================================
// START GAME
// ======================================================

function startGame() {

    waitingScreen.classList.add(
        "hidden"
    );

    gameContainer.classList.remove(
        "hidden"
    );

    gameStarted = true;

    hudPseudo.textContent =
        playerPseudo;

    hudRoom.textContent =
        currentRoom
            ? currentRoom.name
            : "STELLAR BATTLE";

    tank.x =
        500;

    tank.y =
        400;

    resizeCanvas();

    requestAnimationFrame(
        gameLoop
    );
}


// ======================================================
// EXIT GAME
// ======================================================

exitGameBtn.addEventListener(
    "click",
    () => {

        gameStarted = false;

        gameContainer.classList.add(
            "hidden"
        );

        lobbyScreen.classList.remove(
            "hidden"
        );

        socket.emit(
            "leave-room"
        );

    }
);

fullscreenBtn.addEventListener(
    "click",
    async () => {

        try {

            if (!document.fullscreenElement) {

                await document.documentElement
                    .requestFullscreen();

            } else {

                await document.exitFullscreen();

            }

        } catch {}

    }
);


// ======================================================
// GAME UPDATE
// ======================================================

function updateGame() {

    let dx = 0;
    let dy = 0;

    if (
        keys["z"] ||
        keys["arrowup"]
    ) dy -= 1;

    if (
        keys["s"] ||
        keys["arrowdown"]
    ) dy += 1;

    if (
        keys["q"] ||
        keys["arrowleft"]
    ) dx -= 1;

    if (
        keys["d"] ||
        keys["arrowright"]
    ) dx += 1;


    const moving =
        dx !== 0 ||
        dy !== 0;

    if (moving) {

        const length =
            Math.hypot(dx, dy);

        dx /= length;
        dy /= length;

        tank.vx +=
            dx *
            tank.acceleration;

        tank.vy +=
            dy *
            tank.acceleration;

        const targetAngle =
            Math.atan2(
                dy,
                dx
            );

        tank.bodyAngle =
            smoothAngle(
                tank.bodyAngle,
                targetAngle,
                .16
            );

        tank.enginePulse += .25;

    } else {

        tank.vx *=
            tank.friction;

        tank.vy *=
            tank.friction;

        tank.enginePulse += .08;
    }


    const velocity =
        Math.hypot(
            tank.vx,
            tank.vy
        );

    if (
        velocity >
        tank.maxSpeed
    ) {

        tank.vx =
            tank.vx /
            velocity *
            tank.maxSpeed;

        tank.vy =
            tank.vy /
            velocity *
            tank.maxSpeed;

    }


    tank.x +=
        tank.vx;

    tank.y +=
        tank.vy;


    tank.recoil *= .82;


    const screenX =
        tank.x -
        camera.x +
        canvas.width /
            devicePixelRatio /
            2;

    const screenY =
        tank.y -
        camera.y +
        canvas.height /
            devicePixelRatio /
            2;


    const targetAim =
        Math.atan2(
            mouseY -
                screenY,

            mouseX -
                screenX
        );


    tank.angle =
        smoothAngle(
            tank.angle,
            targetAim,
            .28
        );


    tank.bob +=
        moving
            ? .18
            : .05;


    camera.x +=
        (tank.x -
            camera.x -
            0) * .08;

    camera.y +=
        (tank.y -
            camera.y -
            0) * .08;


    if (camera.shake > 0) {

        camera.shake *= .85;

    }


    updateBullets();

    updateParticles();

    updateExplosions();


    const now =
        performance.now();

    if (
        now -
        lastNetworkUpdate >
        50
    ) {

        socket.emit(
            "player-update",
            {

                x: tank.x,

                y: tank.y,

                angle: tank.angle,

                bodyAngle:
                    tank.bodyAngle

            }
        );

        lastNetworkUpdate =
            now;

    }
}


// ======================================================
// BULLETS
// ======================================================

function updateBullets() {

    for (
        let i = bullets.length - 1;
        i >= 0;
        i--
    ) {

        const bullet =
            bullets[i];

        bullet.x +=
            bullet.vx;

        bullet.y +=
            bullet.vy;

        bullet.life++;

        if (
            bullet.life >
            bullet.maxLife
        ) {

            bullets.splice(
                i,
                1
            );

            createExplosion(
                bullet.x,
                bullet.y
            );

            continue;
        }

        if (
            Math.random() <
            .35
        ) {

            createParticle(
                bullet.x,
                bullet.y,
                {
                    vx:
                        -bullet.vx *
                        .05,

                    vy:
                        -bullet.vy *
                        .05,

                    life: 12,

                    size: 1.5
                }
            );

        }
    }
}


// ======================================================
// PARTICLES
// ======================================================

function updateParticles() {

    for (
        let i = particles.length - 1;
        i >= 0;
        i--
    ) {

        const p =
            particles[i];

        p.x += p.vx;

        p.y += p.vy;

        p.vx *= .97;

        p.vy *= .97;

        p.life--;

        if (p.life <= 0) {

            particles.splice(
                i,
                1
            );

        }
    }
}


// ======================================================
// EXPLOSIONS
// ======================================================

function updateExplosions() {

    for (
        let i = explosions.length - 1;
        i >= 0;
        i--
    ) {

        explosions[i].life++;

        if (
            explosions[i].life >
            explosions[i].maxLife
        ) {

            explosions.splice(
                i,
                1
            );

        }
    }
}


// ======================================================
// DRAW
// ======================================================

function gameLoop() {

    if (!gameStarted) return;

    const start =
        performance.now();

    updateGame();

    drawSpace();

    drawRemotePlayers();

    drawBullets();

    drawParticles();

    drawExplosions();

    drawTank();

    updateFPS(
        performance.now() -
        start
    );

    requestAnimationFrame(
        gameLoop
    );
}


// ======================================================
// DRAW TANK
// ======================================================

function drawTank() {

    const w =
        canvas.width /
        devicePixelRatio;

    const h =
        canvas.height /
        devicePixelRatio;

    const shakeX =
        camera.shake
            ? (Math.random() - .5) *
              camera.shake
            : 0;

    const shakeY =
        camera.shake
            ? (Math.random() - .5) *
              camera.shake
            : 0;

    const x =
        tank.x -
        camera.x +
        w / 2 +
        shakeX;

    const y =
        tank.y -
        camera.y +
        h / 2 +
        shakeY;

    ctx.save();

    ctx.translate(
        x,
        y
    );


    // Ombre

    ctx.save();

    ctx.globalAlpha = .35;

    ctx.filter =
        "blur(12px)";

    ctx.fillStyle =
        "#000";

    ctx.beginPath();

    ctx.ellipse(
        0,
        35,
        48,
        20,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.restore();


    // Propulsion

    const engine =
        Math.sin(
            tank.enginePulse
        );

    ctx.save();

    ctx.rotate(
        tank.bodyAngle
    );

    for (
        let i = -1;
        i <= 1;
        i += 2
    ) {

        const flame =
            15 +
            engine * 8 +
            Math.random() * 5;

        const gradient =
            ctx.createLinearGradient(
                -70,
                0,
                -40,
                0
            );

        gradient.addColorStop(
            0,
            "rgba(56,189,248,0)"
        );

        gradient.addColorStop(
            1,
            "rgba(56,189,248,.9)"
        );

        ctx.fillStyle =
            gradient;

        ctx.beginPath();

        ctx.moveTo(
            -50,
            i * 22
        );

        ctx.lineTo(
            -50 - flame,
            i * 22 - 7
        );

        ctx.lineTo(
            -50 - flame,
            i * 22 + 7
        );

        ctx.closePath();

        ctx.fill();

    }

    ctx.restore();


    // Tank

    ctx.save();

    ctx.translate(
        -tank.recoil,
        0
    );

    ctx.rotate(
        tank.bodyAngle
    );

    const bob =
        Math.sin(
            tank.bob
        ) *
        .8;

    ctx.translate(
        0,
        bob
    );


    // Glow

    ctx.shadowColor =
        "rgba(56,189,248,.55)";

    ctx.shadowBlur = 20;


    if (
        tankImage.complete &&
        tankImage.naturalWidth
    ) {

        const srcWidth =
            tankImage.width *
            .55;

        ctx.drawImage(
            tankImage,

            0,
            0,
            srcWidth,
            tankImage.height,

            -tank.width / 2,
            -tank.height / 2,
            tank.width,
            tank.height
        );

    } else {

        drawFallbackTank();

    }

    ctx.restore();


    // Tourelle / canon visuel

    ctx.save();

    ctx.rotate(
        tank.angle
    );

    ctx.translate(
        -tank.recoil * .6,
        0
    );

    ctx.fillStyle =
        "rgba(56,189,248,.35)";

    ctx.shadowColor =
        "#38bdf8";

    ctx.shadowBlur = 12;

    ctx.fillRect(
        0,
        -5,
        50,
        10
    );

    ctx.restore();


    ctx.restore();
}

function drawFallbackTank() {

    ctx.fillStyle =
        "#1e293b";

    ctx.strokeStyle =
        "#38bdf8";

    ctx.lineWidth = 3;

    ctx.beginPath();

    ctx.roundRect(
        -45,
        -35,
        90,
        70,
        15
    );

    ctx.fill();

    ctx.stroke();

    ctx.fillStyle =
        "#38bdf8";

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        20,
        0,
        Math.PI * 2
    );

    ctx.fill();
}


// ======================================================
// REMOTE PLAYERS
// ======================================================

function drawRemotePlayers() {

    for (
        const player
        of remotePlayers.values()
    ) {

        const w =
            canvas.width /
            devicePixelRatio;

        const h =
            canvas.height /
            devicePixelRatio;

        const x =
            player.x -
            camera.x +
            w / 2;

        const y =
            player.y -
            camera.y +
            h / 2;

        ctx.save();

        ctx.translate(
            x,
            y
        );

        ctx.rotate(
            player.bodyAngle
        );

        ctx.globalAlpha =
            .85;

        ctx.fillStyle =
            "#334155";

        ctx.strokeStyle =
            "#94a3b8";

        ctx.lineWidth = 2;

        ctx.beginPath();

        ctx.roundRect(
            -35,
            -25,
            70,
            50,
            12
        );

        ctx.fill();

        ctx.stroke();

        ctx.restore();


        // pseudo

        ctx.save();

        ctx.font =
            "bold 11px Segoe UI";

        ctx.textAlign =
            "center";

        ctx.fillStyle =
            "#cbd5e1";

        ctx.fillText(
            player.pseudo,
            x,
            y - 45
        );

        ctx.restore();
    }
}


// ======================================================
// BULLET DRAW
// ======================================================

function drawBullets() {

    const w =
        canvas.width /
        devicePixelRatio;

    const h =
        canvas.height /
        devicePixelRatio;

    for (
        const b of bullets
    ) {

        const x =
            b.x -
            camera.x +
            w / 2;

        const y =
            b.y -
            camera.y +
            h / 2;

        ctx.save();

        ctx.translate(
            x,
            y
        );

        ctx.rotate(
            b.angle
        );

        ctx.shadowColor =
            "#38bdf8";

        ctx.shadowBlur = 20;

        ctx.fillStyle =
            "#38bdf8";

        ctx.fillRect(
            -14,
            -3,
            28,
            6
        );

        ctx.fillStyle =
            "#fff";

        ctx.fillRect(
            -5,
            -2,
            10,
            4
        );

        ctx.restore();
    }
}


// ======================================================
// PARTICLE DRAW
// ======================================================

function drawParticles() {

    const w =
        canvas.width /
        devicePixelRatio;

    const h =
        canvas.height /
        devicePixelRatio;

    for (
        const p of particles
    ) {

        const x =
            p.x -
            camera.x +
            w / 2;

        const y =
            p.y -
            camera.y +
            h / 2;

        const alpha =
            p.life /
            p.maxLife;

        ctx.globalAlpha =
            alpha;

        ctx.fillStyle =
            "#38bdf8";

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            p.size,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.globalAlpha = 1;
}


// ======================================================
// EXPLOSIONS DRAW
// ======================================================

function drawExplosions() {

    const w =
        canvas.width /
        devicePixelRatio;

    const h =
        canvas.height /
        devicePixelRatio;

    for (
        const e of explosions
    ) {

        const x =
            e.x -
            camera.x +
            w / 2;

        const y =
            e.y -
            camera.y +
            h / 2;

        const progress =
            e.life /
            e.maxLife;

        const radius =
            progress *
            35;

        ctx.save();

        ctx.globalAlpha =
            1 - progress;

        ctx.strokeStyle =
            "#38bdf8";

        ctx.shadowColor =
            "#38bdf8";

        ctx.shadowBlur = 20;

        ctx.lineWidth = 4;

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            radius,
            0,
            Math.PI * 2
        );

        ctx.stroke();

        ctx.restore();
    }
}


// ======================================================
// SOCKET PLAYERS
// ======================================================

socket.on(
    "room-state",
    data => {

        hudPlayers.textContent =
            `${data.players.length} joueur${
                data.players.length > 1
                    ? "s"
                    : ""
            }`;

        const ids =
            new Set();

        data.players.forEach(player => {

            if (
                player.id ===
                socket.id
            ) return;

            ids.add(
                player.id
            );

            if (
                !remotePlayers.has(
                    player.id
                )
            ) {

                remotePlayers.set(
                    player.id,
                    {
                        ...player,
                        pseudo:
                            player.pseudo
                    }
                );

            } else {

                const existing =
                    remotePlayers.get(
                        player.id
                    );

                existing.targetX =
                    player.x;

                existing.targetY =
                    player.y;

                existing.targetAngle =
                    player.angle;

                existing.targetBodyAngle =
                    player.bodyAngle;

            }

        });

        for (
            const id
            of remotePlayers.keys()
        ) {

            if (!ids.has(id)) {

                remotePlayers.delete(id);

            }
        }
    }
);


socket.on(
    "player-update",
    data => {

        const player =
            remotePlayers.get(
                data.id
            );

        if (!player) {

            remotePlayers.set(
                data.id,
                {
                    ...data,
                    targetX: data.x,
                    targetY: data.y,
                    targetAngle: data.angle,
                    targetBodyAngle:
                        data.bodyAngle,
                    pseudo: "Pilote"
                }
            );

            return;
        }

        player.targetX =
            data.x;

        player.targetY =
            data.y;

        player.targetAngle =
            data.angle;

        player.targetBodyAngle =
            data.bodyAngle;

        player.x +=
            (
                player.targetX -
                player.x
            ) * .25;

        player.y +=
            (
                player.targetY -
                player.y
            ) * .25;

        player.angle =
            smoothAngle(
                player.angle,
                player.targetAngle,
                .2
            );

        player.bodyAngle =
            smoothAngle(
                player.bodyAngle,
                player.targetBodyAngle,
                .2
            );
    }
);


socket.on(
    "player-shot",
    data => {

        createMuzzleFlash(
            data.x,
            data.y,
            data.angle
        );

    }
);


// ======================================================
// FPS
// ======================================================

function updateFPS() {

    frameCounter++;

    const now =
        performance.now();

    if (
        now -
        fpsTimer >
        1000
    ) {

        fps =
            frameCounter;

        frameCounter = 0;

        fpsTimer =
            now;

        fpsCounter.textContent =
            `FPS: ${fps}`;

    }

    fpsCounter.style.display =
        settings.showFPS
            ? "block"
            : "none";
}


// ======================================================
// HELPERS
// ======================================================

function smoothAngle(
    current,
    target,
    amount
) {

    let difference =
        target -
        current;

    while (
        difference >
        Math.PI
    ) {
        difference -=
            Math.PI * 2;
    }

    while (
        difference <
        -Math.PI
    ) {
        difference +=
            Math.PI * 2;
    }

    return current +
        difference *
        amount;
}

function escapeHTML(text) {

    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ======================================================
// MOBILE SHOOT SUPPORT
// ======================================================

canvas.addEventListener(
    "touchstart",
    e => {

        if (!gameStarted) return;

        e.preventDefault();

        shoot();

    },
    {
        passive: false
    }
);


// ======================================================
// AUTO UPDATE REMOTE PLAYERS
// ======================================================

setInterval(
    () => {

        for (
            const player
            of remotePlayers.values()
        ) {

            if (
                typeof player.targetX ===
                "number"
            ) {

                player.x +=
                    (
                        player.targetX -
                        player.x
                    ) * .25;

                player.y +=
                    (
                        player.targetY -
                        player.y
                    ) * .25;

                player.angle =
                    smoothAngle(
                        player.angle,
                        player.targetAngle,
                        .2
                    );

                player.bodyAngle =
                    smoothAngle(
                        player.bodyAngle,
                        player.targetBodyAngle,
                        .2
                    );
            }
        }

    },
    16
);