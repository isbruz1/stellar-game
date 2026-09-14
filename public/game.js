const socket = io();
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Écrans
const splash = document.getElementById('splash');
const mainMenu = document.getElementById('mainMenu');
const playMenu = document.getElementById('playMenu');
const settingsMenu = document.getElementById('settingsMenu');
const hud = document.getElementById('hud');
const deathScreen = document.getElementById('deathScreen');
const winScreen = document.getElementById('winScreen');

// Modales
const createModal = document.getElementById('createModal');
const joinModal = document.getElementById('joinModal');
const shareModal = document.getElementById('shareModal');

// HUD
const hpFill = document.getElementById('hpFill');
const hpText = document.getElementById('hpText');
const killsEl = document.getElementById('kills');
const aliveEl = document.getElementById('alive');
const lbList = document.getElementById('lbList');
const killfeed = document.getElementById('killfeed');
const zonePopup = document.getElementById('zonePopup');
const zonePopupText = document.getElementById('zonePopupText');
const zonePopupIcon = document.getElementById('zonePopupIcon');
const winnerName = document.getElementById('winnerName');
const roomIdDisplay = document.getElementById('roomIdDisplay');

// Boutons
const btnPlay = document.getElementById('btnPlay');
const btnSettings = document.getElementById('btnSettings');
const btnSoon = document.getElementById('btnSoon');
const backToMain = document.getElementById('backToMain');
const backFromSettings = document.getElementById('backFromSettings');
const btnCreateRoom = document.getElementById('btnCreateRoom');
const btnJoinRoom = document.getElementById('btnJoinRoom');
const btnRefreshRooms = document.getElementById('btnRefreshRooms');
const pseudoInput = document.getElementById('pseudoInput');
const roomsList = document.getElementById('roomsList');

const cancelCreate = document.getElementById('cancelCreate');
const confirmCreate = document.getElementById('confirmCreate');
const cancelJoin = document.getElementById('cancelJoin');
const confirmJoin = document.getElementById('confirmJoin');
const roomCodeInput = document.getElementById('roomCodeInput');
const sharedCode = document.getElementById('sharedCode');
const copyCode = document.getElementById('copyCode');
const enterGame = document.getElementById('enterGame');
const leaveBtn = document.getElementById('leaveBtn');
const respawnBtn = document.getElementById('respawnBtn');

// État
let myId = null;
let roomId = null;
let worldSize = 2500;
let maxHp = 100;
let gameState = { players: {}, bullets: [], obstacles: [], zone: null };
const camera = { x: 0, y: 0 };
const input = { up: false, down: false, left: false, right: false, shoot: false };
const mouse = { x: 0, y: 0, screenX: 0, screenY: 0 };
let dead = false;
let inGame = false;

// Paramètres
const settings = {
  sfxVolume: 0.7,
  musicVolume: 0.5,
  showGrid: true,
  showPseudos: true,
  tankColor: '#00aaff'
};

// ===== ÉCRAN DE DÉMARRAGE =====
setTimeout(() => {
  splash.classList.add('fadeout');
  setTimeout(() => {
    splash.classList.add('hidden');
    mainMenu.classList.remove('hidden');
  }, 800);
}, 3200);

// ===== MENU PRINCIPAL =====
btnPlay.onclick = () => {
  mainMenu.classList.add('hidden');
  playMenu.classList.remove('hidden');
  socket.emit('getRooms');
};

btnSettings.onclick = () => {
  mainMenu.classList.add('hidden');
  settingsMenu.classList.remove('hidden');
};

btnSoon.onclick = () => {
  alert('✨ Bientôt disponible !');
};

backToMain.onclick = () => {
  playMenu.classList.add('hidden');
  mainMenu.classList.remove('hidden');
};

backFromSettings.onclick = () => {
  settingsMenu.classList.add('hidden');
  mainMenu.classList.remove('hidden');
};

// ===== PARAMÈTRES =====
document.getElementById('sfxVolume').oninput = e => settings.sfxVolume = e.target.value / 100;
document.getElementById('musicVolume').oninput = e => settings.musicVolume = e.target.value / 100;
document.getElementById('showGrid').onchange = e => settings.showGrid = e.target.checked;
document.getElementById('showPseudos').onchange = e => settings.showPseudos = e.target.checked;
document.getElementById('tankColor').oninput = e => settings.tankColor = e.target.value;

// ===== SALLE : CRÉER =====
btnCreateRoom.onclick = () => {
  if (!pseudoInput.value.trim()) return alert('Choisis un pseudo !');
  createModal.classList.remove('hidden');
};
cancelCreate.onclick = () => createModal.classList.add('hidden');

