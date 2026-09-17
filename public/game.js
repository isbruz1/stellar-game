/* ==================================================================
   STELLAR GAME — Client V9
   - Détection appareil (PC / Mobile / Tablette / Console)
   - Mode paysage + plein écran auto
   - 2 joysticks fixes (bleu = bouger, rouge = viser/tirer)
   - Multi-comptes avec lock multi-onglets
   - Menu → Navigateur → Salon → Partie
   - Chiffres de dégâts, bouclier brisé, screen shake
   - Écran de mort + spectateur + écran de victoire
   ================================================================== */

/* ============================================================
   1. DÉTECTION APPAREIL
   ============================================================ */
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
let deviceType = "desktop";     // desktop | mobile | tablet | console
let gamepadType = null;         // xbox | playstation | nintendo | steam | generic
let hasGamepad = false;

function detectDevice() {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  hasGamepad = false;
  for (const gp of gamepads) {
    if (gp) { hasGamepad = true; gamepadType = detectGamepadType(gp.id); break; }
  }
  if (hasGamepad) deviceType = "console";
  else if (isTouchDevice) deviceType = window.innerWidth >= 1024 ? "tablet" : "mobile";
  else deviceType = "desktop";
}

function detectGamepadType(id) {
  const s = (id || "").toLowerCase();
  if (s.includes("xbox") || s.includes("xinput")) return "xbox";
  if (s.includes("playstation") || s.includes("dualshock") || s.includes("dualsense") || s.includes("sony")) return "playstation";
  if (s.includes("steam")) return "steam";
  if (s.includes("nintendo") || s.includes("switch") || s.includes("joy-con")) return "nintendo";
  return "generic";
}

function applyDeviceClass() {
  document.body.className = document.body.className
    .split(" ").filter(c => !c.startsWith("device-")).join(" ");
  document.body.classList.add("device-" + deviceType);
}

/* ============================================================
   2. LANDSCAPE + FULLSCREEN
   ============================================================ */
let isFullscreen = false;

function checkLandscape() {
  const el = document.getElementById("landscapeWarning");
  if (!el) return;
  const isPortrait = window.innerHeight > window.innerWidth;
  const isMobileOrTablet = deviceType === "mobile" || deviceType === "tablet";
  if (isPortrait && isMobileOrTablet) el.classList.remove("hidden");
  else el.classList.add("hidden");
}

async function requestFullscreen() {
  if (deviceType !== "mobile" && deviceType !== "tablet") return;
  if (isFullscreen) return;
  try {
    const el = document.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    isFullscreen = true;
    if (screen.orientation && screen.orientation.lock) {
      try { await screen.orientation.lock("landscape"); } catch (e) {}
    }
  } catch (e) { /* refusé */ }
}

window.addEventListener("resize", checkLandscape);
window.addEventListener("orientationchange", () => setTimeout(checkLandscape, 150));
document.addEventListener("touchstart", () => requestFullscreen(), { once: true });
document.addEventListener("click", () => requestFullscreen(), { once: true });

/* ============================================================
   3. BADGE + AIDE CONTRÔLES
   ============================================================ */
function updateDeviceBadge() {
  const badge = document.getElementById("deviceBadge");
  const icon = document.getElementById("deviceIcon");
  const label = document.getElementById("deviceLabel");
  if (!badge) return;

  badge.className = "device-badge detected";

  if (deviceType === "console") {
    badge.classList.add("gamepad");
    icon.textContent = "🎮";
    const name = gamepadType === "xbox" ? "XBOX" :
                 gamepadType === "playstation" ? "PLAYSTATION" :
                 gamepadType === "nintendo" ? "NINTENDO" :
                 gamepadType === "steam" ? "STEAM" : "MANETTE";
    label.textContent = `${name} DÉTECTÉ`;
  } else if (deviceType === "mobile") {
    badge.classList.add("mobile");
    icon.textContent = "📱";
    label.textContent = "MODE MOBILE · TACTILE";
  } else if (deviceType === "tablet") {
    badge.classList.add("mobile");
    icon.textContent = "📱";
    label.textContent = "MODE TABLETTE";
  } else {
    icon.textContent = "💻";
    label.textContent = "MODE PC · CLAVIER + SOURIS";
  }
}

function updateControlsHint() {
  const hint = document.getElementById("controlsHint");
  if (!hint) return;
  if (deviceType === "console") {
    const shootKey = gamepadType === "playstation" ? "R2" : "RT";
    hint.innerHTML = `<span class="ctrl-key">STICK G.</span> bouger <span class="ctrl-key">STICK D.</span> viser <span class="ctrl-key">${shootKey}</span> tirer`;
  } else if (deviceType === "mobile" || deviceType === "tablet") {
    hint.innerHTML = `<span class="ctrl-key" style="border-color:#4af;color:#9cf">🔵 GAUCHE</span> bouger <span class="ctrl-key" style="border-color:#f55;color:#faa">🔴 DROITE</span> viser + tirer`;
  } else {
    hint.innerHTML = `<span class="ctrl-key">ZQSD</span> bouger <span class="ctrl-key">SOURIS</span> viser <span class="ctrl-key">CLIC</span> tirer`;
  }
}

detectDevice();
applyDeviceClass();
updateControlsHint();

