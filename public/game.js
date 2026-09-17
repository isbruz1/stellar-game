/* =====================================================
   STELLAR GAME V2
   PC + MOBILE
   ===================================================== */

"use strict";

// --------------------------------------------------
// SOCKET
// --------------------------------------------------

const socket = io({
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000
});


// --------------------------------------------------
// DOM
// --------------------------------------------------

const $ = id => document.getElementById(id);

const screens = {
    splash: $("splashScreen"),
    profile: $("profileScreen"),
    lobby: $("lobbyScreen"),
    room: $("roomScreen"),
    game: $("gameScreen")
};

const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d", {
    alpha: false
});


// --------------------------------------------------
// STATE
// --------------------------------------------------

const state = {

    connected: false,

    playerId: null,

    playerName:
        localStorage.getItem("stellarPlayerName") || "",

    room: null,

    map: null,

    players: new Map(),

    bullets: new Map(),

    gameStarted: false,

    keys: new Set(),

    mouse: {
        x: 0,
        y: 0,
        down: false
    },

    mobile: {
        move: {
            active: false,
            pointerId: null,
            x: 0,
            y: 0
        },

        aim: {
            active: false,
            pointerId: null,
            x: 0,
            y: 0
        },

        shooting: false
    },

    camera: {
        x: 0,
        y: 0
    },

    renderPlayers: new Map(),

    lastFrame: performance.now(),

    lastInputSend: 0,

    lastAimAngle: 0,

    devicePixelRatio: 1
};


// --------------------------------------------------
// SPLASH
// --------------------------------------------------

let loadingProgress = 0;

const splashTimer = setInterval(() => {

    loadingProgress += 4;

    $("loadingBar").style.width =
        `${Math.min(loadingProgress, 100)}%`;

    if (loadingProgress >= 100) {

        clearInterval(splashTimer);

        setTimeout(() => {

            if (state.playerName) {
                showScreen("lobby");
                $("welcomeName").textContent =
                    state.playerName;
                refreshRooms();
            } else {
                showScreen("profile");
            }

        }, 350);
    }

}, 45);


// --------------------------------------------------
// SCREEN
// --------------------------------------------------

function showScreen(name) {

    Object.values(screens).forEach(screen => {
        screen.classList.remove("active");
    });

    screens[name].classList.add("active");

    if (name === "game") {
        resizeCanvas();
    }
}


// --------------------------------------------------
// PROFILE
// --------------------------------------------------

$("continueButton").addEventListener("click", saveProfile);

$("playerName").addEventListener("keydown", event => {

    if (event.key === "Enter") {
        saveProfile();
    }

});

function saveProfile() {

    const name =
        $("playerName").value
            .trim()
            .replace(/\s+/g, " ");

    if (name.length < 2) {

        $("profileError").textContent =
            "Ton pseudo doit contenir au moins 2 caractères.";

        return;
    }

    state.playerName = name.slice(0, 16);

    localStorage.setItem(
        "stellarPlayerName",
        state.playerName
    );

    $("welcomeName").textContent =
        state.playerName;

    $("profileError").textContent = "";

    showScreen("lobby");

    refreshRooms();
}


// --------------------------------------------------
// CONNECTION
// --------------------------------------------------

socket.on("connect", () => {

    state.connected = true;
    state.playerId = socket.id;

    updateConnectionUI(true);

    refreshRooms();

    showToast("Connecté au serveur");

});

socket.on("disconnect", reason => {

    state.connected = false;

    updateConnectionUI(false);

    showToast("Connexion perdue...");

});

socket.io.on("reconnect", () => {

    state.connected = true;

    updateConnectionUI(true);

    showToast("Connexion rétablie");

});

socket.on("connect_error", () => {

    updateConnectionUI(false);

});

function updateConnectionUI(online) {

    $("connectionDot").classList.toggle(
        "online",
        online
    );

    $("connectionText").textContent =
        online ? "En ligne" : "Hors ligne";
}


// --------------------------------------------------
// ROOM LIST
// --------------------------------------------------

function refreshRooms() {

    if (!state.connected) return;

    socket.emit("getRooms");
}

socket.on("connected", data => {

    state.playerId = data.id;

    renderRooms(data.rooms || []);

});

socket.on("roomList", rooms => {

    renderRooms(rooms);

});

