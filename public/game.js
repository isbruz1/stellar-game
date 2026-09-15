/* ==================================================================
   STELLAR GAME — Client V2
   ================================================================== */

// ---------- Persistance ----------
let pseudo    = localStorage.getItem("pseudo")   || "";
let realName  = localStorage.getItem("realName") || "";
let currentSkin = parseInt(localStorage.getItem("skin") || "0");

// ---------- Runtime ----------
let myId = null, hostId = null, currentRoomId = null;
let lobbyPlayers = {}, gameStarted = false;
let serverState = { players: {}, bullets: [], zones: [] };
let myAngle = 0;
let activeEffects = {};
const keys = { up: false, down: false, left: false, right: false };
let socket = null;

// ---------- DOM ----------
const $ = id => document.getElementById(id);

const splashScreen  = $("splashScreen");
const loginScreen   = $("loginScreen");
const mainMenu      = $("mainMenuScreen");
const serverBrowser = $("serverBrowser");
const lobbyScreen   = $("lobbyScreen");
const gameScreen    = $("gameScreen");

const loginBtn    = $("loginBtn");
const loginPseudo = $("pseudoInput");
const loginReal   = $("realNameInput");
const pseudoError = $("pseudoError");

const playBtn       = $("playBtn");
const closeBrowser  = $("closeBrowser");
const roomsListEl   = $("roomsList");
const roomsCountEl  = $("roomsCount");
const refreshRooms  = $("refreshRooms");
const codeInput     = $("codeInput");
const joinByCodeBtn = $("joinByCodeBtn");
const serverNameInput = $("serverNameInput");
const createRoomBtn = $("createRoomBtn");

const playersGrid  = $("playersGrid");
const playerCount  = $("playerCount");
const actionBtn    = $("actionBtn");
const quitBtn      = $("quitBtn");
const roomCodeDisplay = $("roomCodeDisplay");
const roomNameDisplay = $("roomNameDisplay");

const settingsBtn  = $("settingsBtn");
const settingsBtn2 = $("settingsBtn2");
const settingsModal= $("settingsModal");
const closeSettings= $("closeSettings");
const settingsPseudo   = $("settingsPseudo");
const settingsRealName = $("settingsRealName");
const skinPicker   = $("skinPicker");

const userPseudoEl = $("userPseudo");
const userRealEl   = $("userReal");

const canvas = $("game");
const ctx    = canvas.getContext("2d");

// ---------- Écrans ----------
function showScreen(name) {
  splashScreen.classList.toggle("hidden",  name !== "splash");
  loginScreen.classList.toggle("hidden",   name !== "login");
  mainMenu.classList.toggle("hidden",      name !== "menu");
  serverBrowser.classList.toggle("hidden", name !== "browser");
  lobbyScreen.classList.toggle("hidden",   name !== "lobby");
  gameScreen.classList.toggle("hidden",    name !== "game");
  if (name === "game") resizeCanvas();
}

