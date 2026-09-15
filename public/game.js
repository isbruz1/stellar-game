/* ==================================================================
   STELLAR GAME — Client V3
   ================================================================== */

// ---------- Accounts (localStorage) ----------
function loadAccounts() {
  try { return JSON.parse(localStorage.getItem("accounts") || "[]"); }
  catch { return []; }
}
function saveAccounts(a) { localStorage.setItem("accounts", JSON.stringify(a)); }

let accounts = loadAccounts();
let currentAccount = null; // { pseudo, realName, skin }

// ---------- Runtime ----------
let myId = null, hostId = null, currentRoomId = null;
let lobbyPlayers = {}, gameStarted = false;
let serverState = { players: {}, bullets: [], zones: [], mapData: null, announcement: null };
let myAngle = 0;
let dead = false;
let spectating = null;
const keys = { up: false, down: false, left: false, right: false };
let socket = null;
let selectedAccountIdx = -1;

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const splashScreen    = $("splashScreen");
const profilesScreen  = $("profilesScreen");
const newAccountScreen= $("newAccountScreen");
const mainMenu        = $("mainMenuScreen");
const serverBrowser   = $("serverBrowser");
const lobbyScreen     = $("lobbyScreen");
const gameScreen      = $("gameScreen");

const pseudoInput = $("pseudoInput");
const realNameInput = $("realNameInput");
const pseudoError = $("pseudoError");
const createAccountBtn = $("createAccountBtn");
const backToProfilesBtn = $("backToProfilesBtn");
const newAccountBtn = $("newAccountBtn");
const enterLobbyBtn = $("enterLobbyBtn");
const accountList = $("accountList");
const previewCanvas = $("previewCanvas");
const previewPseudo = $("previewPseudo");
const previewReal = $("previewReal");

const userPseudoEl = $("userPseudo");
const userRealEl = $("userReal");
const disconnectBtn = $("disconnectBtn");

const playBtn = $("playBtn");
const closeBrowser = $("closeBrowser");
const roomsListEl = $("roomsList");
const roomsCountEl = $("roomsCount");
const refreshRooms = $("refreshRooms");
const codeInput = $("codeInput");
const joinByCodeBtn = $("joinByCodeBtn");
const serverNameInput = $("serverNameInput");
const createRoomBtn = $("createRoomBtn");

const playersGrid = $("playersGrid");
const playerCount = $("playerCount");
const actionBtn = $("actionBtn");
const quitBtn = $("quitBtn");
const roomCodeDisplay = $("roomCodeDisplay");
const roomNameDisplay = $("roomNameDisplay");

const settingsModal = $("settingsModal");
const closeSettings = $("closeSettings");
const settingsPseudo = $("settingsPseudo");
const settingsRealName = $("settingsRealName");
const skinPicker = $("skinPicker");

const canvas = $("game");
const ctx = canvas.getContext("2d");
const minimap = $("minimap");
const mmCtx = minimap.getContext("2d");

// ---------- Screens ----------
function showScreen(name) {
  [splashScreen, profilesScreen, newAccountScreen, mainMenu, serverBrowser, lobbyScreen, gameScreen]
    .forEach(s => s.classList.add("hidden"));
  const map = {
    splash: splashScreen, profiles: profilesScreen, newAccount: newAccountScreen,
    menu: mainMenu, browser: serverBrowser, lobby: lobbyScreen, game: gameScreen
  };
  if (map[name]) map[name].classList.remove("hidden");
  if (name === "game") resizeCanvas();
}