confirmCreate.onclick = () => {
  const isPrivate = document.querySelector('input[name="roomType"]:checked').value === 'private';
  const pseudo = pseudoInput.value.trim();

  socket.emit('createRoom', { isPrivate, pseudo }, (res) => {
    if (res.error) return alert(res.error);
    createModal.classList.add('hidden');

    if (isPrivate) {
      sharedCode.textContent = res.roomId;
      shareModal.classList.remove('hidden');
    } else {
      startGame(res);
    }
  });
};

// ===== SALLE : REJOINDRE =====
btnJoinRoom.onclick = () => {
  if (!pseudoInput.value.trim()) return alert('Choisis un pseudo !');
  joinModal.classList.remove('hidden');
  roomCodeInput.focus();
};
cancelJoin.onclick = () => joinModal.classList.add('hidden');
roomCodeInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmJoin.click();
});

confirmJoin.onclick = () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  if (!code) return alert('Entre un code de salle');
  const pseudo = pseudoInput.value.trim();

  socket.emit('joinRoom', { roomId: code, pseudo }, (res) => {
    if (res.error) return alert(res.error);
    joinModal.classList.add('hidden');
    startGame(res);
  });
};

// ===== REJOINDRE DEPUIS LA LISTE PUBLIQUE =====
function joinPublicRoom(id) {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) return alert('Choisis un pseudo !');
  socket.emit('joinRoom', { roomId: id, pseudo }, (res) => {
    if (res.error) return alert(res.error);
    startGame(res);
  });
}

// ===== COPIER LE CODE =====
copyCode.onclick = () => {
  navigator.clipboard.writeText(sharedCode.textContent);
  copyCode.textContent = '✅ COPIÉ !';
  setTimeout(() => copyCode.textContent = '📋 COPIER LE CODE', 1500);
};

enterGame.onclick = () => {
  shareModal.classList.add('hidden');
  startGame({ roomId: sharedCode.textContent, worldSize, maxHp });
};

// ===== DÉMARRER LE JEU =====
function startGame(res) {
  roomId = res.roomId;
  worldSize = res.worldSize || 2500;
  maxHp = res.maxHp || 100;
  inGame = true;

  playMenu.classList.add('hidden');
  mainMenu.classList.add('hidden');
  settingsMenu.classList.add('hidden');
  canvas.classList.remove('hidden');
  hud.classList.remove('hidden');
  roomIdDisplay.textContent = roomId;
}

// ===== QUITTER LA PARTIE =====
leaveBtn.onclick = () => {
  if (!confirm('Quitter la partie ?')) return;
  socket.emit('leaveRoom', roomId);
  inGame = false;
  canvas.classList.add('hidden');
  hud.classList.add('hidden');
  deathScreen.classList.add('hidden');
  winScreen.classList.add('hidden');
  playMenu.classList.remove('hidden');
  socket.emit('getRooms');
};

respawnBtn.onclick = () => {
  socket.emit('respawn', roomId);
  deathScreen.classList.add('hidden');
  dead = false;
};

// ===== LISTE DES SALLES =====
socket.on('roomsList', (rooms) => {
  if (rooms.length === 0) {
    roomsList.innerHTML = '<p class="empty">Aucune salle publique. Crée la tienne !</p>';
    return;
  }
  roomsList.innerHTML = rooms.map(r => `
    <div class="room-item" data-id="${r.id}">
      <span class="room-name">${r.name}</span>
      <span class="room-players">👥 ${r.players}/${r.maxPlayers}</span>
    </div>
  `).join('');

  document.querySelectorAll('.room-item').forEach(el => {
    el.onclick = () => joinPublicRoom(el.dataset.id);
  });
});

btnRefreshRooms.onclick = () => socket.emit('getRooms');
setInterval(() => { if (!inGame && !playMenu.classList.contains('hidden')) socket.emit('getRooms'); }, 3000);

// ===== CANVAS =====
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ===== CONTRÔLES =====
document.addEventListener('keydown', (e) => {
  if (!inGame) return;
  const k = e.key.toLowerCase();
  if (k === 'arrowup' || k === 'z' || k === 'w') input.up = true;
  if (k === 'arrowdown' || k === 's') input.down = true;
  if (k === 'arrowleft' || k === 'q' || k === 'a') input.left = true;
  if (k === 'arrowright' || k === 'd') input.right = true;
  if (k === ' ') { input.shoot = true; e.preventDefault(); }
  socket.emit('input', { roomId, input });
});

document.addEventListener('keyup', (e) => {
  if (!inGame) return;
  const k = e.key.toLowerCase();
  if (k === 'arrowup' || k === 'z' || k === 'w') input.up = false;
  if (k === 'arrowdown' || k === 's') input.down = false;
  if (k === 'arrowleft' || k === 'q' || k === 'a') input.left = false;
  if (k === 'arrowright' || k === 'd') input.right = false;
  if (k === ' ') input.shoot = false;
  socket.emit('input', { roomId, input });
});