// ==================================================================
//  SPLASH — GALAXY ANIMATION
// ==================================================================
(function initGalaxySplash() {
  const c = $("galaxyCanvas");
  const g = c.getContext("2d");
  let running = true;

  function resize() {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  // Spiral galaxy particles
  const galaxy = [];
  const cx = () => c.width / 2;
  const cy = () => c.height / 2;

  for (let i = 0; i < 600; i++) {
    const angle = Math.random() * Math.PI * 2;
    const arms = 2;
    const armAngle = (Math.floor(Math.random() * arms) / arms) * Math.PI * 2;
    const dist = Math.pow(Math.random(), 0.6) * Math.min(c.width, c.height) * 0.45;
    const spiralOffset = dist * 0.008;
    galaxy.push({
      baseAngle: armAngle + spiralOffset,
      dist,
      size: Math.random() * 1.6 + 0.3,
      speed: 0.0002 + Math.random() * 0.0004,
      hue: Math.random() * 60 + 200, // bleu/violet
      alpha: Math.random() * 0.6 + 0.3
    });
  }

  // Background stars
  const stars = [];
  for (let i = 0; i < 200; i++) {
    stars.push({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      r: Math.random() * 1.2 + 0.2,
      alpha: Math.random() * 0.6 + 0.2,
      twinkle: Math.random() * 0.02 + 0.005
    });
  }

  // Shooting stars
  const shooting = [];
  function spawnShooting() {
    shooting.push({
      x: Math.random() * c.width * 0.6,
      y: Math.random() * c.height * 0.4,
      len: 150 + Math.random() * 100,
      speed: 8 + Math.random() * 6,
      alpha: 1,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3
    });
  }

  let t = 0;
  function loop() {
    if (!running) return;
    t++;

    // Fond noir dégradé
    const bgGrad = g.createRadialGradient(cx(), cy(), 50, cx(), cy(), Math.max(c.width, c.height));
    bgGrad.addColorStop(0, "#0a1530");
    bgGrad.addColorStop(0.5, "#050a1e");
    bgGrad.addColorStop(1, "#000000");
    g.fillStyle = bgGrad;
    g.fillRect(0, 0, c.width, c.height);

    // Stars
    stars.forEach(s => {
      s.alpha += (Math.random() - 0.5) * s.twinkle;
      s.alpha = Math.max(0.1, Math.min(0.9, s.alpha));
      g.fillStyle = `rgba(200, 220, 255, ${s.alpha})`;
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.fill();
    });

    // Galaxy spiral
    galaxy.forEach(p => {
      const angle = p.baseAngle + t * p.speed;
      const x = cx() + Math.cos(angle) * p.dist;
      const y = cy() + Math.sin(angle) * p.dist * 0.55; // aplatir pour effet 3D
      g.fillStyle = `hsla(${p.hue}, 80%, 65%, ${p.alpha})`;
      g.beginPath();
      g.arc(x, y, p.size, 0, Math.PI * 2);
      g.fill();
    });

    // Centre lumineux
    const coreGlow = g.createRadialGradient(cx(), cy(), 0, cx(), cy(), 180);
    coreGlow.addColorStop(0, "rgba(120, 180, 255, 0.4)");
    coreGlow.addColorStop(0.4, "rgba(80, 120, 220, 0.15)");
    coreGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = coreGlow;
    g.beginPath();
    g.arc(cx(), cy(), 180, 0, Math.PI * 2);
    g.fill();

    // Shooting stars
    if (Math.random() < 0.008 && shooting.length < 3) spawnShooting();
    for (let i = shooting.length - 1; i >= 0; i--) {
      const sh = shooting[i];
      const ex = sh.x + Math.cos(sh.angle) * sh.len;
      const ey = sh.y + Math.sin(sh.angle) * sh.len;
      const grad = g.createLinearGradient(sh.x, sh.y, ex, ey);
      grad.addColorStop(0, `rgba(200, 230, 255, ${sh.alpha})`);
      grad.addColorStop(1, "rgba(200, 230, 255, 0)");
      g.strokeStyle = grad;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(sh.x, sh.y);
      g.lineTo(ex, ey);
      g.stroke();

      sh.x += Math.cos(sh.angle) * sh.speed;
      sh.y += Math.sin(sh.angle) * sh.speed;
      sh.alpha -= 0.015;
      if (sh.alpha <= 0 || sh.x > c.width + 200 || sh.y > c.height + 200) {
        shooting.splice(i, 1);
      }
    }

    requestAnimationFrame(loop);
  }
  loop();

  window.__stopGalaxy = () => { running = false; };
})();

// ==================================================================
//  LOGIN BACKGROUND — étoiles flottantes
// ==================================================================
(function initLoginBg() {
  const c = $("loginCanvas");
  if (!c) return;
  const g = c.getContext("2d");
  let running = true;

  function resize() {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const particles = [];
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5
    });
  }

  function loop() {
    if (!running) return;
    g.clearRect(0, 0, c.width, c.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = c.width;
      if (p.x > c.width) p.x = 0;
      if (p.y < 0) p.y = c.height;
      if (p.y > c.height) p.y = 0;
      g.fillStyle = "rgba(100, 180, 255, 0.5)";
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fill();
    });

    // Lignes entre particules proches
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d = Math.hypot(dx, dy);
        if (d < 120) {
          g.strokeStyle = `rgba(68, 170, 255, ${0.15 * (1 - d / 120)})`;
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(particles[i].x, particles[i].y);
          g.lineTo(particles[j].x, particles[j].y);
          g.stroke();
        }
      }
    }
    requestAnimationFrame(loop);
  }
  loop();

  window.__stopLoginBg = () => { running = false; };
})();