window.addEventListener("gamepadconnected", e => {
  console.log("🎮 Manette connectée :", e.gamepad.id);
  detectDevice(); applyDeviceClass(); updateControlsHint(); updateDeviceBadge();
});
window.addEventListener("gamepaddisconnected", () => {
  detectDevice(); applyDeviceClass(); updateControlsHint();
});
window.addEventListener("resize", () => {
  const newType = hasGamepad ? "console"
    : (isTouchDevice ? (window.innerWidth >= 1024 ? "tablet" : "mobile") : "desktop");
  if (newType !== deviceType) {
    deviceType = newType;
    applyDeviceClass();
    updateControlsHint();
    checkLandscape();
  }
});

/* ============================================================
   4. ACCOUNTS (localStorage)
   ============================================================ */
function loadAccounts() {
  try { return JSON.parse(localStorage.getItem("accounts") || "[]"); }
  catch { return []; }
}
function saveAccounts(a) { localStorage.setItem("accounts", JSON.stringify(a)); }

let accounts = loadAccounts();
let currentAccount = null;
let selectedAccountIdx = -1;
let tempSkin = 0;

/* ============================================================
   5. RUNTIME
   ============================================================ */
let myId = null, hostId = null, currentRoomId = null;
let lobbyPlayers = {};
let gameStarted = false;
let serverState = { players: {}, bullets: [], mapData: null };
let myAngle = 0;
let dead = false, spectating = null;
const keys = { up: false, down: false, left: false, right: false };
let socket = null;
let lockedAccounts = [];

let damageNumbers = [];
let shieldBreakFx = [];
let shakeTime = 0;
let shakeIntensity = 0;

/* ============================================================
   6. DOM
   ============================================================ */
const $ = id => document.getElementById(id);

const splashScreen     = $("splashScreen");
const profilesScreen   = $("profilesScreen");
const newAccountScreen = $("newAccountScreen");
const skinSelectScreen = $("skinSelectScreen");
const mainMenu         = $("mainMenuScreen");
const serverBrowser    = $("serverBrowser");
const lobbyScreen      = $("lobbyScreen");
const gameScreen       = $("gameScreen");

const pseudoInput       = $("pseudoInput");
const realNameInput     = $("realNameInput");
const pseudoError       = $("pseudoError");
const nextToSkinBtn     = $("nextToSkinBtn");
const backToProfilesBtn = $("backToProfilesBtn");
const backToNameBtn     = $("backToNameBtn");
const newAccountBtn     = $("newAccountBtn");
const enterLobbyBtn     = $("enterLobbyBtn");
const accountList       = $("accountList");
const previewCanvas     = $("previewCanvas");
const previewPseudo     = $("previewPseudo");
const previewReal       = $("previewReal");
const previewSkinPicker = $("previewSkinPicker");
const skinGrid          = $("skinGrid");
const finishAccountBtn  = $("finishAccountBtn");

const userPseudoEl  = $("userPseudo");
const userRealEl    = $("userReal");
const disconnectBtn = $("disconnectBtn");

const playBtn          = $("playBtn");
const closeBrowser     = $("closeBrowser");
const roomsListEl      = $("roomsList");
const roomsCountEl     = $("roomsCount");
const refreshRooms     = $("refreshRooms");
const codeInput        = $("codeInput");
const joinByCodeBtn    = $("joinByCodeBtn");
const serverNameInput  = $("serverNameInput");
const createRoomBtn    = $("createRoomBtn");

const playersGrid      = $("playersGrid");
const playerCount      = $("playerCount");
const actionBtn        = $("actionBtn");
const quitBtn          = $("quitBtn");
const roomCodeDisplay  = $("roomCodeDisplay");
const roomNameDisplay  = $("roomNameDisplay");

const settingsModal    = $("settingsModal");
const closeSettings    = $("closeSettings");
const settingsPseudo   = $("settingsPseudo");
const settingsRealName = $("settingsRealName");
const skinPicker       = $("skinPicker");

const canvas    = $("game");
const ctx       = canvas.getContext("2d");
const minimap   = $("minimap");
const mmCtx     = minimap.getContext("2d");
const hpBar     = $("hpBar");
const shieldBar = $("shieldBar");

/* ============================================================
   7. NAVIGATION ÉCRANS
   ============================================================ */
function showScreen(name) {
  [splashScreen, profilesScreen, newAccountScreen, skinSelectScreen,
   mainMenu, serverBrowser, lobbyScreen, gameScreen]
    .forEach(s => s.classList.add("hidden"));

  const map = {
    splash: splashScreen,
    profiles: profilesScreen,
    newAccount: newAccountScreen,
    skinSelect: skinSelectScreen,
    menu: mainMenu,
    browser: serverBrowser,
    lobby: lobbyScreen,
    game: gameScreen
  };
  if (map[name]) map[name].classList.remove("hidden");
  if (name === "game") resizeCanvas();
  checkLandscape();
}

/* ============================================================
   8. SOCKET
   ============================================================ */