// ==================================================================
//  SPLASH GALAXY
// ==================================================================
(function initGalaxy() {
  const c = $("galaxyCanvas");
  const g = c.getContext("2d");
  let running = true;
  function resize() { c.width = window.innerWidth; c.height = window.innerHeight; }
  resize();
  window.addEventListener("resize", resize);

  const galaxy = [];
  for (let i = 0; i < 600; i++) {
    const armAngle = (Math.floor(Math.random() * 2) / 2) * Math.PI * 2;
    const dist = Math.pow(Math.random(), 0.6) * Math.min(c.width, c.height) * 0.45;
    galaxy.push({
      baseAngle: armAngle + dist * 0.008, dist,
      size: Math.random() * 1.6 + 0.3,
      speed: 0.0002 + Math.random() * 0.0004,
      hue: Math.random() * 60 + 200, alpha: Math.random() * 0.6 + 0.3
    });
  }
  const stars = [];
  for (let i = 0; i < 200; i++) {
    stars.push({ x: Math.random() * c.width, y: Math.random() * c.height, r: Math.random() * 1.2 + 0.2, alpha: Math.random() * 0.6 + 0.2, twinkle: Math.random() * 0.02 + 0.005 });
  }
  let t = 0;
  (function loop() {
    if (!running) return;
    t++;
    const bg = g.createRadialGradient(c.width/2, c.height/2, 50, c.width/2, c.height/2, Math.max(c.width, c.height));
    bg.addColorStop(0, "#0a1530"); bg.addColorStop(0.5, "#050a1e"); bg.addColorStop(1, "#000");
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);

    stars.forEach(s => {
      s.alpha += (Math.random() - 0.5) * s.twinkle;
      s.alpha = Math.max(0.1, Math.min(0.9, s.alpha));
      g.fillStyle = `rgba(200,220,255,${s.alpha})`;
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI*2); g.fill();
    });

    galaxy.forEach(p => {
      const a = p.baseAngle + t * p.speed;
      const x = c.width/2 + Math.cos(a) * p.dist;
      const y = c.height/2 + Math.sin(a) * p.dist * 0.55;
      g.fillStyle = `hsla(${p.hue}, 80%, 65%, ${p.alpha})`;
      g.beginPath(); g.arc(x, y, p.size, 0, Math.PI*2); g.fill();
    });

    const core = g.createRadialGradient(c.width/2, c.height/2, 0, c.width/2, c.height/2, 180);
    core.addColorStop(0, "rgba(120,180,255,0.4)");
    core.addColorStop(0.4, "rgba(80,120,220,0.15)");
    core.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = core;
    g.beginPath(); g.arc(c.width/2, c.height/2, 180, 0, Math.PI*2); g.fill();

    requestAnimationFrame(loop);
  })();
  window.__stopGalaxy = () => { running = false; };
})();

// ==================================================================
//  BACKGROUND générique (profils / newAccount / menu)
// ==================================================================
function initStarfield(canvasId, opacity = 0.5) {
  const c = $(canvasId);
  if (!c) return;
  const g = c.getContext("2d");
  let running = true;
  function resize() { c.width = window.innerWidth; c.height = window.innerHeight; }
  resize();
  window.addEventListener("resize", resize);

  const stars = [];
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * c.width, y: Math.random() * c.height,
      r: Math.random() * 1.4 + 0.3, alpha: Math.random() * 0.7 + 0.3,
      speed: Math.random() * 0.3 + 0.05
    });
  }
  (function loop() {
    if (!running) return;
    g.fillStyle = `rgba(3,4,13,${opacity})`;
    g.fillRect(0, 0, c.width, c.height);
    stars.forEach(s => {
      s.y += s.speed;
      if (s.y > c.height) { s.y = 0; s.x = Math.random() * c.width; }
      g.fillStyle = `rgba(180,220,255,${s.alpha})`;
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI*2); g.fill();
    });
    requestAnimationFrame(loop);
  })();
  return () => { running = false; };
}

// ==================================================================
//  FLOW DÉMARRAGE
// ==================================================================
showScreen("splash");

setTimeout(() => {
  window.__stopGalaxy && window.__stopGalaxy();
  showScreen("profiles");
  initStarfield("profilesCanvas");
  renderAccounts();
}, 3800);