// ==================================================================
//  FLOW DÉMARRAGE
// ==================================================================
showScreen("splash");

setTimeout(() => {
  window.__stopGalaxy && window.__stopGalaxy();
  if (pseudo.length >= 5 && realName.trim().length > 0) {
    startConnection();
    showScreen("menu");
  } else {
    loginPseudo.value = pseudo;
    loginReal.value = realName;
    validateLoginForm();
    showScreen("login");
    loginPseudo.focus();
  }
}, 4200);

// ---------- Login ----------
function validateLoginForm() {
  const p = loginPseudo.value.trim();
  const r = loginReal.value.trim();
  if (p.length === 0) pseudoError.textContent = "";
  else if (p.length < 5) pseudoError.textContent = "Le pseudo doit faire au moins 5 caractères.";
  else if (p.length > 16) pseudoError.textContent = "Maximum 16 caractères.";
  else pseudoError.textContent = "";
  loginBtn.disabled = !(p.length >= 5 && r.length > 0);
}

loginPseudo.addEventListener("input", validateLoginForm);
loginReal.addEventListener("input", validateLoginForm);

loginBtn.addEventListener("click", () => {
  const p = loginPseudo.value.trim();
  const r = loginReal.value.trim();
  if (p.length < 5 || r.length === 0) return;

  pseudo = p; realName = r;
  localStorage.setItem("pseudo", pseudo);
  localStorage.setItem("realName", realName);

  window.__stopLoginBg && window.__stopLoginBg();
  startConnection();
  showScreen("menu");
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
  if (socket) return;
  socket = io();

  socket.on("connect", () => {
    myId = socket.id;
    userPseudoEl.textContent = pseudo;
    userRealEl.textContent = realName;
    socket.emit("list-rooms");
  });

  // ----- Server list -----
  socket.on("room-list-update", list => {
    renderRoomList(list);
    $("onlineCount").textContent = `${list.length} serveur${list.length > 1 ? "s" : ""} actif${list.length > 1 ? "s" : ""}`;
  });

  // ----- Création / rejoindre -----
  socket.on("room-created", data => {
    currentRoomId = data.id;
    roomCodeDisplay.textContent = data.id;
    roomNameDisplay.textContent = "— " + data.name;
    // On rejoint notre propre room
    socket.emit("join-room", {
      id: data.id,
      pseudo, realName, skin: currentSkin
    });
  });

  socket.on("room-joined", data => {
    currentRoomId = data.id;
    roomCodeDisplay.textContent = data.id;
    roomNameDisplay.textContent = "— " + data.name;
    showScreen("lobby");
  });

  socket.on("join-error", msg => {
    alert("❌ " + msg);
  });

  socket.on("left-room", () => {
    currentRoomId = null;
    showScreen("browser");
    socket.emit("list-rooms");
  });

  // ----- Lobby -----
  socket.on("lobby-update", data => {
    lobbyPlayers = data.players;
    hostId = data.hostId;
    gameStarted = data.gameStarted;
    if (data.roomId) {
      roomCodeDisplay.textContent = data.roomId;
      roomNameDisplay.textContent = "— " + data.roomName;
    }
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
}

// ==================================================================
//  MAIN MENU
// ==================================================================
playBtn.addEventListener("click", () => {
  showScreen("browser");
  if (socket) socket.emit("list-rooms");
});

// ==================================================================
//  SERVER BROWSER
// ==================================================================
closeBrowser.addEventListener("click", () => showScreen("menu"));

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    $("tab-join").classList.toggle("hidden", tab !== "join");
    $("tab-create").classList.toggle("hidden", tab !== "create");
  });
});