function connectSocket() {
  if (socket) return;
  socket = io();

  socket.on("connect", () => {
    myId = socket.id;
    socket.emit("list-rooms");
  });

  socket.on("locked-accounts", list => {
    lockedAccounts = list || [];
    if (!profilesScreen.classList.contains("hidden")) renderAccounts();
  });

  socket.on("claim-result", res => {
    if (res.ok) {
      enterMenuWithAccount();
    } else {
      alert("❌ " + res.reason);
      releaseAccount();
      showScreen("profiles");
      renderAccounts();
    }
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
    damageNumbers = [];
    shieldBreakFx = [];
    shakeTime = 0;
    showScreen("game");
    $("deathScreen").classList.add("hidden");
    $("spectatePanel").classList.add("hidden");
    $("victoryScreen").classList.add("hidden");
    keys.up = keys.down = keys.left = keys.right = false;
    requestFullscreen();
  });

  socket.on("game-ended", () => { gameStarted = false; });

  socket.on("victory", data => {
    gameStarted = false;
    $("deathScreen").classList.add("hidden");
    $("spectatePanel").classList.add("hidden");
    if (data.winnerId === myId) {
      $("victoryScreen").classList.remove("hidden");
    }
  });

  socket.on("hit", data => {
    if (data.shieldDamage > 0) {
      damageNumbers.push({
        x: data.x + (Math.random() - 0.5) * 30,
        y: data.y - 30,
        value: Math.round(data.shieldDamage),
        color: "#4af", life: 60, vy: -1.2
      });
    }
    if (data.hpDamage > 0) {
      damageNumbers.push({
        x: data.x + (Math.random() - 0.5) * 30,
        y: data.y - 50,
        value: Math.round(data.hpDamage),
        color: "#fff", life: 60, vy: -1.4
      });
    }
  });

  socket.on("shield-broken", data => {
    shieldBreakFx.push({ x: data.x, y: data.y, life: 50 });
  });

  socket.on("screen-shake", () => {
    shakeTime = 30;
    shakeIntensity = 14;
  });

  socket.on("state", s => {
    serverState = s;
    const me = s.players[myId];
    if (!me) return;

    hpBar.style.width = (me.hp / 100 * 100) + "%";
    shieldBar.style.width = (me.shield / 100 * 100) + "%";

    if (!me.alive && !dead && gameStarted) {
      dead = true;
      $("deathScreen").classList.remove("hidden");
    }
    if (me.alive && dead) {
      dead = false;
      $("deathScreen").classList.add("hidden");
      $("spectatePanel").classList.add("hidden");
      spectating = null;
    }
  });
}

connectSocket();

/* ============================================================
   9. BACKGROUNDS
   ============================================================ */
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
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      r: Math.random() * 1.4 + 0.3,
      alpha: Math.random() * 0.7 + 0.3,
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
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill();
    });
    requestAnimationFrame(loop);
  })();
}

(function initGalaxy() {
  const c = $("galaxyCanvas");
  if (!c) return;
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
      baseAngle: armAngle + dist * 0.008,
      dist,
      size: Math.random() * 1.6 + 0.3,
      speed: 0.0002 + Math.random() * 0.0004,
      hue: Math.random() * 60 + 200,
      alpha: Math.random() * 0.6 + 0.3
    });
  }
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
  let t = 0;
  (function loop() {
    if (!running) return;
    t++;
    const bg = g.createRadialGradient(
      c.width / 2, c.height / 2, 50,
      c.width / 2, c.height / 2, Math.max(c.width, c.height)
    );
    bg.addColorStop(0, "#0a1530");
    bg.addColorStop(0.5, "#050a1e");
    bg.addColorStop(1, "#000");
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);

    stars.forEach(s => {
      s.alpha += (Math.random() - 0.5) * s.twinkle;
      s.alpha = Math.max(0.1, Math.min(0.9, s.alpha));
      g.fillStyle = `rgba(200,220,255,${s.alpha})`;
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill();
    });

    galaxy.forEach(p => {
      const a = p.baseAngle + t * p.speed;
      const x = c.width / 2 + Math.cos(a) * p.dist;
      const y = c.height / 2 + Math.sin(a) * p.dist * 0.55;
      g.fillStyle = `hsla(${p.hue}, 80%, 65%, ${p.alpha})`;
      g.beginPath(); g.arc(x, y, p.size, 0, Math.PI * 2); g.fill();
    });

    const core = g.createRadialGradient(
      c.width / 2, c.height / 2, 0,
      c.width / 2, c.height / 2, 180
    );
    core.addColorStop(0, "rgba(120,180,255,0.4)");
    core.addColorStop(0.4, "rgba(80,120,220,0.15)");
    core.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = core;
    g.beginPath(); g.arc(c.width / 2, c.height / 2, 180, 0, Math.PI * 2); g.fill();

    requestAnimationFrame(loop);
  })();

  window.__stopGalaxy = () => { running = false; };
})();

/* ============================================================
   10. DÉMARRAGE
   ============================================================ */
showScreen("splash");
checkLandscape();

const detectInterval = setInterval(() => {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  let found = false;
  for (const gp of gamepads) if (gp) { found = true; break; }
  if (found !== hasGamepad) {
    detectDevice();
    applyDeviceClass();
    updateControlsHint();
  }
}, 500);

setTimeout(() => {
  clearInterval(detectInterval);
  updateDeviceBadge();
}, 1500);

setTimeout(() => {
  window.__stopGalaxy && window.__stopGalaxy();
  showScreen("profiles");
  initStarfield("profilesCanvas");
  renderAccounts();
}, 3500);

/* ============================================================
   11. COMPTES
   ============================================================ */
function isAccountLocked(pseudo) {
  return lockedAccounts.some(p => p.toLowerCase() === pseudo.toLowerCase());
}

