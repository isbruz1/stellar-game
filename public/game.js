/* ==================================================================
   STELLAR GAME — Client
   ================================================================== */

// ---------- Persistance ----------
let pseudo    = localStorage.getItem("pseudo")   || "";
let realName  = localStorage.getItem("realName") || "";
let currentSkin = parseInt(localStorage.getItem("skin") || "0");

// ---------- Runtime ----------
let myId = null, hostId = null;
let lobbyPlayers = {}, gameStarted = false;
let serverState = { players: {}, bullets: [] };
let myAngle = 0;
const keys = { up: false, down: false, left: false, right: false };
let socket = null;

// ---------- DOM ----------
const splashScreen = document.getElementById("splashScreen");
const loginScreen  = document.getElementById("loginScreen");
const lobbyScreen  = document.getElementById("lobbyScreen");
const gameScreen   = document.getElementById("gameScreen");

const loginBtn    = document.getElementById("loginBtn");
const loginPseudo = document.getElementById("pseudoInput");
const loginReal   = document.getElementById("realNameInput");
const pseudoError = document.getElementById("pseudoError");

const playersGrid  = document.getElementById("playersGrid");
const playerCount  = document.getElementById("playerCount");
const actionBtn    = document.getElementById("actionBtn");
const quitBtn      = document.getElementById("quitBtn");
const settingsBtn  = document.getElementById("settingsBtn");
const settingsModal= document.getElementById("settingsModal");
const closeSettings= document.getElementById("closeSettings");
const settingsPseudo   = document.getElementById("settingsPseudo");
const settingsRealName = document.getElementById("settingsRealName");
const skinPicker   = document.getElementById("skinPicker");

const canvas = document.getElementById("game");
const ctx    = canvas.getContext("2d");

function showScreen(name) {
  splashScreen.classList.toggle("hidden", name !== "splash");
  loginScreen.classList.toggle("hidden",  name !== "login");
  lobbyScreen.classList.toggle("hidden",  name !== "lobby");
  gameScreen.classList.toggle("hidden",   name !== "game");
  if (name === "game") resizeCanvas();
}

// ==================================================================
//  SPLASH ANIMÉE — étoiles filantes + nébuleuse
// ==================================================================
(function initSplash() {
  const c = document.getElementById("splashCanvas");
  const g = c.getContext("2d");

  function resize() {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  // Particules
  const stars = [];
  for (let i = 0; i < 180; i++) {
    stars.push({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      z: Math.random() * 0.8 + 0.2,
      r: Math.random() * 1.8 + 0.3,
      speed: Math.random() * 0.3 + 0.05
    });
  }

  // Étoiles filantes
  const shooting = [];
  function spawnShooting() {
    shooting.push({
      x: Math.random() * c.width * 0.8,
      y: Math.random() * c.height * 0.4,
      len: 120 + Math.random() * 80,
      speed: 6 + Math.random() * 4,
      alpha: 1
    });
  }
  setInterval(() => {
    if (shooting.length < 3 && Math.random() < 0.5) spawnShooting();
  }, 700);

  let t = 0;
  let running = true;
  function loop() {
    if (!running) return;
    t += 0.01;

    // Fond avec nébuleuse
    const grad = g.createRadialGradient(
      c.width * (0.5 + Math.sin(t * 0.5) * 0.1),
      c.height * (0.5 + Math.cos(t * 0.3) * 0.1),
      50,
      c.width / 2, c.height / 2, c.width * 0.8
    );
    grad.addColorStop(0, "rgba(30, 60, 130, 0.35)");
    grad.addColorStop(0.5, "rgba(10, 20, 50, 0.5)");
    grad.addColorStop(1, "rgba(3, 4, 13, 1)");
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);

    // Étoiles
    stars.forEach(s => {
      s.y += s.speed * s.z;
      if (s.y > c.height) { s.y = 0; s.x = Math.random() * c.width; }
      const a = 0.3 + s.z * 0.7;
      g.fillStyle = `rgba(180, 220, 255, ${a})`;
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.fill();
    });

    // Étoiles filantes
    for (let i = shooting.length - 1; i >= 0; i--) {
      const sh = shooting[i];
      const gx = g.createLinearGradient(sh.x, sh.y, sh.x - sh.len, sh.y - sh.len * 0.4);
      gx.addColorStop(0, `rgba(180, 220, 255, ${sh.alpha})`);
      gx.addColorStop(1, "rgba(180, 220, 255, 0)");
      g.strokeStyle = gx;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(sh.x, sh.y);
      g.lineTo(sh.x - sh.len, sh.y - sh.len * 0.4);
      g.stroke();

      sh.x += sh.speed;
      sh.y += sh.speed * 0.4;
      sh.alpha -= 0.012;
      if (sh.alpha <= 0 || sh.x > c.width + 200) shooting.splice(i, 1);
    }

    requestAnimationFrame(loop);
  }
  loop();

  // Stop l'animation quand on quitte le splash
  window.__stopSplash = () => { running = false; };
})();

// ==================================================================
//  FLOW : splash → login (ou direct lobby si déjà enregistré)
// ==================================================================
showScreen("splash");

setTimeout(() => {
  window.__stopSplash && window.__stopSplash();

  if (pseudo.length >= 5 && realName.trim().length > 0) {
    startConnection();
  } else {
    loginPseudo.value = pseudo;
    loginReal.value   = realName;
    validateLoginForm();
    showScreen("login");
    loginPseudo.focus();
  }
}, 3800);