refreshRooms.addEventListener("click", () => socket && socket.emit("list-rooms"));

joinByCodeBtn.addEventListener("click", () => {
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== 5) { alert("Code à 5 caractères."); return; }
  if (!socket) return;
  socket.emit("join-room", { id: code, pseudo, realName, skin: currentSkin });
});

codeInput.addEventListener("input", () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

createRoomBtn.addEventListener("click", () => {
  if (!socket) return;
  const name = (serverNameInput.value.trim() || `Serveur de ${pseudo}`).slice(0, 24);
  socket.emit("create-room", { name });
});

function renderRoomList(list) {
  roomsCountEl.textContent = `${list.length} serveur${list.length > 1 ? "s" : ""} disponible${list.length > 1 ? "s" : ""}`;
  roomsListEl.innerHTML = "";
  if (list.length === 0) {
    roomsListEl.innerHTML = `<div class="no-rooms">AUCUN SERVEUR POUR LE MOMENT<br><span class="small">Crée le tien dans l'onglet "CRÉER"</span></div>`;
    return;
  }
  list.forEach(r => {
    const el = document.createElement("div");
    el.className = "room-item";
    if (r.count >= r.max) el.classList.add("full");
    el.innerHTML = `
      <div class="room-item-info">
        <div class="room-item-name">${escapeHtml(r.name)}</div>
        <div class="room-item-meta">
          <span>Hôte : <b>${escapeHtml(r.host)}</b></span>
          <span class="code">${r.id}</span>
          <span>${r.count}/${r.max} joueur${r.count > 1 ? "s" : ""}</span>
        </div>
      </div>
      <button class="join-btn">${r.started ? "EN COURS" : "REJOINDRE"}</button>
    `;
    if (!r.started && r.count < r.max) {
      el.querySelector(".join-btn").addEventListener("click", () => {
        socket.emit("join-room", {
          id: r.id, pseudo, realName, skin: currentSkin
        });
      });
    }
    roomsListEl.appendChild(el);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
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
    socket.emit("leave-room");
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
function openSettings() {
  settingsPseudo.value = pseudo;
  settingsRealName.value = realName;
  settingsModal.classList.remove("hidden");
  buildSkinPicker();
}
settingsBtn.addEventListener("click", openSettings);
settingsBtn2.addEventListener("click", openSettings);
closeSettings.addEventListener("click", () => settingsModal.classList.add("hidden"));

settingsPseudo.addEventListener("change", () => {
  const v = (settingsPseudo.value || "").trim();
  if (v.length < 5 || v.length > 16) { settingsPseudo.value = pseudo; return; }
  pseudo = v;
  localStorage.setItem("pseudo", pseudo);
  userPseudoEl.textContent = pseudo;
  if (socket) socket.emit("update-pseudo", pseudo);
});

settingsRealName.addEventListener("change", () => {
  const v = (settingsRealName.value || "").trim().slice(0, 32);
  realName = v;
  localStorage.setItem("realName", realName);
  userRealEl.textContent = realName;
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
//  CLAVIER
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
  if (!gameStarted || !myId || !socket) return;
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
//  CANVAS GAME
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
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
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
  ctx.strokeRect(-cam.x, -cam.y, 3200, 3200);
}

const ZONE_COLORS = {
  heal:   { main: "#4f4",  glow: "rgba(68,255,68,0.4)"  },
  speed:  { main: "#4af",  glow: "rgba(68,170,255,0.4)" },
  damage: { main: "#f55",  glow: "rgba(255,85,85,0.4)"  },
  shield: { main: "#fd4",  glow: "rgba(255,221,68,0.4)" }
};

function drawZones() {
  const cam = getCamera();
  const time = Date.now() / 1000;
  serverState.zones.forEach(z => {
    const info = ZONE_COLORS[z.type] || ZONE_COLORS.heal;
    const x = z.x - cam.x;
    const y = z.y - cam.y;
    const pulse = 1 + Math.sin(time * 2 + z.x * 0.01) * 0.05;
    const r = z.radius * pulse;

    // Halo extérieur
    const grad = ctx.createRadialGradient(x, y, r * 0.3, x, y, r);
    grad.addColorStop(0, info.glow);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Anneau
    ctx.strokeStyle = info.main;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -time * 40;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = info.main;
    ctx.font = "bold 13px Segoe UI, Arial";
    ctx.textAlign = "center";
    const labels = { heal: "❤ SOIN", speed: "⚡ VITESSE", damage: "💥 DÉGÂTS", shield: "🛡 BOUCLIER" };
    ctx.fillText(labels[z.type] || z.type.toUpperCase(), x, y - r - 8);
  });
}

function drawPlayer(p, isMe) {
  const cam = getCamera();
  const x = p.x - cam.x, y = p.y - cam.y;

  // Ombre
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 32, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Aura shield
  if (p.shield > 0) {
    ctx.strokeStyle = "rgba(255,221,68,0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Aura speed
  if (p.speedBoost > 0) {
    ctx.strokeStyle = "rgba(68,170,255,0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(x, y, 36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Tank
  ctx.save();
  ctx.translate(x, y);
  drawTankShape(ctx, p.skin, p.angle);
  ctx.restore();

  // Nom
  ctx.fillStyle = isMe ? "#4af" : "#fff";
  ctx.font = "bold 13px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.fillText(p.pseudo, x, y - 50);

  if (p.realName) {
    ctx.fillStyle = "#789";
    ctx.font = "italic 11px Segoe UI, Arial";
    ctx.fillText(p.realName, x, y - 36);
  }

  // HP bar
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
  const el = $("scoreboard");
  const list = Object.values(serverState.players).sort((a, b) => b.hp - a.hp);
  el.innerHTML = list.map(p => {
    const c = p.alive ? (p.id === myId ? "#4af" : "#ddd") : "#f55";
    return `<div style="color:${c}">${p.pseudo} — ${p.alive ? Math.round(p.hp) + " HP" : "💀"}</div>`;
  }).join("");
}

function drawZoneIndicator() {
  const el = $("zoneIndicator");
  const me = serverState.players[myId];
  if (!me) { el.innerHTML = ""; return; }
  const chips = [];
  if (me.shield > 0) chips.push(`<div class="zone-chip" style="color:#fd4;border-color:#fd4">🛡 BOUCLIER ${Math.ceil(me.shield / 60)}s</div>`);
  if (me.speedBoost > 0) chips.push(`<div class="zone-chip" style="color:#4af;border-color:#4af">⚡ VITESSE</div>`);
  el.innerHTML = chips.join("");
}

function loop() {
  if (gameStarted) {
    ctx.fillStyle = "#0a0e27";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawZones();
    Object.values(serverState.players).forEach(p => {
      if (p.alive) drawPlayer(p, p.id === myId);
    });
    drawBullets();
    drawScoreboard();
    drawZoneIndicator();
  }
  requestAnimationFrame(loop);
}
loop();

// ==================================================================
//  MENU BACKGROUND
// ==================================================================
(function initMenuBg() {
  const c = $("menuCanvas");
  if (!c) return;
  const g = c.getContext("2d");
  let running = true;
  function resize() {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const stars = [];
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      r: Math.random() * 1.4 + 0.3,
      alpha: Math.random() * 0.7 + 0.3,
      speed: Math.random() * 0.3 + 0.05
    });
  }

  function loop() {
    if (!running) return;
    g.fillStyle = "rgba(3, 4, 13, 0.3)";
    g.fillRect(0, 0, c.width, c.height);
    stars.forEach(s => {
      s.y += s.speed;
      if (s.y > c.height) { s.y = 0; s.x = Math.random() * c.width; }
      g.fillStyle = `rgba(180, 220, 255, ${s.alpha})`;
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.fill();
    });
    requestAnimationFrame(loop);
  }
  loop();
})();