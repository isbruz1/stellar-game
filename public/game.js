// ---------- State ----------
let myId = null, hostId = null;
let lobbyPlayers = {}, gameStarted = false;

let pseudo = localStorage.getItem("pseudo")
  || ("Joueur" + Math.floor(Math.random() * 900 + 100));
let currentSkin = parseInt(localStorage.getItem("skin") || "0");
localStorage.setItem("pseudo", pseudo);

let serverState = { players: {}, bullets: [] };
let myAngle = 0;
const keys = { up: false, down: false, left: false, right: false };

// ---------- DOM ----------
const lobbyScreen  = document.getElementById("lobbyScreen");
const gameScreen   = document.getElementById("gameScreen");
const playersGrid  = document.getElementById("playersGrid");
const playerCount  = document.getElementById("playerCount");
const actionBtn    = document.getElementById("actionBtn");
const quitBtn      = document.getElementById("quitBtn");
const settingsBtn  = document.getElementById("settingsBtn");
const settingsModal= document.getElementById("settingsModal");
const closeSettings= document.getElementById("closeSettings");
const pseudoInput  = document.getElementById("pseudoInput");
const skinPicker   = document.getElementById("skinPicker");
const canvas       = document.getElementById("game");
const ctx          = canvas.getContext("2d");

pseudoInput.value = pseudo;

// ---------- Socket ----------
const socket = io();

socket.on("connect", () => {
  myId = socket.id;
  socket.emit("join-lobby", { pseudo, skin: currentSkin });
});

socket.on("lobby-update", data => {
  lobbyPlayers = data.players;
  hostId = data.hostId;
  gameStarted = data.gameStarted;
  renderLobby();
  updateActionButtons();
});

socket.on("game-started", () => {
  gameStarted = true;
  showScreen("game");
  keys.up = keys.down = keys.left = keys.right = false;
});

socket.on("game-ended", () => {
  gameStarted = false;
  showScreen("lobby");
});

socket.on("state", s => { serverState = s; });

// ---------- Écrans ----------
function showScreen(name) {
  lobbyScreen.classList.toggle("hidden", name !== "lobby");
  gameScreen.classList.toggle("hidden",  name !== "game");
  if (name === "game") resizeCanvas();
}

// ---------- Lobby ----------
function renderLobby() {
  playersGrid.innerHTML = "";
  const list = Object.values(lobbyPlayers);
  playerCount.textContent = `(${list.length})`;

  list.forEach(p => {
    const card = document.createElement("div");
    card.className = "player-card";
    if (p.id === hostId) card.classList.add("host");
    if (p.ready) card.classList.add("ready");

    const c = document.createElement("canvas");
    c.width = 80; c.height = 80;
    drawTankPreview(c, p.skin);
    card.appendChild(c);

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = p.pseudo + (p.id === myId ? " (toi)" : "");
    card.appendChild(name);

    if (p.id === hostId) {
      const b = document.createElement("div");
      b.className = "badge"; b.textContent = "HÔTE";
      card.appendChild(b);
    }
    if (p.ready && p.id !== hostId) {
      const t = document.createElement("div");
      t.className = "ready-tag"; t.textContent = "✓ PRÊT";
      card.appendChild(t);
    }
    playersGrid.appendChild(card);
  });
}

function updateActionButtons() {
  if (!myId || !hostId) return;
  const isHost = myId === hostId;

  if (isHost) {
    const guests = Object.values(lobbyPlayers).filter(p => p.id !== hostId);
    actionBtn.textContent = "JOUER";
    actionBtn.className = "btn btn-green";
    actionBtn.disabled = guests.length > 0 && !guests.every(p => p.ready);
    quitBtn.classList.add("hidden");
  } else {
    const me = lobbyPlayers[myId];
    const ready = !!(me && me.ready);
    actionBtn.textContent = ready ? "PAS PRÊT" : "PRÊT";
    actionBtn.className = ready ? "btn btn-yellow" : "btn btn-green";
    actionBtn.disabled = false;
    quitBtn.classList.remove("hidden");
  }
}

actionBtn.addEventListener("click", () => {
  if (myId === hostId) socket.emit("start-game");
  else socket.emit("toggle-ready");
});

quitBtn.addEventListener("click", () => {
  if (confirm("Quitter le serveur ?")) {
    socket.disconnect();
    setTimeout(() => location.reload(), 150);
  }
});

document.getElementById("leaveGameBtn").addEventListener("click", () => {
  socket.emit("leave-game");
  gameStarted = false;
  showScreen("lobby");
});

// ---------- Paramètres ----------
settingsBtn.addEventListener("click", () => {
  settingsModal.classList.remove("hidden");
  buildSkinPicker();
});
closeSettings.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