function renderRooms(rooms) {

    const container = $("serverList");

    container.innerHTML = "";

    if (!rooms.length) {

        container.innerHTML = `
            <div class="panel" style="
                padding:30px;
                text-align:center;
                color:#94a3b8;
            ">
                Aucun serveur disponible.<br>
                Crée ton premier serveur !
            </div>
        `;

        return;
    }

    rooms.forEach(room => {

        const card = document.createElement("div");

        card.className = "server-card";

        const full =
            room.players >= room.maxPlayers;

        card.innerHTML = `
            <div class="card-icon">✦</div>

            <div class="server-info">
                <strong>${escapeHTML(room.name)}</strong>
                <small>Code : ${room.id}</small>
            </div>

            <div class="server-players">
                ${room.players}/${room.maxPlayers}
            </div>

            <button
                class="secondary-button join-server"
                ${full ? "disabled" : ""}
            >
                ${full ? "COMPLET" : "REJOINDRE"}
            </button>
        `;

        const joinButton =
            card.querySelector(".join-server");

        if (!full) {

            joinButton.addEventListener(
                "click",
                () => joinRoom(room.id)
            );

        }

        container.appendChild(card);

    });
}


// --------------------------------------------------
// CREATE SERVER
// --------------------------------------------------

$("createServerButton").addEventListener(
    "click",
    () => openModal("createModal")
);

$("confirmCreateButton").addEventListener(
    "click",
    createServer
);

$("serverNameInput").addEventListener(
    "keydown",
    event => {
        if (event.key === "Enter") {
            createServer();
        }
    }
);

function createServer() {

    let name =
        $("serverNameInput").value.trim();

    if (!name) {
        name = `${state.playerName}'s Server`;
    }

    socket.emit("createRoom", {
        name,
        playerName: state.playerName
    });

    closeModal("createModal");
}


// --------------------------------------------------
// JOIN CODE
// --------------------------------------------------

$("joinCodeButton").addEventListener(
    "click",
    () => openModal("joinModal")
);

$("confirmJoinButton").addEventListener(
    "click",
    joinByCode
);

$("roomCodeInput").addEventListener(
    "input",
    event => {

        event.target.value =
            event.target.value
                .replace(/[^a-zA-Z0-9]/g, "")
                .toUpperCase();

    }
);

$("roomCodeInput").addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {
            joinByCode();
        }

    }
);

function joinByCode() {

    const code =
        $("roomCodeInput").value
            .trim()
            .toUpperCase();

    if (code.length < 4) {

        showToast("Code invalide");

        return;
    }

    joinRoom(code);

    closeModal("joinModal");
}

function joinRoom(roomId) {

    socket.emit("joinRoom", {
        roomId,
        playerName: state.playerName
    });

}


// --------------------------------------------------
// QUICK PLAY
// --------------------------------------------------

$("quickPlayButton").addEventListener(
    "click",
    () => {

        const cards =
            document.querySelectorAll(
                ".join-server"
            );

        if (cards.length > 0) {
            cards[0].click();
        } else {
            createServer();
        }

    }
);


// --------------------------------------------------
// JOINED
// --------------------------------------------------

socket.on("joinedRoom", data => {

    state.room = data.room;
    state.map = data.map;
    state.playerId = data.player.id;

    $("roomName").textContent =
        data.room.name;

    $("roomTitle").textContent =
        data.room.name;

    $("roomCode").textContent =
        data.room.id;

    showScreen("room");

    showToast(
        `Tu as rejoint ${data.room.name}`
    );

});


// --------------------------------------------------
// ROOM STATE
// --------------------------------------------------

socket.on("roomState", data => {

    state.room = data.room;

    state.players.clear();

    for (const player of data.players) {

        state.players.set(
            player.id,
            player
        );

    }

    renderRoomPlayers();

    const isHost =
        state.room.ownerId === state.playerId;

    $("hostBadge").classList.toggle(
        "hidden",
        !isHost
    );

    $("startGameButton").classList.toggle(
        "hidden",
        !isHost
    );

    const me =
        state.players.get(state.playerId);

    if (me) {

        $("readyStatus").textContent =
            me.ready
                ? "✓ Tu es prêt"
                : "Pas prêt";

        $("readyButton").textContent =
            me.ready
                ? "ANNULER"
                : "SE PRÉPARER";
    }

});