function renderAccounts() {
  accountList.innerHTML = "";

  if (accounts.length === 0) {
    accountList.innerHTML = `<div class="no-rooms" style="grid-column:1/-1">AUCUN COMPTE<br><span class="muted">Crée-en un pour commencer</span></div>`;
    enterLobbyBtn.disabled = true;
    previewPseudo.textContent = "—";
    previewReal.textContent = "—";
    previewSkinPicker.innerHTML = "";
    return;
  }

  accounts.forEach((acc, idx) => {
    const card = document.createElement("div");
    card.className = "account-card";
    const locked = isAccountLocked(acc.pseudo);
    if (idx === selectedAccountIdx) card.classList.add("selected");
    if (locked) card.classList.add("locked");

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
      if (locked) return alert("❌ Compte en cours d'utilisation.");
      if (confirm(`⚠️ Supprimer définitivement "${acc.pseudo}" ?`)) {
        accounts.splice(idx, 1);
        saveAccounts(accounts);
        if (selectedAccountIdx >= accounts.length) {
          selectedAccountIdx = accounts.length - 1;
        }
        renderAccounts();
      }
    });
    card.appendChild(del);

    card.addEventListener("click", () => {
      if (locked) return;
      selectedAccountIdx = idx;
      renderAccounts();
      previewAccount(accounts[idx]);
    });

    accountList.appendChild(card);
  });

  if (
    selectedAccountIdx < 0 ||
    selectedAccountIdx >= accounts.length ||
    isAccountLocked(accounts[selectedAccountIdx]?.pseudo || "")
  ) {
    selectedAccountIdx = accounts.findIndex(a => !isAccountLocked(a.pseudo));
  }

  if (selectedAccountIdx >= 0 && accounts[selectedAccountIdx]) {
    previewAccount(accounts[selectedAccountIdx]);
  } else {
    enterLobbyBtn.disabled = true;
    previewPseudo.textContent = "—";
    previewReal.textContent = "—";
    previewSkinPicker.innerHTML = "";
  }
}

function previewAccount(acc) {
  previewPseudo.textContent = acc.pseudo;
  previewReal.textContent = acc.realName || "";
  drawPreviewTank(acc.skin || 0);

  previewSkinPicker.innerHTML = "";
  SKINS.forEach((s, i) => {
    const c = document.createElement("canvas");
    c.width = 60; c.height = 60;
    if (i === (acc.skin || 0)) c.className = "selected";
    drawTankPreview(c, i);
    c.addEventListener("click", () => {
      acc.skin = i;
      const realIdx = accounts.findIndex(a => a.pseudo === acc.pseudo);
      if (realIdx >= 0) accounts[realIdx].skin = i;
      saveAccounts(accounts);
      previewAccount(acc);
    });
    previewSkinPicker.appendChild(c);
  });

  const locked = isAccountLocked(acc.pseudo);
  enterLobbyBtn.disabled = locked;
  enterLobbyBtn.textContent = locked ? "🔒 EN UTILISATION" : "JOUER";
}

function drawPreviewTank(skinId) {
  const c = previewCanvas;
  const cx = c.getContext("2d");
  cx.clearRect(0, 0, c.width, c.height);
  cx.save();
  cx.translate(c.width / 2, c.height / 2);
  drawTankShape(cx, skinId, -Math.PI / 2, 2.0);
  cx.restore();
}

function enterMenuWithAccount() {
  userPseudoEl.textContent = currentAccount.pseudo;
  userRealEl.textContent = currentAccount.realName;
  showScreen("menu");
  initStarfield("menuCanvas");
  updateControlsHint();
}

enterLobbyBtn.addEventListener("click", () => {
  if (selectedAccountIdx < 0 || !accounts[selectedAccountIdx]) return;
  const acc = accounts[selectedAccountIdx];
  if (isAccountLocked(acc.pseudo)) return alert("❌ Compte déjà utilisé ailleurs.");
  currentAccount = { ...acc };
  socket.emit("claim-account", currentAccount.pseudo);
});

/* ============================================================
   12. NOUVEAU COMPTE
   ============================================================ */
newAccountBtn.addEventListener("click", () => {
  pseudoInput.value = "";
  realNameInput.value = "";
  pseudoError.textContent = "";
  nextToSkinBtn.disabled = true;
  showScreen("newAccount");
  initStarfield("newAccountCanvas");
  pseudoInput.focus();
});

backToProfilesBtn.addEventListener("click", () => showScreen("profiles"));

function validateNewAccount() {
  const p = pseudoInput.value.trim();
  const r = realNameInput.value.trim();
  if (p.length === 0) pseudoError.textContent = "";
  else if (p.length < 5) pseudoError.textContent = "Minimum 5 caractères.";
  else if (p.length > 16) pseudoError.textContent = "Maximum 16 caractères.";
  else if (accounts.some(a => a.pseudo.toLowerCase() === p.toLowerCase()))
    pseudoError.textContent = "Ce pseudo existe déjà.";
  else if (isAccountLocked(p))
    pseudoError.textContent = "Ce pseudo est déjà utilisé ailleurs.";
  else pseudoError.textContent = "";

  nextToSkinBtn.disabled = !(
    p.length >= 5 &&
    p.length <= 16 &&
    r.length > 0 &&
    !accounts.some(a => a.pseudo.toLowerCase() === p.toLowerCase()) &&
    !isAccountLocked(p)
  );
}
pseudoInput.addEventListener("input", validateNewAccount);
realNameInput.addEventListener("input", validateNewAccount);

nextToSkinBtn.addEventListener("click", () => {
  tempSkin = 0;
  showScreen("skinSelect");
  initStarfield("skinSelectCanvas");
  buildSkinGrid();
});