// ==================================================================
//  COMPTES
// ==================================================================
function renderAccounts() {
  accountList.innerHTML = "";
  if (accounts.length === 0) {
    accountList.innerHTML = `<div class="no-rooms" style="grid-column:1/-1">AUCUN COMPTE<br><span class="muted">Crée-en un pour commencer</span></div>`;
    enterLobbyBtn.disabled = true;
    previewPseudo.textContent = "—";
    previewReal.textContent = "—";
    return;
  }

  accounts.forEach((acc, idx) => {
    const card = document.createElement("div");
    card.className = "account-card";
    if (idx === selectedAccountIdx) card.classList.add("selected");

    const c = document.createElement("canvas");
    c.width = 80; c.height = 80;
    drawTankPreview(c, acc.skin || 0);
    card.appendChild(c);

    const n = document.createElement("div");
    n.className = "name";
    n.textContent = acc.pseudo;
    card.appendChild(n);

    const r = document.createElement("div");
    r.className = "real";
    r.textContent = acc.realName || "";
    card.appendChild(r);

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "✕";
    del.title = "Supprimer ce compte";
    del.addEventListener("click", e => {
      e.stopPropagation();
      if (confirm(`⚠️ Supprimer DÉFINITIVEMENT le compte "${acc.pseudo}" ?\n\nCette action est irréversible.`)) {
        if (confirm(`Dernière confirmation : supprimer "${acc.pseudo}" et le retirer du serveur ?`)) {
          accounts.splice(idx, 1);
          saveAccounts(accounts);
          if (currentAccount && currentAccount.pseudo === acc.pseudo) currentAccount = null;
          if (selectedAccountIdx >= accounts.length) selectedAccountIdx = accounts.length - 1;
          if (socket) socket.emit("delete-account", acc.pseudo);
          renderAccounts();
          showDeleteBanner(acc.pseudo);
        }
      }
    });
    card.appendChild(del);

    card.addEventListener("click", () => {
      selectedAccountIdx = idx;
      renderAccounts();
      previewAccount(acc);
    });

    accountList.appendChild(card);
  });

  if (selectedAccountIdx >= 0 && accounts[selectedAccountIdx]) {
    previewAccount(accounts[selectedAccountIdx]);
  } else {
    selectedAccountIdx = 0;
    previewAccount(accounts[0]);
  }
}

function previewAccount(acc) {
  previewPseudo.textContent = acc.pseudo;
  previewReal.textContent = acc.realName || "";
  const c = previewCanvas;
  const cx = c.getContext("2d");
  cx.clearRect(0, 0, c.width, c.height);
  cx.save();
  cx.translate(c.width / 2, c.height / 2);
  drawTankShape(cx, acc.skin || 0, -Math.PI / 2, 2.2);
  cx.restore();
  enterLobbyBtn.disabled = false;
}

function showDeleteBanner(pseudo) {
  const banner = document.createElement("div");
  banner.className = "delete-banner";
  banner.textContent = `⚠️ COMPTE "${pseudo}" SUPPRIMÉ DÉFINITIVEMENT DU SERVEUR ⚠️`;
  document.body.insertBefore(banner, document.body.firstChild);
  setTimeout(() => banner.remove(), 5000);
}

enterLobbyBtn.addEventListener("click", () => {
  if (selectedAccountIdx < 0 || !accounts[selectedAccountIdx]) return;
  currentAccount = { ...accounts[selectedAccountIdx] };
  userPseudoEl.textContent = currentAccount.pseudo;
  userRealEl.textContent = currentAccount.realName;
  startConnection();
  showScreen("menu");
  initStarfield("menuCanvas");
});

newAccountBtn.addEventListener("click", () => {
  pseudoInput.value = "";
  realNameInput.value = "";
  pseudoError.textContent = "";
  createAccountBtn.disabled = true;
  showScreen("newAccount");
  initStarfield("newAccountCanvas");
  pseudoInput.focus();
});

backToProfilesBtn.addEventListener("click", () => showScreen("profiles"));

// Validation nouveau compte
function validateNewAccount() {
  const p = pseudoInput.value.trim();
  const r = realNameInput.value.trim();
  if (p.length === 0) pseudoError.textContent = "";
  else if (p.length < 5) pseudoError.textContent = "Minimum 5 caractères.";
  else if (p.length > 16) pseudoError.textContent = "Maximum 16 caractères.";
  else if (accounts.some(a => a.pseudo.toLowerCase() === p.toLowerCase()))
    pseudoError.textContent = "Ce pseudo existe déjà.";
  else pseudoError.textContent = "";
  createAccountBtn.disabled = !(p.length >= 5 && p.length <= 16 &&
    r.length > 0 && !accounts.some(a => a.pseudo.toLowerCase() === p.toLowerCase()));
}
pseudoInput.addEventListener("input", validateNewAccount);
realNameInput.addEventListener("input", validateNewAccount);

createAccountBtn.addEventListener("click", () => {
  const p = pseudoInput.value.trim();
  const r = realNameInput.value.trim();
  if (p.length < 5 || r.length === 0) return;
  const acc = { pseudo: p, realName: r, skin: 0 };
  accounts.push(acc);
  saveAccounts(accounts);
  selectedAccountIdx = accounts.length - 1;
  showScreen("profiles");
  renderAccounts();
});