function renderRoomPlayers() {

    const container = $("playerList");

    container.innerHTML = "";

    state.players.forEach(player => {

        const row =
            document.createElement("div");

        row.className = "player-row";

        row.innerHTML = `
            <div
                class="player-dot"
                style="background:${player.color}"
            ></div>

            <div class="player-name">
                ${escapeHTML(player.name)}
                ${player.id === state.room.ownerId
                    ? " 👑"
                    : ""}
            </div>

            <div class="player-status ${
                player.ready ? "ready" : ""
            }">
                ${player.ready ? "PRÊT" : "Pas prêt"}
            </div>
        `;

        container.appendChild(row);

    });

}


// --------------------------------------------------
// READY
// --------------------------------------------------

$("readyButton").addEventListener(
    "click",
    () => {

        const me =
            state.players.get(state.playerId);

        socket.emit(
            "ready",
            !(me && me.ready)
        );

    }
);


// --------------------------------------------------
// START GAME
// --------------------------------------------------

$("startGameButton").addEventListener(
    "click",
    () => {

        socket.emit("startGame");

    }
);

socket.on("gameStarted", data => {

    state.map = data.map;
    state.gameStarted = true;

    showScreen("game");

    document.body.requestFullscreen?.()
        .catch(() => {});

});


// --------------------------------------------------
// LEAVE ROOM
// --------------------------------------------------

$("leaveRoomButton").addEventListener(
    "click",
    leaveRoom
);

$("leaveGameButton").addEventListener(
    "click",
    () => {

        state.gameStarted = false;

        socket.emit("leaveRoom");

        showScreen("lobby");

        refreshRooms();

    }
);

function leaveRoom() {

    socket.emit("leaveRoom");

    state.room = null;

    showScreen("lobby");

    refreshRooms();

}


// --------------------------------------------------
// GAME STATE
// --------------------------------------------------

socket.on("gameState", data => {

    for (const player of data.players) {

        state.players.set(
            player.id,
            player
        );

        if (!state.renderPlayers.has(player.id)) {

            state.renderPlayers.set(
                player.id,
                {
                    x: player.x,
                    y: player.y
                }
            );

        }

    }

    const ids =
        new Set(
            data.players.map(p => p.id)
        );

    for (const id of state.players.keys()) {

        if (!ids.has(id)) {
            state.players.delete(id);
            state.renderPlayers.delete(id);
        }

    }

    state.bullets.clear();

    for (const bullet of data.bullets) {

        state.bullets.set(
            bullet.id,
            bullet
        );

    }

    updateHUD();

});


// --------------------------------------------------
// PLAYER DEATH
// --------------------------------------------------

socket.on("playerDied", data => {

    addKillMessage(
        `${data.killer} ✦ ${data.victim}`
    );

});


// --------------------------------------------------
// ERROR
// --------------------------------------------------

socket.on("errorMessage", message => {

    showToast(message);

});


// --------------------------------------------------
// INPUT KEYBOARD
// --------------------------------------------------

window.addEventListener(
    "keydown",
    event => {

        const key =
            event.key.toLowerCase();

        state.keys.add(key);

        if (
            [
                "w",
                "a",
                "s",
                "d",
                "z",
                "q",
                "arrowup",
                "arrowdown",
                "arrowleft",
                "arrowright",
                " "
            ].includes(key)
        ) {
            event.preventDefault();
        }

        if (key === "escape") {
            state.mouse.down = false;
        }

    }
);

window.addEventListener(
    "keyup",
    event => {

        state.keys.delete(
            event.key.toLowerCase()
        );

    }
);


// --------------------------------------------------
// MOUSE
// --------------------------------------------------

canvas.addEventListener(
    "mousemove",
    event => {

        state.mouse.x = event.clientX;
        state.mouse.y = event.clientY;

        updateMouseAim();

    }
);

canvas.addEventListener(
    "mousedown",
    event => {

        if (event.button === 0) {
            state.mouse.down = true;
        }

    }
);

window.addEventListener(
    "mouseup",
    event => {

        if (event.button === 0) {
            state.mouse.down = false;
        }

    }
);


// --------------------------------------------------
// MOBILE JOYSTICKS
// --------------------------------------------------