function buildSkinGrid() {
  skinGrid.innerHTML = "";
  SKINS.forEach((s, i) => {
    const c = document.createElement("canvas");
    c.width = 90; c.height = 90;
    if (i === tempSkin) c.className = "selected";
    drawTankPreview(c, i);
    c.addEventListener("click", () => {
      tempSkin = i;
      buildSkinGrid();
    });
    skinGrid.appendChild(c);
  });
}

backToNameBtn.addEventListener("click", () => showScreen("newAccount"));

finishAccountBtn.addEventListener("click", () => {
  const p = pseudoInput.value.trim();
  const r = realNameInput.value.trim();
  if (p.length < 5 || r.length === 0) return;

  const acc = { pseudo: p, realName: r, skin: tempSkin };
  accounts.push(acc);
  saveAccounts(accounts);
  selectedAccountIdx = accounts.length - 1;
  showScreen("profiles");
  renderAccounts();
});

/* ============================================================
   13. MENU PRINCIPAL
   ============================================================ */
playBtn.addEventListener("click", () => {
  showScreen("browser");
  if (socket) socket.emit("list-rooms");
});

function releaseAccount() {
  if (!currentAccount || !socket) return;
  socket.emit("release-account", currentAccount.pseudo);
  currentAccount = null;
}

disconnectBtn.addEventListener("click", () => {
  if (!confirm("Se déconnecter ?")) return;
  releaseAccount();
  selectedAccountIdx = -1;
  showScreen("profiles");
  renderAccounts();
});

/* ============================================================
   14. NAVIGATEUR DE SERVEURS
   ============================================================ */
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
          id: r.id,
          pseudo: currentAccount.pseudo,
          realName: currentAccount.realName,
          skin: currentAccount.skin || 0
        });
      });
    }
    roomsListEl.appendChild(el);
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/* ============================================================
   15. SALON
   ============================================================ */
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
    n.className = "name";
    n.textContent = p.pseudo + (p.id === myId ? " (toi)" : "");
    card.appendChild(n);

    if (p.realName) {
      const r = document.createElement("div");
      r.className = "realname";
      r.textContent = p.realName;
      card.appendChild(r);
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

/* ============================================================
   16. ÉCRAN DE MORT + SPECTATEUR
   ============================================================ */
$("backToLobbyBtn").addEventListener("click", () => {
  if (!socket) return;
  socket.emit("leave-game");
  dead = false;
  spectating = null;
  gameStarted = false;
  $("deathScreen").classList.add("hidden");
  $("spectatePanel").classList.add("hidden");
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
    el.textContent = p.pseudo;
    el.addEventListener("click", () => {
      if (socket) socket.emit("spectate", p.id);
      spectating = p.id;
      renderSpectateList();
    });
    list.appendChild(el);
  });
}

/* ============================================================
   17. VICTOIRE
   ============================================================ */
$("returnToServerBtn").addEventListener("click", () => {
  $("victoryScreen").classList.add("hidden");
  $("deathScreen").classList.add("hidden");
  $("spectatePanel").classList.add("hidden");
  gameStarted = false;
  dead = false;
  spectating = null;
  showScreen("lobby");
});

/* ============================================================
   18. CLAVIER (PC)
   ============================================================ */
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

/* ============================================================
   19. SOURIS (PC)
   ============================================================ */
canvas.addEventListener("mousemove", e => {
  if (deviceType !== "desktop") return;
  const rect = canvas.getBoundingClientRect();
  const cam = getCamera();
  const me = serverState.players[myId];
  if (!me) return;
  const wx = e.clientX - rect.left + cam.x;
  const wy = e.clientY - rect.top + cam.y;
  myAngle = Math.atan2(wy - me.y, wx - me.x);
});

canvas.addEventListener("mousedown", e => {
  if (deviceType !== "desktop") return;
  if (e.button !== 0 || !gameStarted || !myId || !socket) return;
  const me = serverState.players[myId];
  if (!me || !me.alive) return;
  socket.emit("shoot", { angle: myAngle });
});

/* ============================================================
   20. CONTRÔLES TACTILES — 2 JOYSTICKS FIXES
   ============================================================ */
const touchControls = $("touchControls");
const moveJoystick  = $("moveJoystick");
const moveKnob      = $("moveKnob");
const aimJoystick   = $("aimJoystick");
const aimKnob       = $("aimKnob");

const moveJoyState = { active: false, touchId: null, baseX: 0, baseY: 0, dx: 0, dy: 0 };
const aimJoyState  = { active: false, touchId: null, baseX: 0, baseY: 0, dx: 0, dy: 0 };

const KNOB_RADIUS = 35;
const DEADZONE = 0.25;

if (deviceType === "mobile" || deviceType === "tablet") {
  touchControls.classList.remove("hidden");
}