document.addEventListener('mousedown', (e) => {
  if (e.button === 0 && inGame) {
    input.shoot = true;
    socket.emit('input', { roomId, input });
  }
});
document.addEventListener('mouseup', () => {
  if (!inGame) return;
  input.shoot = false;
  socket.emit('input', { roomId, input });
});
document.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousemove', (e) => {
  mouse.screenX = e.clientX;
  mouse.screenY = e.clientY;
});

// ===== SOCKET EVENTS =====
socket.on('init', (data) => {
  myId = data.id;
  worldSize = data.worldSize;
  maxHp = data.maxHp;
});

let lastZoneState = 'in';

socket.on('state', (state) => {
  gameState = state;

  const me = state.players[myId];
  if (me) {
    const hpPct = Math.max(0, me.hp / maxHp) * 100;
    hpFill.style.width = hpPct + '%';
    hpText.textContent = `${Math.round(me.hp)} HP`;
    if (hpPct > 60) hpFill.style.background = 'linear-gradient(90deg, #00e5ff, #0066ff)';
    else if (hpPct > 30) hpFill.style.background = 'linear-gradient(90deg, #ffaa00, #ff8800)';
    else hpFill.style.background = 'linear-gradient(90deg, #ff0055, #ff0000)';

    killsEl.textContent = `🎯 ${me.kills} kills`;
    aliveEl.textContent = `👥 ${state.aliveCount} / ${state.totalCount}`;

    if (!me.alive && !dead) {
      dead = true;
      deathScreen.classList.remove('hidden');
    }

    // ─── SYSTÈME DE POPUP ZONE ───
    const dx = me.x - state.zone.x;
    const dy = me.y - state.zone.y;
    const distFromCenter = Math.hypot(dx, dy);
    const distToEdge = state.zone.radius - distFromCenter; // positif = dans la zone

    let zoneState;
    if (distToEdge < -100) zoneState = 'danger';        // loin dehors
    else if (distToEdge < 0) zoneState = 'outside';     // dehors
    else if (distToEdge < 150) zoneState = 'warning';   // proche du bord
    else zoneState = 'in';

    if (zoneState !== lastZoneState) {
      lastZoneState = zoneState;
      showZonePopup(zoneState);
    }
  }

  updateLeaderboard(state.players);
});

function showZonePopup(state) {
  zonePopup.classList.remove('hidden', 'warning', 'danger');
  if (state === 'in') {
    zonePopup.classList.add('hidden');
    return;
  }
  if (state === 'warning') {
    zonePopup.classList.add('warning');
    zonePopupIcon.textContent = '⚠️';
    zonePopupText.textContent = 'ZONE PROCHE';
  } else if (state === 'outside') {
    zonePopup.classList.add('warning');
    zonePopupIcon.textContent = '🔥';
    zonePopupText.textContent = 'HORS ZONE — REPARS EN VITESSE !';
  } else if (state === 'danger') {
    zonePopup.classList.add('danger');
    zonePopupIcon.textContent = '☠️';
    zonePopupText.textContent = 'DÉGÂTS MASSIFS — REVIENS !';
  }
  // Auto-hide après 2.5s si warning
  if (state === 'warning') {
    setTimeout(() => {
      if (lastZoneState === 'warning') zonePopup.classList.add('hidden');
    }, 2500);
  }
}

socket.on('killfeed', (data) => {
  const div = document.createElement('div');
  div.className = 'killfeed-item';
  div.innerHTML = `💀 <b>${data.killer}</b> a éliminé <b>${data.victim}</b>`;
  killfeed.appendChild(div);
  setTimeout(() => div.remove(), 5000);
  while (killfeed.children.length > 5) killfeed.removeChild(killfeed.firstChild);
});

socket.on('roundEnd', (data) => {
  winnerName.textContent = `🏆 ${data.winner} remporte la manche !`;
  winScreen.classList.remove('hidden');
});

socket.on('roundStart', () => {
  winScreen.classList.add('hidden');
  deathScreen.classList.add('hidden');
  dead = false;
});

// ===== LEADERBOARD =====
function updateLeaderboard(players) {
  const sorted = Object.values(players).sort((a, b) => {
    if (a.alive !== b.alive) return b.alive - a.alive;
    if (b.kills !== a.kills) return b.kills - a.kills;
    return b.hp - a.hp;
  }).slice(0, 6);

  lbList.innerHTML = sorted.map(p => {
    const me = p.id === myId ? 'me' : '';
    const deadCls = p.alive ? '' : 'dead';
    return `<li class="${deadCls} ${me}">
      <span>${p.alive ? '🟢' : '💀'} ${p.pseudo}</span>
      <span>${p.kills} 🎯</span>
    </li>`;
  }).join('');
}