setupJoystick(
    $("moveJoystick"),
    state.mobile.move
);

setupJoystick(
    $("aimJoystick"),
    state.mobile.aim
);

function setupJoystick(element, joystick) {

    element.addEventListener(
        "pointerdown",
        event => {

            event.preventDefault();

            joystick.active = true;
            joystick.pointerId =
                event.pointerId;

            element.setPointerCapture(
                event.pointerId
            );

            updateJoystick(
                event,
                element,
                joystick
            );

        }
    );

    element.addEventListener(
        "pointermove",
        event => {

            if (
                !joystick.active ||
                event.pointerId !== joystick.pointerId
            ) {
                return;
            }

            event.preventDefault();

            updateJoystick(
                event,
                element,
                joystick
            );

        }
    );

    const end = event => {

        if (
            event.pointerId !== joystick.pointerId
        ) {
            return;
        }

        joystick.active = false;
        joystick.pointerId = null;
        joystick.x = 0;
        joystick.y = 0;

        resetJoystickVisual(element);

    };

    element.addEventListener(
        "pointerup",
        end
    );

    element.addEventListener(
        "pointercancel",
        end
    );

    element.addEventListener(
        "lostpointercapture",
        end
    );
}

function updateJoystick(
    event,
    element,
    joystick
) {

    const rect =
        element.getBoundingClientRect();

    const centerX =
        rect.left + rect.width / 2;

    const centerY =
        rect.top + rect.height / 2;

    let dx =
        event.clientX - centerX;

    let dy =
        event.clientY - centerY;

    const max =
        rect.width * .32;

    const length =
        Math.hypot(dx, dy);

    if (length > max) {

        dx =
            dx / length * max;

        dy =
            dy / length * max;

    }

    joystick.x =
        dx / max;

    joystick.y =
        dy / max;

    const knob =
        element.querySelector(
            ".joystick-knob"
        );

    knob.style.transform =
        `translate(
            calc(-50% + ${dx}px),
            calc(-50% + ${dy}px)
        )`;

    if (element === $("aimJoystick")) {

        if (Math.hypot(
            joystick.x,
            joystick.y
        ) > .15) {

            state.lastAimAngle =
                Math.atan2(
                    joystick.y,
                    joystick.x
                );

        }

    }

}

function resetJoystickVisual(element) {

    const knob =
        element.querySelector(
            ".joystick-knob"
        );

    knob.style.transform =
        "translate(-50%, -50%)";
}


// --------------------------------------------------
// SHOOT BUTTON
// --------------------------------------------------

const shootButton =
    $("shootButton");

shootButton.addEventListener(
    "pointerdown",
    event => {

        event.preventDefault();

        state.mobile.shooting = true;

    }
);

shootButton.addEventListener(
    "pointerup",
    event => {

        event.preventDefault();

        state.mobile.shooting = false;

    }
);

shootButton.addEventListener(
    "pointercancel",
    () => {

        state.mobile.shooting = false;

    }
);

shootButton.addEventListener(
    "pointerleave",
    () => {

        state.mobile.shooting = false;

    }
);


// --------------------------------------------------
// MOUSE AIM
// --------------------------------------------------

function updateMouseAim() {

    if (!state.gameStarted) return;

    const me =
        state.players.get(state.playerId);

    if (!me) return;

    const world =
        screenToWorld(
            state.mouse.x,
            state.mouse.y
        );

    state.lastAimAngle =
        Math.atan2(
            world.y - me.y,
            world.x - me.x
        );

}


// --------------------------------------------------
// INPUT UPDATE
// --------------------------------------------------

function calculateMovement() {

    let x = 0;
    let y = 0;

    if (
        state.keys.has("w") ||
        state.keys.has("z") ||
        state.keys.has("arrowup")
    ) {
        y -= 1;
    }

    if (
        state.keys.has("s") ||
        state.keys.has("arrowdown")
    ) {
        y += 1;
    }

    if (
        state.keys.has("a") ||
        state.keys.has("q") ||
        state.keys.has("arrowleft")
    ) {
        x -= 1;
    }

    if (
        state.keys.has("d") ||
        state.keys.has("arrowright")
    ) {
        x += 1;
    }

    if (
        Math.abs(state.mobile.move.x) > .05 ||
        Math.abs(state.mobile.move.y) > .05
    ) {

        x = state.mobile.move.x;
        y = state.mobile.move.y;

    }

    const length =
        Math.hypot(x, y);

    if (length > 1) {

        x /= length;
        y /= length;

    }

    return { x, y };
}