function getJoystickCenter(el) {
  const rect = el.querySelector(".joystick-ring").getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function updateKnob(el, dx, dy) {
  el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function resetKnob(el) {
  el.style.transform = "translate(-50%, -50%)";
}

// ---------- MOVE (BLEU) ----------
moveJoystick.addEventListener("touchstart", e => {
  if (!gameStarted || dead) return;
  e.preventDefault();
  const t = e.changedTouches[0];
  moveJoyState.active = true;
  moveJoyState.touchId = t.identifier;
  const c = getJoystickCenter(moveJoystick);
  moveJoyState.baseX = c.x;
  moveJoyState.baseY = c.y;
  moveJoystick.classList.add("active");
}, { passive: false });

moveJoystick.addEventListener("touchmove", e => {
  if (!moveJoyState.active) return;
  e.preventDefault();
  const t = Array.from(e.changedTouches).find(x => x.identifier === moveJoyState.touchId);
  if (!t) return;

  let dx = t.clientX - moveJoyState.baseX;
  let dy = t.clientY - moveJoyState.baseY;
  const dist = Math.hypot(dx, dy);
  const norm = dist > KNOB_RADIUS ? KNOB_RADIUS / dist : 1;
  dx *= norm;
  dy *= norm;
  moveJoyState.dx = dx;
  moveJoyState.dy = dy;

  updateKnob(moveKnob, dx, dy);

  const nx = dx / KNOB_RADIUS;
  const ny = dy / KNOB_RADIUS;
  const mag = Math.hypot(nx, ny);

  if (mag < DEADZONE) {
    keys.up = keys.down = keys.left = keys.right = false;
    return;
  }
  keys.right = nx > 0.35;
  keys.left  = nx < -0.35;
  keys.down  = ny > 0.35;
  keys.up    = ny < -0.35;
}, { passive: false });

function endMoveJoystick(e) {
  const t = Array.from(e.changedTouches).find(x => x.identifier === moveJoyState.touchId);
  if (!t) return;
  moveJoyState.active = false;
  moveJoyState.touchId = null;
  moveJoyState.dx = 0;
  moveJoyState.dy = 0;
  keys.up = keys.down = keys.left = keys.right = false;
  moveJoystick.classList.remove("active");
  resetKnob(moveKnob);
}
moveJoystick.addEventListener("touchend", endMoveJoystick);
moveJoystick.addEventListener("touchcancel", endMoveJoystick);

// ---------- AIM (ROUGE) ----------
aimJoystick.addEventListener("touchstart", e => {
  if (!gameStarted || dead) return;
  e.preventDefault();
  const t = e.changedTouches[0];
  aimJoyState.active = true;
  aimJoyState.touchId = t.identifier;
  const c = getJoystickCenter(aimJoystick);
  aimJoyState.baseX = c.x;
  aimJoyState.baseY = c.y;
  aimJoystick.classList.add("active");
}, { passive: false });

aimJoystick.addEventListener("touchmove", e => {
  if (!aimJoyState.active) return;
  e.preventDefault();
  const t = Array.from(e.changedTouches).find(x => x.identifier === aimJoyState.touchId);
  if (!t) return;

  let dx = t.clientX - aimJoyState.baseX;
  let dy = t.clientY - aimJoyState.baseY;
  const dist = Math.hypot(dx, dy);
  const norm = dist > KNOB_RADIUS ? KNOB_RADIUS / dist : 1;
  dx *= norm;
  dy *= norm;
  aimJoyState.dx = dx;
  aimJoyState.dy = dy;

  updateKnob(aimKnob, dx, dy);

  const mag = Math.hypot(dx, dy) / KNOB_RADIUS;
  if (mag < DEADZONE) return;
  myAngle = Math.atan2(dy, dx);
}, { passive: false });

function endAimJoystick(e) {
  const t = Array.from(e.changedTouches).find(x => x.identifier === aimJoyState.touchId);
  if (!t) return;
  aimJoyState.active = false;
  aimJoyState.touchId = null;
  aimJoyState.dx = 0;
  aimJoyState.dy = 0;
  aimJoystick.classList.remove("active");
  resetKnob(aimKnob);
}
aimJoystick.addEventListener("touchend", endAimJoystick);
aimJoystick.addEventListener("touchcancel", endAimJoystick);

// ---------- TIR AUTO (joystick rouge actif) ----------
let lastTouchShot = 0;
setInterval(() => {
  if (!aimJoyState.active) return;
  if (!gameStarted || dead || !socket) return;
  const mag = Math.hypot(aimJoyState.dx, aimJoyState.dy) / KNOB_RADIUS;
  if (mag < DEADZONE) return;
  const now = Date.now();
  if (now - lastTouchShot < 400) return;
  const me = serverState.players[myId];
  if (me && me.alive) {
    socket.emit("shoot", { angle: myAngle });
    lastTouchShot = now;
  }
}, 50);

/* ============================================================
   21. MANETTE
   ============================================================ */
let gamepadLastShot = 0;

function pollGamepad() {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const g of gamepads) if (g) { gp = g; break; }

  if (gp && gameStarted && !dead) {
    const now = Date.now();
    const lx = gp.axes[0] || 0;
    const ly = gp.axes[1] || 0;
    const deadzone = 0.25;

    keys.up    = ly < -deadzone;
    keys.down  = ly > deadzone;
    keys.left  = lx < -deadzone;
    keys.right = lx > deadzone;

    const rx = gp.axes[2] || 0;
    const ry = gp.axes[3] || 0;
    if (Math.hypot(rx, ry) > deadzone) {
      myAngle = Math.atan2(ry, rx);
    } else if (Math.hypot(lx, ly) > deadzone) {
      myAngle = Math.atan2(ly, lx);
    }

    const rtPressed = gp.buttons[7] && gp.buttons[7].pressed;
    const ltPressed = gp.buttons[6] && gp.buttons[6].pressed;
    if ((rtPressed || ltPressed) && now - gamepadLastShot > 350) {
      const me = serverState.players[myId];
      if (me && me.alive && socket) {
        socket.emit("shoot", { angle: myAngle });
        gamepadLastShot = now;
      }
    }
  }
  requestAnimationFrame(pollGamepad);
}
pollGamepad();

/* ============================================================
   22. INPUT → SERVEUR
   ============================================================ */
setInterval(() => {
  if (!gameStarted || !myId || !socket) return;
  const me = serverState.players[myId];
  if (!me || !me.alive) return;
  socket.emit("input", { keys, angle: myAngle });
}, 33);

/* ============================================================
   23. CANVAS
   ============================================================ */
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function getCamera() {
  const target = spectating
    ? serverState.players[spectating]
    : serverState.players[myId];
  if (!target) return { x: 0, y: 0 };

  let cx = target.x - canvas.width / 2;
  let cy = target.y - canvas.height / 2;

  if (shakeTime > 0) {
    const intensity = shakeIntensity * (shakeTime / 30);
    cx += (Math.random() - 0.5) * intensity;
    cy += (Math.random() - 0.5) * intensity;
  }

  return { x: cx, y: cy };
}

/* ============================================================
   24. RENDU
   ============================================================ */
function drawBiomes() {
  ctx.fillStyle = "#0f1a10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawRivers() {
  const md = serverState.mapData;
  if (!md) return;
  const cam = getCamera();
  const time = Date.now() / 1000;

  md.rivers.forEach(r => {
    ctx.strokeStyle = "rgba(40, 30, 15, 0.8)";
    ctx.lineWidth = r.width + 24;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    r.points.forEach((p, i) => {
      const x = p.x - cam.x, y = p.y - cam.y;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.strokeStyle = "rgba(70, 90, 40, 0.5)";
    ctx.lineWidth = r.width + 12;
    ctx.stroke();

    ctx.strokeStyle = "rgba(15, 45, 100, 0.95)";
    ctx.lineWidth = r.width;
    ctx.beginPath();
    r.points.forEach((p, i) => {
      const x = p.x - cam.x, y = p.y - cam.y;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.strokeStyle = "rgba(30, 80, 150, 0.7)";
    ctx.lineWidth = r.width * 0.7;
    ctx.stroke();

    ctx.strokeStyle = `rgba(120, 200, 255, ${0.4 + Math.sin(time * 1.5) * 0.15})`;
    ctx.lineWidth = r.width * 0.45;
    ctx.setLineDash([18, 28]);
    ctx.lineDashOffset = -time * 40;
    ctx.beginPath();
    r.points.forEach((p, i) => {
      const x = p.x - cam.x, y = p.y - cam.y;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

function drawForests() {
  const md = serverState.mapData;
  if (!md) return;
  const cam = getCamera();
  const time = Date.now() / 1000;

  md.forests.forEach(f => {
    f.forEach((t, idx) => {
      const x = t.x - cam.x, y = t.y - cam.y;
      if (x < -80 || x > canvas.width + 80 || y < -80 || y > canvas.height + 80) return;

      const sway = Math.sin(time * 1.2 + idx * 0.7) * 2.5;

      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.ellipse(x + 6, y + t.r * 0.6, t.r * 0.95, t.r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#2a1808";
      ctx.fillRect(x - 5, y + t.r * 0.1, 10, t.r * 0.7);
      ctx.fillStyle = "#5a3a1a";
      ctx.fillRect(x - 5, y + t.r * 0.1, 4, t.r * 0.7);

      ctx.fillStyle = "#0a1f0a";
      ctx.beginPath(); ctx.arc(x + sway * 0.3, y + t.r * 0.1, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1a3a1a";
      ctx.beginPath(); ctx.arc(x - 2 + sway * 0.5, y - t.r * 0.15, t.r * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2d5a28";
      ctx.beginPath(); ctx.arc(x - 4 + sway * 0.7, y - t.r * 0.35, t.r * 0.6, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "rgba(150, 220, 150, 0.4)";
      ctx.beginPath(); ctx.arc(x - 7 + sway * 0.8, y - t.r * 0.5, t.r * 0.28, 0, Math.PI * 2); ctx.fill();
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

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x + 4, y + 6, w.w, w.h);

    ctx.fillStyle = "#3a3a4a";
    ctx.fillRect(x, y, w.w, w.h);

    ctx.strokeStyle = "#5a5a7a";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w.w, w.h);

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
  ctx.strokeRect(-cam.x, -cam.y, 4500, 4500);
}

function drawPlayer(p, isMe) {
  const cam = getCamera();
  const x = p.x - cam.x, y = p.y - cam.y;

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 32, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  if (p.shield > 0) {
    ctx.strokeStyle = `rgba(255,221,68,${0.3 + (p.shield / 100) * 0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(x, y);
  drawTankShape(ctx, p.skin, p.angle);
  ctx.restore();

  ctx.fillStyle = isMe ? "#4af" : "#fff";
  ctx.font = "bold 13px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.fillText(p.pseudo, x, y - 50);
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

function updateDamageNumbers() {
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const dn = damageNumbers[i];
    dn.y += dn.vy;
    dn.vy *= 0.96;
    dn.life--;
    if (dn.life <= 0) damageNumbers.splice(i, 1);
  }
}

function drawDamageNumbers() {
  const cam = getCamera();
  damageNumbers.forEach(dn => {
    const x = dn.x - cam.x;
    const y = dn.y - cam.y;
    const alpha = Math.min(1, dn.life / 30);

    ctx.font = "bold 22px Segoe UI, Arial";
    ctx.textAlign = "center";

    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.7})`;
    ctx.fillText("-" + dn.value, x + 2, y + 2);

    ctx.fillStyle = dn.color;
    ctx.globalAlpha = alpha;
    ctx.fillText("-" + dn.value, x, y);
    ctx.globalAlpha = 1;
  });
}

function updateShieldBreakFx() {
  for (let i = shieldBreakFx.length - 1; i >= 0; i--) {
    shieldBreakFx[i].life--;
    if (shieldBreakFx[i].life <= 0) shieldBreakFx.splice(i, 1);
  }
}

function drawShieldBreakFx() {
  const cam = getCamera();
  shieldBreakFx.forEach(fx => {
    const x = fx.x - cam.x;
    const y = fx.y - cam.y;
    const progress = 1 - fx.life / 50;
    const alpha = Math.min(1, fx.life / 25);
    const radius = 30 + progress * 70;

    ctx.strokeStyle = `rgba(255, 221, 68, ${alpha})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 200, 0, ${alpha * 0.6})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();

    if (fx.life > 20) {
      const textAlpha = (fx.life - 20) / 30;
      ctx.font = "bold 16px Segoe UI, Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(0,0,0,${textAlpha * 0.7})`;
      ctx.fillText("BOUCLIER DÉTRUIT !", x + 2, y - radius - 8);
      ctx.fillStyle = `rgba(255, 221, 68, ${textAlpha})`;
      ctx.fillText("BOUCLIER DÉTRUIT !", x, y - radius - 10);
    }

    const shardCount = 6;
    for (let i = 0; i < shardCount; i++) {
      const a = (i / shardCount) * Math.PI * 2 + progress * 3;
      const sd = radius * 0.9;
      const sx = x + Math.cos(a) * sd;
      const sy = y + Math.sin(a) * sd;
      ctx.fillStyle = `rgba(255, 221, 68, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawScoreboard() {
  const el = $("scoreboard");
  const list = Object.values(serverState.players);

  list.sort((a, b) => {
    if (a.id === myId) return -1;
    if (b.id === myId) return 1;
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return a.pseudo.localeCompare(b.pseudo);
  });

  const display = list.length <= 10 ? list : list.slice(0, 10);
  const extra = list.length - display.length;

  el.innerHTML = display.map(p => {
    const c = p.alive
      ? (p.id === myId ? "#4af" : "#ddd")
      : "#666";
    const skull = p.alive ? "" : " 💀";
    const you = p.id === myId ? " (toi)" : "";
    return `<div style="color:${c}">${esc(p.pseudo)}${you}${skull}</div>`;
  }).join("") +
    (extra > 0 ? `<div style="color:#89a;font-size:11px">+ ${extra} autres…</div>` : "");
}

function drawAliveCounter() {
  const el = $("aliveCounter");
  if (!el) return;
  const players = Object.values(serverState.players);
  const alive = players.filter(p => p.alive).length;
  const total = players.length;
  if (total === 0) { el.textContent = ""; return; }
  el.textContent = `${alive} / ${total} SURVIVANT${alive > 1 ? "S" : ""}`;
}

function drawMinimap() {
  const size = minimap.width;
  const scale = size / 4500;

  mmCtx.clearRect(0, 0, size, size);
  mmCtx.fillStyle = "rgba(10, 20, 40, 0.9)";
  mmCtx.fillRect(0, 0, size, size);

  if (serverState.mapData) {
    mmCtx.fillStyle = "rgba(150, 150, 180, 0.4)";
    serverState.mapData.walls.forEach(w => {
      mmCtx.fillRect(w.x * scale, w.y * scale, w.w * scale, w.h * scale);
    });

    mmCtx.strokeStyle = "rgba(80, 140, 220, 0.6)";
    mmCtx.lineWidth = 2;
    serverState.mapData.rivers.forEach(r => {
      mmCtx.beginPath();
      r.points.forEach((p, i) => {
        i === 0
          ? mmCtx.moveTo(p.x * scale, p.y * scale)
          : mmCtx.lineTo(p.x * scale, p.y * scale);
      });
      mmCtx.stroke();
    });
  }

  const me = serverState.players[myId];
  if (me && me.alive) {
    mmCtx.fillStyle = "#4af";
    mmCtx.beginPath();
    mmCtx.arc(me.x * scale, me.y * scale, 4, 0, Math.PI * 2);
    mmCtx.fill();

    mmCtx.strokeStyle = "rgba(68,170,255,0.6)";
    mmCtx.lineWidth = 2;
    mmCtx.beginPath();
    mmCtx.arc(me.x * scale, me.y * scale, 7, 0, Math.PI * 2);
    mmCtx.stroke();
  }
}

/* ============================================================
   25. BOUCLE DE RENDU
   ============================================================ */
function loop() {
  if (gameStarted) {
    drawBiomes();
    drawRivers();
    drawGrid();
    drawWalls();
    drawForests();

    Object.values(serverState.players).forEach(p => {
      if (p.alive) drawPlayer(p, p.id === myId);
    });

    drawBullets();
    drawShieldBreakFx();
    drawDamageNumbers();

    drawScoreboard();
    drawAliveCounter();
    drawMinimap();

    updateDamageNumbers();
    updateShieldBreakFx();
    if (shakeTime > 0) shakeTime--;
  }
  requestAnimationFrame(loop);
}
loop();