// ==================================================================
//  LOGIN — validation
// ==================================================================
function validateLoginForm() {
  const p = loginPseudo.value.trim();
  const r = loginReal.value.trim();

  if (p.length === 0) {
    pseudoError.textContent = "";
  } else if (p.length < 5) {
    pseudoError.textContent = "Le pseudo doit faire au moins 5 caractères.";
  } else if (p.length > 16) {
    pseudoError.textContent = "Maximum 16 caractères.";
  } else {
    pseudoError.textContent = "";
  }

  loginBtn.disabled = !(p.length >= 5 && r.length > 0);
}

loginPseudo.addEventListener("input", validateLoginForm);
loginReal.addEventListener("input", validateLoginForm);

loginBtn.addEventListener("click", () => {
  const p = loginPseudo.value.trim();
  const r = loginReal.value.trim();
  if (p.length < 5 || r.length === 0) return;

  pseudo   = p;
  realName = r;
  localStorage.setItem("pseudo",   pseudo);
  localStorage.setItem("realName", realName);

  startConnection();
});

[loginPseudo, loginReal].forEach(el => {
  el.addEventListener("keydown", e => {
    if (e.key === "Enter" && !loginBtn.disabled) loginBtn.click();
  });
});

// ==================================================================
//  SOCKET
// ==================================================================
function startConnection() {
  socket = io();

  socket.on("connect", () => {
    myId = socket.id;
    socket.emit("join-lobby", { pseudo, realName, skin: currentSkin });
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

  showScreen("lobby");
}

// ==================================================================
//  LOBBY
// ==================================================================
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

    if (p.realName) {
      const rn = document.createElement("div");
      rn.className = "realname";
      rn.textContent = p.realName;
      card.appendChild(rn);
    }

    if (p.id === hostId) {
      const b = document.createElement("div");
      b.className = "badge";
      b.textContent = "HÔTE";
      card.appendChild(b);
    }
    if (p.ready && p.id !== hostId) {
      const t = document.createElement("div");
      t.className = "ready-tag";
      t.textContent = "✓ PRÊT";
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
  if (!socket) return;
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
  if (!socket) return;
  socket.emit("leave-game");
  gameStarted = false;
  showScreen("lobby");
});

// ==================================================================
//  PARAMÈTRES
// ==================================================================
settingsBtn.addEventListener("click", () => {
  settingsPseudo.value = pseudo;
  settingsRealName.value = realName;
  settingsModal.classList.remove("hidden");
  buildSkinPicker();
});
closeSettings.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

settingsPseudo.addEventListener("change", () => {
  const v = (settingsPseudo.value || "").trim();
  if (v.length < 5 || v.length > 16) {
    settingsPseudo.value = pseudo;
    return;
  }
  pseudo = v;
  localStorage.setItem("pseudo", pseudo);
  if (socket) socket.emit("update-pseudo", pseudo);
});

settingsRealName.addEventListener("change", () => {
  const v = (settingsRealName.value || "").trim().slice(0, 32);
  realName = v;
  localStorage.setItem("realName", realName);
  if (socket) socket.emit("update-realname", realName);
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
      if (socket) socket.emit("update-skin", i);
      buildSkinPicker();
    });
    skinPicker.appendChild(c);
  });
}

// ==================================================================
//  CLAVIER (fix zqsd dans les inputs)
// ==================================================================
const keyMap = {
  "z": "up",    "w": "up",    "arrowup": "up",
  "s": "down",  "arrowdown": "down",
  "q": "left",  "a": "left",  "arrowleft": "left",
  "d": "right", "arrowright": "right"
};

window.addEventListener("keydown", e => {
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  const k = keyMap[e.key.toLowerCase()];
  if (k) { keys[k] = true; e.preventDefault(); }
});

window.addEventListener("keyup", e => {
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  const k = keyMap[e.key.toLowerCase()];
  if (k) { keys[k] = false; e.preventDefault(); }
});

// ==================================================================
//  SOURIS
// ==================================================================
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

// ==================================================================
//  INPUT → serveur
// ==================================================================
setInterval(() => {
  if (!gameStarted || !myId || !socket) return;
  const me = serverState.players[myId];
  if (!me || !me.alive) return;
  socket.emit("input", { keys, angle: myAngle });
}, 33);

// ==================================================================
//  CANVAS
// ==================================================================
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function getCamera() {
  const me = serverState.players[myId];
  if (!me) return { x: 0, y: 0 };
  return {
    x: me.x - canvas.width / 2,
    y: me.y - canvas.height / 2
  };
}

// ==================================================================
//  RENDU
// ==================================================================
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
  ctx.fillText(p.pseudo, x, y - 50);

  if (p.realName) {
    ctx.fillStyle = "#789";
    ctx.font = "italic 11px Segoe UI, Arial";
    ctx.fillText(p.realName, x, y - 36);
  }

  const bw = 52, bh = 5;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - bw / 2, y - 30, bw, bh);
  ctx.fillStyle = p.hp > 60 ? "#4f4" : p.hp > 30 ? "#fd4" : "#f55";
  ctx.fillRect(x - bw / 2, y - 30, bw * (p.hp / 100), bh);
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
loop();