function sendInput() {

    if (
        !state.gameStarted ||
        !state.connected
    ) {
        return;
    }

    const now =
        performance.now();

    if (
        now - state.lastInputSend < 33
    ) {
        return;
    }

    state.lastInputSend = now;

    const movement =
        calculateMovement();

    const shooting =
        state.mouse.down ||
        state.keys.has(" ") ||
        state.mobile.shooting;

    socket.emit("input", {
        x: movement.x,
        y: movement.y,
        angle: state.lastAimAngle,
        shooting
    });

}


// --------------------------------------------------
// CANVAS
// --------------------------------------------------

function resizeCanvas() {

    const rect =
        canvas.getBoundingClientRect();

    state.devicePixelRatio =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );

    canvas.width =
        Math.floor(
            rect.width *
            state.devicePixelRatio
        );

    canvas.height =
        Math.floor(
            rect.height *
            state.devicePixelRatio
        );

    ctx.setTransform(
        state.devicePixelRatio,
        0,
        0,
        state.devicePixelRatio,
        0,
        0
    );

}

window.addEventListener(
    "resize",
    resizeCanvas
);

window.addEventListener(
    "orientationchange",
    () => {
        setTimeout(
            resizeCanvas,
            150
        );
    }
);


// --------------------------------------------------
// CAMERA
// --------------------------------------------------

function updateCamera() {

    const me =
        state.players.get(state.playerId);

    if (!me) return;

    const rect =
        canvas.getBoundingClientRect();

    const targetX =
        me.x - rect.width / 2;

    const targetY =
        me.y - rect.height / 2;

    state.camera.x +=
        (targetX - state.camera.x) *
        .12;

    state.camera.y +=
        (targetY - state.camera.y) *
        .12;

    if (state.map) {

        state.camera.x =
            clamp(
                state.camera.x,
                0,
                Math.max(
                    0,
                    state.map.width -
                    rect.width
                )
            );

        state.camera.y =
            clamp(
                state.camera.y,
                0,
                Math.max(
                    0,
                    state.map.height -
                    rect.height
                )
            );

    }

}


// --------------------------------------------------
// RENDER
// --------------------------------------------------

function loop(now) {

    const dt =
        Math.min(
            (now - state.lastFrame) / 1000,
            .05
        );

    state.lastFrame = now;

    sendInput();

    if (state.gameStarted) {

        updateCamera();

        drawWorld(dt);

    }

    requestAnimationFrame(loop);

}

requestAnimationFrame(loop);


// --------------------------------------------------
// WORLD
// --------------------------------------------------

function drawWorld() {

    const width =
        canvas.clientWidth;

    const height =
        canvas.clientHeight;

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    ctx.save();

    ctx.translate(
        -state.camera.x,
        -state.camera.y
    );

    drawBackground();

    drawRivers();

    drawForests();

    drawWalls();

    drawGrid();

    drawBullets();

    state.players.forEach(
        player => drawPlayer(player)
    );

    ctx.restore();

    drawMiniMap();

}

function drawBackground() {

    ctx.fillStyle = "#101820";

    ctx.fillRect(
        0,
        0,
        state.map.width,
        state.map.height
    );

}

function drawGrid() {

    const size = 80;

    const startX =
        Math.floor(
            state.camera.x / size
        ) * size;

    const startY =
        Math.floor(
            state.camera.y / size
        ) * size;

    const endX =
        state.camera.x +
        canvas.clientWidth +
        size;

    const endY =
        state.camera.y +
        canvas.clientHeight +
        size;

    ctx.strokeStyle =
        "rgba(255,255,255,.035)";

    ctx.lineWidth = 1;

    ctx.beginPath();

    for (
        let x = startX;
        x < endX;
        x += size
    ) {

        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);

    }

    for (
        let y = startY;
        y < endY;
        y += size
    ) {

        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);

    }

    ctx.stroke();

}

