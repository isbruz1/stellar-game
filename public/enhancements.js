/* Stellar V11: outils de salon et préférences locales. */
const preferenceKey = 'stellar-preferences';
let preferences;
try { preferences = JSON.parse(localStorage.getItem(preferenceKey)) || {}; } catch { preferences = {}; }
const toast = document.createElement('div');
toast.className = 'stellar-toast hidden'; toast.setAttribute('role', 'status'); document.body.append(toast);
let toastTimer;
function notifyPlayer(message) { toast.textContent = message; toast.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.add('hidden'), 4000); }
function applyPreferences() {
  document.body.classList.toggle('reduced-motion', !!preferences.motion);
  document.body.classList.toggle('compact-hud', !!preferences.compact);
}
applyPreferences();
const connectionBadge = document.createElement('div'); connectionBadge.className = 'connection-badge'; connectionBadge.setAttribute('role', 'status'); document.body.append(connectionBadge);
socket.on('connect', () => { connectionBadge.textContent = '● En ligne'; });
socket.on('disconnect', () => { connectionBadge.textContent = '○ Reconnexion…'; resetControls(); });
socket.on('connect_error', () => { connectionBadge.textContent = '○ Serveur indisponible'; });
connectionBadge.textContent = socket.connected ? '● En ligne' : 'Connexion…';
setInterval(() => {
  if (!socket.connected || document.hidden) return;
  const start = performance.now(); socket.timeout(3000).emit('ping-check', error => {
    connectionBadge.textContent = error ? '○ Connexion lente' : `● ${Math.round(performance.now() - start)} ms`;
  });
}, 5000);
function resetControls() {
  Object.keys(keys).forEach(key => keys[key] = false);
  moveJoyState.active = aimJoyState.active = false;
  moveJoyState.touchId = aimJoyState.touchId = null;
  resetKnob(moveKnob); resetKnob(aimKnob);
  moveJoystick.classList.remove('active'); aimJoystick.classList.remove('active');
  if (socket.connected) socket.emit('input', { keys, angle: myAngle });
  holdingFire = false;
}
window.addEventListener('blur', resetControls);
document.addEventListener('visibilitychange', () => { if (document.hidden) resetControls(); });
let holdingFire = false;
canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) holdingFire = true; });
window.addEventListener('pointerup', () => holdingFire = false);
window.addEventListener('pointercancel', resetControls);
setInterval(() => { if (holdingFire && gameStarted && !dead && socket.connected) socket.emit('shoot', { angle: myAngle }); }, 360);