// ===== RENDU =====
function draw() {
  requestAnimationFrame(draw);

  if (!inGame) return;
  const me = gameState.players[myId];

  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!me || !gameState.zone) return;

  camera.x = me.x - canvas.width / 2;
  camera.y = me.y - canvas.height / 2;

  mouse.x = mouse.screenX + camera.x;
  mouse.y = mouse.screenY + camera.y;
  socket.emit('mouse', { roomId, mouse });

  // Grille
  if (settings.showGrid) {
    ctx.strokeStyle = 'rgba(0, 170, 255, 0.06)';
    ctx.lineWidth = 1;
    const gs = 80;
    const startX = Math.floor(camera.x / gs) * gs;
    const startY = Math.floor(camera.y / gs) * gs;
    for (let x = startX; x < camera.x + canvas.width; x += gs) {
      ctx.beginPath();
      ctx.moveTo(x - camera.x, 0);
      ctx.lineTo(x - camera.x, canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y < camera.y + canvas.height; y += gs) {
      ctx.beginPath();
      ctx.moveTo(0, y - camera.y);
      ctx.lineTo(canvas.width, y - camera.y);
      ctx.stroke();
    }
  }

  // Zone
  const z = gameState.zone;
  const zx = z.x - camera.x;
  const zy = z.y - camera.y;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 80, 0.15)';
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.arc(zx, zy, z.radius, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.strokeStyle = z.shrinking ? '#ff0055' : '#00e5ff';
  ctx.lineWidth = 4;
  ctx.setLineDash([15, 10]);
  ctx.arc(zx, zy, z.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.strokeStyle = z.shrinking ? 'rgba(255,0,85,0.3)' : 'rgba(0,229,255,0.3)';
  ctx.lineWidth = 20;
  ctx.arc(zx, zy, z.radius, 0, Math.PI * 2);
  ctx.stroke();

  // Obstacles
  for (const o of gameState.obstacles) {
    const ox = o.x - camera.x;
    const oy = o.y - camera.y;
    if (ox + o.w < 0 || oy + o.h < 0 || ox > canvas.width || oy > canvas.height) continue;

    ctx.fillStyle = '#0d1a3a';
    ctx.fillRect(ox, oy, o.w, o.h);
    ctx.strokeStyle = 'rgba(0, 170, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, o.w, o.h);

    ctx.fillStyle = 'rgba(0, 229, 255, 0.1)';
    ctx.fillRect(ox + 4, oy + 4, o.w - 8, 4);
  }

  // Balles
  for (const b of gameState.bullets) {
    const bx = b.x - camera.x;
    const by = b.y - camera.y;
    if (bx < -20 || by < -20 || bx > canvas.width + 20 || by > canvas.height + 20) continue;

    ctx.beginPath();
    ctx.fillStyle = '#00e5ff';
    ctx.globalAlpha = 0.3;
    ctx.arc(bx - b.vx * 1.5, by - b.vy * 1.5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 15;
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Tanks
  for (const id in gameState.players) {
    const p = gameState.players[id];
    if (!p.alive) continue;

    const px = p.x - camera.x;
    const py = p.y - camera.y;
    if (px < -50 || py < -50 || px > canvas.width + 50 || py > canvas.height + 50) continue;

    drawTank(px, py, p, id === myId);
  }
}

function drawTank(x, y, p, isMe) {
  const r = 22;
  const color = isMe ? settings.tankColor : p.color;

  ctx.beginPath();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.arc(x + 3, y + 3, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.angle);

  ctx.fillStyle = '#050510';
  ctx.fillRect(-r, -r - 3, r * 2, 8);
  ctx.fillRect(-r, r - 5, r * 2, 8);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isMe ? '#fff' : 'rgba(0, 229, 255, 0.6)';
  ctx.lineWidth = isMe ? 3 : 2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-r + 4, -r + 8, r * 2 - 8, 4);

  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.turretAngle);

  ctx.fillStyle = '#111';
  ctx.fillRect(0, -5, r + 14, 10);
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(0, -4, r + 14, 3);

  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();

  if (settings.showPseudos) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(p.pseudo, x, y - r - 8);
    ctx.fillText(p.pseudo, x, y - r - 8);
  }

  const hpW = 44;
  const hpPct = Math.max(0, p.hp / 100);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - hpW / 2, y - r - 22, hpW, 5);
  ctx.fillStyle = hpPct > 0.5 ? '#00e5ff' : hpPct > 0.25 ? '#ffaa00' : '#ff0055';
  ctx.fillRect(x - hpW / 2, y - r - 22, hpW * hpPct, 5);

  if (isMe) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.arc(x, y, r + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

draw();