function drawRivers() {

    for (const river of state.map.rivers) {

        ctx.fillStyle = "#164e63";

        ctx.fillRect(
            river.x,
            river.y,
            river.w,
            river.h
        );

        ctx.fillStyle =
            "rgba(56,189,248,.13)";

        for (
            let y = river.y;
            y < river.y + river.h;
            y += 45
        ) {

            ctx.fillRect(
                river.x + 20,
                y,
                river.w - 40,
                2
            );

        }

    }

}

function drawForests() {

    for (const forest of state.map.forests) {

        ctx.fillStyle = "#123528";

        ctx.fillRect(
            forest.x,
            forest.y,
            forest.w,
            forest.h
        );

        ctx.fillStyle =
            "rgba(34,197,94,.18)";

        for (
            let x = forest.x + 25;
            x < forest.x + forest.w;
            x += 45
        ) {

            for (
                let y = forest.y + 25;
                y < forest.y + forest.h;
                y += 45
            ) {

                ctx.beginPath();

                ctx.arc(
                    x,
                    y,
                    13,
                    0,
                    Math.PI * 2
                );

                ctx.fill();

            }

        }

    }

}

function drawWalls() {

    for (const wall of state.map.walls) {

        ctx.fillStyle = "#252f3d";

        ctx.fillRect(
            wall.x,
            wall.y,
            wall.w,
            wall.h
        );

        ctx.strokeStyle =
            "rgba(255,255,255,.08)";

        ctx.strokeRect(
            wall.x,
            wall.y,
            wall.w,
            wall.h
        );

    }

}


// --------------------------------------------------
// PLAYER
// --------------------------------------------------