const tools = document.createElement('div'); tools.className = 'lobby-tools';
tools.innerHTML = '<button id="inviteFriend" class="icon-btn wide">Inviter un ami</button><button id="openPreferences" class="icon-btn wide">⚙ Réglages</button>';
document.querySelector('#lobbyScreen .top-actions').append(tools);
const menuSettings = document.createElement('button'); menuSettings.className = 'icon-btn'; menuSettings.textContent = '⚙'; menuSettings.title = 'Réglages et sauvegarde'; document.querySelector('#mainMenuScreen .top-actions').prepend(menuSettings);
const panel = document.createElement('div'); panel.className = 'modal hidden';
panel.innerHTML = `<div class="modal-content preferences-panel" role="dialog" aria-modal="true" aria-label="Réglages"><h2>TON POSTE DE PILOTAGE</h2><label><input type="checkbox" id="prefSound"> Sons de combat</label><label><input type="checkbox" id="prefMotion"> Réduire les animations</label><label><input type="checkbox" id="prefCompact"> Interface de jeu compacte</label><p id="pilotStats"></p><button id="exportProfiles" class="btn btn-yellow">SAUVEGARDER MES PROFILS</button><label class="backup-label">Restaurer une sauvegarde<input id="importProfiles" type="file" accept="application/json,.json"></label><p class="muted">Les profils et statistiques sont enregistrés sur cet appareil. Garde une sauvegarde avant une réinitialisation.</p><button id="closePreferences" class="btn btn-green">FERMER</button></div>`;
document.body.append(panel);
function openPreferences() {
  panel.classList.remove('hidden');
  $('prefSound').checked = !!preferences.sound; $('prefMotion').checked = !!preferences.motion; $('prefCompact').checked = !!preferences.compact;
  const stats = readStats(); $('pilotStats').textContent = `${stats.matches} parties · ${stats.wins} victoires · ${stats.kills} éliminations (cet appareil)`;
  $('closePreferences').focus();
}
menuSettings.onclick = $('openPreferences').onclick = openPreferences;
const profileSettings = menuSettings.cloneNode(true); profileSettings.onclick = openPreferences; document.querySelector('.profiles-footer').append(profileSettings);
$('closePreferences').onclick = () => panel.classList.add('hidden');
panel.addEventListener('click', e => { if (e.target === panel) panel.classList.add('hidden'); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') panel.classList.add('hidden'); });
for (const [id, name] of [['prefSound','sound'],['prefMotion','motion'],['prefCompact','compact']]) $(id).onchange = e => {
  preferences[name] = e.target.checked; localStorage.setItem(preferenceKey, JSON.stringify(preferences)); applyPreferences();
};
$('exportProfiles').onclick = () => {
  const blob = new Blob([JSON.stringify({ version: 1, accounts: loadAccounts(), stats: readStats() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'stellar-profils.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('importProfiles').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    if (file.size > 100000) throw new Error('Fichier trop volumineux.');
    const backup = JSON.parse(await file.text());
    if (backup.version !== 1 || !Array.isArray(backup.accounts) || backup.accounts.length > 100) throw new Error('Sauvegarde invalide.');
    const restored = backup.accounts.map(a => {
      if (typeof a.pseudo !== 'string' || a.pseudo.trim().length < 5 || a.pseudo.length > 16 || typeof a.realName !== 'string' || a.realName.length > 32 || !Number.isInteger(a.skin) || a.skin < 0 || a.skin >= SKINS.length) throw new Error('Profil invalide.');
      return { pseudo: a.pseudo.trim(), realName: a.realName, skin: a.skin };
    });
    const merged = loadAccounts(); let added = 0;
    for (const a of restored) if (!merged.some(existing => existing.pseudo.toLowerCase() === a.pseudo.toLowerCase())) { merged.push(a); added++; }
    saveAccounts(merged); accounts = merged; renderAccounts(); notifyPlayer(`${added} profil(s) restauré(s).`);
  } catch (error) { notifyPlayer(error.message); }
  e.target.value = '';
};
$('inviteFriend').onclick = async () => {
  const url = new URL(location.href); url.searchParams.set('room', currentRoomId);
  try { await navigator.clipboard.writeText(url.href); notifyPlayer('Lien copié ! Envoie-le à ton ami.'); }
  catch { prompt('Copie ce lien pour inviter ton ami :', url.href); }
};
const invitedRoom = new URL(location.href).searchParams.get('room');
if (invitedRoom && /^[A-Z0-9]{5}$/.test(invitedRoom)) { codeInput.value = invitedRoom; notifyPlayer('Invitation reçue : choisis ton profil puis rejoins le serveur avec le code prérempli.'); }
const chat = document.createElement('section'); chat.className = 'lobby-chat';
chat.innerHTML = '<h3>CHAT DU SALON</h3><div id="chatMessages" role="log" aria-live="polite"></div><form id="chatForm"><input id="chatText" maxlength="180" placeholder="Écris à ton équipe…" aria-label="Message"><button class="icon-btn wide" type="submit">Envoyer</button></form>';
document.querySelector('#lobbyScreen .lobby-content').append(chat);
$('chatForm').onsubmit = e => { e.preventDefault(); const text = $('chatText').value.trim(); if (text && socket.connected) { socket.emit('chat-message', text); $('chatText').value = ''; } };
socket.on('room-joined', () => $('chatMessages').replaceChildren());
socket.on('chat-message', data => {
  const line = document.createElement('p'); line.textContent = `${data.pseudo} : ${data.text}`; $('chatMessages').append(line);
  while ($('chatMessages').children.length > 50) $('chatMessages').firstChild.remove();
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
});
function readStats() { try { const s = JSON.parse(localStorage.getItem('stellar-stats')) || {}; return { matches: Number(s.matches) || 0, wins: Number(s.wins) || 0, kills: Number(s.kills) || 0 }; } catch { return { matches: 0, wins: 0, kills: 0 }; } }
function recordStat(key) { const stats = readStats(); stats[key]++; localStorage.setItem('stellar-stats', JSON.stringify(stats)); }
socket.on('game-started', () => recordStat('matches'));
socket.on('victory', data => { if (data.winnerId === myId) recordStat('wins'); });
socket.on('elimination', data => { notifyPlayer(`${data.attacker} a éliminé ${data.victim}`); if (data.attackerId === myId) recordStat("kills"); });
let audioContext;
document.addEventListener('pointerdown', () => { if (preferences.sound) { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume().catch(() => {}); } });
socket.on('hit', data => {
  if (!preferences.sound || !audioContext || (data.attackerId !== myId && data.targetId !== myId)) return;
  const osc = audioContext.createOscillator(), gain = audioContext.createGain(); osc.connect(gain); gain.connect(audioContext.destination);
  osc.frequency.value = data.targetId === myId ? 140 : 650; gain.gain.setValueAtTime(0.06, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1); osc.start(); osc.stop(audioContext.currentTime + 0.1);
});