pseudoInput.addEventListener("change", () => {
  const v = (pseudoInput.value || "").trim().slice(0, 16) || "Joueur";
  pseudo = v;
  pseudoInput.value = v;
  localStorage.setItem("pseudo", pseudo);
  socket.emit("update-pseudo", pseudo);
});

function buildSkinPicker() {
  skinPicker.innerHTML = "";
  SKINS.forEach((s, i) => {
    const c = document.createElement("canvas");
    c.width = 70; c.height = 70;
    c.className = "skin-option" + (i === currentSkin ? " selected" : "");
    c.title = s.name;
    drawTankPreview(c, i);
    c.addEventListener("click", () => {
      currentSkin = i;
      localStorage.setItem("skin", i);
      socket.emit("update-skin", i);
      buildSkinPicker();
    });
    skinPicker.appendChild(c);
  });
}

// ---------- Clavier : FIX zqsd dans les inputs ----------
const keyMap = {
  "z": "up",    "w": "up",    "arrowup": "up",
  "s": "down",  "arrowdown": "down",
  "q": "left",  "a": "left",  "arrowleft": "left",
  "d": "right", "arrowright": "right"
};

window.addEventListener("keydown", e => {
  // FIX : on ignore les touches quand on tape dans un champ
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  const k = keyMap[e.key.toLowerCase()];
  if (k) { keys[k] = true; e.preventDefault(); }
});

window.addEventListener("keyup", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  const k = keyMap[e.key.toLowerCase()];
  if (k) { keys[k] = false; e.preventDefault(); }
});

// ---------- Souris ----------
canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  const cam = getCamera();
  const me = serverState.players[myId];
  if (!me) return;
  const wx = e.clientX - rect.left + cam.x;
  const wy = e.clientY - rect.top  + cam.y;
  myAngle = Math.atan2(wy - me.y, wx - me.x);
});

canvas.addEventListener("mousedown", e => {
  if (e.button !== 0) return;
  if (!gameStarted || !myId) return;
  socket.emit("shoot", { angle: myAngle });
});

// ---------- Envoi input ----------
setInterval(() => {
  if (!gameStarted || !myId) return;
  const me = serverState.players[myId];
  if (!me || !me.alive) return;
  socket.emit("input", { keys, angle: myAngle });
}, 33);

// ---------- Canvas ----------
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function getCamera() {
  const me = serverState.players[myId];
  if (!me) return { x: 0, y: 0 };
  return { x: me.x - canvas.width / 2, y: me.y - canvas.height / 2 };
}

// ---------- Rendu ----------
function drawGrid() {
  const cam = getCamera();
  const g = 100;
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  const sx = Math.floor(cam.x / g) * g;
  const sy = Math.floor(cam.y / g) * g;
  for (let x = sx; x < cam.x + canvas.width; x += g) {
    ctx.beginPath();
    ctx.moveTo(x - cam.x, 0);
    ctx.lineTo(x - cam.x, canvas.height);
    ctx.stroke();
  }
  for (let y = sy; y < cam.y + canvas.height; y += g) {
    ctx.beginPath();
    ctx.moveTo(0, y - cam.y);
    ctx.lineTo(canvas.width, y - cam.y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#4af";
  ctx.lineWidth = 4;
  ctx.strokeRect(-cam.x, -cam.y, 2400, 2400);
}

function drawPlayer(p, isMe) {
  const cam = getCamera();
  const x = p.x - cam.x, y = p.y - cam.y;

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 32, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  drawTankShape(ctx, p.skin, p.angle);
  ctx.restore();

  ctx.fillStyle = isMe ? "#4af" : "#fff";
  ctx.font = "bold 13px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.fillText(p.pseudo, x, y - 44);

  const bw = 52, bh = 5;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - bw / 2, y - 36, bw, bh);
  ctx.fillStyle = p.hp > 60 ? "#4f4" : p.hp > 30 ? "#fd4" : "#f55";
  ctx.fillRect(x - bw / 2, y - 36, bw * (p.hp / 100), bh);
}

function drawBullets() {
  const cam = getCamera();
  ctx.shadowColor = "#ff0";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#ff4";
  serverState.bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x - cam.x, b.y - cam.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;
}

function drawScoreboard() {
  const el = document.getElementById("scoreboard");
  const list = Object.values(serverState.players).sort((a, b) => b.hp - a.hp);
  el.innerHTML = list.map(p => {
    const c = p.alive ? (p.id === myId ? "#4af" : "#ddd") : "#f55";
    return `<div style="color:${c}">${p.pseudo} — ${p.alive ? p.hp + " HP" : "💀"}</div>`;
  }).join("");
}

function loop() {
  if (gameStarted) {
    ctx.fillStyle = "#0a0e27";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    Object.values(serverState.players).forEach(p => {
      if (p.alive) drawPlayer(p, p.id === myId);
    });
    drawBullets();
    drawScoreboard();
  }
  requestAnimationFrame(loop);
}

showScreen("lobby");
loop();