// ==================================================================
//  SOCKET
// ==================================================================
function startConnection() {
  if (socket) return;
  socket = io();

  socket.on("connect", () => {
    myId = socket.id;
    socket.emit("list-rooms");
  });

  socket.on("room-list-update", list => {
    renderRoomList(list);
    const el = $("onlineCount");
    if (el) el.textContent = `${list.length} serveur${list.length > 1 ? "s" : ""} actif${list.length > 1 ? "s" : ""}`;
  });

  socket.on("room-created", data => {
    currentRoomId = data.id;
    roomCodeDisplay.textContent = data.id;
    roomNameDisplay.textContent = "— " + data.name;
    socket.emit("join-room", {
      id: data.id,
      pseudo: currentAccount.pseudo,
      realName: currentAccount.realName,
      skin: currentAccount.skin || 0
    });
  });

  socket.on("room-joined", data => {
    currentRoomId = data.id;
    roomCodeDisplay.textContent = data.id;
    roomNameDisplay.textContent = "— " + data.name;
    showScreen("lobby");
  });

  socket.on("join-error", msg => alert("❌ " + msg));

  socket.on("left-room", () => {
    currentRoomId = null;
    showScreen("browser");
    socket.emit("list-rooms");
  });

  socket.on("account-deleted", () => {
    if (socket) { socket.disconnect(); socket = null; }
  });

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
    dead = false;
    showScreen("game");
    $("deathScreen").classList.add("hidden");
    $("spectatePanel").classList.add("hidden");
    keys.up = keys.down = keys.left = keys.right = false;
  });

  socket.on("game-ended", () => {
    gameStarted = false;
    showScreen("lobby");
  });

  socket.on("state", s => {
    const wasAlive = serverState.players[myId]?.alive;
    serverState = s;

    // Détection mort
    const me = s.players[myId];
    if (me && !me.alive && !dead && gameStarted) {
      dead = true;
      $("deathScreen").classList.remove("hidden");
    }
    if (me && me.alive && dead) {
      dead = false;
      $("deathScreen").classList.add("hidden");
      $("spectatePanel").classList.add("hidden");
      spectating = null;
    }
  });
}

// ==================================================================
//  MAIN MENU
// ==================================================================
playBtn.addEventListener("click", () => {
  showScreen("browser");
  if (socket) socket.emit("list-rooms");
});

disconnectBtn.addEventListener("click", () => {
  if (!confirm("Se déconnecter ?")) return;
  if (socket) { socket.disconnect(); socket = null; }
  currentAccount = null;
  selectedAccountIdx = -1;
  showScreen("profiles");
  renderAccounts();
});

// ==================================================================
//  BROWSER
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
  if (code.length !== 5) return alert("Code à 5 caractères.");
  if (!socket) return;
  socket.emit("join-room", {
    id: code,
    pseudo: currentAccount.pseudo,
    realName: currentAccount.realName,
    skin: currentAccount.skin || 0
  });
});