function drawPlayer(player) {

    const render =
        state.renderPlayers.get(
            player.id
        );

    if (!render) return;

    render.x +=
        (player.x - render.x) *
        .35;

    render.y +=
        (player.y - render.y) *
        .35;

    if (!player.alive) {

        drawDeadPlayer(
            render.x,
            render.y
        );

        return;
    }

    const isMe =
        player.id === state.playerId;

    // shadow

    ctx.fillStyle =
        "rgba(0,0,0,.35)";

    ctx.beginPath();

    ctx.ellipse(
        render.x,
        render.y + 18,
        24,
        10,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();


    // body

    ctx.fillStyle =
        player.color;

    ctx.beginPath();

    ctx.arc(
        render.x,
        render.y,
        PLAYER_RADIUS,
        0,
        Math.PI * 2
    );

    ctx.fill();


    // outline

    ctx.strokeStyle =
        isMe
            ? "#ffffff"
            : "rgba(255,255,255,.3)";

    ctx.lineWidth =
        isMe ? 3 : 1;

    ctx.stroke();


    // direction

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 5;

    ctx.beginPath();

    ctx.moveTo(
        render.x,
        render.y
    );

    ctx.lineTo(
        render.x +
            Math.cos(player.angle) * 30,
        render.y +
            Math.sin(player.angle) * 30
    );

    ctx.stroke();


    // health

    const health =
        Math.max(
            0,
            player.health /
            player.maxHealth
        );

    ctx.fillStyle =
        "rgba(0,0,0,.6)";

    ctx.fillRect(
        render.x - 25,
        render.y - 35,
        50,
        5
    );

    ctx.fillStyle =
        health > .5
            ? "#22c55e"
            : health > .25
                ? "#f59e0b"
                : "#ef4444";

    ctx.fillRect(
        render.x - 25,
        render.y - 35,
        50 * health,
        5
    );


    // name

    ctx.font =
        "bold 11px system-ui";

    ctx.textAlign = "center";

    ctx.fillStyle = "#fff";

    ctx.fillText(
        player.name,
        render.x,
        render.y - 45
    );

}

function drawDeadPlayer(x, y) {

    ctx.save();

    ctx.globalAlpha = .35;

    ctx.strokeStyle = "#94a3b8";

    ctx.lineWidth = 4;

    ctx.beginPath();

    ctx.moveTo(
        x - 12,
        y - 12
    );

    ctx.lineTo(
        x + 12,
        y + 12
    );

    ctx.moveTo(
        x + 12,
        y - 12
    );

    ctx.lineTo(
        x - 12,
        y + 12
    );

    ctx.stroke();

    ctx.restore();

}


// --------------------------------------------------
// BULLETS
// --------------------------------------------------

function drawBullets() {

    state.bullets.forEach(
        bullet => {

            ctx.fillStyle = "#fef08a";

            ctx.shadowBlur = 12;
            ctx.shadowColor = "#facc15";

            ctx.beginPath();

            ctx.arc(
                bullet.x,
                bullet.y,
                5,
                0,
                Math.PI * 2
            );

            ctx.fill();

            ctx.shadowBlur = 0;

        }
    );

}


// --------------------------------------------------
// MINIMAP
// --------------------------------------------------

function drawMiniMap() {

    if (!state.map) return;

    const width = 150;
    const height =
        width *
        state.map.height /
        state.map.width;

    const x =
        canvas.clientWidth -
        width -
        15;

    const y =
        canvas.clientHeight -
        height -
        15;

    ctx.save();

    ctx.fillStyle =
        "rgba(5,8,17,.75)";

    ctx.fillRect(
        x,
        y,
        width,
        height
    );

    ctx.strokeStyle =
        "rgba(255,255,255,.15)";

    ctx.strokeRect(
        x,
        y,
        width,
        height
    );

    state.players.forEach(
        player => {

            if (!player.alive) return;

            ctx.fillStyle =
                player.id === state.playerId
                    ? "#fff"
                    : player.color;

            ctx.beginPath();

            ctx.arc(
                x +
                    player.x /
                    state.map.width *
                    width,

                y +
                    player.y /
                    state.map.height *
                    height,

                player.id === state.playerId
                    ? 4
                    : 3,

                0,
                Math.PI * 2
            );

            ctx.fill();

        }
    );

    ctx.restore();

}


// --------------------------------------------------
// HUD
// --------------------------------------------------

function updateHUD() {

    const me =
        state.players.get(
            state.playerId
        );

    if (!me) return;

    $("hudName").textContent =
        me.name;

    $("hudColor").style.background =
        me.color;

    $("healthBar").style.width =
        `${me.health}%`;

    $("killsValue").textContent =
        me.kills;

    $("deathsValue").textContent =
        me.deaths;

}


// --------------------------------------------------
// COORDINATES
// --------------------------------------------------

function screenToWorld(x, y) {

    return {
        x:
            x +
            state.camera.x,

        y:
            y +
            state.camera.y
    };

}


// --------------------------------------------------
// FULLSCREEN
// --------------------------------------------------

$("fullscreenButton").addEventListener(
    "click",
    async () => {

        try {

            if (!document.fullscreenElement) {

                await document.documentElement
                    .requestFullscreen();

            } else {

                await document.exitFullscreen();

            }

        } catch (error) {

            console.log(error);

        }

    }
);


// --------------------------------------------------
// COPY ROOM CODE
// --------------------------------------------------

$("copyRoomCodeButton").addEventListener(
    "click",
    async () => {

        const code =
            $("roomCode").textContent;

        try {

            await navigator.clipboard.writeText(
                code
            );

            showToast("Code copié !");

        } catch {

            showToast(
                `Code : ${code}`
            );

        }

    }
);


// --------------------------------------------------
// MODALS
// --------------------------------------------------

document.querySelectorAll(
    "[data-close]"
).forEach(button => {

    button.addEventListener(
        "click",
        () => {
            closeModal(
                button.dataset.close
            );
        }
    );

});

function openModal(id) {

    $(id).classList.add("active");

}

function closeModal(id) {

    $(id).classList.remove("active");

}


// --------------------------------------------------
// TOAST
// --------------------------------------------------

function showToast(message) {

    const toast =
        document.createElement("div");

    toast.className = "toast";

    toast.textContent = message;

    $("toastContainer")
        .appendChild(toast);

    setTimeout(() => {

        toast.remove();

    }, 3000);

}


// --------------------------------------------------
// KILL FEED
// --------------------------------------------------

function addKillMessage(message) {

    const item =
        document.createElement("div");

    item.className =
        "kill-message";

    item.textContent =
        message;

    $("killFeed")
        .appendChild(item);

    setTimeout(() => {

        item.remove();

    }, 3500);

}


// --------------------------------------------------
// HTML SECURITY
// --------------------------------------------------

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


// --------------------------------------------------
// INITIALIZATION
// --------------------------------------------------

$("playerName").value =
    state.playerName;

resizeCanvas();

window.addEventListener(
    "beforeunload",
    () => {

        if (socket.connected) {
            socket.disconnect();
        }

    }
);