codeInput.addEventListener("input", () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

createRoomBtn.addEventListener("click", () => {
  if (!socket) return;
  const name = (serverNameInput.value.trim() || `Serveur de ${currentAccount.pseudo}`).slice(0, 24);
  socket.emit("create-room", { name });
});

function renderRoomList(list) {
  if (!roomsCountEl) return;
  roomsCountEl.textContent = `${list.length} serveur${list.length > 1 ? "s" : ""}`;
  roomsListEl.innerHTML = "";
  if (list.length === 0) {
    roomsListEl.innerHTML = `<div class="no-rooms">AUCUN SERVEUR DISPONIBLE<br><span class="muted">Crée le tien dans l'onglet CRÉER</span></div>`;
    return;
  }
  list.forEach(r => {
    const el = document.createElement("div");
    el.className = "room-item";
    if (r.count >= r.max) el.classList.add("full");
    el.innerHTML = `
      <div class="room-item-info">
        <div class="room-item-name">${esc(r.name)}</div>
        <div class="room-item-meta">
          <span>Hôte : <b>${esc(r.host)}</b></span>
          <span class="code">${r.id}</span>
          <span>${r.count}/${r.max}</span>
        </div>
      </div>
      <button class="join-btn">${r.started ? "EN COURS" : "REJOINDRE"}</button>
    `;
    if (!r.started && r.count < r.max) {
      el.querySelector(".join-btn").addEventListener("click", () => {
        socket.emit("join-room", {
          id: r.id, pseudo: currentAccount.pseudo,
          realName: currentAccount.realName, skin: currentAccount.skin || 0
        });
      });
    }
    roomsListEl.appendChild(el);
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
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
    const n = document.createElement("div");
    n.className = "name"; n.textContent = p.pseudo + (p.id === myId ? " (toi)" : "");
    card.appendChild(n);
    if (p.realName) {
      const r = document.createElement("div");
      r.className = "realname"; r.textContent = p.realName;
      card.appendChild(r);
    }
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
  if (!socket) return;
  if (myId === hostId) socket.emit("start-game");
  else socket.emit("toggle-ready");
});

quitBtn.addEventListener("click", () => {
  if (confirm("Quitter le serveur ?")) socket.emit("leave-room");
});

$("leaveGameBtn").addEventListener("click", () => {
  if (!socket) return;
  socket.emit("leave-game");
  gameStarted = false;
  dead = false;
  spectating = null;
  showScreen("lobby");
});

// ==================================================================
//  DEATH SCREEN
// ==================================================================
$("backToLobbyBtn").addEventListener("click", () => {
  if (!socket) return;
  socket.emit("leave-game");
  dead = false;
  spectating = null;
  gameStarted = false;
  showScreen("lobby");
});

$("spectateBtn").addEventListener("click", () => {
  $("deathScreen").classList.add("hidden");
  $("spectatePanel").classList.remove("hidden");
  renderSpectateList();
});

$("stopSpectateBtn").addEventListener("click", () => {
  if (socket) socket.emit("stop-spectate");
  spectating = null;
  $("spectatePanel").classList.add("hidden");
  $("deathScreen").classList.remove("hidden");
});

function renderSpectateList() {
  const list = $("spectateList");
  list.innerHTML = "";
  Object.values(serverState.players).forEach(p => {
    if (!p.alive || p.id === myId) return;
    const el = document.createElement("div");
    el.className = "spectate-item" + (spectating === p.id ? " active" : "");
    el.textContent = `${p.pseudo} (${Math.round(p.hp)} HP) — 👁 ${p.spectators || 0}`;
    el.addEventListener("click", () => {
      if (socket) socket.emit("spectate", p.id);
      spectating = p.id;
      renderSpectateList();
    });
    list.appendChild(el);
  });
}

// ==================================================================
//  PARAMÈTRES
// ==================================================================
function openSettings() {
  settingsPseudo.value = currentAccount?.pseudo || "";
  settingsRealName.value = currentAccount?.realName || "";
  settingsModal.classList.remove("hidden");
  buildSkinPicker();
}
$("settingsBtn")?.addEventListener("click", openSettings);
closeSettings.addEventListener("click", () => settingsModal.classList.add("hidden"));

settingsPseudo.addEventListener("change", () => {
  const v = (settingsPseudo.value || "").trim();
  if (v.length < 5 || v.length > 16) { settingsPseudo.value = currentAccount.pseudo; return; }
  currentAccount.pseudo = v;
  userPseudoEl.textContent = v;
  updateAccountInStorage();
  if (socket) socket.emit("update-pseudo", v);
});

settingsRealName.addEventListener("change", () => {
  const v = (settingsRealName.value || "").trim().slice(0, 32);
  currentAccount.realName = v;
  userRealEl.textContent = v;
  updateAccountInStorage();
  if (socket) socket.emit("update-realname", v);
});

function updateAccountInStorage() {
  const i = accounts.findIndex(a => a.pseudo === currentAccount.pseudo);
  // On récupère par pseudo d'origine - plus simple : on remplace l'entrée sélectionnée
  if (selectedAccountIdx >= 0 && accounts[selectedAccountIdx]) {
    accounts[selectedAccountIdx] = { ...currentAccount };
    saveAccounts(accounts);
  }
}

function buildSkinPicker() {
  skinPicker.innerHTML = "";
  SKINS.forEach((s, i) => {
    const c = document.createElement("canvas");
    c.width = 70; c.height = 70;
    c.className = "skin-option" + (i === (currentAccount?.skin || 0) ? " selected" : "");
    c.title = s.name;
    drawTankPreview(c, i);
    c.addEventListener("click", () => {
      currentAccount.skin = i;
      updateAccountInStorage();
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
  "z":"up","w":"up","arrowup":"up",
  "s":"down","arrowdown":"down",
  "q":"left","a":"left","arrowleft":"left",
  "d":"right","arrowright":"right"
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
  const wy = e.clientY - rect.top + cam.y;
  myAngle = Math.atan2(wy - me.y, wx - me.x);
});
canvas.addEventListener("mousedown", e => {
  if (e.button !== 0 || !gameStarted || !myId || !socket) return;
  const me = serverState.players[myId];
  if (!me || !me.alive) return;
  socket.emit("shoot", { angle: myAngle });
});

// ==================================================================
//  INPUT serveur
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
  // En mode spectateur, suivre la cible
  const target = spectating ? serverState.players[spectating] : serverState.players[myId];
  if (!target) return { x: 0, y: 0 };
  return { x: target.x - canvas.width / 2, y: target.y - canvas.height / 2 };
}

// ==================================================================
//  RENDU
// ==================================================================
const BIOME_COLORS = {
  grass:  { bg: "#1d3a1a", accent: "#2d5a28", tree: "#0f2410" },
  desert: { bg: "#5a4a2a", accent: "#7a6038", tree: "#3a2a1a" },
  snow:   { bg: "#2a3a4a", accent: "#4a5a6a", tree: "#1a2a3a" },
  water:  { bg: "#0a2040", accent: "#1a3560", tree: "#000000" }
};

function drawBiomes() {
  const md = serverState.mapData;
  if (!md) return;
  const cam = getCamera();

  // Fond par défaut
  ctx.fillStyle = "#0f1a10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Biomes
  md.biomes.forEach(b => {
    const colors = BIOME_COLORS[b.type] || BIOME_COLORS.grass;
    const x = b.x - cam.x, y = b.y - cam.y;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, b.r);
    grad.addColorStop(0, colors.accent);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, b.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawRivers() {
  const md = serverState.mapData;
  if (!md) return;
  const cam = getCamera();
  md.rivers.forEach(r => {
    ctx.strokeStyle = "rgba(30, 80, 150, 0.8)";
    ctx.lineWidth = r.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    r.points.forEach((p, i) => {
      const x = p.x - cam.x, y = p.y - cam.y;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Reflet
    ctx.strokeStyle = "rgba(100, 180, 255, 0.3)";
    ctx.lineWidth = r.width * 0.4;
    ctx.stroke();
  });
}

function drawForests() {
  const md = serverState.mapData;
  if (!md) return;
  const cam = getCamera();
  md.forests.forEach(f => {
    f.forEach(t => {
      const x = t.x - cam.x, y = t.y - cam.y;
      if (x < -50 || x > canvas.width + 50 || y < -50 || y > canvas.height + 50) return;
      // Ombre
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.arc(x + 4, y + 6, t.r, 0, Math.PI * 2);
      ctx.fill();
      // Arbre
      ctx.fillStyle = "#0f2410";
      ctx.beginPath();
      ctx.arc(x, y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2d5a28";
      ctx.beginPath();
      ctx.arc(x - 3, y - 3, t.r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

function drawWalls() {
  const md = serverState.mapData;
  if (!md) return;
  const cam = getCamera();
  md.walls.forEach(w => {
    const x = w.x - cam.x, y = w.y - cam.y;
    if (x + w.w < 0 || x > canvas.width || y + w.h < 0 || y > canvas.height) return;

    // Ombre
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x + 4, y + 6, w.w, w.h);
    // Corps
    ctx.fillStyle = "#3a3a4a";
    ctx.fillRect(x, y, w.w, w.h);
    // Bordure
    ctx.strokeStyle = "#5a5a7a";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w.w, w.h);
    // Reflet
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(x, y, w.w, 6);
  });
}

function drawGrid() {
  const cam = getCamera();
  const g = 100;
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
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
    const x = z.x - cam.x, y = z.y - cam.y;
    const pulse = 1 + Math.sin(time * 2 + z.x * 0.01) * 0.05;
    const r = z.radius * pulse;

    const grad = ctx.createRadialGradient(x, y, r * 0.3, x, y, r);
    grad.addColorStop(0, info.glow);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = info.main;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -time * 40;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Si mobile, flèche directionnelle
    if (z.moving) {
      const arrowLen = 40;
      const a = Math.atan2(z.vy, z.vx);
      ctx.strokeStyle = info.main;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * arrowLen, y + Math.sin(a) * arrowLen);
      ctx.stroke();
    }

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

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 32, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  if (p.shield > 0) {
    ctx.strokeStyle = "rgba(255,221,68,0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (p.speedBoost > 0) {
    ctx.strokeStyle = "rgba(68,170,255,0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(x, y, 36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.save();
  ctx.translate(x, y);
  drawTankShape(ctx, p.skin, p.angle);
  ctx.restore();

  ctx.fillStyle = isMe ? "#4af" : "#fff";
  ctx.font = "bold 13px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.fillText(p.pseudo, x, y - 50);

  // Œil + compteur spectateurs
  if (p.spectators > 0) {
    ctx.fillStyle = "#fd4";
    ctx.font = "bold 12px Segoe UI, Arial";
    ctx.fillText(`👁 ${p.spectators}`, x, y - 66);
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
  const el = $("scoreboard");
  const list = Object.values(serverState.players).sort((a, b) => b.hp - a.hp);
  el.innerHTML = list.map(p => {
    const c = p.alive ? (p.id === myId ? "#4af" : "#ddd") : "#f55";
    const spec = p.spectators > 0 ? ` <span style="color:#fd4">👁${p.spectators}</span>` : "";
    return `<div style="color:${c}">${p.pseudo} — ${p.alive ? Math.round(p.hp) + " HP" : "💀"}${spec}</div>`;
  }).join("");
}

function drawZoneIndicator() {
  const el = $("zoneIndicator");
  const me = serverState.players[myId];
  if (!me) { el.innerHTML = ""; return; }
  const chips = [];
  if (me.shield > 0) chips.push(`<div class="zone-chip" style="color:#fd4;border-color:#fd4">🛡 BOUCLIER ${Math.ceil(me.shield / 60)}s</div>`);
  if (me.speedBoost > 0) chips.push(`<div class="zone-chip" style="color:#4af;border-color:#4af">⚡ VITESSE</div>`);
  if (me.damageBoost > 0) chips.push(`<div class="zone-chip" style="color:#f55;border-color:#f55">💥 DÉGÂTS +</div>`);
  el.innerHTML = chips.join("");
}

function drawAnnouncement() {
  const el = $("announcement");
  if (serverState.announcement) {
    el.textContent = serverState.announcement;
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
}

function drawMinimap() {
  const size = minimap.width;
  const scale = size / 3200;
  mmCtx.clearRect(0, 0, size, size);
  mmCtx.fillStyle = "rgba(10, 20, 40, 0.85)";
  mmCtx.fillRect(0, 0, size, size);

  // Murs
  if (serverState.mapData) {
    mmCtx.fillStyle = "rgba(150, 150, 180, 0.5)";
    serverState.mapData.walls.forEach(w => {
      mmCtx.fillRect(w.x * scale, w.y * scale, w.w * scale, w.h * scale);
    });
    // Rivières
    mmCtx.strokeStyle = "rgba(80, 140, 220, 0.6)";
    mmCtx.lineWidth = 2;
    serverState.mapData.rivers.forEach(r => {
      mmCtx.beginPath();
      r.points.forEach((p, i) => {
        if (i === 0) mmCtx.moveTo(p.x * scale, p.y * scale);
        else mmCtx.lineTo(p.x * scale, p.y * scale);
      });
      mmCtx.stroke();
    });
  }

  // Zones
  serverState.zones.forEach(z => {
    const info = ZONE_COLORS[z.type] || ZONE_COLORS.heal;
    mmCtx.strokeStyle = info.main;
    mmCtx.lineWidth = 2;
    mmCtx.beginPath();
    mmCtx.arc(z.x * scale, z.y * scale, z.radius * scale, 0, Math.PI * 2);
    mmCtx.stroke();
  });

  // Joueurs
  Object.values(serverState.players).forEach(p => {
    if (!p.alive) return;
    mmCtx.fillStyle = p.id === myId ? "#4af" : (spectating === p.id ? "#fd4" : "#fff");
    mmCtx.beginPath();
    mmCtx.arc(p.x * scale, p.y * scale, p.id === myId ? 4 : 3, 0, Math.PI * 2);
    mmCtx.fill();
  });
}

function loop() {
  if (gameStarted) {
    drawBiomes();
    drawRivers();
    drawGrid();
    drawWalls();
    drawForests();
    drawZones();

    Object.values(serverState.players).forEach(p => {
      if (p.alive) drawPlayer(p, p.id === myId);
    });
    drawBullets();
    drawScoreboard();
    drawZoneIndicator();
    drawAnnouncement();
    drawMinimap();
  }
  requestAnimationFrame(loop);
}
loop();